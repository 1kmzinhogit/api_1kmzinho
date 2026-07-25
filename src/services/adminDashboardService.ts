import { type Prisma, type StatusPedido } from "@prisma/client";
import { prisma } from "../config/db.js";
import { listarStatusLotes } from "./paymentService.js";

type FiltrosDashboard = {
  nomeEvento?: string;
  dataInicio?: Date;
  dataFim?: Date;
};

type StatusLoteDashboard = {
  nomeEvento: string;
  lote: string;
  distancia: string;
  [campo: string]: unknown;
};

export function validarFiltrosDashboard(query: Record<string, unknown>): FiltrosDashboard {
  return {
    nomeEvento: textoOpcional(query.nomeEvento, "nomeEvento"),
    dataInicio: dataOpcional(query.dataInicio, "dataInicio"),
    dataFim: dataOpcional(query.dataFim, "dataFim"),
  };
}

export async function listarEventosDashboard() {
  const lotes = await prisma.configLote.findMany({
    select: { nomeEvento: true, distancia: true, lote: true, ativo: true },
    orderBy: [{ nomeEvento: "asc" }, { distancia: "asc" }, { lote: "asc" }],
  });
  const eventos = new Map<string, { nomeEvento: string; distancias: Set<string>; lotes: number; ativos: number }>();

  for (const lote of lotes) {
    const evento = eventos.get(lote.nomeEvento) ?? {
      nomeEvento: lote.nomeEvento,
      distancias: new Set<string>(),
      lotes: 0,
      ativos: 0,
    };
    evento.distancias.add(lote.distancia);
    evento.lotes += 1;
    if (lote.ativo) evento.ativos += 1;
    eventos.set(lote.nomeEvento, evento);
  }

  return Array.from(eventos.values()).map((evento) => ({
    nomeEvento: evento.nomeEvento,
    distancias: Array.from(evento.distancias).sort(),
    totalLotes: evento.lotes,
    lotesAtivos: evento.ativos,
  }));
}

export async function obterResumoDashboard(filtros: FiltrosDashboard) {
  const where = montarWhere(filtros);
  const [grupos, lotesStatus] = await Promise.all([
    prisma.pedido.groupBy({
      by: ["nomeEvento", "lote", "distancia", "status"],
      where,
      _count: { _all: true },
      _sum: { total: true, valorIngresso: true },
    }),
    listarStatusLotes(filtros.nomeEvento) as Promise<StatusLoteDashboard[]>,
  ]);

  const totaisStatus: Record<StatusPedido, number> = {
    APROVADO: 0,
    PENDENTE: 0,
    REJEITADO: 0,
    CANCELADO: 0,
  };
  let valorArrecadado = 0;
  let valorInscricoes = 0;
  const porLote = new Map<string, { aprovados: number; pendentes: number; rejeitados: number; cancelados: number; valorArrecadado: number; valorInscricoes: number }>();

  for (const grupo of grupos) {
    const quantidade = grupo._count._all;
    totaisStatus[grupo.status] += quantidade;
    const chave = `${grupo.nomeEvento}::${grupo.lote}::${grupo.distancia}`;
    const atual = porLote.get(chave) ?? {
      aprovados: 0, pendentes: 0, rejeitados: 0, cancelados: 0, valorArrecadado: 0, valorInscricoes: 0,
    };
    if (grupo.status === "APROVADO") {
      atual.aprovados += quantidade;
      atual.valorArrecadado += grupo._sum.total ?? 0;
      atual.valorInscricoes += grupo._sum.valorIngresso ?? 0;
      valorArrecadado += grupo._sum.total ?? 0;
      valorInscricoes += grupo._sum.valorIngresso ?? 0;
    } else if (grupo.status === "PENDENTE") atual.pendentes += quantidade;
    else if (grupo.status === "REJEITADO") atual.rejeitados += quantidade;
    else atual.cancelados += quantidade;
    porLote.set(chave, atual);
  }

  return {
    atualizadoEm: new Date(),
    filtros: { nomeEvento: filtros.nomeEvento ?? null, dataInicio: filtros.dataInicio ?? null, dataFim: filtros.dataFim ?? null },
    resumo: {
      inscricoesAprovadas: totaisStatus.APROVADO,
      pedidosPendentes: totaisStatus.PENDENTE,
      pedidosRejeitados: totaisStatus.REJEITADO,
      pedidosCancelados: totaisStatus.CANCELADO,
      valorArrecadado,
      valorInscricoes,
      valorTaxas: Math.round((valorArrecadado - valorInscricoes) * 100) / 100,
      ticketMedio: totaisStatus.APROVADO ? valorArrecadado / totaisStatus.APROVADO : 0,
    },
    lotes: lotesStatus.map((lote) => {
      const metricas = porLote.get(`${lote.nomeEvento}::${lote.lote}::${lote.distancia}`) ?? {
        aprovados: 0, pendentes: 0, rejeitados: 0, cancelados: 0, valorArrecadado: 0, valorInscricoes: 0,
      };
      return {
        ...lote,
        vendasAprovadasPeriodo: metricas.aprovados,
        pedidosPendentesPeriodo: metricas.pendentes,
        pedidosRejeitadosPeriodo: metricas.rejeitados,
        pedidosCanceladosPeriodo: metricas.cancelados,
        valorArrecadadoPeriodo: metricas.valorArrecadado,
        valorInscricoesPeriodo: metricas.valorInscricoes,
        valorTaxasPeriodo: Math.round((metricas.valorArrecadado - metricas.valorInscricoes) * 100) / 100,
      };
    }),
  };
}

