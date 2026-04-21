import { type Request, type Response } from "express";
import { processarWebhookPagamento } from "../services/paymentService.js";

export async function handleWebhook(req: Request, res: Response) {
  try {
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