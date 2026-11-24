# Integração do painel administrativo React

Este documento é para o projeto React do painel. O painel consome esta API; ele **não** deve acessar o Supabase diretamente.

## Variável do React

No `.env` do projeto React:

```env
VITE_API_URL=https://sua-api.onrender.com
```

Não use no React `DATABASE_URL`, `DIRECT_URL`, `MP_ACCESS_TOKEN`, `EMAIL_PASSWORD`, `EVENTOS_ADMIN_TOKEN` ou `REEMBOLSO_ADMIN_TOKEN`.

## Variáveis da API

Configure no ambiente desta API:

```env
FRONTEND_URL=https://site-publico.com
ADMIN_FRONTEND_URL=https://painel.seudominio.com
ADMIN_PASSWORD=uma_senha_forte
ADMIN_SECRET_KEY=um_segredo_longo_e_aleatorio
ADMIN_AUTH_ENABLED=true
```

`ADMIN_FRONTEND_URL` deve ser a origem exata do projeto React, sem barra no final. Em produção, a sessão usa cookie `HttpOnly`, `Secure` e `SameSite=None`.

## Requisições

Use `credentials: "include"` em todas as chamadas, pois a sessão administrativa fica em cookie.

```ts
const apiUrl = import.meta.env.VITE_API_URL;

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.erro ?? "Erro ao consultar a API.");
  return body;
}
```

## Autenticação

### Login

```ts
await api("/admin/auth/login", {
  method: "POST",
  body: JSON.stringify({ password: senha }),
});
```

Resposta:

```json
{ "authenticated": true, "expiresAt": "2026-07-27T20:00:00.000Z" }
```

Erros: `401` para senha inválida; `500` se a autenticação não estiver configurada na API.

### Sessão

```ts
const sessao = await api("/admin/auth/session");
// { authenticated: true, expiresAt: "..." }
```

Sem uma sessão válida, a rota retorna `401` com
`{ "authenticated": false, "erro": "Sessão administrativa inválida ou expirada." }`.
O caminho legado `/admin/auth/sessao` continua disponível.

### Logout

```ts
await api("/admin/auth/logout", { method: "POST" });
```

As sessões expiram em 8 horas. As rotas do dashboard retornam `401` caso não exista sessão válida.

## Dashboard

### Eventos

```ts
const { eventos } = await api("/admin/dashboard/eventos");
```

Resposta:

```json
{
  "eventos": [
    {
      "nomeEvento": "Juntos Rumo ao Céu",
      "distancias": ["5km"],
      "totalLotes": 2,
      "lotesAtivos": 2
    }
  ]
}
```

### Resumo e métricas

```ts
const params = new URLSearchParams({
  nomeEvento: "Juntos Rumo ao Céu",
  dataInicio: "2026-07-01T00:00:00.000Z",
  dataFim: "2026-07-31T23:59:59.999Z",
});
const resumo = await api(`/admin/dashboard/resumo?${params}`);
```

Filtros opcionais: `nomeEvento`, `dataInicio` e `dataFim` em ISO 8601. O período considera a data de criação do pedido.

`resumo.resumo` contém:

```txt
inscricoesAprovadas
pedidosPendentes
pedidosRejeitados
pedidosCancelados
valorArrecadado
valorInscricoes
valorTaxas
ticketMedio
```

`resumo.lotes` combina capacidade/vagas atuais com vendas e valores do período selecionado. Os campos do período terminam em `Periodo`, por exemplo `vendasAprovadasPeriodo` e `valorArrecadadoPeriodo`.

`resumo.distanciasSelecionadas` lista as distâncias escolhidas nos pedidos aprovados, usando o mesmo valor salvo no comprovante. Cada item contém `nomeEvento` e `distancia` (por exemplo, `{ nomeEvento: "Corrida", distancia: "3.5KM" }`). A lista respeita os filtros de evento e período.

### Inscrições paginadas

