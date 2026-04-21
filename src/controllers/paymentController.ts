import { type Request, type Response } from "express";
import * as servicoPagamento from "../services/paymentService.js";

export async function checkout(req: Request, res: Response) {
  try {
    const payload = req.body;

    if (
      !payload?.cpf ||
      !payload?.nomeEvento ||
      !payload?.contato ||
      !Array.isArray(payload?.itens) ||
      payload.itens.length === 0
    ) {
      return res
        .status(400)
        .json({ erro: "Dados do pedido inválidos ou incompletos." });
    }

    const resultado = await servicoPagamento.criarPedido(payload);

    return res.status(200).json(resultado);
  } catch (error: unknown) {
    console.error("Erro ao criar pedido:", error);

    if (error instanceof Error && error.message.includes("Já existe uma compra")) {
      return res.status(409).json({ erro: error.message });
    }

    return res.status(500).json({ erro: "Erro ao processar pagamento." });
  }
}