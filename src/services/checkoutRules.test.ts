import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calcularSlots,
  montarItemMercadoPago,
  validarLoteDisponivel,
  type KitCheckout,
} from "./checkoutRules.js";

const kit: KitCheckout = {
  id: "kit-confiavel",
  nomeEvento: "Corrida da Família 2026",
  distancia: "1KM",
  lote: "Lote 1",
  capacidade: 10,
  preco: {
    categoria: "MASCULINO",
    valor: 80,
  },
};

test("alterar preço no payload não muda o valor cobrado", () => {
  const payloadManipulado = {
    valorIngresso: 1,
    amount: 1,
    price: 1,
    itens: [{ valor_unitario: 1 }],
  };

  const item = montarItemMercadoPago(kit);

  assert.equal(item.unit_price, 80);
  assert.notEqual(item.unit_price, payloadManipulado.valorIngresso);
  assert.notEqual(item.unit_price, payloadManipulado.itens[0].valor_unitario);
});

test("alterar soldSlots/availableSlots no payload não libera vaga", () => {
  const payloadManipulado = {
    soldSlots: 0,
    availableSlots: 999,
    totalSlots: 999,
  };

  const slots = calcularSlots(10, 10);

  assert.equal(slots.soldSlots, 10);
  assert.equal(slots.remainingSlots, 0);
  assert.notEqual(slots.remainingSlots, payloadManipulado.availableSlots);
});

test("checkout é bloqueado quando remainingSlots chega a 0", () => {
  const slots = calcularSlots(10, 10);

  assert.throws(() => validarLoteDisponivel(slots), /Lote esgotado/);
});
