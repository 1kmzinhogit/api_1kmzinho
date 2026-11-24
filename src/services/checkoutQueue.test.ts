import assert from "node:assert/strict";
import test from "node:test";
import { CheckoutFilaCheiaError, criarFilaSerial } from "./checkoutQueue.js";

test("100 operações concorrentes são executadas em FIFO, uma por vez", async () => {
  const fila = criarFilaSerial(100);
  const ordem: number[] = [];
  let ativas = 0;
  let maximoAtivo = 0;

  const resultados = await Promise.all(Array.from({ length: 100 }, (_, indice) =>
    fila.executar(async () => {
      ativas++;
      maximoAtivo = Math.max(maximoAtivo, ativas);
      ordem.push(indice);
      await new Promise((resolve) => setTimeout(resolve, 1));
      ativas--;
      return indice;
    })
  ));

  assert.equal(resultados.length, 100);
  assert.equal(maximoAtivo, 1);
  assert.deepEqual(ordem, Array.from({ length: 100 }, (_, indice) => indice));
  assert.equal(fila.tamanho(), 0);
});

test("fila cheia rejeita nova operação sem travar as seguintes", async () => {
  const fila = criarFilaSerial(1);
  let sinalizarInicio!: () => void;
  let liberar!: () => void;
  const iniciou = new Promise<void>((resolve) => { sinalizarInicio = resolve; });
  const bloqueio = new Promise<void>((resolve) => { liberar = resolve; });

  const primeira = fila.executar(async () => {
    sinalizarInicio();
    await bloqueio;
    return "ok";
  });

  await iniciou;
  await assert.rejects(fila.executar(async () => "não executa"), CheckoutFilaCheiaError);
  liberar();
  assert.equal(await primeira, "ok");
  assert.equal(await fila.executar(async () => "continua"), "continua");
});
