import { type Request, type Response } from "express";
import { processPaymentWebhook } from "../services/paymentService.js";

export async function handleWebhook(req: Request, res: Response) {
  try {
    const bodyType = req.body?.type;
    const bodyPaymentId = req.body?.data?.id;

    const queryType = req.query.type;
    const queryTopic = req.query.topic;
    const queryPaymentId = req.query["data.id"] || req.query.id;

    const eventType = bodyType || queryType || queryTopic;
    const paymentId = bodyPaymentId || queryPaymentId;

    if (
      (eventType !== "payment" && eventType !== "merchant_order") ||
      !paymentId
    ) {
      return res.sendStatus(200);
    }

    await processPaymentWebhook(String(paymentId));

    return res.sendStatus(200);
  } catch (error) {
    console.error("Erro no webhook do Mercado Pago:", error);
    return res.sendStatus(500);
  }
}