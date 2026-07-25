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
  body: JSON.stringify({ senha }),
});
```

Resposta:

```json
{ "autenticado": true }
```

Erros: `401` para senha inválida; `500` se a autenticação não estiver configurada na API.

### Sessão

```ts
const sessao = await api("/admin/auth/sessao");
// { autenticado: true | false }
```

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

### Pedidos paginados

```ts
const pedidos = await api(
  "/admin/dashboard/pedidos?nomeEvento=Juntos%20Rumo%20ao%20C%C3%A9u&status=APROVADO&pagina=1&limite=20"
);
```

Filtros opcionais:

```txt
nomeEvento
lote
status: PENDENTE | APROVADO | REJEITADO | CANCELADO
busca: nome, CPF, e-mail ou código do pedido
dataInicio: ISO 8601
dataFim: ISO 8601
pagina: padrão 1
limite: padrão 20, máximo 100
```

Resposta:

```json
{
  "pagina": 1,
  "limite": 20,
  "total": 1,
  "totalPaginas": 1,
  "pedidos": []
}
```

Cada pedido inclui número de inscrição, status, participante, e-mail, CPF, contato, evento, lote, categoria, valores, data de compra e data de envio do comprovante.

## Relatórios

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

## Regras visuais recomendadas

- Validar sessão antes de abrir o dashboard; se `autenticado` for `false`, mostrar login.
- Usar TanStack Query e atualizar resumo/eventos a cada 30 segundos.
- Exibir valores com `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`.
- Tratar `401` redirecionando para a tela de login.
- Não exibir tokens ou credenciais no navegador.
