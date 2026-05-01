import { type CategoriaPedido } from "../models/Pedidos.js";

export type KitCheckout = {
  id: string;
  nomeEvento: string;
  lote: string;
  distancia: string;
  capacidade: number;
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

export function montarItemMercadoPago(kit: KitCheckout) {
  return {
    id: kit.id,
    title: `Inscrição ${kit.nomeEvento} - ${kit.distancia} - ${kit.lote}`,
    quantity: 1,
    unit_price: kit.preco.valor,
    currency_id: "BRL" as const,
  };
}
