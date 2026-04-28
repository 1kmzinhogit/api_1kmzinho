import { Payment, Preference } from "mercadopago";
import { Prisma } from "@prisma/client";
import { v4 as uuid } from "uuid";
import { mp } from "../config/mercadoPago.js";
import { prisma } from "../config/db.js";
import { type PedidoInput } from "../models/Pedidos.js";
import { gerarCodigoPedido } from "./codigoPedidoService.js";
import { verificarLoteENotificar } from "./pdfService.js";

export async function criarPedido(payload: PedidoInput) {
  const referenciaExterna = uuid();

  const total = payload.itens.reduce(
    (soma, item) => soma + item.valor_unitario * item.quantidade,
    0
  );

  const existente = await prisma.pedido.findFirst({
    where: {
      cpf: payload.cpf,
      nomeEvento: payload.nomeEvento,
    },
  });

  if (existente) {
    throw new Error("Já existe uma compra para este CPF neste evento.");
  }

  const pedido = await prisma.$transaction(async (tx) => {
    const codigoPedido = await gerarCodigoPedido(tx, payload.nomeEvento, payload.lote);

    return tx.pedido.create({
      data: {
        codigoPedido,
        referenciaExterna,
        total,
        cpf: payload.cpf,
        contato: payload.contato,
        nomeEvento: payload.nomeEvento,
        lote: payload.lote,
        valorIngresso: payload.valorIngresso,
        nomeNaCamisa: payload.nomeNaCamisa,
        dataNascimento: payload.dataNascimento,
        nomePessoa: payload.nomePessoa,
        corCamisa: payload.corCamisa,
        equipe: payload.equipe ?? "",
        categoria: payload.categoria ?? "MASCULINO",
        numeroCamisa: payload.numeroCamisa,
        itens: {
          create: payload.itens.map((item) => ({
            titulo: item.titulo,
            quantidade: item.quantidade,
            valorUnit: item.valor_unitario,
          })),
        },
      },
      include: { itens: true },
    });
  });

  const preference = new Preference(mp);

  const resposta = await preference.create({
    body: {
      items: payload.itens.map((item) => ({
        id: item.id,
        title: item.titulo,
        quantity: item.quantidade,
        unit_price: item.valor_unitario,
        currency_id: "BRL",
      })),
      external_reference: referenciaExterna,
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
