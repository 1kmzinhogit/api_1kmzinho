import { Router } from "express";
import { checkout } from "../controllers/paymentController.js";
import { handleWebhook } from "../webhooks/mercadoPago.js";

const router = Router();

// Cria pedido + preferência no Mercado Pago
router.post("/checkout", checkout);

// Webhook do Mercado Pago
router.post("/webhooks/mercadopago", handleWebhook);

export default router;

// Centraliza todas as rotas da aplicação em um único arquivo.
// Manter as rotas separadas dos controllers facilita a leitura e manutenção.