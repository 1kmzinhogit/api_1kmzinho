import { Payment, PaymentRefund, Preference } from "mercadopago";
import { Prisma } from "@prisma/client";
import { v4 as uuid } from "uuid";
import { mp } from "../config/mercadoPago.js";
import { prisma } from "../config/db.js";
import { type CheckoutInput, type CategoriaPedido } from "../models/Pedidos.js";
import {
  calcularSlots,
  loteDentroDaJanela,
  montarItemMercadoPago,
  validarJanelaLoteDisponivel,
  validarLoteDisponivel,
  type KitCheckout,
} from "./checkoutRules.js";
import { gerarCodigoPedido } from "./codigoPedidoService.js";
import { verificarLoteENotificar } from "./pdfService.js";
import { calcularInfoReembolso } from "./refundRules.js";

type SolicitacaoReembolsoRaw = {
  id: string;
  id_pedido: string;
  status: string;
  email_contato: string;
  observacao: string | null;
  criado_em: Date;
  atualizado_em: Date;
};

type SolicitacaoReembolsoListagemRaw = SolicitacaoReembolsoRaw & {
  codigo_pedido: string | null;
  nome_evento: string;
  lote: string;
  distancia: string;
  total: number;
  nome_pessoa: string;
  cpf_pedido: string;
  contato: string;
};

