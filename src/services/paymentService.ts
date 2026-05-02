import { Payment, PaymentRefund, Preference } from "mercadopago";
import { Prisma } from "@prisma/client";
import { v4 as uuid } from "uuid";
import { mp } from "../config/mercadoPago.js";
import { prisma } from "../config/db.js";
import { type CheckoutInput, type CategoriaPedido } from "../models/Pedidos.js";
import {
  calcularSlots,
  montarItemMercadoPago,
  validarLoteDisponivel,
  type KitCheckout,
} from "./checkoutRules.js";
import { gerarCodigoPedido } from "./codigoPedidoService.js";
import { enviarSolicitacaoReembolso } from "./emailService.js";
import { verificarLoteENotificar } from "./pdfService.js";
import { calcularInfoReembolso } from "./refundRules.js";

export async function criarPedido(payload: CheckoutInput) {
  const categoria = payload.categoria ?? "MASCULINO";
  const idPedido = uuid();

  const { pedido, itemMercadoPago, slots, distancia } = await prisma.$transaction(
    async (tx) => {
      const kit = await buscarKitCheckout(tx, payload.kitId, categoria);

      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${kit.id}))`;

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

  const resposta = await preference.create({
    body: {
      items: [itemMercadoPago],
      external_reference: pedido.id,
      back_urls: {
        success: `${process.env.FRONTEND_URL}/pagamento/status?status=sucesso`,
        failure: `${process.env.FRONTEND_URL}/pagamento/status?status=erro`,
        pending: `${process.env.FRONTEND_URL}/pagamento/status?status=pendente`,
      },
      auto_return: "approved",
      notification_url: `${process.env.API_PUBLIC_URL}/webhooks/mercadopago`,
    },
  });

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
    preco: {
      categoria,
      valor: kit.precos[0].valor,
    },
  };
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

  const infoReembolso = calcularInfoReembolso({
    status: pedido.status,
    criadoEm: pedido.criadoEm,
    nomeEvento: pedido.nomeEvento,
  });

  if (!infoReembolso.permiteSolicitarReembolso) {
    throw new Error(
      infoReembolso.motivoIndisponibilidadeReembolso ??
        "Pedido fora do prazo permitido para reembolso."
    );
  }

  await enviarSolicitacaoReembolso({
    idPedido: pedido.id,
    codigoPedido: pedido.codigoPedido,
    nomeEvento: pedido.nomeEvento,
    lote: pedido.lote,
    distancia: pedido.distancia,
    nomePessoa: pedido.nomePessoa,
    cpf: pedido.cpf,
    contato: pedido.contato,
    emailContato: params.emailContato,
    total: pedido.total,
    dataCompra: infoReembolso.dataCompra,
    dataLimiteReembolso: infoReembolso.dataLimiteReembolso,
    prazoReembolsoDias: infoReembolso.prazoReembolsoDias,
    eventoComDataAlterada: infoReembolso.eventoComDataAlterada,
    observacao: params.observacao,
  });

  return {
    ok: true,
    idPedido: pedido.id,
    emailContato: params.emailContato,
    mensagem:
      "Solicitação de reembolso enviada. Nossa equipe fará a análise e entrará em contato pelo e-mail informado.",
  };
}

export async function reembolsarPedido(params: {
  idPedido: string;
  amount?: number;
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

  if (!infoReembolso.permiteSolicitarReembolso) {
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

  return {
    idPedido: pedido.id,
    status: "CANCELADO",
    idReembolso: reembolso.id,
    valorReembolsado: reembolso.amount,
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
