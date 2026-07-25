import { type Request, type Response } from "express";
import * as dashboard from "../services/adminDashboardService.js";

export async function listarEventosAdmin(_req: Request, res: Response) {
  try {
    return res.status(200).json({ eventos: await dashboard.listarEventosDashboard() });
  } catch (error) {
    console.error("Erro ao listar eventos do painel:", error);
    return res.status(500).json({ erro: "Erro ao listar eventos." });
  }
}

export async function resumoAdmin(req: Request, res: Response) {
  try {
    return res.status(200).json(await dashboard.obterResumoDashboard(dashboard.validarFiltrosDashboard(req.query)));
  } catch (error) {
    return erroDashboard(res, error);
  }
}

export async function listarPedidosAdmin(req: Request, res: Response) {
  try {
    return res.status(200).json(await dashboard.listarPedidosDashboard(req.query));
  } catch (error) {
    return erroDashboard(res, error);
  }
}

function erroDashboard(res: Response, error: unknown) {
  console.error("Erro no painel administrativo:", error);
  if (error instanceof Error && error.message.includes("inválid")) {
    return res.status(400).json({ erro: error.message });
  }
  return res.status(500).json({ erro: "Erro ao consultar dados do painel." });
}
