// Cálculo de exposição ao calor (NHO 06 / NR-15): funções puras.
// As FÓRMULAS (IBUTG, ponderação em 60 min) ficam aqui porque vêm da norma.
// As TABELAS (Quadros 1 a 4) NÃO ficam aqui: são lidas da planilha anexada (calor-tabelas.js),
// então quando o laboratório/SST atualiza a planilha, o sistema acompanha sem mudar código.
(function (root) {
  const EPS = 1e-9;
  const LIMITE_VARIACAO = 0.4;   // °C: variação (máx − mín) permitida entre as leituras
  const MIN_LEITURAS = 5;
  const BASE_MIN = 60;           // a avaliação é ponderada em 60 minutos

  const finito = n => typeof n === "number" && Number.isFinite(n);
  const soma = a => a.reduce((s, x) => s + x, 0);

  /** Média e variação (máx − mín) de uma lista; ignora o que não for número. */
  function estatistica(valores) {
    const v = (valores || []).filter(finito);
    if (!v.length) return { n: 0, media: NaN, variacao: NaN };
    return { n: v.length, media: soma(v) / v.length, variacao: Math.max(...v) - Math.min(...v) };
  }

  /**
   * IBUTG de uma situação, a partir das MÉDIAS.
   *  sem carga solar: 0,7·TBN + 0,3·TG
   *  com carga solar: 0,7·TBN + 0,2·TG + 0,1·TBS
   */
  function ibutg(tg, tbn, tbs, comSolar) {
    if (!finito(tg) || !finito(tbn)) return NaN;
    if (!comSolar) return 0.7 * tbn + 0.3 * tg;
    if (!finito(tbs)) return NaN;
    return 0.7 * tbn + 0.2 * tg + 0.1 * tbs;
  }

  /**
   * Primeira linha do quadro com M >= m (arredonda o M para CIMA = lado conservador).
   * O quadro vem da planilha: [{ m, ibutg }]. Retorna null se m passa do fim do quadro.
   */
  function procurarNoQuadro(quadro, m) {
    if (!finito(m) || !quadro || !quadro.length) return null;
    const ord = [...quadro].sort((a, b) => a.m - b.m);
    return ord.find(l => l.m >= m - EPS) || null;
  }

  /**
   * Uma situação térmica: { exposicao (min), taxaMetabolica (W), leituras: [{tg, tbs, tbn}] }.
   * TBS só é exigido (e só entra no cálculo) quando há carga solar.
   */
  function calcularSituacao(sit, comSolar) {
    const col = k => estatistica((sit.leituras || []).map(l => l[k]));
    const tg = col("tg"), tbn = col("tbn"), tbs = col("tbs");
    const exigidos = comSolar ? [["TG", tg], ["TBN", tbn], ["TBS", tbs]] : [["TG", tg], ["TBN", tbn]];
    const problemas = [];
    for (const [nome, e] of exigidos) {
      if (e.n < MIN_LEITURAS) problemas.push(`${nome}: ${e.n} de ${MIN_LEITURAS} leituras mínimas`);
      else if (e.variacao > LIMITE_VARIACAO + EPS) problemas.push(`${nome}: variação de ${e.variacao.toFixed(2).replace(".", ",")} °C, acima de ±0,4 °C`);
    }
    return {
      tg, tbn, tbs,
      ibutg: ibutg(tg.media, tbn.media, tbs.media, comSolar),
      validas: problemas.length === 0,
      problemas,
    };
  }

  /**
   * Avaliação completa.
   * entrada: { situacoes: [...], comSolar: bool, incremento: °C (vestimenta, Quadro 4) }
   * quadros: { quadro1: [{m, ibutg}] (nível de ação), quadro2: [{m, ibutg}] (limite) }
   */
  function calcularAvaliacao(entrada, quadros) {
    const usadas = (entrada.situacoes || []).map((s, i) => ({ s, i: i + 1 })).filter(x => finito(x.s.exposicao) && x.s.exposicao > 0);
    const problemas = [];
    const sits = usadas.map(({ s, i }) => ({ n: i, exposicao: s.exposicao, taxaMetabolica: s.taxaMetabolica, ...calcularSituacao(s, !!entrada.comSolar) }));

    const tempoTotal = soma(sits.map(s => s.exposicao));
    const tempoOk = Math.abs(tempoTotal - BASE_MIN) < EPS;
    if (!sits.length) problemas.push("Informe ao menos uma situação com exposição maior que zero.");
    else if (!tempoOk) problemas.push(`O tempo total de exposição é ${tempoTotal} min, e não ${BASE_MIN} min. O cálculo divide por ${BASE_MIN}, então confira os tempos.`);

    for (const s of sits) {
      if (!finito(s.taxaMetabolica)) problemas.push(`Situação ${s.n}: falta a taxa metabólica (W).`);
      for (const p of s.problemas) problemas.push(`Situação ${s.n}, ${p}.`);
    }

    const completa = sits.length > 0 && sits.every(s => finito(s.ibutg));
    const mCompleto = sits.length > 0 && sits.every(s => finito(s.taxaMetabolica));
    const incremento = finito(entrada.incremento) ? entrada.incremento : 0;

    const mMedio = mCompleto ? soma(sits.map(s => s.taxaMetabolica * s.exposicao)) / BASE_MIN : NaN;
    const ibutgBase = completa ? soma(sits.map(s => s.ibutg * s.exposicao)) / BASE_MIN : NaN;
    const ibutgMedio = ibutgBase + incremento;

    const limite = procurarNoQuadro(quadros && quadros.quadro2, mMedio);
    const nivelAcao = procurarNoQuadro(quadros && quadros.quadro1, mMedio);
    if (finito(mMedio) && (!limite || !nivelAcao)) problemas.push(`M médio de ${mMedio.toFixed(1).replace(".", ",")} W está acima do último valor dos quadros da planilha. Consulte a norma.`);

    return {
      situacoes: sits, tempoTotal, tempoOk,
      mMedio, ibutgBase, incremento, ibutgMedio,
      limite, nivelAcao,
      acimaDoLimite: finito(ibutgMedio) && limite ? ibutgMedio > limite.ibutg + EPS : null,
      acimaDoNivelAcao: finito(ibutgMedio) && nivelAcao ? ibutgMedio > nivelAcao.ibutg + EPS : null,
      medicoesValidas: sits.length > 0 && sits.every(s => s.validas),
      problemas,
    };
  }

  root.Calor = { estatistica, ibutg, procurarNoQuadro, calcularSituacao, calcularAvaliacao, LIMITE_VARIACAO, MIN_LEITURAS, BASE_MIN };
})(typeof globalThis !== "undefined" ? globalThis : window);
