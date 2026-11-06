import test from "node:test";
import assert from "node:assert/strict";
import "../src/calor.js";
import "../src/calor-tabelas.js";

const { Calor, CalorTabelas } = globalThis;
const perto = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

test("estatistica: média e variação; ignora o que não é número", () => {
  const e = Calor.estatistica([23, 23.4, 23, 21, 22]);
  perto(e.media, 22.48);
  perto(e.variacao, 2.4);
  assert.equal(e.n, 5);
  assert.equal(Calor.estatistica([1, "x", null, 3]).n, 2);
  assert.equal(Calor.estatistica([]).n, 0);
});

test("ibutg sem solar: 0,7·TBN + 0,3·TG", () => {
  perto(Calor.ibutg(30, 20, NaN, false), 0.7 * 20 + 0.3 * 30);
});

test("ibutg com solar: 0,7·TBN + 0,2·TG + 0,1·TBS", () => {
  perto(Calor.ibutg(40, 20, 30, true), 14 + 8 + 3);
  assert.ok(Number.isNaN(Calor.ibutg(40, 20, NaN, true)), "sem TBS não calcula");
});

const quadro = [{ m: 100, ibutg: 30 }, { m: 125, ibutg: 28 }, { m: 150, ibutg: 26 }, { m: 175, ibutg: 25 }];

test("procurarNoQuadro: primeira linha com M >= m (lado conservador)", () => {
  assert.equal(Calor.procurarNoQuadro(quadro, 125).ibutg, 28);
  assert.equal(Calor.procurarNoQuadro(quadro, 126).ibutg, 26);
  assert.equal(Calor.procurarNoQuadro(quadro, 50).ibutg, 30);
  assert.equal(Calor.procurarNoQuadro(quadro, 200), null, "não chuta acima do último valor");
  assert.equal(Calor.procurarNoQuadro([], 100), null);
});

const leit = (tg, tbn, tbs) => [0, 1, 2, 3, 4].map(() => ({ tg, tbn, tbs }));

test("avaliação simples: 60 min numa situação", () => {
  const r = Calor.calcularAvaliacao(
    { comSolar: false, incremento: 0, situacoes: [{ exposicao: 60, taxaMetabolica: 150, leituras: leit(30, 20) }] },
    { quadro1: quadro, quadro2: quadro });
  perto(r.ibutgMedio, 0.7 * 20 + 0.3 * 30);
  perto(r.mMedio, 150);
  assert.equal(r.limite.ibutg, 26);
  assert.equal(r.acimaDoLimite, false);   // 23 < 26
  assert.equal(r.tempoOk, true);
  assert.deepEqual(r.problemas, []);
});

test("duas situações ponderadas por tempo e vestimenta soma no IBUTG", () => {
  const r = Calor.calcularAvaliacao({
    comSolar: false, incremento: 2,
    situacoes: [
      { exposicao: 30, taxaMetabolica: 100, leituras: leit(30, 20) },   // 20,0 + ... = 0,7*20+0,3*30 = 23
      { exposicao: 30, taxaMetabolica: 200, leituras: leit(40, 30) },   // 21+12 = 33
    ] }, { quadro1: quadro, quadro2: quadro });
  perto(r.ibutgBase, 28);
  perto(r.ibutgMedio, 30);
  perto(r.mMedio, 150);
  assert.equal(r.acimaDoLimite, true);    // 30 > 26
});

test("tempo total diferente de 60 gera aviso (a planilha divide por 60 mesmo assim)", () => {
  const r = Calor.calcularAvaliacao(
    { comSolar: false, situacoes: [{ exposicao: 50, taxaMetabolica: 100, leituras: leit(30, 20) }, { exposicao: 220, taxaMetabolica: 100, leituras: leit(30, 20) }] },
    { quadro1: quadro, quadro2: quadro });
  assert.equal(r.tempoOk, false);
  assert.ok(r.problemas.some(p => p.includes("270")));
});

