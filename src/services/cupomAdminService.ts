import { prisma } from "../config/db.js";

export async function listarCupons() {
  return prisma.cupom.findMany({ orderBy: [{ nomeEvento: "asc" }, { codigo: "asc" }] });
}

export async function salvarCupom(payload: Record<string, unknown>) {
  const codigo = typeof payload.codigo === "string" ? payload.codigo.trim().toUpperCase() : "";
  const nomeEvento = typeof payload.nomeEvento === "string" ? payload.nomeEvento.trim() : "";
  const desconto = Number(payload.desconto);
  const ativo = payload.ativo === undefined ? true : payload.ativo;
  if (!/^[A-Z0-9_-]{3,40}$/.test(codigo)) throw new Error("Use um código de 3 a 40 caracteres (letras, números, hífen ou sublinhado).");
  if (!nomeEvento) throw new Error("Selecione a corrida.");
  if (!Number.isFinite(desconto) || desconto <= 0) throw new Error("Informe um desconto em reais maior que zero.");
  if (typeof ativo !== "boolean") throw new Error("Campo ativo inválido.");
  const corridaExiste = await prisma.configLote.findFirst({ where: { nomeEvento }, select: { id: true } });
  if (!corridaExiste) throw new Error("A corrida selecionada não tem lotes cadastrados.");
  const existente = await prisma.cupom.findUnique({ where: { codigo } });
  if (existente && payload.id !== existente.id) throw new Error("Já existe um cupom com esse código.");
  if (typeof payload.id === "string" && payload.id) {
    return prisma.cupom.update({ where: { id: payload.id }, data: { codigo, nomeEvento, desconto, ativo } });
  }
  return prisma.cupom.create({ data: { codigo, nomeEvento, desconto, ativo } });
}

export async function alterarStatusCupom(id: string, ativo: unknown) {
  if (typeof ativo !== "boolean") throw new Error("Informe ativo como verdadeiro ou falso.");
  return prisma.cupom.update({ where: { id }, data: { ativo } });
}

export async function listarCorridasParaCupons() {
  const lotes = await prisma.configLote.findMany({ select: { nomeEvento: true }, distinct: ["nomeEvento"], orderBy: { nomeEvento: "asc" } });
  return lotes.map((lote) => lote.nomeEvento);
}
