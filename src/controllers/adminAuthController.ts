import { type Request, type Response } from "express";
import {
  autenticarSenhaAdmin,
  criarCookieSessaoAdmin,
  limparCookieSessaoAdmin,
  obterSessaoAdmin,
} from "../services/adminAuthService.js";

export function loginAdmin(req: Request, res: Response) {
  try {
    if (!autenticarSenhaAdmin(req.body?.password ?? req.body?.senha)) {
      return res.status(401).json({ erro: "Senha inválida." });
    }

    const sessao = criarCookieSessaoAdmin();
    res.setHeader("Set-Cookie", sessao.cookie);
    return res.status(200).json({ authenticated: true, expiresAt: sessao.expiraEm });
  } catch (error) {
    console.error("Erro ao autenticar painel administrativo:", error);
    return res.status(500).json({ erro: "Autenticação do painel não configurada." });
  }
}

export function logoutAdmin(_req: Request, res: Response) {
  res.setHeader("Set-Cookie", limparCookieSessaoAdmin());
  return res.status(200).json({ success: true });
}

export function sessaoAdmin(req: Request, res: Response) {
  const sessao = obterSessaoAdmin(req);
  return res.status(200).json({ authenticated: Boolean(sessao), expiresAt: sessao?.expiraEm ?? null });
}
