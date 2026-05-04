import { type CategoriaPedido } from "../models/Pedidos.js";

export type KitCheckout = {
  id: string;
  nomeEvento: string;
  lote: string;
  distancia: string;
  capacidade: number;
  dataInicio: Date | null;
  dataFim: Date | null;
  preco: {
    categoria: CategoriaPedido;
    valor: number;
  };
};

export type SlotsLote = {
  totalSlots: number;
  soldSlots: number;
  remainingSlots: number;
};

export function calcularSlots(totalSlots: number, soldSlotsConfirmados: number): SlotsLote {
  const soldSlots = Math.max(0, soldSlotsConfirmados);
  const remainingSlots = Math.max(0, totalSlots - soldSlots);

  return {
    totalSlots,
    soldSlots,
    remainingSlots,
  };
}

export function validarLoteDisponivel(slots: SlotsLote) {
  if (slots.remainingSlots <= 0) {
    throw new Error("Lote esgotado.");
  }
}

export function validarJanelaLoteDisponivel(
  dataInicio: Date | null,
  dataFim: Date | null,
  agora = new Date()
) {
  if (dataInicio && agora < dataInicio) {
    throw new Error("Lote ainda não está disponível.");
  }

  if (dataFim && agora > dataFim) {
    throw new Error("Lote encerrado.");
  }
}

export function loteDentroDaJanela(
  dataInicio: Date | null,
  dataFim: Date | null,
  agora = new Date()
) {
  return (!dataInicio || agora >= dataInicio) && (!dataFim || agora <= dataFim);
}

export function montarItemMercadoPago(kit: KitCheckout) {
  return {
    id: kit.id,
    title: `Inscrição ${kit.nomeEvento} - ${kit.distancia} - ${kit.lote}`,
    quantity: 1,
    unit_price: kit.preco.valor,
    currency_id: "BRL" as const,
  };
}
