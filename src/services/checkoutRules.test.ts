import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calcularSlots,
  montarItemMercadoPago,
  montarItensMercadoPago,
  validarJanelaLoteDisponivel,
  validarLoteDisponivel,
  type KitCheckout,
} from "./checkoutRules.js";

const kit: KitCheckout = {
  id: "kit-confiavel",
  nomeEvento: "Corrida da Família 2026",
  distancia: "1KM",
  lote: "Lote 1",
  capacidade: 10,
  dataInicio: null,
  dataFim: null,
  viradaPorData: true,
  viradaPorCapacidade: true,
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

test("checkout inclui a taxa de serviço como item separado", () => {
  const itens = montarItensMercadoPago(kit, 5);

  assert.deepEqual(itens, [
    montarItemMercadoPago(kit),
    {
      id: "taxa-servico",
      title: "Taxa de serviço",
      quantity: 1,
      unit_price: 5,
      currency_id: "BRL",
    },
  ]);
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

test("checkout é bloqueado antes da data de início do lote", () => {
  assert.throws(
    () =>
      validarJanelaLoteDisponivel(
        new Date("2026-05-10T00:00:00.000Z"),
        null,
        true,
        new Date("2026-05-09T23:59:59.000Z")
      ),
    /ainda não está disponível/
  );
});

test("checkout é bloqueado depois da data de fim do lote", () => {
  assert.throws(
    () =>
      validarJanelaLoteDisponivel(
        null,
        new Date("2026-05-10T23:59:59.000Z"),
        true,
        new Date("2026-05-11T00:00:00.000Z")
      ),
    /Lote encerrado/
  );
});

test("checkout ignora janela quando virada por data está desligada", () => {
  assert.doesNotThrow(() =>
    validarJanelaLoteDisponivel(
      null,
      new Date("2026-05-10T23:59:59.000Z"),
      false,
      new Date("2026-05-11T00:00:00.000Z")
    )
  );
});