export async function listarPedidosDashboard(query: Record<string, unknown>) {
  const filtros = validarFiltrosDashboard(query);
  const status = textoOpcional(query.status, "status") as StatusPedido | undefined;
  if (status && !["PENDENTE", "APROVADO", "REJEITADO", "CANCELADO"].includes(status)) {
    throw new Error("status inválido.");
  }
  const lote = textoOpcional(query.lote, "lote");
  const busca = textoOpcional(query.busca, "busca");
  const pagina = numeroPagina(query.pagina, "pagina", 1, 1);
  const limite = numeroPagina(query.limite, "limite", 20, 100);
  const where: Prisma.PedidoWhereInput = { ...montarWhere(filtros), ...(status ? { status } : {}), ...(lote ? { lote } : {}) };
  if (busca) {
    where.OR = [
      { nomePessoa: { contains: busca, mode: "insensitive" } },
      { email: { contains: busca, mode: "insensitive" } },
      { cpf: { contains: busca } },
      { codigoPedido: { contains: busca, mode: "insensitive" } },
    ];
  }

  const [total, pedidos] = await Promise.all([
    prisma.pedido.count({ where }),
    prisma.pedido.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      skip: (pagina - 1) * limite,
      take: limite,
      select: {
        id: true, codigoPedido: true, numeroInscricao: true, status: true, nomePessoa: true,
        email: true, cpf: true, contato: true, nomeEvento: true, distancia: true, lote: true,
        categoria: true, valorIngresso: true, total: true, criadoEm: true, comprovanteEnviadoEm: true,
      },
    }),
  ]);
  return { pagina, limite, total, totalPaginas: Math.ceil(total / limite), pedidos };
}

function montarWhere(filtros: FiltrosDashboard): Prisma.PedidoWhereInput {
  return {
    ...(filtros.nomeEvento ? { nomeEvento: filtros.nomeEvento } : {}),
    ...(filtros.dataInicio || filtros.dataFim ? { criadoEm: { ...(filtros.dataInicio ? { gte: filtros.dataInicio } : {}), ...(filtros.dataFim ? { lte: filtros.dataFim } : {}) } } : {}),
  };
}

function textoOpcional(valor: unknown, campo: string) {
  if (valor === undefined) return undefined;
  if (typeof valor !== "string") throw new Error(`${campo} inválido.`);
  return valor.trim() || undefined;
}

function dataOpcional(valor: unknown, campo: string) {
  const texto = textoOpcional(valor, campo);
  if (!texto) return undefined;
  const data = new Date(texto);
  if (Number.isNaN(data.getTime())) throw new Error(`${campo} inválida.`);
  return data;
}

function numeroPagina(valor: unknown, campo: string, padrao: number, maximo: number) {
  if (valor === undefined) return padrao;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1 || numero > maximo) throw new Error(`${campo} inválida.`);
  return numero;
}
