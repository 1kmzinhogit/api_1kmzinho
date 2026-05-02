# API 1KM

API Node.js/Express para checkout de inscrições, Mercado Pago, controle de lotes/vagas e relatórios.

## Configuração

1. Instale as dependências:

```bash
npm install
```

2. Copie `.env.example` para `.env` e preencha as variáveis:

```bash
cp .env.example .env
```

3. Gere o Prisma Client:

```bash
npx prisma generate
```

4. Aplique as migrations:

```bash
npx prisma migrate dev
```

Em produção, use:

```bash
npx prisma migrate deploy
```

## Desenvolvimento

```bash
npm run dev
```

A API fica disponível em:

```txt
http://localhost:3000
```

Healthcheck:

```txt
GET /health
```

## Docker

Subir ou rebuildar a API:

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

Container esperado:

```txt
api_corrida
```

Porta publicada:

```txt
0.0.0.0:3000->3000/tcp
```

## Checkout Seguro

O endpoint `POST /checkout` nao confia mais em preco, evento, lote, vagas ou itens enviados pelo frontend.

O frontend deve enviar somente o `kitId` e dados/escolhas do participante:

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

Qualquer campo financeiro enviado pelo frontend, como `amount`, `price`, `valorIngresso` ou `itens[].valor_unitario`, deve ser ignorado pela API.

## Regras de Compra

- O pedido nasce com status `PENDENTE`.
- A compra so vira `APROVADO` quando o webhook do Mercado Pago confirmar pagamento aprovado.
- Uma nova tentativa com mesmo CPF/evento so e bloqueada quando ja existe pedido `APROVADO`.
- Pedidos `PENDENTE`, `REJEITADO` ou `CANCELADO` nao bloqueiam nova tentativa.
- `external_reference` usa o `id` do pedido criado no banco.

## Regras de Reembolso

- O prazo padrao para solicitar reembolso e de ate 7 dias corridos a partir da compra.
- Se a data do evento tiver sido alterada, o prazo operacional sobe para 30 dias corridos a partir da compra.
- A API calcula e retorna a janela de reembolso na consulta por CPF.
- A API tambem bloqueia o reembolso quando o pedido esta fora do prazo permitido.
- Para marcar eventos com data alterada, configure no Render:

```env
EVENTOS_COM_DATA_ALTERADA=Corrida da Familia 2026,Outro Evento
```

Os nomes podem ser separados por virgula. A comparacao ignora maiusculas/minusculas e acentos.

Resposta de `GET /pedidos/consulta?cpf=...`:

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

Para o cliente final, use o endpoint de solicitacao:

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

Esse endpoint valida CPF, status do pedido e janela de reembolso. Ele nao cancela a compra automaticamente; ele registra uma solicitacao `PENDENTE` no banco. O reembolso financeiro deve ser processado pelo Mercado Pago/admin, e o webhook atualiza o pedido para `CANCELADO` quando receber o status de refund.

Para listar as solicitacoes pendentes em uma tela/admin interna:

```txt
GET /reembolsos/solicitacoes?status=PENDENTE
```

Use `Authorization: Bearer <REEMBOLSO_ADMIN_TOKEN>` ou `x-admin-token`.

Para atualizar manualmente o status de uma solicitacao:

```txt
PATCH /reembolsos/solicitacoes/:idSolicitacao
```

Payload:

```json
{
  "status": "PROCESSADO"
}
```

Status aceitos: `PENDENTE`, `PROCESSADO`, `REJEITADO`.

Quando o Mercado Pago enviar webhook com status de reembolso/cancelamento (`refunded`, `charged_back` ou `cancelled`), a API marca o pedido como `CANCELADO` e atualiza automaticamente solicitacoes `PENDENTE` daquele pedido para `PROCESSADO`.

Cancelamento admin de pagamento pendente:

```txt
POST /pedidos/:idPedido/cancelamento
```

Use `Authorization: Bearer <REEMBOLSO_ADMIN_TOKEN>` ou `x-admin-token`.

Esse endpoint consulta o pagamento no Mercado Pago e so cancela se o status remoto estiver `pending` ou `in_process`. Para pedido ja `APROVADO`, use o fluxo de reembolso.

Reembolso admin de pagamento aprovado:

