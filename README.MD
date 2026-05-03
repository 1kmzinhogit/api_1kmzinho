# API 1KM

API Node.js/Express para checkout de inscricoes, Mercado Pago, controle de lotes/vagas, consulta de pedidos, solicitacoes de reembolso e relatorios.

## Instalação

Instale as dependencias:

```bash
npm install
```

Copie o arquivo de exemplo de variaveis:

```bash
cp .env.example .env
```

Gere o Prisma Client:

```bash
npx prisma generate
```

Aplique as migrations em desenvolvimento:

```bash
npx prisma migrate dev
```

Em producao:

```bash
npx prisma migrate deploy
```

## Variáveis

Variaveis principais:

```env
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
MP_ACCESS_TOKEN=APP_USR-...
FRONTEND_URL=https://1kmzinho.com.br
API_PUBLIC_URL=https://api-1kmzinho.onrender.com
PORT=3000
NODE_ENV=production
REEMBOLSO_ADMIN_TOKEN=token-admin
EVENTOS_COM_DATA_ALTERADA=Corrida da Familia 2026,Outro Evento
```

`EVENTOS_COM_DATA_ALTERADA` e opcional. Use nomes separados por virgula. A comparacao ignora acentos e maiusculas/minusculas.

Variaveis antigas de e-mail ainda podem existir, mas o fluxo publico de reembolso nao depende mais de SMTP/Gmail:

```env
EMAIL_USER=
EMAIL_PASSWORD=
EMAIL_DESTINO=
```

## Dados Privados

Nao commite arquivos privados no repositorio.

Arquivos que devem ficar fora do Git:

```txt
.env
service-account.json
private-key.json
*.pem
*.key
```

No Render, use:

- **Environment Variables** para valores como `DATABASE_URL`, `MP_ACCESS_TOKEN`, `FRONTEND_URL` e `REEMBOLSO_ADMIN_TOKEN`.
- **Secret Files** somente para arquivos privados reais, como `.env`, chaves `.json`, `.pem` ou `.key`.

Nao coloque `package.json` em Secret Files. Ele deve ficar no repositorio.

Se precisar criar uma pasta local para dados privados:

```bash
mkdir -p private
```

Exemplo:

```txt
private/service-account.json
private/chave.pem
```

Adicione a pasta ao `.gitignore` antes de usar:

```gitignore
private/
```

## Desenvolvimento

Suba a API local:

```bash
npm run dev
```

URL local:

```txt
http://localhost:3000
```

Healthcheck:

```txt
GET /health
```

## Docker e Render

Subir ou rebuildar localmente:

```bash
docker compose up -d --build
```

Ver logs:

```bash
docker logs api_corrida
```

Parar:

```bash
docker compose down
```

No Render, este projeto usa Docker. O `Dockerfile` aplica migrations antes de iniciar:

```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
```

Portanto, apos o deploy, migrations pendentes sao aplicadas automaticamente antes da API subir.

## Checkout Seguro

`POST /checkout` nao confia em preco, evento, lote, vagas ou itens enviados pelo frontend. O frontend deve enviar somente `kitId` e os dados do participante.

Exemplo:

```json
{
  "kitId": "id-do-config-lote",
  "cpf": "123.456.789-00",
  "contato": "(11) 99999-9999",
  "nomeNaCamisa": "JOAO",
  "dataNascimento": "1990-01-01",
  "nomePessoa": "Joao Silva",
  "corCamisa": "Branca",
  "categoria": "MASCULINO",
  "equipe": "",
  "numeroCamisa": "10"
}
```

O `kitId` e o `id` da tabela `config_lotes`.

O backend busca no banco:

- `nomeEvento`
- `distancia`
- `lote`
- `capacidade`
- preco ativo da categoria em `precos_lote`

O backend monta internamente:

- `valorIngresso`
- `total`
- item do Mercado Pago
- titulo do item
- `unit_price`
- `external_reference`

## Regras de Compra

- O pedido nasce com status `PENDENTE`.
- A compra so vira `APROVADO` quando o webhook do Mercado Pago confirmar pagamento aprovado.
- Uma nova tentativa com mesmo CPF/evento so e bloqueada quando ja existe pedido `APROVADO`.
- Pedidos `PENDENTE`, `REJEITADO` ou `CANCELADO` nao bloqueiam nova tentativa.
- `external_reference` usa o `id` do pedido criado no banco.

## Consulta de Pedidos

