import assert from "node:assert/strict";
import test from "node:test";
import { validarLimiteUsos, validarValidade } from "./cupomAdminService.js";

test("limite ausente ou null remove o limite; inteiro positivo é aceito", () => {
  assert.equal(validarLimiteUsos(undefined), null);
  assert.equal(validarLimiteUsos(null), null);
  assert.equal(validarLimiteUsos(3), 3);
});

test("limite precisa ser inteiro positivo", () => {
  for (const valor of [0, -1, 2.5, "3", Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => validarLimiteUsos(valor), /inteiro positivo/);
  }
});

test("validade aceita ISO com Z ou offset e usa o instante representado", () => {
  assert.equal(validarValidade(undefined), null);
  assert.equal(validarValidade(null), null);
  assert.equal(validarValidade("2026-11-23T12:00:00-03:00")?.toISOString(), "2026-11-23T15:00:00.000Z");
  assert.equal(validarValidade("2026-11-23T15:00:00Z")?.toISOString(), "2026-11-23T15:00:00.000Z");
});

test("validade exige data ISO válida com fuso", () => {
  for (const valor of ["2026-11-23", "2026-11-23T12:00:00", "2026-13-45T12:00:00Z", 123]) {
    assert.throws(() => validarValidade(valor), /validadeAte/);
  }
});
