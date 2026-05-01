import { Payment, Preference } from "mercadopago";
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
import { verificarLoteENotificar } from "./pdfService.js";

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
