import { Payment, Preference } from "mercadopago";
import { v4 as uuid } from "uuid";
import { mp } from "../config/mercadoPago.js";
import { prisma } from "../config/db.js";
import { type OrderInput } from "../models/Order.js";

export async function createOrder(payload: OrderInput) {
  const externalReference = uuid();

  const totalAmount = payload.items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );

  const existing = await prisma.order.findFirst({
    where: {
      cpf: payload.cpf,
      raceName: payload.raceName,
    },
  });

  if (existing) {
    throw new Error("Já existe uma compra para este CPF neste evento.");
  }

  const order = await prisma.order.create({
    data: {
      externalReference,
      totalAmount,
      cpf: payload.cpf,
      contactNumber: payload.contactNumber,
      raceName: payload.raceName,
      lot: payload.lot,
      ticketValue: payload.ticketValue,
      shirtName: payload.shirtName,
      shirtNumber: payload.shirtNumber,
      shirtColor: payload.shirtColor,
      items: {
        create: payload.items.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          unitPrice: item.unit_price,
        })),
      },
    },
    include: { items: true },
  });

  const preference = new Preference(mp);

  const response = await preference.create({
    body: {
      items: payload.items.map((item) => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        unit_price: item.unit_price,
        currency_id: "BRL",
      })),
      external_reference: externalReference,
      back_urls: {
        success: `${process.env.FRONTEND_URL}/pagamento/status?status=success`,
        failure: `${process.env.FRONTEND_URL}/pagamento/status?status=error`,
        pending: `${process.env.FRONTEND_URL}/pagamento/status?status=pending`,
      },
      auto_return: "approved",
      notification_url: `${process.env.API_PUBLIC_URL}/webhooks/mercadopago`,
    },
  });

  if (!response.id) {
    throw new Error("Mercado Pago não retornou preferenceId.");
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { preferenceId: response.id },
  });

  return {
    orderId: order.id,
    preferenceId: response.id,
    initPoint: response.init_point,
    sandboxInitPoint: response.sandbox_init_point,
  };
}

export async function processPaymentWebhook(mpPaymentId: string) {
  const paymentClient = new Payment(mp);
  const mpPayment = await paymentClient.get({ id: mpPaymentId });

  const status = mpPayment.status;
  const externalReference = mpPayment.external_reference;

  if (!externalReference) {
    throw new Error("external_reference ausente no pagamento.");
  }

  const order = await prisma.order.findUnique({
    where: { externalReference },
  });

  if (!order) {
    throw new Error(`Pedido não encontrado: ${externalReference}`);
  }

  const mappedStatus = mapStatus(status ?? "pending");

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        status: mappedStatus,
        paymentId: String(mpPayment.id),
      },
    }),
    prisma.payment.upsert({
      where: { mpPaymentId: String(mpPayment.id) },
      update: {
        status: mappedStatus,
        rawResponse: mpPayment as object,
      },
      create: {
        mpPaymentId: String(mpPayment.id),
        status: mappedStatus,
        rawResponse: mpPayment as object,
        orderId: order.id,
      },
    }),
  ]);

  return { orderId: order.id, status: mappedStatus };
}

function mapStatus(mpStatus: string) {
  const map: Record<string, "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"> =
    {
      approved: "APPROVED",
      rejected: "REJECTED",
      pending: "PENDING",
      cancelled: "CANCELLED",
      in_process: "PENDING",
      in_mediation: "PENDING",
      authorized: "PENDING",
      refunded: "CANCELLED",
      charged_back: "CANCELLED",
    };

  return map[mpStatus] ?? "PENDING";
}