test("leituras insuficientes ou variação > 0,4 invalidam as medições", () => {
  const poucas = Calor.calcularSituacao({ leituras: leit(30, 20).slice(0, 3) }, false);
  assert.equal(poucas.validas, false);
  const variando = Calor.calcularSituacao({ leituras: [30, 30.5, 30, 30, 30].map(tg => ({ tg, tbn: 20 })) }, false);
  assert.equal(variando.validas, false);
  assert.ok(variando.problemas[0].includes("TG"));
  const limite = Calor.calcularSituacao({ leituras: [30, 30.4, 30, 30, 30].map(tg => ({ tg, tbn: 20 })) }, false);
  assert.equal(limite.validas, true, "variação exatamente 0,4 é aceita");
});

test("sem TBS só é problema quando há carga solar", () => {
  assert.equal(Calor.calcularSituacao({ leituras: leit(30, 20) }, false).validas, true);
  assert.equal(Calor.calcularSituacao({ leituras: leit(30, 20) }, true).validas, false);
});

test("M médio acima do quadro avisa em vez de chutar", () => {
  const r = Calor.calcularAvaliacao(
    { comSolar: false, situacoes: [{ exposicao: 60, taxaMetabolica: 900, leituras: leit(30, 20) }] },
    { quadro1: quadro, quadro2: quadro });
  assert.equal(r.limite, null);
  assert.equal(r.acimaDoLimite, null);
  assert.ok(r.problemas.some(p => p.includes("acima do último valor")));
});

// ----- leitor das tabelas -----
function planilhaFalsa() {
  const l = [];
  l.push(["Quadro 1", "", "", "Quadro 2", "", "", "Quadro 3", "", "", "", "Quadro 4", ""]);
  l.push(["M (W)", "IBUTG", "", "M (W)", "IBUTG", "", "Postura", "Subgrupo", "Atividade", "W", "Roupa", "Adição"]);
  for (let i = 0; i < 12; i++) l.push([100 + i * 10, 30 - i, "", 100 + i * 10, 32 - i, "", i === 0 ? "Sentado" : "", i === 0 ? "Leve" : "", i < 2 ? "Atividade " + i : "", i < 2 ? 100 + i : "", i === 0 ? "Roupa comum" : "", i === 0 ? 0 : ""]);
  return l;
}

test("lerTabelas acha os quadros pelo título", () => {
  const t = CalorTabelas.lerTabelas(planilhaFalsa());
  assert.equal(t.quadro1.length, 12);
  assert.equal(t.quadro2[0].ibutg, 32);
  assert.equal(t.quadro3.length, 2);
  assert.equal(t.quadro3[1].postura, "Sentado");
  assert.equal(t.quadro4[0].roupa, "Roupa comum");
  assert.deepEqual(t.problemas, []);
  assert.equal(t.ok, true);
});

test("lerTabelas: sem títulos devolve erro claro, não chuta", () => {
  const t = CalorTabelas.lerTabelas([["a", "b"], [1, 2]]);
  assert.equal(t.ok, false);
  assert.ok(t.erro.includes("Quadro"));
});

test("sentinela da fórmula do IBUTG", () => {
  const f = "=IF(P20=\"Sim\",0.7*D20+0.2*B20+0.1*C20,0.7*D20+0.3*B20)";
  assert.equal(CalorTabelas.verificarFormulaIBUTG(f).ok, true);
  assert.equal(CalorTabelas.verificarFormulaIBUTG(f.replace("0.3", "0.4")).ok, false);
  assert.equal(CalorTabelas.verificarFormulaIBUTG("").ok, null);
});

test("oráculo da planilha real (GESTAO_INFORMACAO_2.2, bloco 1): IBUTG médio 101,16", () => {
  // leituras 23; 23,4; 23; 21; 22 em TG, TBS e TBN; exposições 50 e 220 min; sem sol; incremento 0.
  const l = [23, 23.4, 23, 21, 22].map(v => ({ tg: v, tbs: v, tbn: v }));
  const r = Calor.calcularAvaliacao({ comSolar: false, incremento: 0, situacoes: [
    { exposicao: 50, taxaMetabolica: 100, leituras: l }, { exposicao: 220, taxaMetabolica: 100, leituras: l } ] },
  { quadro1: quadro, quadro2: quadro });
  perto(r.situacoes[0].ibutg, 22.48);
  perto(r.ibutgMedio, 101.16, 1e-9);           // a planilha divide por 60 mesmo com 270 min
  assert.equal(r.tempoOk, false);               // o sistema avisa o que a planilha só sinaliza
  assert.equal(r.medicoesValidas, false);       // variação 2,4 > 0,4
});
