import { Router } from "express";
import {
  atualizarStatusSolicitacaoReembolso,
  cancelarPagamento,
  checkout,
  consultarPorCpf,
  listarStatusLotes,
  listarSolicitacoesReembolso,
  reembolso,
  solicitarReembolso,
} from "../controllers/paymentController.js";
import { cadastrarEventoLotes } from "../controllers/eventoAdminController.js";
import {
  pesquisarParticipantesRelatorio,
  relatorioExcelPorEvento,
  relatorioPDFIndividual,
  relatorioPorEvento,
  relatorioPorLote,
} from "../controllers/reportController.js";
import { handleWebhook } from "../webhooks/mercadoPago.js";
import { loginAdmin, logoutAdmin, sessaoAdmin } from "../controllers/adminAuthController.js";
import {
  listarEventosAdmin,
  listarPedidosAdmin,
  resumoAdmin,
} from "../controllers/adminDashboardController.js";
import { exigirSessaoAdmin } from "../services/adminAuthService.js";

const router = Router();

router.get("/health", (_req, res) => {
  return res.status(200).json({ ok: true });
});

// Pagamento
router.post("/checkout", checkout);
router.get("/lotes/status", listarStatusLotes);

// Painel administrativo (sessão por cookie httpOnly)
router.post("/admin/auth/login", loginAdmin);
router.use("/admin", exigirSessaoAdmin);
router.post("/admin/auth/logout", logoutAdmin);
router.get("/admin/auth/session", sessaoAdmin);
router.get("/admin/auth/sessao", sessaoAdmin);
router.get("/admin/inscricoes", listarPedidosAdmin);
router.get("/admin/dashboard/eventos", exigirSessaoAdmin, listarEventosAdmin);
router.get("/admin/dashboard/resumo", exigirSessaoAdmin, resumoAdmin);
router.get("/admin/dashboard/pedidos", exigirSessaoAdmin, listarPedidosAdmin);
router.post("/admin/eventos/lotes", cadastrarEventoLotes);
router.get("/admin/relatorios/:nomeEvento/excel", relatorioExcelPorEvento);
router.get("/admin/relatorios/:nomeEvento/participantes", pesquisarParticipantesRelatorio);
router.get("/admin/relatorios/:nomeEvento/participantes/:idPedido/pdf", relatorioPDFIndividual);
router.get("/pedidos/consulta", consultarPorCpf);
router.post("/pedidos/:idPedido/solicitar-reembolso", solicitarReembolso);
router.post("/pedidos/:idPedido/cancelamento", cancelarPagamento);
router.post("/pedidos/:idPedido/reembolso", reembolso);
router.get("/reembolsos/solicitacoes", listarSolicitacoesReembolso);
router.patch("/reembolsos/solicitacoes/:idSolicitacao", atualizarStatusSolicitacaoReembolso);

// Webhooks
router.post("/webhooks/mercadopago", handleWebhook);

// Relatórios PDF
router.get("/relatorio/:nomeEvento/pdf", relatorioPorEvento);
router.get("/relatorio/:nomeEvento/lote/:lote/pdf", relatorioPorLote);

export default router;
