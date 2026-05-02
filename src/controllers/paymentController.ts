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

export async function solicitarReembolso(req: Request, res: Response) {
  try {
    const idPedido = Array.isArray(req.params.idPedido)
      ? req.params.idPedido[0]
      : req.params.idPedido;
    const cpf = typeof req.body?.cpf === "string" ? req.body.cpf : "";
    const emailContato =
      typeof req.body?.emailContato === "string" ? req.body.emailContato.trim() : "";
    const observacao =
      typeof req.body?.observacao === "string" ? req.body.observacao.trim() : undefined;

    if (!idPedido || !cpf || !emailContato) {
      return res.status(400).json({
        erro: "Informe idPedido, CPF e e-mail de contato para solicitar reembolso.",
      });
    }

    const resultado = await servicoPagamento.solicitarReembolsoPedido({
      idPedido,
      cpf,
      emailContato,
      observacao,
    });

    return res.status(200).json(resultado);
  } catch (error: unknown) {
    console.error("Erro ao solicitar reembolso:", error);

    if (error instanceof Error) {
      if (error.message.includes("não encontrado")) {
        return res.status(404).json({ erro: error.message });
      }

      if (
        error.message.includes("CPF inválido") ||
        error.message.includes("e-mail válido") ||
        error.message.includes("Pedido ainda") ||
        error.message.includes("Prazo de")
      ) {
        return res.status(400).json({ erro: error.message });
      }

      return res.status(502).json({ erro: error.message });
    }

    return res.status(500).json({ erro: "Erro ao solicitar reembolso." });
  }
}

export async function listarSolicitacoesReembolso(req: Request, res: Response) {
  try {
    const autorizado = validarTokenAdmin(req);

    if (!autorizado.ok) {
      return res.status(autorizado.status).json({ erro: autorizado.erro });
    }

    const status = typeof req.query.status === "string" ? req.query.status : "PENDENTE";
    const solicitacoes = await servicoPagamento.listarSolicitacoesReembolso(status);

    return res.status(200).json({ solicitacoes });
  } catch (error: unknown) {
    console.error("Erro ao listar solicitações de reembolso:", error);

    return res.status(500).json({ erro: "Erro ao listar solicitações de reembolso." });
  }
}

export async function atualizarStatusSolicitacaoReembolso(req: Request, res: Response) {
  try {
    const autorizado = validarTokenAdmin(req);

    if (!autorizado.ok) {
      return res.status(autorizado.status).json({ erro: autorizado.erro });
    }

    const idSolicitacao = Array.isArray(req.params.idSolicitacao)
      ? req.params.idSolicitacao[0]
      : req.params.idSolicitacao;
    const status = typeof req.body?.status === "string" ? req.body.status : "";

    if (!idSolicitacao || !status) {
      return res.status(400).json({ erro: "Informe idSolicitacao e status." });
    }

    const solicitacao = await servicoPagamento.atualizarStatusSolicitacaoReembolso({
      idSolicitacao,
      status,
    });

    return res.status(200).json({ solicitacao });
  } catch (error: unknown) {
    console.error("Erro ao atualizar solicitação de reembolso:", error);

    if (error instanceof Error) {
      if (error.message.includes("não encontrada")) {
        return res.status(404).json({ erro: error.message });
      }

      if (error.message.includes("Status de solicitação inválido")) {
        return res.status(400).json({ erro: error.message });
      }
    }

    return res.status(500).json({ erro: "Erro ao atualizar solicitação de reembolso." });
  }
}

export async function reembolso(req: Request, res: Response) {
  try {
    const autorizado = validarTokenAdmin(req);

    if (!autorizado.ok) {
      return res.status(autorizado.status).json({ erro: autorizado.erro });
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
        error.message.includes("Valor de reembolso") ||
        error.message.includes("Prazo de")
      ) {
        return res.status(400).json({ erro: error.message });
      }

      return res.status(502).json({ erro: error.message });
    }

    return res.status(500).json({ erro: "Erro ao reembolsar pedido." });
  }
}

export async function cancelarPagamento(req: Request, res: Response) {
  try {
    const autorizado = validarTokenAdmin(req);

    if (!autorizado.ok) {
      return res.status(autorizado.status).json({ erro: autorizado.erro });
    }

    const idPedido = Array.isArray(req.params.idPedido)
      ? req.params.idPedido[0]
      : req.params.idPedido;

    const resultado = await servicoPagamento.cancelarPagamentoPendente({ idPedido });

    return res.status(200).json(resultado);
  } catch (error: unknown) {
    console.error("Erro ao cancelar pagamento:", error);

    if (error instanceof Error) {
      if (
        error.message.includes("não encontrado") ||
        error.message.includes("não possui pagamento")
      ) {
        return res.status(404).json({ erro: error.message });
      }

      if (
        error.message.includes("Apenas pedidos pendentes") ||
        error.message.includes("não pode ser cancelado")
      ) {
        return res.status(400).json({ erro: error.message });
      }

      return res.status(502).json({ erro: error.message });
    }

    return res.status(500).json({ erro: "Erro ao cancelar pagamento." });
  }
}

function validarTokenAdmin(req: Request):
  | { ok: true }
  | { ok: false; status: number; erro: string } {
  const tokenConfigurado = process.env.REEMBOLSO_ADMIN_TOKEN;
  const authorization = req.headers.authorization;
  const headerAdminToken = req.headers["x-admin-token"];
  const tokenRecebido = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : Array.isArray(headerAdminToken)
      ? headerAdminToken[0]
      : headerAdminToken;

  if (!tokenConfigurado) {
    return { ok: false, status: 500, erro: "Token de reembolso não configurado." };
  }

  if (tokenRecebido !== tokenConfigurado) {
    return { ok: false, status: 401, erro: "Não autorizado." };
  }

  return { ok: true };
}