```txt
POST /pedidos/:idPedido/reembolso
```

Use `Authorization: Bearer <REEMBOLSO_ADMIN_TOKEN>` ou `x-admin-token`. A API permite apenas reembolso total e respeita a janela de 7/30 dias definida na regra de negocio.

Antes do deploy, aplique a migration:

```bash
npx prisma migrate deploy
```

Prompt para aplicar no frontend:

```txt
Atualize a tela de consulta de pedidos para usar os novos campos de reembolso retornados por GET /pedidos/consulta e o novo fluxo de solicitacao em POST /pedidos/:idPedido/solicitar-reembolso.

Para cada pedido:
- Exiba "Data da compra" usando o campo dataCompra formatado em pt-BR.
- Exiba "Prazo para reembolso" usando dataLimiteReembolso formatado em pt-BR.
- Exiba o e-mail de contato usando emailContato quando vier preenchido.
- Se emailContato vier vazio/null, mostre um campo de e-mail vazio para a pessoa preencher antes de solicitar reembolso.
- Permita que a pessoa edite o e-mail antes de enviar a solicitacao, mesmo quando emailContato ja vier preenchido.
- Se eventoComDataAlterada for true, mostre que o prazo de reembolso e de 30 dias por alteracao de data do evento.
- Se eventoComDataAlterada for false, mostre que o prazo de reembolso e de 7 dias a partir da compra.
- Habilite o botao "Solicitar reembolso" somente quando permiteSolicitarReembolso for true e houver um e-mail valido no campo.
- Quando permiteSolicitarReembolso for false, deixe o botao desabilitado e exiba motivoIndisponibilidadeReembolso quando existir.
- Nao calcule a regra no frontend; use prazoReembolsoDias, dataLimiteReembolso e permiteSolicitarReembolso vindos da API.
- Ao clicar em "Solicitar reembolso", abra uma confirmacao mostrando evento, data da compra, prazo limite e e-mail de contato.
- Quando confirmar, envie POST /pedidos/:idPedido/solicitar-reembolso com:
  {
    "cpf": CPF digitado na consulta,
    "emailContato": email editado/confirmado pela pessoa,
    "observacao": texto opcional se existir no layout
  }
- Se a API responder ok: true, mostre a mensagem retornada pela API e mantenha o pedido visivel.
- Nao chame o endpoint admin POST /pedidos/:idPedido/reembolso pelo frontend publico.
- A solicitacao fica registrada como PENDENTE no banco; o reembolso financeiro continua sendo processado depois pelo admin/Mercado Pago.
```

## Regras de Lote e Vagas

- `ConfigLote.capacidade` e o total de vagas do lote.
- `soldSlots` e calculado no backend contando pedidos `APROVADO`.
- `remainingSlots = capacidade - soldSlots`.
- Se `remainingSlots <= 0`, o checkout retorna erro de lote esgotado.
- A criacao do pedido pendente usa transacao serializable e lock por kit para reduzir corrida de concorrencia.
- O frontend pode exibir vagas, mas a API sempre recalcula antes de criar o checkout.

## Webhook Mercado Pago

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
- `ConfigLote`: evento/lote/capacidade/distancia.
- `PrecoLote`: preco por categoria do lote.

Para cadastrar um novo card/evento no frontend, primeiro cadastre o lote e os precos no banco. O frontend deve usar o `id` de `ConfigLote` como `kitId`.

## Testes

```bash
npm test
```

Os testes atuais validam:

- payload com preco manipulado nao altera valor cobrado;
- payload com vagas manipuladas nao libera vaga;
- checkout bloqueia quando o lote fica sem vagas.

## Scripts de Simulacao

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

No Windows/PowerShell, prefira as variaveis `$env:*`:

```powershell
$env:API_URL="http://localhost:3000"; $env:KIT_ID="id-do-config-lote"; npx tsx testesCompras/simularCompras.ts
```

Comando antigo, sem variaveis, so funciona se o script tiver um `KIT_ID` valido configurado:

```bash
npx tsx testesCompras/simularCompras.ts
```

Simular cadastros direto no banco:

```bash
npx tsx testesCompras/simularCadastros.ts
```

Simular webhooks:

```bash
npx tsx testesCompras/simularWebhooks.ts
```
