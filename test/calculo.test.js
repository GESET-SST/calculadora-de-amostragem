import { test } from "node:test";
import assert from "node:assert/strict";
import "../src/calculo.js";

const { tempoMinutos, volumeLitros, vazaoLitrosPorMin, dentroDaFaixa, vazoesParaCalcular, tabelaTempos } = globalThis.Calculo;
const perto = (a, b) => Math.abs(a - b) < 1e-9;   // decimais no computador não são exatos

// Exemplo do Josué: 2-butoxietanol, volume 2 a 10 L, vazão 0,01 a 0,05 L/min
const casos = [
  { volume: 2, vazao: 0.01, esperado: 200 },
  { volume: 10, vazao: 0.01, esperado: 1000 },
  { volume: 2, vazao: 0.05, esperado: 40 },
  { volume: 10, vazao: 0.05, esperado: 200 },
];

for (const c of casos) {
  test(`${c.volume} L a ${c.vazao} L/min = ${c.esperado} min`, () => {
    assert.ok(perto(tempoMinutos(c.volume, c.vazao), c.esperado));
  });
}

test("vazão zero deve dar erro, não Infinity", () => assert.throws(() => tempoMinutos(2, 0)));
test("vazão negativa deve dar erro", () => assert.throws(() => tempoMinutos(2, -0.01)));
test("volume inválido (texto) deve dar erro", () => assert.throws(() => tempoMinutos("abc", 0.01)));
test("número escrito como texto também é recusado (a conversão é feita antes, na tela)", () => assert.throws(() => tempoMinutos("2", 0.01)));
test("NaN e Infinity dão erro", () => {
  assert.throws(() => tempoMinutos(NaN, 0.01));
  assert.throws(() => tempoMinutos(2, Infinity));
});

test("as três grandezas fecham o ciclo: V = Q × t e Q = V ÷ t", () => {
  assert.ok(perto(volumeLitros(0.03, 100), 3));
  assert.ok(perto(vazaoLitrosPorMin(3, 100), 0.03));
  assert.throws(() => volumeLitros(0.03, 0));
  assert.throws(() => vazaoLitrosPorMin(3, -1));
});

test("dentroDaFaixa: limites incluídos, null = sem limite", () => {
  assert.ok(dentroDaFaixa(0.03, 0.01, 0.05));
  assert.ok(dentroDaFaixa(0.05, 0.01, 0.05));
  assert.ok(!dentroDaFaixa(0.06, 0.01, 0.05));
  assert.ok(dentroDaFaixa(600, 480, null));
  assert.ok(!dentroDaFaixa(NaN, 0, 1));
});

test("vazões: faixa contínua com intermediária dentro da faixa", () => {
  const r = vazoesParaCalcular({ min: 0.01, max: 0.05, opcoes: null }, 0.03);
  assert.deepEqual(r.lista.map(x => x.valor), [0.01, 0.03, 0.05]);
  assert.equal(r.lista[1].intermediaria, true);
  assert.equal(r.erro, "");
});

test("vazões: intermediária fora da faixa NÃO entra e gera erro", () => {
  const r = vazoesParaCalcular({ min: 0.01, max: 0.05, opcoes: null }, 0.2);
  assert.deepEqual(r.lista.map(x => x.valor), [0.01, 0.05]);
  assert.notEqual(r.erro, "");
});

test("vazões: vazão única não repete linha", () => {
  const r = vazoesParaCalcular({ min: 0.2, max: 0.2, opcoes: null }, NaN);
  assert.equal(r.lista.length, 1);
});

test("vazões: valores alternativos (ciclone) usam só as opções e ignoram intermediária", () => {
  const r = vazoesParaCalcular({ min: 1.7, max: 2.5, opcoes: [1.7, 2.5] }, 2);
  assert.deepEqual(r.lista.map(x => x.valor), [1.7, 2.5]);
});

test("tabela do exemplo do Josué: 200, 1000, 40 e 200 min", () => {
  const { lista } = vazoesParaCalcular({ min: 0.01, max: 0.05, opcoes: null });
  const t = tabelaTempos(2, 10, lista);
  assert.ok(perto(t[0].tmin, 200) && perto(t[0].tmax, 1000));
  assert.ok(perto(t[1].tmin, 40) && perto(t[1].tmax, 200));
});

test("tabela: volume só mínimo (ex.: 'mínimo 480 L') deixa o máximo vazio, sem inventar", () => {
  const t = tabelaTempos(480, null, [{ valor: 0.2, intermediaria: false }]);
  assert.ok(perto(t[0].tmin, 2400));
  assert.equal(t[0].tmax, null);
});