export async function criarPedido(payload: CheckoutInput) {
  const categoria = payload.categoria ?? "MASCULINO";
  const idPedido = uuid();

  const { pedido, itemMercadoPago, slots, distancia } = await prisma.$transaction(
    async (tx) => {
      const kit = await buscarKitCheckout(tx, payload.kitId, categoria);

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${kit.id}))`;
      validarJanelaLoteDisponivel(kit.dataInicio, kit.dataFim);

      const existente = await tx.pedido.findFirst({
        where: {
          cpf: payload.cpf,
          nomeEvento: kit.nomeEvento,
          status: "APROVADO",
        },
      });

      if (existente) {
        throw new Error("Já existe uma compra aprovada para este CPF neste evento.");
      }

      const soldSlots = await tx.pedido.count({
        where: {
          nomeEvento: kit.nomeEvento,
          lote: kit.lote,
          status: "APROVADO",
        },
      });

      const slotsLote = calcularSlots(kit.capacidade, soldSlots);
      validarLoteDisponivel(slotsLote);

      const reservasAtivas = await tx.pedido.count({
        where: {
          nomeEvento: kit.nomeEvento,
          lote: kit.lote,
          status: { in: ["PENDENTE", "APROVADO"] },
        },
      });

      if (reservasAtivas >= kit.capacidade) {
        throw new Error("Lote esgotado ou com pagamentos em processamento.");
      }

      const item = montarItemMercadoPago(kit);
      const codigoPedido = await gerarCodigoPedido(tx, kit.nomeEvento, kit.lote);

      const pedidoCriado = await tx.pedido.create({
        data: {
          id: idPedido,
          codigoPedido,
          referenciaExterna: idPedido,
          total: item.unit_price,
          cpf: payload.cpf,
          contato: payload.contato,
          nomeEvento: kit.nomeEvento,
          distancia: kit.distancia,
          lote: kit.lote,
          valorIngresso: kit.preco.valor,
          nomeNaCamisa: payload.nomeNaCamisa,
          dataNascimento: payload.dataNascimento,
          nomePessoa: payload.nomePessoa,
          corCamisa: payload.corCamisa,
          equipe: payload.equipe ?? "",
          categoria,
          numeroCamisa: payload.numeroCamisa,
          itens: {
            create: {
              titulo: item.title,
              quantidade: item.quantity,
              valorUnit: item.unit_price,
            },
          },
        },
        include: { itens: true },
      });

      return {
        pedido: pedidoCriado,
        itemMercadoPago: item,
        slots: slotsLote,
        distancia: kit.distancia,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  const preference = new Preference(mp);
  const preferenceBody = {
    items: [itemMercadoPago],
    external_reference: pedido.id,
    back_urls: {
      success: `${process.env.FRONTEND_URL}/pagamento/status?status=sucesso`,
      failure: `${process.env.FRONTEND_URL}/pagamento/status?status=erro`,
      pending: `${process.env.FRONTEND_URL}/pagamento/status?status=pendente`,
    },
    auto_return: "approved",
    notification_url: `${process.env.API_PUBLIC_URL}/webhooks/mercadopago`,
  };
  const idempotencyKey = pedido.id;

  let resposta;

  try {
    resposta = await preference.create({
      body: preferenceBody,
      requestOptions: {
        idempotencyKey,
      },
    });
  } catch (error: unknown) {
    console.error("Erro ao criar preferência no Mercado Pago:", {
      mercadoPago: extrairErroMercadoPago(error),
      idempotencyKey,
      preferenceBody,
    });

    throw error;
  }

  if (!resposta.id) {
    throw new Error("Mercado Pago não retornou o ID da preferência.");
  }

  await prisma.pedido.update({
    where: { id: pedido.id },
    data: { idPreferencia: resposta.id },
  });

  return {
    idPedido: pedido.id,
    codigoPedido: pedido.codigoPedido,
    idPreferencia: resposta.id,
    linkPagamento: resposta.init_point,
    linkSandbox: resposta.sandbox_init_point,
    status: pedido.status,
    nomeEvento: pedido.nomeEvento,
    distancia,
    lote: pedido.lote,
    valorIngresso: pedido.valorIngresso,
    totalSlots: slots.totalSlots,
    soldSlots: slots.soldSlots,
    remainingSlots: slots.remainingSlots,
  };
}

async function buscarKitCheckout(
  tx: Prisma.TransactionClient,
  kitId: string,
  categoria: CategoriaPedido
): Promise<KitCheckout> {
  const kit = await tx.configLote.findFirst({
    where: {
      id: kitId,
      ativo: true,
    },
    include: {
      precos: {
        where: {
          categoria,
          ativo: true,
        },
        take: 1,
      },
    },
  });

  if (!kit || kit.precos.length === 0) {
    throw new Error("kitId inválido ou sem preço ativo para a categoria.");
  }

  return {
    id: kit.id,
    nomeEvento: kit.nomeEvento,
    distancia: "distancia" in kit ? String(kit.distancia) : "1KM",
    lote: kit.lote,
    capacidade: kit.capacidade,
    dataInicio: kit.dataInicio,
    dataFim: kit.dataFim,
    preco: {
      categoria,
      valor: kit.precos[0].valor,
    },
  };
}

export async function listarStatusLotes(nomeEvento?: string) {
  const lotes = await prisma.configLote.findMany({
    where: nomeEvento ? { nomeEvento } : undefined,
    select: {
      id: true,
      nomeEvento: true,
      distancia: true,
      lote: true,
      ativo: true,
      capacidade: true,
      dataInicio: true,
      dataFim: true,
      precos: {
        where: { ativo: true },
        orderBy: { categoria: "asc" },
        select: {
          categoria: true,
          valor: true,
        },
      },
    },
    orderBy: [
      { nomeEvento: "asc" },
      { distancia: "asc" },
      { dataInicio: "asc" },
      { lote: "asc" },
    ],
  });

  const agora = new Date();
  const totaisPorLote = await buscarTotaisPedidosPorLote(
    lotes.map((lote) => ({
      nomeEvento: lote.nomeEvento,
      lote: lote.lote,
    }))
  );

  return lotes.map((loteConfig) => {
    const totais = totaisPorLote.get(chaveLote(loteConfig.nomeEvento, loteConfig.lote));
    const vendidos = totais?.vendidos ?? 0;
    const reservados = totais?.reservados ?? 0;

    const vagasRestantes = Math.max(0, loteConfig.capacidade - vendidos);
    const vagasReservaveis = Math.max(0, loteConfig.capacidade - reservados);
    const percentualVendido = calcularPercentual(vendidos, loteConfig.capacidade);
    const dentroDaJanela = loteDentroDaJanela(
      loteConfig.dataInicio,
      loteConfig.dataFim,
      agora
    );
    const disponivel =
      loteConfig.ativo &&
      dentroDaJanela &&
      vagasReservaveis > 0 &&
      loteConfig.precos.length > 0;

    return {
      id: loteConfig.id,
      nomeEvento: loteConfig.nomeEvento,
      distancia: loteConfig.distancia,
      lote: loteConfig.lote,
      ativo: loteConfig.ativo,
      disponivel,
      motivoIndisponibilidade: motivoIndisponibilidadeLote({
        ativo: loteConfig.ativo,
        dataInicio: loteConfig.dataInicio,
        dataFim: loteConfig.dataFim,
        dentroDaJanela,
        vagasReservaveis,
        possuiPrecoAtivo: loteConfig.precos.length > 0,
        agora,
      }),
      capacidade: loteConfig.capacidade,
      vendidos,
      reservados,
      vagasRestantes,
      vagasReservaveis,
      percentualVendido,
      dataInicio: loteConfig.dataInicio,
      dataFim: loteConfig.dataFim,
      precos: loteConfig.precos.map((preco) => ({
        categoria: preco.categoria,
        valor: preco.valor,
      })),
    };
  });
}

async function buscarTotaisPedidosPorLote(
  lotes: Array<{ nomeEvento: string; lote: string }>
): Promise<Map<string, { vendidos: number; reservados: number }>> {
  if (lotes.length === 0) {
    return new Map();
  }

  const filtros = lotes.map((lote) => ({
    nomeEvento: lote.nomeEvento,
    lote: lote.lote,
  }));
  const totais = await prisma.pedido.groupBy({
    by: ["nomeEvento", "lote", "status"],
    where: {
      OR: filtros,
      status: { in: ["PENDENTE", "APROVADO"] },
    },
    _count: { _all: true },
  });
  const porLote = new Map<string, { vendidos: number; reservados: number }>();

  for (const total of totais) {
    const key = chaveLote(total.nomeEvento, total.lote);
    const atual = porLote.get(key) ?? { vendidos: 0, reservados: 0 };
    const quantidade = total._count._all;

    if (total.status === "APROVADO") {
      atual.vendidos += quantidade;
    }

    atual.reservados += quantidade;
    porLote.set(key, atual);
  }

  return porLote;
}

function chaveLote(nomeEvento: string, lote: string): string {
  return `${nomeEvento}\u0000${lote}`;
}

function extrairErroMercadoPago(error: unknown) {
  if (!isRecord(error)) {
    return { message: String(error) };
  }

  const apiResponse = isRecord(error.api_response) ? error.api_response : undefined;
  const response = isRecord(error.response) ? error.response : undefined;
  const headers = extrairHeaders(apiResponse?.headers ?? response?.headers);

  return {
    name: typeof error.name === "string" ? error.name : undefined,
    message: typeof error.message === "string" ? error.message : undefined,
    status: error.status ?? response?.status ?? apiResponse?.status,
    error: error.error,
    cause: error.cause,
    body: response?.data ?? error.body,
    xRequestId: headers["x-request-id"],
    headers,
  };
}

function extrairHeaders(headers: unknown): Record<string, string> {
  if (!headers) {
    return {};
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(
      headers
        .filter((header): header is [string, string[] | string] => Array.isArray(header))
        .map(([key, value]) => [
          key.toLowerCase(),
          Array.isArray(value) ? value.join(", ") : String(value),
        ])
    );
  }

  if (isRecord(headers)) {
    return Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)])
    );
  }

  return {};
}

function calcularPercentual(valor: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((valor / total) * 10000) / 100);
}

function motivoIndisponibilidadeLote(params: {
  ativo: boolean;
  dataInicio: Date | null;
  dataFim: Date | null;
  dentroDaJanela: boolean;
  vagasReservaveis: number;
  possuiPrecoAtivo: boolean;
  agora: Date;
}): string | null {
  if (!params.ativo) {
    return "Lote inativo.";
  }

  if (params.dataInicio && params.agora < params.dataInicio) {
    return "Lote ainda não está disponível.";
  }

  if (params.dataFim && params.agora > params.dataFim) {
    return "Lote encerrado.";
  }

  if (!params.dentroDaJanela) {
    return "Lote fora do período de venda.";
  }

  if (params.vagasReservaveis <= 0) {
    return "Lote esgotado ou com pagamentos em processamento.";
  }

  if (!params.possuiPrecoAtivo) {
    return "Lote sem preço ativo.";
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function processarWebhookPagamento(idPagamentoMp: string) {
  const clientePagamento = new Payment(mp);
  const pagamentoMp = await clientePagamento.get({ id: idPagamentoMp });

  const status = pagamentoMp.status;
  const referenciaExterna = pagamentoMp.external_reference;

  if (!referenciaExterna) {
    throw new Error("Referência externa ausente no pagamento.");
  }

  const pedido = await prisma.pedido.findUnique({
    where: { referenciaExterna },
  });

  if (!pedido) {
    throw new Error(`Pedido não encontrado: ${referenciaExterna}`);
  }

  const statusMapeado = mapearStatus(status ?? "pending");

  await prisma.$transaction([
    prisma.pedido.update({
      where: { id: pedido.id },
      data: {
        status: statusMapeado,
        idPagamento: String(pagamentoMp.id),
      },
    }),
    prisma.pagamento.upsert({
      where: { idPagamentoMp: String(pagamentoMp.id) },
      update: {
        status: statusMapeado,
        respostaRaw: pagamentoMp as object,
      },
      create: {
        idPagamentoMp: String(pagamentoMp.id),
        status: statusMapeado,
        respostaRaw: pagamentoMp as object,
        idPedido: pedido.id,
      },
    }),
  ]);

  if (statusMapeado === "CANCELADO") {
    await marcarSolicitacoesPendentesComoProcessadas(pedido.id);
  }

  // Verifica virada de lote ao aprovar pagamento
  if (statusMapeado === "APROVADO") {
    await verificarLoteENotificar(pedido.nomeEvento, pedido.lote).catch((err) => {
      console.error("Erro ao verificar lote:", err);
    });
  }

  return { idPedido: pedido.id, status: statusMapeado };
}

export async function processarWebhookPagamentoSimulado(params: {
  idPedido?: string;
  referenciaExterna?: string;
  idPagamentoMp: string;
  statusMp: string;
}) {
  const filtros: Prisma.PedidoWhereInput[] = [];

  if (params.idPedido) {
    filtros.push({ id: params.idPedido });
  }

  if (params.referenciaExterna) {
    filtros.push({ referenciaExterna: params.referenciaExterna });
  }

  if (filtros.length === 0) {
    throw new Error("Informe idPedido ou referenciaExterna para simular webhook.");
  }

  const pedido = await prisma.pedido.findFirst({
    where: { OR: filtros },
  });

  if (!pedido) {
    throw new Error("Pedido não encontrado para simulação de webhook.");
  }

  const statusMapeado = mapearStatus(params.statusMp);
  const respostaRaw = {
    id: params.idPagamentoMp,
    status: params.statusMp,
    external_reference: pedido.referenciaExterna,
    simulated: true,
  };

  await prisma.$transaction([
    prisma.pedido.update({
      where: { id: pedido.id },
      data: {
        status: statusMapeado,
        idPagamento: params.idPagamentoMp,
      },
    }),
    prisma.pagamento.upsert({
      where: { idPagamentoMp: params.idPagamentoMp },
      update: {
        status: statusMapeado,
        respostaRaw,
      },
      create: {
        idPagamentoMp: params.idPagamentoMp,
        status: statusMapeado,
        respostaRaw,
        idPedido: pedido.id,
      },
    }),
  ]);

  if (statusMapeado === "CANCELADO") {
    await marcarSolicitacoesPendentesComoProcessadas(pedido.id);
  }

  if (statusMapeado === "APROVADO") {
    await verificarLoteENotificar(pedido.nomeEvento, pedido.lote).catch((err) => {
      console.error("Erro ao verificar lote:", err);
    });
  }

  return { idPedido: pedido.id, status: statusMapeado };
}

export async function consultarPedidosPorCpf(cpf: string) {
  const cpfsPossiveis = gerarVariacoesCpf(cpf);

  if (cpfsPossiveis.length === 0) {
    throw new Error("CPF inválido.");
  }

  const pedidos = await prisma.pedido.findMany({
    where: {
      cpf: { in: cpfsPossiveis },
      status: { in: ["APROVADO", "PENDENTE", "CANCELADO", "REJEITADO"] },
    },
    orderBy: { criadoEm: "desc" },
    select: {
      id: true,
      codigoPedido: true,
      status: true,
      contato: true,
      nomeEvento: true,
      lote: true,
      distancia: true,
      total: true,
      criadoEm: true,
      nomePessoa: true,
      pagamentos: {
        orderBy: { criadoEm: "desc" },
        take: 1,
        select: { respostaRaw: true },
      },
    },
  });

  return pedidos.map((pedido) => {
    const infoReembolso = calcularInfoReembolso({
      status: pedido.status,
      criadoEm: pedido.criadoEm,
      nomeEvento: pedido.nomeEvento,
    });

    return {
      idPedido: pedido.id,
      codigoPedido: pedido.codigoPedido,
      status: pedido.status,
      nomeEvento: pedido.nomeEvento,
      lote: pedido.lote,
      distancia: pedido.distancia,
      total: pedido.total,
      criadoEm: pedido.criadoEm,
      dataCompra: infoReembolso.dataCompra,
      emailContato: extrairEmailContato(pedido.contato, pedido.pagamentos[0]?.respostaRaw),
      prazoReembolsoDias: infoReembolso.prazoReembolsoDias,
      dataLimiteReembolso: infoReembolso.dataLimiteReembolso,
      eventoComDataAlterada: infoReembolso.eventoComDataAlterada,
      nomePessoa: mascararNome(pedido.nomePessoa),
      permiteSolicitarReembolso: infoReembolso.permiteSolicitarReembolso,
      motivoIndisponibilidadeReembolso: infoReembolso.motivoIndisponibilidadeReembolso,
    };
  });
}

export async function solicitarReembolsoPedido(params: {
  idPedido: string;
  cpf: string;
  emailContato: string;
  observacao?: string;
}) {
  const cpfsPossiveis = gerarVariacoesCpf(params.cpf);

  if (cpfsPossiveis.length === 0) {
    throw new Error("CPF inválido.");
  }

  if (!emailValido(params.emailContato)) {
    throw new Error("Informe um e-mail válido para contato.");
  }

  const pedido = await prisma.pedido.findFirst({
    where: {
      id: params.idPedido,
      cpf: { in: cpfsPossiveis },
    },
    include: { pagamentos: true },
  });

  if (!pedido) {
    throw new Error("Pedido não encontrado para o CPF informado.");
  }

  if (pedido.status !== "APROVADO") {
    throw new Error(
      "Compra não foi efetuada ou ainda não foi aprovada. Por isso, não será possível solicitar reembolso."
    );
  }

  const [solicitacao] = await prisma.$queryRaw<SolicitacaoReembolsoRaw[]>`
    INSERT INTO solicitacoes_reembolso (
      id,
      id_pedido,
      cpf,
      email_contato,
      observacao,
      status
    )
    VALUES (
      ${uuid()},
      ${pedido.id},
      ${params.cpf},
      ${params.emailContato},
      ${params.observacao ?? null},
      'PENDENTE'
    )
    ON CONFLICT (id_pedido) WHERE status = 'PENDENTE'
    DO UPDATE SET
      cpf = EXCLUDED.cpf,
      email_contato = EXCLUDED.email_contato,
      observacao = EXCLUDED.observacao,
      atualizado_em = CURRENT_TIMESTAMP
    RETURNING id, id_pedido, status, email_contato, observacao, criado_em, atualizado_em
  `;

  const reembolso = await reembolsarPedido({
    idPedido: pedido.id,
    ignorarPrazo: true,
  });

  return {
    ok: true,
    idPedido: pedido.id,
    idSolicitacao: solicitacao.id,
    statusSolicitacao: "PROCESSADO",
    emailContato: params.emailContato,
    reembolso,
    mensagem: "Reembolso processado com sucesso.",
  };
}

export async function listarSolicitacoesReembolso(status = "PENDENTE") {
  const solicitacoes = await prisma.$queryRaw<SolicitacaoReembolsoListagemRaw[]>`
    SELECT
      sr.id,
      sr.id_pedido,
      sr.status,
      sr.email_contato,
      sr.observacao,
      sr.criado_em,
      sr.atualizado_em,
      p.codigo_pedido,
      p.nome_evento,
      p.lote,
      p.distancia,
      p.total,
      p.nome_pessoa,
      p.cpf AS cpf_pedido,
      p.contato
    FROM solicitacoes_reembolso sr
    INNER JOIN pedidos p ON p.id = sr.id_pedido
    WHERE sr.status = ${status}
    ORDER BY sr.criado_em DESC
  `;

  return solicitacoes.map((solicitacao) => ({
    idSolicitacao: solicitacao.id,
    idPedido: solicitacao.id_pedido,
    codigoPedido: solicitacao.codigo_pedido,
    statusSolicitacao: solicitacao.status,
    emailContato: solicitacao.email_contato,
    observacao: solicitacao.observacao,
    criadoEm: solicitacao.criado_em,
    atualizadoEm: solicitacao.atualizado_em,
    pedido: {
      nomeEvento: solicitacao.nome_evento,
      lote: solicitacao.lote,
      distancia: solicitacao.distancia,
      total: solicitacao.total,
      nomePessoa: solicitacao.nome_pessoa,
      cpf: solicitacao.cpf_pedido,
      contato: solicitacao.contato,
    },
  }));
}

export async function atualizarStatusSolicitacaoReembolso(params: {
  idSolicitacao: string;
  status: string;
}) {
  const status = normalizarStatusSolicitacao(params.status);

  if (!status) {
    throw new Error("Status de solicitação inválido.");
  }

  const [solicitacao] = await prisma.$queryRaw<SolicitacaoReembolsoRaw[]>`
    UPDATE solicitacoes_reembolso
    SET
      status = ${status},
      atualizado_em = CURRENT_TIMESTAMP
    WHERE id = ${params.idSolicitacao}
    RETURNING id, id_pedido, status, email_contato, observacao, criado_em, atualizado_em
  `;

  if (!solicitacao) {
    throw new Error("Solicitação de reembolso não encontrada.");
  }

  return {
    idSolicitacao: solicitacao.id,
    idPedido: solicitacao.id_pedido,
    statusSolicitacao: solicitacao.status,
    emailContato: solicitacao.email_contato,
    observacao: solicitacao.observacao,
    criadoEm: solicitacao.criado_em,
    atualizadoEm: solicitacao.atualizado_em,
  };
}

export async function reembolsarPedido(params: {
  idPedido: string;
  amount?: number;
  ignorarPrazo?: boolean;
}) {
  const pedido = await prisma.pedido.findUnique({
    where: { id: params.idPedido },
    include: { pagamentos: true },
  });

  if (!pedido) {
    throw new Error("Pedido não encontrado.");
  }

  if (pedido.status !== "APROVADO") {
    throw new Error("Apenas pedidos aprovados podem ser reembolsados.");
  }

  const infoReembolso = calcularInfoReembolso({
    status: pedido.status,
    criadoEm: pedido.criadoEm,
    nomeEvento: pedido.nomeEvento,
  });

  if (!params.ignorarPrazo && !infoReembolso.permiteSolicitarReembolso) {
    throw new Error(
      infoReembolso.motivoIndisponibilidadeReembolso ??
        "Pedido fora do prazo permitido para reembolso."
    );
  }

  const idPagamentoMp =
    pedido.idPagamento ?? pedido.pagamentos.at(-1)?.idPagamentoMp;

  if (!idPagamentoMp) {
    throw new Error("Pedido não possui pagamento confirmado para reembolso.");
  }

  if (params.amount !== undefined) {
    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      throw new Error("Valor de reembolso inválido.");
    }

    if (params.amount !== pedido.total) {
      throw new Error("Esta API permite apenas reembolso total do pedido.");
    }
  }

  const clienteReembolso = new PaymentRefund(mp);
  const reembolso = await clienteReembolso.create({
    payment_id: idPagamentoMp,
    body: params.amount ? { amount: params.amount } : undefined,
  });

  if (reembolso.status !== "approved") {
    throw new Error(`Reembolso não aprovado pelo Mercado Pago: ${reembolso.status ?? "sem status"}.`);
  }

  await prisma.$transaction([
    prisma.pedido.update({
      where: { id: pedido.id },
      data: { status: "CANCELADO" },
    }),
    prisma.pagamento.upsert({
      where: { idPagamentoMp },
      update: {
        status: "CANCELADO",
        respostaRaw: {
          ...(pedido.pagamentos.at(-1)?.respostaRaw as object | null),
          refund: reembolso as object,
        },
      },
      create: {
        idPagamentoMp,
        status: "CANCELADO",
        respostaRaw: { refund: reembolso as object },
        idPedido: pedido.id,
      },
    }),
  ]);

  await marcarSolicitacoesPendentesComoProcessadas(pedido.id);

  return {
    idPedido: pedido.id,
    status: "CANCELADO",
    idReembolso: reembolso.id,
    valorReembolsado: reembolso.amount,
  };
}

export async function cancelarPagamentoPendente(params: {
  idPedido: string;
}) {
  const pedido = await prisma.pedido.findUnique({
    where: { id: params.idPedido },
    include: { pagamentos: true },
  });

  if (!pedido) {
    throw new Error("Pedido não encontrado.");
  }

  if (pedido.status !== "PENDENTE") {
    throw new Error("Apenas pedidos pendentes podem ser cancelados. Pedidos aprovados devem seguir o fluxo de reembolso.");
  }

  const idPagamentoMp =
    pedido.idPagamento ?? pedido.pagamentos.at(-1)?.idPagamentoMp;

  if (!idPagamentoMp) {
    throw new Error("Pedido não possui pagamento pendente para cancelamento.");
  }

  const clientePagamento = new Payment(mp);
  const pagamentoMp = await clientePagamento.get({ id: idPagamentoMp });
  const statusMp = pagamentoMp.status ?? "";

  if (!["pending", "in_process"].includes(statusMp)) {
    throw new Error(`Pagamento não pode ser cancelado no status atual do Mercado Pago: ${statusMp || "sem status"}.`);
  }

  const pagamentoCancelado = await clientePagamento.cancel({ id: idPagamentoMp });
  const statusMapeado = mapearStatus(pagamentoCancelado.status ?? "cancelled");

  await prisma.$transaction([
    prisma.pedido.update({
      where: { id: pedido.id },
      data: { status: statusMapeado },
    }),
    prisma.pagamento.upsert({
      where: { idPagamentoMp },
      update: {
        status: statusMapeado,
        respostaRaw: pagamentoCancelado as object,
      },
      create: {
        idPagamentoMp,
        status: statusMapeado,
        respostaRaw: pagamentoCancelado as object,
        idPedido: pedido.id,
      },
    }),
  ]);

  return {
    idPedido: pedido.id,
    status: statusMapeado,
    idPagamentoMp,
    statusMercadoPago: pagamentoCancelado.status,
    statusDetalheMercadoPago: pagamentoCancelado.status_detail,
  };
}

function gerarVariacoesCpf(cpf: string): string[] {
  const cpfLimpo = cpf.replace(/\D/g, "");

  if (cpfLimpo.length !== 11) {
    return [];
  }

  return Array.from(new Set([
    cpf,
    cpfLimpo,
    cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"),
  ]));
}

async function marcarSolicitacoesPendentesComoProcessadas(idPedido: string) {
  await prisma.$executeRaw`
    UPDATE solicitacoes_reembolso
    SET
      status = 'PROCESSADO',
      atualizado_em = CURRENT_TIMESTAMP
    WHERE id_pedido = ${idPedido}
      AND status = 'PENDENTE'
  `;
}

function normalizarStatusSolicitacao(status: string): string | null {
  const statusNormalizado = status.trim().toUpperCase();
  const permitidos = new Set(["PENDENTE", "PROCESSADO", "REJEITADO"]);

  return permitidos.has(statusNormalizado) ? statusNormalizado : null;
}

function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function extrairEmailContato(contato: string, respostaRaw?: Prisma.JsonValue): string | null {
  if (emailValido(contato)) {
    return contato;
  }

  const emailPagamento = buscarEmailEmObjeto(respostaRaw);

  return emailPagamento && emailValido(emailPagamento) ? emailPagamento : null;
}

function buscarEmailEmObjeto(valor: Prisma.JsonValue | undefined): string | null {
  if (!valor || typeof valor !== "object") {
    return null;
  }

  if (Array.isArray(valor)) {
    for (const item of valor) {
      const email = buscarEmailEmObjeto(item);
      if (email) {
        return email;
      }
    }

    return null;
  }

  const objeto = valor as Record<string, Prisma.JsonValue>;
  const emailDireto = objeto.email;

  if (typeof emailDireto === "string") {
    return emailDireto;
  }

  for (const chave of ["payer", "cardholder", "additional_info"]) {
    const email = buscarEmailEmObjeto(objeto[chave]);
    if (email) {
      return email;
    }
  }

  return null;
}

function mascararNome(nome: string): string {
  const partes = nome.trim().split(/\s+/);

  if (partes.length === 0 || !partes[0]) {
    return "";
  }

  return partes.length === 1 ? partes[0] : `${partes[0]} ${partes.at(-1)?.[0] ?? ""}.`;
}

function mapearStatus(statusMp: string): "PENDENTE" | "APROVADO" | "REJEITADO" | "CANCELADO" {
  const mapa: Record<string, "PENDENTE" | "APROVADO" | "REJEITADO" | "CANCELADO"> = {
    approved: "APROVADO",
    rejected: "REJEITADO",
    pending: "PENDENTE",
    cancelled: "CANCELADO",
    in_process: "PENDENTE",
    in_mediation: "PENDENTE",
    authorized: "PENDENTE",
    refunded: "CANCELADO",
    charged_back: "CANCELADO",
  };

  return mapa[statusMp] ?? "PENDENTE";
}
