import { type Request, type Response } from "express";
import {
  autenticarSenhaAdmin,
  criarCookieSessaoAdmin,
  limparCookieSessaoAdmin,
  sessaoAdminValida,
} from "../services/adminAuthService.js";

export function loginAdmin(req: Request, res: Response) {
  try {
    if (!autenticarSenhaAdmin(req.body?.senha)) {
      return res.status(401).json({ erro: "Senha inválida." });
    }

    res.setHeader("Set-Cookie", criarCookieSessaoAdmin());
    return res.status(200).json({ autenticado: true });
  } catch (error) {
    console.error("Erro ao autenticar painel administrativo:", error);
    return res.status(500).json({ erro: "Autenticação do painel não configurada." });
  }
}

export function logoutAdmin(_req: Request, res: Response) {
  res.setHeader("Set-Cookie", limparCookieSessaoAdmin());
  return res.status(200).json({ autenticado: false });
}

export function sessaoAdmin(req: Request, res: Response) {
  return res.status(200).json({ autenticado: sessaoAdminValida(req) });
}
