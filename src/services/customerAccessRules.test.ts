import assert from "node:assert/strict";
import { test } from "node:test";
import {
  credenciaisClienteCorrespondem,
  gerarVariacoesCpf,
  normalizarEmailCliente,
} from "./customerAccessRules.js";

test("normaliza CPF formatado para busca sem perder compatibilidade", () => {
  assert.deepEqual(
    gerarVariacoesCpf("123.456.789-00"),
    ["123.456.789-00", "12345678900"]
  );
});

test("rejeita CPF com quantidade incorreta de digitos", () => {
  assert.deepEqual(gerarVariacoesCpf("123456789"), []);
});

test("normaliza email sem diferenciar maiusculas e espacos externos", () => {
  assert.equal(normalizarEmailCliente(" Cliente@Email.com "), "cliente@email.com");
});

test("aceita apenas CPF e email pertencentes ao mesmo pedido", () => {
  const pedido = { cpf: "123.456.789-00", email: "cliente@email.com" };

  assert.equal(
    credenciaisClienteCorrespondem(pedido, "12345678900", "CLIENTE@email.com"),
    true
  );
  assert.equal(
    credenciaisClienteCorrespondem(pedido, "12345678900", "outro@email.com"),
    false
  );
  assert.equal(
    credenciaisClienteCorrespondem(pedido, "00000000000", "cliente@email.com"),
    false
  );
});
