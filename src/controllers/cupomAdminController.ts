import { type Request, type Response } from "express";
import * as service from "../services/cupomAdminService.js";

export async function listarCuponsAdmin(_req: Request, res: Response) {
  try { return res.json({ cupons: await service.listarCupons() }); }
  catch (error) { console.error("Erro ao listar cupons:", error); return res.status(500).json({ erro: "Erro ao listar cupons." }); }
}

export async function salvarCupomAdmin(req: Request, res: Response) {
  try { return res.status(200).json({ cupom: await service.salvarCupom(req.body ?? {}) }); }
  catch (error: unknown) {
    if (error instanceof Error) return res.status(400).json({ erro: error.message });
    console.error("Erro ao salvar cupom:", error); return res.status(500).json({ erro: "Erro ao salvar cupom." });
  }
}

export async function alterarStatusCupomAdmin(req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try { return res.json({ cupom: await service.alterarStatusCupom(id, req.body?.ativo) }); }
  catch (error: unknown) {
    if (error instanceof Error && error.message.includes("verdadeiro ou falso")) return res.status(400).json({ erro: error.message });
    if (error instanceof Error && error.message.includes("Record to update not found")) return res.status(404).json({ erro: "Cupom não encontrado." });
    console.error("Erro ao atualizar cupom:", error); return res.status(500).json({ erro: "Erro ao atualizar cupom." });
  }
}

export async function listarCorridasCuponsAdmin(_req: Request, res: Response) {
  try { return res.json({ corridas: await service.listarCorridasParaCupons() }); }
  catch (error) { console.error("Erro ao listar corridas:", error); return res.status(500).json({ erro: "Erro ao listar corridas." }); }
}
