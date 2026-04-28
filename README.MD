Comandos: 
  npx prisma generate
  npx prisma migrate dev --name init
  npx prisma studio

## Docker

### Subir a API
```bash
docker-compose up -d --build
```

### Verificar logs
```bash
docker logs api_corrida
```

### Parar o container
```bash
docker-compose down
```

### Rebuild completo
```bash
docker-compose down && docker-compose up -d --build
```

A API estará disponível em: `http://localhost:3000`

---

## PostgreSQL no Docker

  docker run --name postgres-api `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD="suasenha" `
  -e POSTGRES_DB=Seu banco `
  -p 5432:5432 `
  -d postgres <--

## Simular compras (via API)
npx tsx testesCompras/simularCompras.ts

## Simular cadastros (direto no banco)
npx tsx testesCompras/simularCadastros.ts

## Simular webhooks
npx tsx testesCompras/simularWebhooks.ts




POST /checkout
  → paymentController.checkout
  → paymentService.createOrder()
    - cria Order (status = PENDING) + itens no Postgres (Prisma)
    - valida regra de 1 compra por CPF por corrida (unique [cpf, raceName])
    - cria preferência no Mercado Pago com external_reference = UUID do pedido
    - salva preferenceId no pedido
  → retorna { orderId, preferenceId, initPoint }

Usuário paga no Mercado Pago

POST /webhooks/mercadopago  ← Mercado Pago chama automaticamente
  → webhooks/mercadoPago.handleWebhook
  → paymentService.processPaymentWebhook()
    - busca detalhes do pagamento no MP (Payment.get)
    - encontra o pedido via external_reference
    - dentro de uma transação:
        - atualiza Order.status (PENDING | APPROVED | REJECTED | CANCELLED)
        - grava Payment com:
            - mpPaymentId (ID do MP, único)
            - status (enum PaymentStatus)
            - rawResponse (JSON completo do MP para auditoria)

Banco de dados (Prisma / Postgres)
  - Order
      id (UUID)
      status (PENDING | APPROVED | REJECTED | CANCELLED)
      paymentId (String?, único)
      preferenceId (String?)
      externalReference (String?, único)
      cpf (String)                       ← CPF do participante
      contactNumber (String)             ← telefone/whatsapp
      raceName (String)                  ← nome do evento/corrida
      lot (String)                       ← lote da inscrição
      ticketValue (Float)                ← valor do lote
      shirtName (String)                 ← nome/descrição da camisa
      shirtNumber (String)               ← número da camisa
      shirtColor (String)                ← cor da camisa
      totalAmount (Float)
      createdAt, updatedAt
      items (OrderItem[])
      payments (Payment[])
      unique constraint: (cpf, raceName) ← 1 compra por CPF por corrida

  - OrderItem
      title, quantity, unit_price, orderId

  - Payment
      mpPaymentId (único)
      status (PaymentStatus)
      rawResponse (Json)
      orderId

Observações de infra
  - O webhook precisa de URL pública em desenvolvimento. Sugestão:
      ngrok http 3000
    Copiar a URL gerada e configurar em APP_URL no .env,
    para que notification_url aponte para:
      ${APP_URL}/api/webhooks/mercadopago