Endpoint:

```txt
GET /pedidos/consulta?cpf=12345678900
```

Resposta:

```json
{
  "pedidos": [
    {
      "idPedido": "uuid",
      "codigoPedido": "L1-001",
      "status": "APROVADO",
      "nomeEvento": "Corrida da Familia 2026",
      "lote": "Lote 1",
      "distancia": "1KM",
      "total": 120,
      "criadoEm": "2026-05-01T10:00:00.000Z",
      "dataCompra": "2026-05-01T10:00:00.000Z",
      "emailContato": "cliente@email.com",
      "prazoReembolsoDias": 7,
      "dataLimiteReembolso": "2026-05-08T10:00:00.000Z",
      "eventoComDataAlterada": false,
      "nomePessoa": "Joao S.",
      "permiteSolicitarReembolso": true,
      "motivoIndisponibilidadeReembolso": null
    }
  ]
}
```

## Reembolso

Regras:

- Prazo padrao: ate 7 dias corridos a partir da compra.
- Evento com data alterada: ate 30 dias corridos a partir da compra.
- A API calcula a janela de reembolso e retorna os campos na consulta por CPF.
- O frontend publico registra apenas a solicitacao; o reembolso financeiro e feito pelo admin/Mercado Pago.

Solicitar reembolso no fluxo publico:

```txt
POST /pedidos/:idPedido/solicitar-reembolso
```

Payload:

```json
{
  "cpf": "123.456.789-00",
  "emailContato": "cliente@email.com",
  "observacao": "Opcional"
}
```

Resposta:

```json
{
  "ok": true,
  "idPedido": "uuid",
  "idSolicitacao": "uuid",
  "statusSolicitacao": "PENDENTE",
  "emailContato": "cliente@email.com",
  "mensagem": "Solicitação de reembolso registrada. Nossa equipe fará a análise e entrará em contato pelo e-mail informado."
}
```

Listar solicitacoes no admin:

```txt
GET /reembolsos/solicitacoes?status=PENDENTE
```

Autenticacao:

```txt
Authorization: Bearer <REEMBOLSO_ADMIN_TOKEN>
```

ou:

```txt
x-admin-token: <REEMBOLSO_ADMIN_TOKEN>
```

Atualizar status de uma solicitacao:

```txt
PATCH /reembolsos/solicitacoes/:idSolicitacao
```

Payload:

```json
{
  "status": "PROCESSADO"
}
```

Status aceitos:

```txt
PENDENTE
PROCESSADO
REJEITADO
```

Quando o Mercado Pago enviar webhook com status `refunded`, `charged_back` ou `cancelled`, a API marca o pedido como `CANCELADO` e atualiza solicitacoes `PENDENTE` daquele pedido para `PROCESSADO`.

## Cancelamento e Reembolso Admin

Cancelamento de pagamento pendente:

```txt
POST /pedidos/:idPedido/cancelamento
```

Esse endpoint consulta o pagamento no Mercado Pago e so cancela se o status remoto estiver `pending` ou `in_process`.

Reembolso de pagamento aprovado:

```txt
POST /pedidos/:idPedido/reembolso
```

A API permite apenas reembolso total e respeita a janela de 7/30 dias da regra de negocio.

Ambos exigem:

```txt
Authorization: Bearer <REEMBOLSO_ADMIN_TOKEN>
```

## Regras de Lote e Vagas

- `ConfigLote.capacidade` e o total de vagas do lote.
- `soldSlots` e calculado no backend contando pedidos `APROVADO`.
- `remainingSlots = capacidade - soldSlots`.
- Se `remainingSlots <= 0`, o checkout retorna erro de lote esgotado.
- A criacao do pedido pendente usa transacao serializable e lock por kit para reduzir corrida de concorrencia.
- O frontend pode exibir vagas, mas a API sempre recalcula antes de criar o checkout.

## Webhook Mercado Pago

Endpoint:

```txt
POST /webhooks/mercadopago
```

Fluxo:

1. Mercado Pago chama o webhook.
2. A API busca o pagamento no Mercado Pago.
3. A API localiza o pedido por `external_reference`.
4. A API atualiza o pedido para `APROVADO`, `PENDENTE`, `REJEITADO` ou `CANCELADO`.
5. A API salva/atualiza o registro em `pagamentos` com a resposta raw do Mercado Pago.

Em desenvolvimento, `API_PUBLIC_URL` precisa ser uma URL publica para o Mercado Pago chamar o webhook. Exemplo:

