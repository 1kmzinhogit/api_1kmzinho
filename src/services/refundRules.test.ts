import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { calcularInfoReembolso, eventoTemDataAlterada } from "./refundRules.js";

const envOriginal = process.env.EVENTOS_COM_DATA_ALTERADA;

afterEach(() => {
  process.env.EVENTOS_COM_DATA_ALTERADA = envOriginal;
});

test("permite reembolso de pedido aprovado ate 7 dias da compra", () => {
  process.env.EVENTOS_COM_DATA_ALTERADA = "";

  const info = calcularInfoReembolso({
    status: "APROVADO",
    criadoEm: new Date("2026-05-01T10:00:00.000Z"),
    nomeEvento: "Corrida da Familia",
    agora: new Date("2026-05-08T10:00:00.000Z"),
  });

  assert.equal(info.prazoReembolsoDias, 7);
  assert.equal(info.permiteSolicitarReembolso, true);
  assert.equal(info.dataLimiteReembolso.toISOString(), "2026-05-08T10:00:00.000Z");
});

test("bloqueia reembolso depois de 7 dias quando evento nao teve data alterada", () => {
  process.env.EVENTOS_COM_DATA_ALTERADA = "";

  const info = calcularInfoReembolso({
    status: "APROVADO",
    criadoEm: new Date("2026-05-01T10:00:00.000Z"),
    nomeEvento: "Corrida da Familia",
    agora: new Date("2026-05-08T10:00:01.000Z"),
  });

  assert.equal(info.permiteSolicitarReembolso, false);
  assert.equal(info.motivoIndisponibilidadeReembolso, "Prazo de 7 dias para solicitar reembolso expirado.");
});

test("usa prazo de 30 dias para evento com data alterada", () => {
  process.env.EVENTOS_COM_DATA_ALTERADA = "Corrida da Família";

  const info = calcularInfoReembolso({
    status: "APROVADO",
    criadoEm: new Date("2026-05-01T10:00:00.000Z"),
    nomeEvento: "Corrida da Familia",
    agora: new Date("2026-05-31T10:00:00.000Z"),
  });

  assert.equal(eventoTemDataAlterada("Corrida da Familia"), true);
  assert.equal(info.eventoComDataAlterada, true);
  assert.equal(info.prazoReembolsoDias, 30);
  assert.equal(info.permiteSolicitarReembolso, true);
});

test("bloqueia reembolso de pedido nao aprovado", () => {
  const info = calcularInfoReembolso({
    status: "PENDENTE",
    criadoEm: new Date("2026-05-01T10:00:00.000Z"),
    nomeEvento: "Corrida da Familia",
    agora: new Date("2026-05-02T10:00:00.000Z"),
  });

  assert.equal(info.permiteSolicitarReembolso, false);
  assert.equal(info.motivoIndisponibilidadeReembolso, "Pedido ainda nao esta aprovado para reembolso.");
});
