import assert from "node:assert/strict";
import { test } from "node:test";
import {
  encontrarRegraCapacidadeCompartilhada,
  encontrarRegraPorEventoEDistancia,
} from "./sharedCapacityRules.js";

test("os dois kits de Juntos Rumo ao Céu usam a mesma regra de 300 vagas", () => {
  const completo = encontrarRegraCapacidadeCompartilhada(
    "juntos-rumo-ao-ceu-kit-completo"
  );
  const simples = encontrarRegraCapacidadeCompartilhada(
    "juntos-rumo-ao-ceu-kit-simples"
  );

  assert.equal(completo?.capacidadeTotal, 300);
  assert.equal(simples?.capacidadeTotal, 300);
  assert.deepEqual(completo?.kitIds, simples?.kitIds);
});

test("a regra aceita a distância 5km sem depender de maiúsculas", () => {
  const regra = encontrarRegraPorEventoEDistancia("Juntos Rumo ao Céu", "5km");

  assert.equal(regra?.capacidadeTotal, 300);
});
