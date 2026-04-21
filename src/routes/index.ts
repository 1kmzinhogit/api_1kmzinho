import { Router } from "express";
import { checkout } from "../controllers/paymentController.js";
import { handleWebhook } from "../webhooks/mercadoPago.js";

const router = Router();

router.get("/health", (_req, res) => {
  return res.status(200).json({ ok: true });
});

router.post("/checkout", checkout);
router.post("/webhooks/mercadopago", handleWebhook);

export default router;