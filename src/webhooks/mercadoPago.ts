import { type Request, type Response } from "express";
import { processPaymentWebhook } from "../services/paymentService.js";

export async function handleWebhook(req: Request, res: Response) {
  try {
    const { type, data } = req.body;

    if (type !== "payment" || !data?.id) {
      return res.sendStatus(200);
    }

    const result = await processPaymentWebhook(data.id);
    console.log(`Pedido ${result.orderId} → ${result.status}`);

    return res.sendStatus(200);
  } catch (error) {
    console.error("Erro no webhook do Mercado Pago:", error);
    return res.sendStatus(500);
  }
}

// Recebe notificações automáticas do Mercado Pago sobre mudanças de status.
// O MP chama essa rota sempre que um pagamento é atualizado (aprovado, recusado, etc).