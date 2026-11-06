// Leitor das tabelas do calor (aba "Dados Calor - Tabelas" da planilha de gestão).
// Acha os quadros pelo TÍTULO ("Quadro 1", "Quadro 2"...), não pela posição das células.
// Na dúvida não adivinha: devolve o que faltou em "problemas".
(function (root) {
  const semAcento = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const limpa = s => String(s ?? "").replace(/\s+/g, " ").trim();
  const numero = v => {
    if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
    const t = String(v ?? "").trim().replace(",", ".");
    return t === "" ? NaN : Number(t);
  };

  /** linhas: array de arrays (XLSX.utils.sheet_to_json(ws, { header: 1 })). */
  function lerTabelas(linhas) {
    const falha = erro => ({ ok: false, erro, quadro1: [], quadro2: [], quadro3: [], quadro4: [], problemas: [erro] });

    // 1) linha dos títulos: a que tem 3 ou mais células começando por "Quadro N"
    let linhaTit = -1, titulos = [];
    for (let i = 0; i < Math.min((linhas || []).length, 15) && linhaTit < 0; i++) {
      const achados = (linhas[i] || []).map((c, j) => ({ j, m: /^\s*quadro\s*(\d+)/i.exec(limpa(c)) })).filter(x => x.m).map(x => ({ n: Number(x.m[1]), col: x.j }));
      if (achados.length >= 3) { linhaTit = i; titulos = achados; }
    }
    if (linhaTit < 0) return falha("Não encontrei os títulos dos quadros (Quadro 1, Quadro 2…) na aba de tabelas do calor.");

    const bloco = n => {
      const k = titulos.findIndex(t => t.n === n);
      if (k < 0) return null;
      return { ini: titulos[k].col, fim: (titulos[k + 1] ? titulos[k + 1].col : (linhas[linhaTit] || []).length) - 1 };
    };
    const linhasDe = (b, largura) => {
      const out = [];
      for (let i = linhaTit + 2; i < linhas.length; i++) {
        const l = linhas[i] || [];
        const cel = [];
        for (let c = 0; c < largura; c++) cel.push(l[b.ini + c]);
        if (cel.every(x => limpa(x) === "")) break;      // fim do quadro
        out.push(cel);
      }
      return out;
    };
    const cab = (b, c) => semAcento(((linhas[linhaTit + 1] || [])[b.ini + c]) ?? "");
    const problemas = [];

    const par = (n, rotulo) => {
      const b = bloco(n);
      if (!b) { problemas.push(`${rotulo}: título não encontrado`); return []; }
      if (!cab(b, 1).includes("ibutg")) problemas.push(`${rotulo}: a 2ª coluna não parece ser IBUTG (cabeçalho "${limpa((linhas[linhaTit + 1] || [])[b.ini + 1])}")`);
      const r = linhasDe(b, 2).map(([m, i]) => ({ m: numero(m), ibutg: numero(i) })).filter(x => Number.isFinite(x.m) && Number.isFinite(x.ibutg));
      if (r.length < 10) problemas.push(`${rotulo}: só ${r.length} linhas legíveis`);
      return r.sort((a, b2) => a.m - b2.m);
    };
    const quadro1 = par(1, "Quadro 1 (nível de ação)");
    const quadro2 = par(2, "Quadro 2 (limite de exposição)");

    let quadro3 = [];
    const b3 = bloco(3);
    if (!b3) problemas.push("Quadro 3 (taxa metabólica): título não encontrado");
    else {
      let postura = "";
      for (const [p, sg, at, w] of linhasDe(b3, 4)) {
        if (limpa(p)) postura = limpa(p);
        const watts = numero(w);
        if (limpa(at) && Number.isFinite(watts)) quadro3.push({ postura, subgrupo: limpa(sg), atividade: limpa(at), w: watts });
      }
      if (!quadro3.length) problemas.push("Quadro 3 (taxa metabólica): nenhuma atividade legível");
    }

    let quadro4 = [];
    const b4 = bloco(4);
    if (!b4) problemas.push("Quadro 4 (vestimenta): título não encontrado");
    else {
      quadro4 = linhasDe(b4, 2).map(([t, a]) => ({ roupa: limpa(t), adicao: numero(a) })).filter(x => x.roupa && Number.isFinite(x.adicao));
      if (!quadro4.length) problemas.push("Quadro 4 (vestimenta): nenhuma linha legível");
    }

    return { ok: problemas.length === 0, quadro1, quadro2, quadro3, quadro4, problemas };
  }

  /**
   * Sentinela: a fórmula do IBUTG da planilha ainda é a que o sistema usa?
   * Recebe o texto da fórmula (ex.: a célula IBUTGi da aba Calor). Se mudar, o sistema AVISA
   * em vez de calcular errado em silêncio.
   * Esperado: sem solar 0,7·TBN + 0,3·TG ; com solar 0,7·TBN + 0,2·TG + 0,1·TBS.
   */
  function verificarFormulaIBUTG(formula) {
    if (!formula) return { ok: null, aviso: "Não consegui ler a fórmula do IBUTG na planilha para conferir." };
    const f = String(formula).replace(/\s+/g, "").replace(/,/g, ".").replace(/\$/g, "");
    // compara o CONJUNTO de coeficientes (a planilha pode escrever o caso com sol antes ou depois)
    const coef = (f.match(/0\.\d+(?=\*)/g) || []).map(Number).sort((a, b) => a - b).join(",");
    if (coef === "0.1,0.2,0.3,0.7,0.7") return { ok: true, aviso: "" };
    return { ok: false, aviso: `A fórmula do IBUTG nesta planilha parece diferente da usada pelo sistema (coeficientes lidos: ${coef || "nenhum"}). Confira com a planilha antes de usar o resultado.` };
  }

  root.CalorTabelas = { lerTabelas, verificarFormulaIBUTG };
})(typeof globalThis !== "undefined" ? globalThis : window);
