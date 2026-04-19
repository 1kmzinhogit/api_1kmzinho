import { MercadoPagoConfig } from "mercadopago";

export const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});



// Inicializa e exporta o cliente do Mercado Pago com o token de acesso.
// Centralizar aqui evita reconfigurar o SDK em cada arquivo que precisar dele.