```bash
ngrok http 3000
```

Depois configure:

```env
API_PUBLIC_URL=https://sua-url-publica.ngrok-free.app
```

## Banco de Dados

Modelos principais:

- `Pedido`: inscricao/checkout.
- `ItemPedido`: item persistido do pedido.
- `Pagamento`: retorno bruto e status do Mercado Pago.
- `SolicitacaoReembolso`: solicitacao de reembolso feita pelo cliente.
- `ConfigLote`: evento/lote/capacidade/distancia.
- `PrecoLote`: preco por categoria do lote.

Para cadastrar um novo card/evento no frontend, primeiro cadastre o lote e os precos no banco. O frontend deve usar o `id` de `ConfigLote` como `kitId`.

### Cadastrar nova corrida/lote no Supabase

Sempre que criar uma corrida, card ou lote novo no frontend, cadastre antes o lote e os precos no banco. O backend usa esses dados para impedir manipulacao de preco, evento, lote e vagas pelo frontend.

Exemplo para um card com:

```ts
{
  id: "21km-lote1",
  raceName: "Meia Maratona",
  distance: "21km",
  price: 0.50,
  lot: 1,
  availableSlots: 100
}
```

Rode no Supabase SQL Editor:

```sql
INSERT INTO config_lotes (
  id,
  nome_evento,
  distancia,
  lote,
  capacidade,
  capacidade_atual,
  ativo
)
VALUES (
  '21km-lote1',
  'Meia Maratona',
  '21km',
  'Lote 1',
  100,
  0,
  true
)
ON CONFLICT (id) DO UPDATE SET
  nome_evento = EXCLUDED.nome_evento,
  distancia = EXCLUDED.distancia,
  lote = EXCLUDED.lote,
  capacidade = EXCLUDED.capacidade,
  ativo = EXCLUDED.ativo;

INSERT INTO precos_lote (
  id,
  id_config_lote,
  categoria,
  valor,
  ativo
)
VALUES
  ('21km-lote1-masculino', '21km-lote1', 'MASCULINO', 0.50, true),
  ('21km-lote1-feminino', '21km-lote1', 'FEMININO', 0.50, true),
  ('21km-lote1-maior-60', '21km-lote1', 'MAIOR_60', 0.50, true),
  ('21km-lote1-lgbtqia', '21km-lote1', 'LGBTQIA', 0.50, true)
ON CONFLICT (id_config_lote, categoria) DO UPDATE SET
  valor = EXCLUDED.valor,
  ativo = EXCLUDED.ativo;
```

Depois confira se cadastrou:

```sql
SELECT
  cl.id,
  cl.nome_evento,
  cl.distancia,
  cl.lote,
  cl.capacidade,
  cl.ativo,
  pl.categoria,
  pl.valor,
  pl.ativo AS preco_ativo
FROM config_lotes cl
LEFT JOIN precos_lote pl ON pl.id_config_lote = cl.id
WHERE cl.id = '21km-lote1'
ORDER BY pl.categoria;
```

Se o frontend usa `kitId: "21km-lote1"`, precisa existir `config_lotes.id = '21km-lote1'`. Para novas corridas, troque os IDs, nome, distancia, lote, capacidade e valores do exemplo.

## Testes

```bash
npm test
```

Os testes atuais validam:

- payload com preco manipulado nao altera valor cobrado;
- payload com vagas manipuladas nao libera vaga;
- checkout bloqueia quando o lote fica sem vagas;
- regra de reembolso de 7/30 dias.

## Scripts de Simulação

Simular compras via API:

```bash
KIT_ID=id-do-config-lote npx tsx testesCompras/simularCompras.ts
```

No PowerShell:

```powershell
$env:KIT_ID="id-do-config-lote"; npx tsx testesCompras/simularCompras.ts
```

Tambem e possivel apontar para outra API:

```bash
API_URL=http://localhost:3000 KIT_ID=id-do-config-lote npx tsx testesCompras/simularCompras.ts
```

No Windows/PowerShell:

```powershell
$env:API_URL="http://localhost:3000"; $env:KIT_ID="id-do-config-lote"; npx tsx testesCompras/simularCompras.ts
```

Simular cadastros direto no banco:

```bash
npx tsx testesCompras/simularCadastros.ts
```

Simular webhooks:

```bash
npx tsx testesCompras/simularWebhooks.ts
```
