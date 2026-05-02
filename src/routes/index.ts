import { Router } from "express";
import {
  checkout,
  consultarPorCpf,
  reembolso,
  solicitarReembolso,
} from "../controllers/paymentController.js";
import { relatorioPorEvento, relatorioPorLote } from "../controllers/reportController.js";
import { handleWebhook } from "../webhooks/mercadoPago.js";

const router = Router();

router.get("/health", (_req, res) => {
  return res.status(200).json({ ok: true });
});

// Pagamento
router.post("/checkout", checkout);
router.get("/pedidos/consulta", consultarPorCpf);
router.post("/pedidos/:idPedido/solicitar-reembolso", solicitarReembolso);
router.post("/pedidos/:idPedido/reembolso", reembolso);

// Webhooks
router.post("/webhooks/mercadopago", handleWebhook);

// Relatórios PDF
router.get("/relatorio/:nomeEvento/pdf", relatorioPorEvento);
router.get("/relatorio/:nomeEvento/lote/:lote/pdf", relatorioPorLote);

export default router;
