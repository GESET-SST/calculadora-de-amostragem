import { test } from "node:test";
import assert from "node:assert/strict";
import XLSX from "xlsx";
import "../src/faixas.js";

const { lerFaixa, lerPlanilha } = globalThis.Faixas;

test("faixa de vazão com vírgula e unidade", () => {
  const r = lerFaixa("0,01 - 0,05 L/min");
  assert.deepEqual([r.min, r.max, r.ok], [0.01, 0.05, true]);
});
test("faixa de volume com unidade nos dois lados", () => {
  const r = lerFaixa("200 L - 1000 L");
  assert.deepEqual([r.min, r.max], [200, 1000]);
});
test("só mínimo", () => {
  const r = lerFaixa("mínimo 480 L");
  assert.deepEqual([r.min, r.max], [480, null]);
});
test("só máximo", () => {
  const r = lerFaixa("Máx 10L");
  assert.deepEqual([r.min, r.max], [null, 10]);
});
test("milhar com ponto", () => {
  const r = lerFaixa("1.000 - 2.000 L");
  assert.deepEqual([r.min, r.max], [1000, 2000]);
});
test("mL/min é convertido para L/min", () => {
  const r = lerFaixa("10 - 50 mL/min");
  assert.ok(Math.abs(r.min - 0.01) < 1e-9 && Math.abs(r.max - 0.05) < 1e-9);
});
test("valor único com L/min não é confundido com 'mínimo'", () => {
  const r = lerFaixa("0,2 L/min");
  assert.deepEqual([r.min, r.max], [0.2, 0.2]);
});
test("texto sem número não é aceito", () => {
  assert.equal(lerFaixa("conforme método").ok, false);
  assert.equal(lerFaixa("").ok, false);
});

// Planilha sintética no formato visto no vídeo (colunas do Guia de Amostragem)
const cab = ["Número", "Código do amostrador", "Agente Químico", "CAS", "Tipo de amostrador", "Vazão", "Volume",
  "Metodologia orientativa", "Procedimento interno", "Condições de transporte/armazenamento", "Estabilidade", "Observação"];
const linhas = [
  ["FPR-255 002-1 GA – Guia de Amostragem Rev. 05"],   // título antes do cabeçalho
  [],
  cab,
  [1, "TC-01", "2-Butoxietanol", "111-76-2", "Carvão ativado", "0,01 - 0,05 L/min", "2 L - 10 L", "NIOSH", "PI-1", "Refrigerar", "30 dias", ""],
  [2, "TC-02", "Agente X", "000-00-0", "Sílica", "0,2 L/min", "mínimo 480 L", "", "", "", "", ""],
  [3, "TC-03", "Agente Y", "", "Filtro", "conforme método", "Máx 10L", "", "", "", "", ""],
  [4, "", "", "", "", "0,1 L/min", "5 L", "", "", "", "", ""],   // linha mesclada sem agente
];

test("acha cabeçalho mesmo com título acima e lê os agentes", () => {
  const r = lerPlanilha(linhas);
  assert.equal(r.ok, true);
  assert.equal(r.agentes.length, 3);
  assert.equal(r.agentes[0].agente, "2-Butoxietanol");
  assert.deepEqual([r.agentes[0].volume.min, r.agentes[0].volume.max], [2, 10]);
});
test("linhas problemáticas vão para 'revisar', não somem", () => {
  const r = lerPlanilha(linhas);
  assert.ok(r.revisar.some(x => x.agente === "Agente Y"));   // vazão ilegível
  assert.ok(r.revisar.some(x => x.linha === 7));             // linha mesclada
});
test("arquivo errado dá erro claro", () => {
  const r = lerPlanilha([["a", "b"], [1, 2]]);
  assert.equal(r.ok, false);
});
test("ida e volta por um .xlsx de verdade", () => {
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Guia");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const lido = XLSX.read(buf, { type: "buffer" });
  const aoa = XLSX.utils.sheet_to_json(lido.Sheets["Guia"], { header: 1, defval: "" });
  assert.equal(lerPlanilha(aoa).agentes.length, 3);
});