```ts
const pedidos = await api(
  "/admin/inscricoes?nomeEvento=Juntos%20Rumo%20ao%20C%C3%A9u&status=APROVADO&pagina=1&limite=100"
);
```

O caminho legado `/admin/dashboard/pedidos` continua disponível.

Filtros opcionais:

```txt
nomeEvento
lote
equipe
numeroCamisa
numeroInscricao
status: PENDENTE | APROVADO | REJEITADO | CANCELADO
busca: nome, e-mail, equipe ou código do pedido
dataInicio: data `YYYY-MM-DD` ou ISO 8601 (aplicada desde o início do dia)
dataFim: data `YYYY-MM-DD` ou ISO 8601 (aplicada até o fim do dia)
pagina: padrão 1
limite: padrão 20, máximo 100
```

Resposta:

```json
{
  "pagina": 1,
  "limite": 100,
  "total": 1,
  "totalPaginas": 1,
  "pedidos": []
}
```

Para consultar mais de 100 registros, incremente `pagina` até `totalPaginas`.
Cada pedido inclui número de inscrição, status, participante, e-mail, contato, evento,
distância, lote, categoria, equipe, tamanho/cor de camisa, valores, data de compra e
data de envio do comprovante. CPF e outros dados sensíveis não são retornados.

## Relatórios

As rotas de PDF exigem a mesma sessão administrativa por cookie usada pelo painel.
Sem uma sessão válida, a API responde `401`.

Baixar PDF de evento:

```ts
window.open(`${apiUrl}/relatorio/${encodeURIComponent(nomeEvento)}/pdf`, "_blank");
```

Baixar PDF de lote:

```ts
window.open(
  `${apiUrl}/relatorio/${encodeURIComponent(nomeEvento)}/lote/${encodeURIComponent(lote)}/pdf`,
  "_blank"
);
```

## Cupons de desconto

O painel pode cadastrar cupons sem acessar o banco. Todas estas rotas usam a
sessão administrativa por cookie (`credentials: "include"`).

### Corridas disponíveis

```ts
const { corridas } = await api<string[]>("/admin/cupons/corridas");
```

Use a lista em um campo de seleção. Ela inclui eventos com lotes cadastrados.

### Listar cupons

```ts
const { cupons } = await api<{ cupons: Cupom[] }>("/admin/cupons");
```

### Criar cupom

```ts
await api("/admin/cupons", {
  method: "POST",
  body: JSON.stringify({
    codigo: "CORRE10",
    nomeEvento: "Corrida 1KM 2026",
    desconto: 10,
    limiteUsos: 100, // opcional; null remove o limite
    validadeAte: "2026-12-31T23:59:59-03:00", // ISO 8601 opcional; null remove a validade
  }),
});
```

O desconto é um valor fixo em reais; se superar o valor da inscrição, ele é
limitado ao valor da inscrição. `limiteUsos` deve ser um inteiro positivo ou
`null`; `validadeAte` deve ser uma data ISO 8601 com fuso (`Z` ou offset) ou
`null`. A validade é comparada pelo instante representado no fuso enviado. O
código aceita letras, números, hífen e sublinhado (3 a 40 caracteres) e é salvo
em maiúsculas. Para editar, envie também `id` no mesmo endpoint; omitir ou enviar
`null` remove cada limite opcional. O limite editado não pode ficar abaixo dos
usos já consumidos. Para ativar/desativar, use:

```ts
await api(`/admin/cupons/${id}/ativo`, {
  method: "PATCH",
  body: JSON.stringify({ ativo: false }),
});
```

Tipos mínimos para a interface:

```ts
type Cupom = {
  id: string;
  codigo: string;
  nomeEvento: string;
  desconto: number;
  limiteUsos: number | null;
  validadeAte: string | null;
  usos: number;
  ativo: boolean;
  criadoEm: string;
};
```

