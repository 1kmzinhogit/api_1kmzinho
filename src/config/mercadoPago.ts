import { MercadoPagoConfig } from "mercadopago";

if (!process.env.MP_ACCESS_TOKEN) {
  throw new Error("MP_ACCESS_TOKEN não foi definido no .env");
}

export const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});