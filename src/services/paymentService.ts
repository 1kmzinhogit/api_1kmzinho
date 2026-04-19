import { Preference, Payment } from "mercadopago";
import { mp } from "../config/mercadoPago.js";
import { prisma } from "../config/db.js";
import { type OrderInput } from "../models/Order.js";
import { v4 as uuid } from "uuid";

export async function createOrder(payload: OrderInput) {
  const externalReference = uuid();

  const totalAmount = payload.items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );

  // Garante apenas uma compra por CPF por evento de corrida
  const existing = await prisma.order.findFirst({
    where: {
      cpf: payload.cpf,
      raceName: payload.raceName,
    },
  });

  if (existing) {
    throw new Error("Já existe uma compra para este CPF neste evento.");
  }

  // 1. Persiste o pedido antes de ir ao MP
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
          unit_price: item.unit_price,
        })),
      },
    },
    include: { items: true },
  });

  // 2. Cria preferência no Mercado Pago
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
        success: `${process.env.APP_URL}/pagamento/status?status=success`,
        failure: `${process.env.APP_URL}/pagamento/status?status=error`,
        pending: `${process.env.APP_URL}/pagamento/status?status=pending`,
      },
      auto_return: "approved",
      notification_url: `${process.env.APP_URL}/api/webhooks/mercadopago`,
    },
  });

  if (!response.id) {
    throw new Error("Mercado Pago não retornou preferenceId.");
  }

  // 3. Salva o preferenceId no pedido
  await prisma.order.update({
    where: { id: order.id },
    data: { preferenceId: response.id },
  });

  return {
    orderId: order.id,
    preferenceId: response.id,
    initPoint: response.init_point,
  };
}

export async function processPaymentWebhook(mpPaymentId: string) {
  const paymentClient = new Payment(mp);
  const mpPayment = await paymentClient.get({ id: mpPaymentId });

  const { status, external_reference } = mpPayment;

  if (!external_reference) {
    throw new Error("external_reference ausente no pagamento.");
  }

  const order = await prisma.order.findUnique({
    where: { externalReference: external_reference },
  });

  if (!order) {
    throw new Error(`Pedido não encontrado: ${external_reference}`);
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        status: mapStatus(status!),
        paymentId: String(mpPayment.id),
      },
    }),
    prisma.payment.create({
      data: {
        mpPaymentId: String(mpPayment.id),
        status: mapStatus(status!),
        rawResponse: mpPayment as object,
        orderId: order.id,
      },
    }),
  ]);

  return { orderId: order.id, status };
}

function mapStatus(mpStatus: string) {
  const map: Record<
    string,
    "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
  > = {
    approved: "APPROVED",
    rejected: "REJECTED",
    pending: "PENDING",
    cancelled: "CANCELLED",
  };
  return map[mpStatus] ?? "PENDING";
}