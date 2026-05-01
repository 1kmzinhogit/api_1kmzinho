import { type Request, type Response } from "express";
import * as servicoPagamento from "../services/paymentService.js";

export async function checkout(req: Request, res: Response) {
  try {
    const payload = req.body;

    if (
      !payload?.kitId ||
      !payload?.cpf ||
      !payload?.contato ||
      !payload?.nomeNaCamisa ||
      !payload?.dataNascimento ||
      !payload?.nomePessoa ||
      !payload?.corCamisa
    ) {
      return res
        .status(400)
        .json({ erro: "Informe kitId e os dados obrigatórios do participante." });
    }

    const resultado = await servicoPagamento.criarPedido(payload);

    return res.status(200).json(resultado);
  } catch (error: unknown) {
    console.error("Erro ao criar pedido:", error);

    if (error instanceof Error) {
      if (error.message.includes("kitId inválido")) {
        return res.status(400).json({ erro: error.message });
      }

      if (
        error.message.includes("Já existe uma compra") ||
        error.message.includes("Lote esgotado")
      ) {
        return res.status(409).json({ erro: error.message });
      }
    }

    return res.status(500).json({ erro: "Erro ao processar pagamento." });
  }
}
