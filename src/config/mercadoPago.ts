import { MercadoPagoConfig } from "mercadopago";
import { config } from "./env.js";

if (!process.env.MP_ACCESS_TOKEN) {
  throw new Error("MP_ACCESS_TOKEN não foi definido no .env");
}

export const mp = new MercadoPagoConfig({
 accessToken: process.env.MP_ACCESS_TOKEN as string,
 options: { timeout: config.mercadoPago.requestTimeoutMs },
});
