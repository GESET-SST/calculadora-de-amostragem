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


// ---- Casos reais do Guia de Amostragem que o leitor lia ERRADO em silêncio (agora não adivinha) ----
test("'Mín. 480 L' e 'Mín 480 L' são só mínimo", () => {
  for (const t of ["Mín. 480 L", "Mín 480 L", "Mínimo 480 L"]) {
    const r = lerFaixa(t);
    assert.deepEqual([r.min, r.max, r.ok], [480, null, true], t);
  }
});
test("duas vazões por tipo de ciclone = opções, não faixa", () => {
  const r = lerFaixa("Ciclone de Nylon 1,7 L/min Ciclone de Aluminio 2,5 L/min");
  assert.deepEqual(r.opcoes, [1.7, 2.5]);
  assert.ok(r.nota.includes("não é faixa"));
});
test("condição de umidade NÃO vira faixa 3–50", () => {
  const r = lerFaixa("3 L (se umidade ≥ 50%). 5 L (se umidade < 50%)");
  assert.equal(r.ok, false);
  assert.equal(r.condicional, true);
});
test("STEL/TWA exige conferência manual", () => {
  assert.equal(lerFaixa("22,5 L (para STEL). 90 L (para TWA)").condicional, true);
  assert.equal(lerFaixa("1,5 L/min (para STEL). 0,25 - 0,50 L/min (para TWA)").condicional, true);
});
test("número de procedimento NÃO vira volume (mínimo 480 L e PR-BLIII-185)", () => {
  const r = lerFaixa("mínimo 480 L e PR-BLIII-185");
  assert.equal(r.condicional, true);
  assert.equal(r.max, null);
});
test("'≤ 0,05 L' (sem /min) vai para conferência", () => {
  assert.equal(lerFaixa("≤ 0,05 L").condicional, true);
});
test("uma vazão com texto descritivo é lida, mas com nota para conferir", () => {
  const r = lerFaixa("1,6 L/min Amostragem com Ciclone Torácico");
  assert.deepEqual([r.min, r.max, r.ok], [1.6, 1.6, true]);
  assert.ok(r.nota);
});
test("espaços e quebras de linha no nome do agente são limpos", () => {
  const r = lerPlanilha([
    ["Agente Químico", "Vazão", "Volume"],
    ["1,6-Hexametileno   Diisocianato (HDI)      \n", "1 L/min", "15 L"],
  ]);
  assert.equal(r.agentes[0].agente, "1,6-Hexametileno Diisocianato (HDI)");
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

test("colunas finais do Guia: transporte, armazenamento, estabilidade e observação são lidas separadas", () => {
  const r = Faixas.lerPlanilha([
    ["Código do amostrador", "Agente Químico", "CAS", "Tipo de amostrador", "Vazão", "Volume", "Condições de Transporte", "Condições de armazenamento", "Estabilidade da amostra", "Observação"],
    ["MDI", "Agente de teste", "000-00-0", "Cassete", "1 L/min", "15 L", "Sob gelo", "Manter no freezer", "18 dias", "-"],
  ]);
  const a = r.agentes[0];
  assert.equal(a.transporte, "Sob gelo");
  assert.equal(a.armazenamento, "Manter no freezer");
  assert.equal(a.estabilidade, "18 dias");
  assert.equal(a.observacao, "-");   // o Guia usa "-" para "sem observação": a tela é quem ignora
  assert.equal(a.codigo, "MDI");
});

test("coluna única 'transporte/armazenamento' não duplica o texto", () => {
  const r = Faixas.lerPlanilha([
    ["Agente", "Vazão", "Volume", "Transporte e armazenamento"],
    ["Agente de teste", "1 L/min", "15 L", "Refrigerar"],
  ]);
  assert.equal(r.agentes[0].transporte, "Refrigerar");
  assert.equal(r.agentes[0].armazenamento, "");
});
