import { type Request, type Response } from "express";
import * as eventoAdminService from "../services/eventoAdminService.js";

export async function cadastrarEventoLotes(req: Request, res: Response) {
  try {
    const autorizado = validarTokenEventosAdmin(req);

    if (!autorizado.ok) {
      return res.status(autorizado.status).json({ erro: autorizado.erro });
    }

    const resultado = await eventoAdminService.cadastrarEventoLotes(req.body);

    return res.status(200).json(resultado);
  } catch (error: unknown) {
    console.error("Erro ao cadastrar evento/lotes:", error);

    if (error instanceof Error) {
      return res.status(400).json({ erro: error.message });
    }

    return res.status(500).json({ erro: "Erro ao cadastrar evento/lotes." });
  }
}

function validarTokenEventosAdmin(req: Request):
  | { ok: true }
  | { ok: false; status: number; erro: string } {
  const tokenConfigurado =
    process.env.EVENTOS_ADMIN_TOKEN || process.env.REEMBOLSO_ADMIN_TOKEN;
  const authorization = req.headers.authorization;
  const tokenRecebido = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined;

  if (!tokenConfigurado) {
    return { ok: false, status: 500, erro: "Token administrativo não configurado." };
  }

  if (tokenRecebido !== tokenConfigurado) {
    return { ok: false, status: 401, erro: "Não autorizado." };
  }

  return { ok: true };
}
