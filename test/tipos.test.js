import { test } from "node:test";
import assert from "node:assert/strict";
import "../src/faixas.js";
import "../src/tipos.js";

const { detectarTipo } = globalThis.Tipos;

test("reconhece o Guia de Amostragem pelo cabeçalho", () => {
  const r = detectarTipo({ "Guia": [["x"], ["Número", "Agente Químico", "CAS", "Vazão", "Volume"]] });
  assert.equal(r.tipo, "guia-amostragem");
});

test("reconhece planilha de gestão (várias calculadoras) pelas abas", () => {
  const r = detectarTipo({
    "Calor": [["Voltar"], ["", "Cálculo de Calor conforme NHO 06"]],
    "Ruído": [["Voltar"], ["", "Cálculo de NEN para jornada diferente de 480 min"]],
    "EPI": [["CA", "Validade"]],
  });
  assert.equal(r.tipo, "gestao-informacao");
  assert.equal(r.abas.length, 3);
  assert.ok(r.abas[0].titulo.includes("NHO 06"));
});

test("tipo desconhecido lista o que viu, sem inventar", () => {
  const r = detectarTipo({ "Plan1": [["a", "b"], [1, 2]] });
  assert.equal(r.tipo, "desconhecido");
  assert.equal(r.abas[0].nome, "Plan1");
});
