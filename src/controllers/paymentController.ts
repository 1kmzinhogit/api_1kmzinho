import { type Request, type Response } from "express";
import * as paymentService from "../services/paymentService.js";

export async function checkout(req: Request, res: Response) {
  try {
    const payload = req.body;

    if (!payload?.cpf || !payload?.raceName || !Array.isArray(payload?.items)) {
      return res
        .status(400)
        .json({ error: "Dados de pedido inválidos ou incompletos." });
    }

    const result = await paymentService.createOrder(payload);

    return res.status(200).json(result);
  } catch (error: unknown) {
    console.error("Erro ao criar pedido:", error);

    if (error instanceof Error && error.message.includes("Já existe uma compra")) {
      return res.status(409).json({ error: error.message });
    }

    return res.status(500).json({ error: "Erro ao processar pagamento." });
  }
}

// Recebe a requisição do cliente, cria o pedido no banco e inicia o pagamento.
// O controller apenas orquestra — a lógica de pagamento fica no service.