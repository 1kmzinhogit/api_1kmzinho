import { prisma } from "../config/db.js";

export async function listarCupons() {
  const cupons = await prisma.cupom.findMany({ orderBy: [{ nomeEvento: "asc" }, { codigo: "asc" }] });
  const usos = await prisma.pedido.groupBy({
    by: ["codigoCupom"],
    where: { status: "APROVADO", codigoCupom: { in: cupons.map((cupom) => cupom.codigo) } },
    _count: { _all: true },
  });
  const usosPorCodigo = new Map(usos.map((item) => [item.codigoCupom, item._count._all]));
  return cupons.map((cupom) => ({ ...cupom, usos: usosPorCodigo.get(cupom.codigo) ?? 0 }));
}

export async function salvarCupom(payload: Record<string, unknown>) {
  const codigo = typeof payload.codigo === "string" ? payload.codigo.trim().toUpperCase() : "";
  const nomeEvento = typeof payload.nomeEvento === "string" ? payload.nomeEvento.trim() : "";
  const desconto = Number(payload.desconto);
  const ativo = payload.ativo === undefined ? true : payload.ativo;
  const limiteUsos = validarLimiteUsos(payload.limiteUsos);
  const validadeAte = validarValidade(payload.validadeAte);
  if (!/^[A-Z0-9_-]{3,40}$/.test(codigo)) throw new Error("Use um código de 3 a 40 caracteres (letras, números, hífen ou sublinhado).");
  if (!nomeEvento) throw new Error("Selecione a corrida.");
  if (!Number.isFinite(desconto) || desconto <= 0) throw new Error("Informe um desconto em reais maior que zero.");
  if (typeof ativo !== "boolean") throw new Error("Campo ativo inválido.");
  const corridaExiste = await prisma.configLote.findFirst({ where: { nomeEvento }, select: { id: true } });
  if (!corridaExiste) throw new Error("A corrida selecionada não tem lotes cadastrados.");
  const existente = typeof payload.id === "string" && payload.id
    ? await prisma.cupom.findUnique({ where: { id: payload.id } })
    : null;
  if (typeof payload.id === "string" && payload.id && !existente) throw new Error("Cupom não encontrado.");
  const codigoEmUso = await prisma.cupom.findUnique({ where: { codigo } });
  if (codigoEmUso && codigoEmUso.id !== existente?.id) throw new Error("Já existe um cupom com esse código.");
  const dados = { codigo, nomeEvento, desconto, ativo, limiteUsos, validadeAte };
  if (existente) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${existente.codigo}))`;
      const atual = await tx.cupom.findUniqueOrThrow({ where: { id: existente.id } });
      if (codigo !== atual.codigo) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${codigo}))`;
      }
      const usos = await tx.pedido.count({ where: { codigoCupom: atual.codigo, status: "APROVADO" } });
      if (limiteUsos !== null && limiteUsos < usos) {
        throw new Error(`O limite não pode ser menor que os ${usos} usos já consumidos.`);
      }
      return tx.cupom.update({ where: { id: existente.id }, data: dados });
    });
  }
  return prisma.cupom.create({ data: dados });
}

export function validarLimiteUsos(valor: unknown): number | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== "number" || !Number.isSafeInteger(valor) || valor <= 0) {
    throw new Error("limiteUsos deve ser um inteiro positivo ou null.");
  }
  return valor;
}

export function validarValidade(valor: unknown): Date | null {
  if (valor === undefined || valor === null || valor === "") return null;
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(valor)) {
    throw new Error("validadeAte deve ser uma data ISO 8601 com fuso horário ou null.");
  }
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) throw new Error("validadeAte inválida.");
  return data;
}

export async function alterarStatusCupom(id: string, ativo: unknown) {
  if (typeof ativo !== "boolean") throw new Error("Informe ativo como verdadeiro ou falso.");
  return prisma.cupom.update({ where: { id }, data: { ativo } });
}

export async function listarCorridasParaCupons() {
  const lotes = await prisma.configLote.findMany({ select: { nomeEvento: true }, distinct: ["nomeEvento"], orderBy: { nomeEvento: "asc" } });
  return lotes.map((lote) => lote.nomeEvento);
}
