import { type Prisma, type StatusPedido } from "@prisma/client";
import { prisma } from "../config/db.js";
import { listarStatusLotes } from "./paymentService.js";

type FiltrosDashboard = {
  nomeEvento?: string;
  dataInicio?: Date;
  dataFim?: Date;
};

type StatusLoteDashboard = {
  id: string;
  nomeEvento: string;
  lote: string;
  distancia: string;
  capacidade: number;
  vagasReservaveis: number;
  percentualVendido: number;
  precos: Array<{ valor: number }>;
  grupoCapacidade: string | null;
  [campo: string]: unknown;
};

export function validarFiltrosDashboard(query: Record<string, unknown>): FiltrosDashboard {
  const filtros = {
    nomeEvento: textoOpcional(query.nomeEvento, "nomeEvento"),
    dataInicio: dataOpcional(query.dataInicio, "dataInicio"),
    dataFim: dataOpcional(query.dataFim, "dataFim"),
  };
  if (filtros.dataInicio && filtros.dataFim && filtros.dataInicio > filtros.dataFim) {
    throw new Error("intervalo de datas inválido.");
  }
  return filtros;
}

export async function listarEventosDashboard() {
  const lotes = await prisma.configLote.findMany({
    select: { id: true, nomeEvento: true, distancia: true, lote: true, capacidade: true, ativo: true, grupoCapacidade: true, capacidadeGrupo: true, precos: { where: { ativo: true }, select: { valor: true } } },
    orderBy: [{ nomeEvento: "asc" }, { distancia: "asc" }, { lote: "asc" }],
  });
  const eventos = new Map<string, { nomeEvento: string; lotes: Array<typeof lotes[number]> }>();

  for (const lote of lotes) {
    const evento = eventos.get(lote.nomeEvento) ?? {
      nomeEvento: lote.nomeEvento,
      lotes: [],
    };
    evento.lotes.push(lote);
    eventos.set(lote.nomeEvento, evento);
  }

  return Array.from(eventos.values()).map((evento) => ({
    nomeEvento: evento.nomeEvento,
    lotes: evento.lotes.map((lote) => ({
      id: lote.id, nomeEvento: lote.nomeEvento, distancia: lote.distancia, lote: lote.lote,
      capacidade: lote.capacidade, ativo: lote.ativo,
      grupoCapacidade: lote.grupoCapacidade ? { id: lote.grupoCapacidade, capacidadeTotal: lote.capacidadeGrupo } : null,
      precos: Array.from(new Set(lote.precos.map((preco) => preco.valor))),
    })),
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

  const gruposVagas = new Set<string>();
  const vagasRestantes = lotesStatus.reduce((total, lote) => {
    const chave = lote.grupoCapacidade ? `grupo:${lote.grupoCapacidade}` : `lote:${lote.id}`;
    if (gruposVagas.has(chave)) return total;
    gruposVagas.add(chave);
    return total + lote.vagasReservaveis;
  }, 0);

  return {
    atualizadoEm: new Date(),
    resumo: {
      inscricoesAprovadas: totaisStatus.APROVADO,
      pedidosPendentes: totaisStatus.PENDENTE,
      pedidosRejeitados: totaisStatus.REJEITADO,
      pedidosCancelados: totaisStatus.CANCELADO,
      valorArrecadado,
      valorInscricoes,
      valorTaxas: Math.round((valorArrecadado - valorInscricoes) * 100) / 100,
      ticketMedio: totaisStatus.APROVADO ? valorArrecadado / totaisStatus.APROVADO : 0,
      vagasRestantes,
    },
    lotes: lotesStatus.map((lote) => {
      const metricas = porLote.get(`${lote.nomeEvento}::${lote.lote}::${lote.distancia}`) ?? {
        aprovados: 0, pendentes: 0, rejeitados: 0, cancelados: 0, valorArrecadado: 0, valorInscricoes: 0,
      };
      return {
        nomeEvento: lote.nomeEvento,
        distancia: lote.distancia,
        lote: lote.lote,
        capacidade: lote.capacidade,
        vendidos: metricas.aprovados,
        pendentes: metricas.pendentes,
        vagasRestantes: lote.vagasReservaveis,
        percentualVendido: lote.percentualVendido,
        valorArrecadado: metricas.valorArrecadado,
        valorInscricoes: metricas.valorInscricoes,
        valorTaxas: Math.round((metricas.valorArrecadado - metricas.valorInscricoes) * 100) / 100,
        precos: Array.from(new Set(lote.precos.map((preco) => preco.valor))),
      };
    }),
  };
}

export async function listarPedidosDashboard(query: Record<string, unknown>) {
  const filtros = validarFiltrosDashboard(query);
  const statusTexto = textoOpcional(query.status, "status");
  const status = statusTexto?.toUpperCase() as StatusPedido | undefined;
  if (status && !["PENDENTE", "APROVADO", "REJEITADO", "CANCELADO"].includes(status)) {
    throw new Error("status inválido.");
  }
  const lote = textoOpcional(query.lote, "lote");
  const equipe = textoOpcional(query.equipe, "equipe");
  const numeroCamisa = textoOpcional(query.numeroCamisa, "numeroCamisa");
  const numeroInscricao = inteiroOpcional(query.numeroInscricao, "numeroInscricao");
  const busca = textoOpcional(query.busca, "busca");
  const pagina = numeroPagina(query.pagina, "pagina", 1, 1);
  const limite = numeroPagina(query.limite, "limite", 20, 100);
  const where: Prisma.PedidoWhereInput = {
    ...montarWhere(filtros),
    ...(status ? { status } : {}),
    ...(lote ? { lote } : {}),
    ...(equipe ? { equipe: { contains: equipe, mode: "insensitive" } } : {}),
    ...(numeroCamisa ? { numeroCamisa } : {}),
    ...(numeroInscricao !== undefined ? { numeroInscricao } : {}),
  };
  if (busca) {
    where.OR = [
      { nomePessoa: { contains: busca, mode: "insensitive" } },
      { email: { contains: busca, mode: "insensitive" } },
      { codigoPedido: { contains: busca, mode: "insensitive" } },
      { equipe: { contains: busca, mode: "insensitive" } },
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
        email: true, contato: true, nomeEvento: true, distancia: true, lote: true,
        categoria: true, equipe: true, numeroCamisa: true, corCamisa: true,
        valorIngresso: true, total: true, criadoEm: true, comprovanteEnviadoEm: true,
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
  const apenasData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  const data = apenasData
    ? new Date(`${texto}T${campo === "dataFim" ? "23:59:59.999" : "00:00:00.000"}Z`)
    : new Date(texto);
  if (Number.isNaN(data.getTime())) throw new Error(`${campo} inválida.`);
  if (campo === "dataInicio") data.setUTCHours(0, 0, 0, 0);
  if (campo === "dataFim") data.setUTCHours(23, 59, 59, 999);
  return data;
}

function inteiroOpcional(valor: unknown, campo: string) {
  if (valor === undefined || valor === "") return undefined;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 0) throw new Error(`${campo} inválido.`);
  return numero;
}

function numeroPagina(valor: unknown, campo: string, padrao: number, maximo: number) {
  if (valor === undefined) return padrao;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1 || numero > maximo) throw new Error(`${campo} inválida.`);
  return numero;
}
