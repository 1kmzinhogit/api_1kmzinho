import assert from "node:assert/strict";
import test from "node:test";
import { validarElegibilidadeCupom } from "./couponRules.js";

const agora = new Date("2026-11-23T12:00:00.000Z");
const cupomBase = {
  ativo: true,
  nomeEvento: "Corrida 1KM",
  validadeAte: null as Date | null,
  limiteUsos: null as number | null,
};

test("cupom sem limites permanece válido", () => {
  assert.doesNotThrow(() => validarElegibilidadeCupom(cupomBase, "Corrida 1KM", 500, agora));
});

test("recusa cupom quando o limite já foi consumido", () => {
  assert.throws(() => validarElegibilidadeCupom({ ...cupomBase, limiteUsos: 2 }, "Corrida 1KM", 2, agora), /limite de usos/);
});

test("data futura ainda é válida", () => {
  assert.doesNotThrow(() => validarElegibilidadeCupom({ ...cupomBase, validadeAte: new Date("2026-11-23T12:00:00.001Z") }, "Corrida 1KM", 0, agora));
});

test("expira quando o horário atual é igual ou posterior à validade", () => {
  assert.throws(() => validarElegibilidadeCupom({ ...cupomBase, validadeAte: agora }, "Corrida 1KM", 0, agora), /expirou/);
});

test("recusa cupom de outra corrida e cupom inativo", () => {
  assert.throws(() => validarElegibilidadeCupom(cupomBase, "Outra corrida", 0, agora), /não é válido para esta corrida/);
  assert.throws(() => validarElegibilidadeCupom({ ...cupomBase, ativo: false }, "Corrida 1KM", 0, agora), /inativo/);
});

test("operações serializadas não ultrapassam limite na última vaga", async () => {
  let usosAprovados = 0;
  let lock = Promise.resolve();
  const consumir = async () => {
    const anterior = lock;
    let liberar!: () => void;
    lock = new Promise<void>((resolve) => { liberar = resolve; });
    await anterior;
    try {
      validarElegibilidadeCupom({ ...cupomBase, limiteUsos: 1 }, "Corrida 1KM", usosAprovados, agora);
      usosAprovados += 1;
      return true;
    } catch {
      return false;
    } finally {
      liberar();
    }
  };
  assert.deepEqual(await Promise.all([consumir(), consumir()]), [true, false]);
  assert.equal(usosAprovados, 1);
});
