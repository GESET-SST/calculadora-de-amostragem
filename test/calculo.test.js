import { test } from "node:test";
import assert from "node:assert/strict";
import { tempoMinutos } from "../src/calculo.js";

// Exemplo do Josué: 2-butoxietanol, volume 2 a 10 L, vazão 0,01 a 0,05 L/min
const casos = [
  { volume: 2, vazao: 0.01, esperado: 200 },
  { volume: 10, vazao: 0.01, esperado: 1000 },
  { volume: 2, vazao: 0.05, esperado: 40 },
  { volume: 10, vazao: 0.05, esperado: 200 },
];

for (const c of casos) {
  test(`${c.volume} L a ${c.vazao} L/min = ${c.esperado} min`, () => {
    // tolerância: números decimais no computador não são exatos
    assert.ok(Math.abs(tempoMinutos(c.volume, c.vazao) - c.esperado) < 1e-9);
  });
}

test("vazão zero deve dar erro, não Infinity", () => {
  assert.throws(() => tempoMinutos(2, 0));
});

test("vazão negativa deve dar erro", () => {
  assert.throws(() => tempoMinutos(2, -0.01));
});

test("volume inválido (texto) deve dar erro", () => {
  assert.throws(() => tempoMinutos("abc", 0.01));
});
