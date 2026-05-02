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

export async function consultarPorCpf(req: Request, res: Response) {
  try {
    const cpf = typeof req.query.cpf === "string" ? req.query.cpf : "";

    if (!cpf) {
      return res.status(400).json({ erro: "Informe o CPF." });
    }

    const pedidos = await servicoPagamento.consultarPedidosPorCpf(cpf);

    return res.status(200).json({ pedidos });
  } catch (error: unknown) {
    console.error("Erro ao consultar pedidos por CPF:", error);

    if (error instanceof Error && error.message.includes("CPF inválido")) {
      return res.status(400).json({ erro: error.message });
    }

    return res.status(500).json({ erro: "Erro ao consultar pedidos." });
  }
}

export async function reembolso(req: Request, res: Response) {
  try {
    const tokenConfigurado = process.env.REEMBOLSO_ADMIN_TOKEN;
    const authorization = req.headers.authorization;
    const headerAdminToken = req.headers["x-admin-token"];
    const tokenRecebido = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : Array.isArray(headerAdminToken)
        ? headerAdminToken[0]
        : headerAdminToken;

    if (!tokenConfigurado) {
      return res.status(500).json({ erro: "Token de reembolso não configurado." });
    }

    if (tokenRecebido !== tokenConfigurado) {
      return res.status(401).json({ erro: "Não autorizado." });
    }

    const amount = req.body?.amount;
    const idPedido = Array.isArray(req.params.idPedido)
      ? req.params.idPedido[0]
      : req.params.idPedido;

    const resultado = await servicoPagamento.reembolsarPedido({
      idPedido,
      amount: amount === undefined ? undefined : Number(amount),
    });

    return res.status(200).json(resultado);
  } catch (error: unknown) {
    console.error("Erro ao reembolsar pedido:", error);

    if (error instanceof Error) {
      if (
        error.message.includes("não encontrado") ||
        error.message.includes("não possui pagamento")
      ) {
        return res.status(404).json({ erro: error.message });
      }

      if (
        error.message.includes("Apenas pedidos aprovados") ||
        error.message.includes("Valor de reembolso")
      ) {
        return res.status(400).json({ erro: error.message });
      }

      return res.status(502).json({ erro: error.message });
    }

    return res.status(500).json({ erro: "Erro ao reembolsar pedido." });
  }
}
