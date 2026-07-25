import { type CategoriaPedido } from "../models/Pedidos.js";

export type KitCheckout = {
  id: string;
  nomeEvento: string;
  lote: string;
  distancia: string;
  capacidade: number;
  dataInicio: Date | null;
  dataFim: Date | null;
  viradaPorData: boolean;
  viradaPorCapacidade: boolean;
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
  viradaPorData = true,
  agora = new Date()
) {
  if (!viradaPorData) {
    return;
  }

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
  viradaPorData = true,
  agora = new Date()
) {
  if (!viradaPorData) {
    return true;
  }

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

export function montarItensMercadoPago(kit: KitCheckout, taxaServico = 0) {
  if (!Number.isFinite(taxaServico) || taxaServico < 0) {
    throw new Error("A taxa de serviço deve ser um valor igual ou maior que zero.");
  }

  const itens = [montarItemMercadoPago(kit)];
  const taxaArredondada = Math.round(taxaServico * 100) / 100;

  if (taxaArredondada > 0) {
    itens.push({
      id: "taxa-servico",
      title: "Taxa de serviço",
      quantity: 1,
      unit_price: taxaArredondada,
      currency_id: "BRL" as const,
    });
  }

  return itens;
}
