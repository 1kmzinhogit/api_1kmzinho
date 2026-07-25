# Teste de comprovante

Este teste não cria pedido e não altera o banco. Ele envia um comprovante fictício, com PDF anexado, para o e-mail em `EMAIL_DESTINO`.

Configure no `.env`:

```env
EMAIL_USER=seu_email@gmail.com
EMAIL_PASSWORD=sua_senha_de_app
EMAIL_DESTINO=seu_email_para_receber_o_teste@gmail.com
```

Execute:

```bash
npx tsx testeComprovantes/enviarComprovanteTeste.ts
```
