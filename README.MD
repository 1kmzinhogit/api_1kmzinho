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
EVENTOS_ADMIN_TOKEN=token-admin-eventos
EVENTOS_COM_DATA_ALTERADA=Corrida da Familia 2026,Outro Evento
```

`EVENTOS_COM_DATA_ALTERADA` e opcional. Use nomes separados por virgula. A comparacao ignora acentos e maiusculas/minusculas.
`EVENTOS_ADMIN_TOKEN` e opcional. Quando nao estiver configurado, a rota administrativa de eventos reutiliza `REEMBOLSO_ADMIN_TOKEN`.

Variaveis de e-mail usadas para reembolso e relatorios automaticos de lote:

```env
EMAIL_USER=
EMAIL_PASSWORD=
EMAIL_DESTINO=
RELATORIO_LOTES_INTERVAL_MS=300000
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
- `dataInicio` e `dataFim`, quando configurados
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

- A API calcula a janela de reembolso e retorna os campos na consulta por CPF.
- No fluxo publico, se o pedido estiver `APROVADO`, a API registra a solicitacao e processa o reembolso automaticamente no Mercado Pago.
- Se o pedido nao estiver `APROVADO`, a API informa que a compra nao foi efetuada/aprovada e que nao sera possivel solicitar reembolso.
- O endpoint admin continua disponivel para reembolso manual quando necessario.

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
  "statusSolicitacao": "PROCESSADO",
  "emailContato": "cliente@email.com",
  "reembolso": {
    "idPedido": "uuid",
    "status": "CANCELADO",
    "idReembolso": 123456789,
    "valorReembolsado": 0.5
  },
  "mensagem": "Reembolso processado com sucesso."
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
- Se `data_inicio` estiver no futuro, o checkout bloqueia o lote.
- Se `data_fim` ja passou, o checkout bloqueia o lote.
- Se o lote tiver capacidade e periodo, a virada e mista: fecha quando esgotar ou quando passar da data final, o que acontecer primeiro.
- Quando o lote fecha por capacidade ou por `data_fim`, a API envia automaticamente o relatorio PDF dos kits aprovados e marca `notificado = true`.
- O envio por capacidade acontece no webhook aprovado do Mercado Pago; o envio por data e recuperacao de webhooks perdidos rodam no verificador automatico `RELATORIO_LOTES_INTERVAL_MS`.
- A criacao do pedido pendente usa transacao serializable e lock por kit para reduzir corrida de concorrencia.
- O frontend pode exibir vagas, mas a API sempre recalcula antes de criar o checkout.

Status para cards do frontend:

```txt
GET /health
GET /lotes/status
GET /lotes/status?nomeEvento=Meia%20Maratona
POST /admin/eventos/lotes
```

Retorna `capacidade`, `vendidos`, `reservados`, `vagasRestantes`, `vagasReservaveis`, `percentualVendido`, `disponivel`, `motivoIndisponibilidade`, datas e precos ativos por lote.

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

### Cadastrar eventos/lotes pela API admin

Sempre que criar um evento, card ou lote novo no frontend, cadastre antes o lote e os precos pela API admin. Assim nao e preciso usar SQL manual no Supabase.

Endpoint:

```txt
POST /admin/eventos/lotes
```

Autenticacao:

```txt
Authorization: Bearer <EVENTOS_ADMIN_TOKEN>
```

Se `EVENTOS_ADMIN_TOKEN` nao existir, a API usa `REEMBOLSO_ADMIN_TOKEN`.

Payload que o programa executavel deve montar a partir dos campos preenchidos na tela:

```json
{
  "nomeEvento": "",
  "distancia": "",
  "lotes": [
    {
      "id": "",
      "lote": "",
      "capacidade": 0,
      "capacidadeAtual": 0,
      "dataInicio": null,
      "dataFim": null,
      "ativo": true,
      "precos": [
        { "categoria": "MASCULINO", "valor": 0, "ativo": true },
        { "categoria": "FEMININO", "valor": 0, "ativo": true },
        { "categoria": "MAIOR_60", "valor": 0, "ativo": true },
        { "categoria": "LGBTQIA", "valor": 0, "ativo": true },
        { "categoria": "PCD", "valor": 0, "ativo": true }
      ]
    }
  ]
}
```

Fluxo sugerido no executavel:

1. Preencha `nomeEvento`, `distancia`, `ID do lote / kitId`, nome do lote, capacidade, datas e precos.
2. Clique em `Adicionar lote`.
3. Quando perguntado, escolha se deseja criar mais um lote para o mesmo evento.
4. Para o segundo lote em diante, edite `ID do lote / kitId`, nome do lote, capacidade, datas e valores.
5. Revise a lista `Lotes prontos para envio`. Use editar/remover se precisar corrigir algo.
6. Clique em `Enviar para API` e confirme. A API salva tudo em transacao.

Exemplo de chamada em PowerShell, usando variaveis em vez de dados fixos:

```powershell
$headers = @{ Authorization = "Bearer $env:EVENTOS_ADMIN_TOKEN" }
$body = @{
  nomeEvento = $nomeEvento
  distancia = $distancia
  lotes = @(
    @{
      id = $idLote
      lote = $nomeLote
      capacidade = $capacidade
      capacidadeAtual = $capacidadeAtual
      dataInicio = $dataInicio
      dataFim = $dataFim
      ativo = $ativo
      precos = $precos
    }
  )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Method Post `
  -Uri "$env:API_URL/admin/eventos/lotes" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $body
```

Exemplo de chamada no executavel Python:

```python
import os
import json
from urllib.request import Request, urlopen

body = json.dumps(payload_montado_pela_tela).encode("utf-8")
request = Request(
    f"{os.environ['API_URL']}/admin/eventos/lotes",
    data=body,
    headers={
        "Authorization": f"Bearer {os.environ['EVENTOS_ADMIN_TOKEN']}",
        "Content-Type": "application/json",
    },
    method="POST",
)

with urlopen(request, timeout=30) as response:
    response.read()
```

Resposta de sucesso:

```json
{
  "ok": true,
  "evento": "Nome preenchido no payload",
  "lotesSalvos": [
    {
      "id": "id-preenchido-no-payload",
      "lote": "lote-preenchido-no-payload",
      "capacidade": 1,
      "precos": 5
    }
  ]
}
```

Se o frontend usa `kitId`, ele precisa ser igual ao `id` enviado para `config_lotes.id` nesta rota.

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
