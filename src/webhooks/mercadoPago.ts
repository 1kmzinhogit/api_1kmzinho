import { type Request, type Response } from "express";
import {
  processarWebhookPagamento,
  processarWebhookPagamentoSimulado,
} from "../services/paymentService.js";

export async function handleWebhook(req: Request, res: Response) {
  try {
    if (req.body?.modoTeste === true) {
      if (process.env.NODE_ENV === "production") {
        return res.status(403).json({ erro: "Simulação indisponível em produção." });
      }

      const resultado = await processarWebhookPagamentoSimulado({
        idPedido: req.body.idPedido,
        referenciaExterna: req.body.external_reference,
        idPagamentoMp: String(req.body.data?.id ?? req.body.idPagamento),
        statusMp: String(req.body.status ?? "pending"),
      });

      return res.status(200).json({
        mensagem: "Webhook simulado processado.",
        ...resultado,
      });
    }

    const tipoBody = req.body?.type;
    const idPagamentoBody = req.body?.data?.id;

    const tipoQuery = req.query.type;
    const topicoQuery = req.query.topic;
    const idPagamentoQuery = req.query["data.id"] || req.query.id;

    const tipoEvento = tipoBody || tipoQuery || topicoQuery;
    const idPagamento = idPagamentoBody || idPagamentoQuery;

    if (
      (tipoEvento !== "payment" && tipoEvento !== "merchant_order") ||
      !idPagamento
    ) {
      return res.sendStatus(200);
    }

    await processarWebhookPagamento(String(idPagamento));

    return res.sendStatus(200);
  } catch (error) {
    console.error("Erro no webhook do Mercado Pago:", error);
    return res.sendStatus(500);
  }
}