No formulário de inscrição, envie o código informado pelo cliente como campo
opcional `cupom` no `POST /checkout`. A API valida se existe, está ativo e
pertence ao evento escolhido; preços e desconto são calculados no servidor.
Pedidos retornam `codigoCupom` e `descontoCupom` na listagem admin. `usos` conta
somente pedidos `APROVADO`; pendentes, rejeitados e cancelados não consomem uso.
O webhook confirma a aprovação e valida o limite dentro de uma transação
serializada pelo código do cupom, de modo que compras simultâneas não ultrapassem
o limite. Pedidos antigos continuam sem limite e sem validade.

Para validar o código antes de criar o pedido, o site pode chamar a rota pública
`POST /cupons/validar` com `kitId`, `categoria` (`MASCULINO`, `FEMININO`,
`MAIOR_60`, `LGBTQIA` ou `PCD`) e `cupom`. A resposta inclui `codigoCupom`,
`valorIngresso`, `descontoCupom`, `taxaServico` e `total`. Essa chamada não cria
pedido nem reserva o cupom; o `POST /checkout` valida novamente ao concluir a
compra e retorna `codigoCupom`, `descontoCupom` e `total` aplicados.

Exemplo copiável para usar na área do checkout do frontend:

```ts
type CupomValidado = {
  codigoCupom: string;
  valorIngresso: number;
  descontoCupom: number;
  taxaServico: number;
  total: number;
};

async function validarCupomNoCheckout(params: {
  kitId: string;
  categoria: "MASCULINO" | "FEMININO" | "MAIOR_60" | "LGBTQIA" | "PCD";
  cupom: string;
}): Promise<CupomValidado> {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/cupons/validar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.erro ?? "Não foi possível validar o cupom.");
  return body as CupomValidado;
}

// Ao clicar em “Aplicar cupom” na tela:
const validacao = await validarCupomNoCheckout({ kitId, categoria, cupom });
setCupomAplicado(validacao);

// Exibir na tela (valores retornados pela API):
// validacao.valorIngresso, validacao.descontoCupom,
// validacao.taxaServico e validacao.total

// No envio final do checkout, incluir o mesmo código no payload:
const pedido = await api("/checkout", {
  method: "POST",
  body: JSON.stringify({ ...dadosParticipante, kitId, categoria, cupom: validacao.codigoCupom }),
});
```

Limpe `cupomAplicado` se o usuário trocar o lote (`kitId`), categoria ou o
código. A tela deve exibir os valores da resposta da API e tratar `body.erro`
quando a validação retornar `400` (inativo, expirado, limite esgotado ou corrida
incorreta). O checkout valida novamente, pois a disponibilidade pode mudar entre
a validação e o envio do pedido.

O componente React independente [`CupomCheckout.tsx`](./CupomCheckout.tsx)
renderiza o campo de código, botão **Aplicar**, mensagens de erro e resumo do
desconto/total retornado pela API. Coloque o componente dentro da área do
checkout e encaminhe o código validado ao payload final:

```tsx
const [cupomAplicado, setCupomAplicado] = useState<CupomValidado | null>(null);

<CupomCheckout
  apiUrl={import.meta.env.VITE_API_URL}
  kitId={kitSelecionado.id}
  categoria={categoria}
  onCupomChange={setCupomAplicado}
/>

// Ao montar os dados para POST /checkout:
const payload = {
  ...dadosParticipante,
  kitId: kitSelecionado.id,
  categoria,
  ...(cupomAplicado ? { cupom: cupomAplicado.codigoCupom } : {}),
};
```

O componente invalida o cupom aplicado se o código mudar. Se o lote ou a
categoria puderem mudar na mesma tela, limpe também `cupomAplicado` ao mudar
qualquer um desses campos.

## Regras visuais recomendadas

- Validar sessão antes de abrir o dashboard; em caso de `401`, mostrar login.
- Usar TanStack Query e atualizar resumo/eventos a cada 30 segundos.
- Exibir valores com `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`.
- Tratar `401` redirecionando para a tela de login.
- Não exibir tokens ou credenciais no navegador.
