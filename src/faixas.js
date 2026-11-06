// Leitor da planilha do laboratório (Guia de Amostragem).
// Funções puras: entra texto/linhas, sai objeto. Roda no navegador e no Node.
// Regra de ouro: na dúvida, NÃO adivinhar. Marcar para o técnico conferir.
(function (root) {
  const semAcento = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const limpa = s => String(s ?? "").replace(/\s+/g, " ").trim();

  // "1.000" -> 1000 ; "0,05" -> 0.05 ; "0.05" -> 0.05
  function numero(txt) {
    let t = String(txt).trim();
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, "");
    t = t.replace(",", ".");
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  }

  // Converte o texto da faixa em { min, max, ok, bruto, opcoes, nota, condicional }.
  // Volumes em L, vazões em L/min (mL é convertido).
  //  ok=true            -> min/max confiáveis (pode ter "nota" pedindo conferência)
  //  opcoes=[a,b]       -> valores DISCRETOS (ex.: ciclone de nylon 1,7 ou de alumínio 2,5), não é faixa contínua
  //  condicional=true   -> texto com condição/ressalva (STEL/TWA, umidade, norma...): sem números, conferir à mão
  function lerFaixa(bruto) {
    const original = limpa(bruto);
    const r = { min: null, max: null, ok: false, bruto: original, opcoes: null, nota: "", condicional: false };
    if (!original) return r;

    const sa = semAcento(original);
    const t = sa.replace(/\/\s*min\b/g, "");          // "L/min" -> "L" (evita confundir com a palavra "mínimo")
    const fator = /\bml\b/.test(t) ? 1 / 1000 : 1;
    const nums = (t.match(/\d+(?:[.,]\d+)*/g) || []).map(numero).filter(Number.isFinite);
    if (!nums.length) return r;

    // O que sobra depois de tirar números, unidades e palavras de faixa? Se sobrou algo, há condição no texto.
    const resto = t.replace(/\d+(?:[.,]\d+)*/g, " ")
      .replace(/\b(minimo|maximo|min|max|ml|l|a)\b/g, " ")
      .replace(/[-–—.,;:()]/g, " ").replace(/\s+/g, "");

    if (resto === "") {
      if (/\b(minimo|min)\b/.test(t) && nums.length === 1) r.min = nums[0] * fator;
      else if (/\b(maximo|max)\b/.test(t) && nums.length === 1) r.max = nums[0] * fator;
      else if (nums.length >= 2) {
        r.min = Math.min(nums[0], nums[1]) * fator;
        r.max = Math.max(nums[0], nums[1]) * fator;
      } else r.min = r.max = nums[0] * fator;
      r.ok = true;
      return r;
    }

    // Há texto extra. Três situações conhecidas, o resto vai para conferência manual.
    const lmin = [...sa.matchAll(/(\d+(?:[.,]\d+)*)\s*l\s*\/\s*min/g)].map(m => numero(m[1])).filter(Number.isFinite);
    const temIntervalo = /\d\s*[-–]\s*\d/.test(sa);

    if (nums.length === 1 && lmin.length === 1) {                 // ex.: "1,6 L/min Amostragem com Ciclone Torácico"
      r.min = r.max = nums[0] * fator;
      r.ok = true;
      r.nota = `confira o texto do laboratório: "${original}"`;
    } else if (lmin.length >= 2 && lmin.length === nums.length && !temIntervalo) {   // ex.: "Ciclone de Nylon 1,7 L/min Ciclone de Alumínio 2,5 L/min"
      r.opcoes = lmin.map(n => n * fator);
      r.min = Math.min(...r.opcoes);
      r.max = Math.max(...r.opcoes);
      r.ok = true;
      r.nota = `valores alternativos (não é faixa contínua): ${r.opcoes.map(n => String(Number(n.toFixed(3))).replace(".", ",")).join(" ou ")}. Texto: "${original}"`;
    } else {
      r.condicional = true;                                       // ex.: "3 L (se umidade ≥ 50%). 5 L (se umidade < 50%)"
    }
    return r;
  }

  // Acha a linha de cabeçalho e as colunas pelo NOME (não pela posição).
  function acharColunas(linhas) {
    const regras = {
      agente: h => h.includes("agente"),
      cas: h => h === "cas" || h.startsWith("cas "),
      amostrador: h => h.includes("tipo de amostrador") || h === "amostrador",
      codigo: h => h.includes("codigo"),
      vazao: h => h.includes("vazao"),
      volume: h => h.includes("volume"),
      transporte: h => h.includes("transporte"),
      armazenamento: h => h.includes("armazenamento"),
      estabilidade: h => h.includes("estabilidade"),
      observacao: h => h.includes("observa"),
    };
    for (let i = 0; i < Math.min(linhas.length, 30); i++) {
      const hs = (linhas[i] || []).map(semAcento);
      const col = {};
      for (const [k, fn] of Object.entries(regras)) {
        const idx = hs.findIndex(fn);
        if (idx >= 0) col[k] = idx;
      }
      if (col.armazenamento !== undefined && col.armazenamento === col.transporte) delete col.armazenamento;   // coluna única "transporte/armazenamento"
      if (col.agente !== undefined && col.vazao !== undefined && col.volume !== undefined) {
        return { linhaCabecalho: i, col };
      }
    }
    return null;
  }

  // linhas: array de arrays (como XLSX.utils.sheet_to_json(ws, {header:1}))
  function lerPlanilha(linhas) {
    const achou = acharColunas(linhas);
    if (!achou) {
      return { ok: false, erro: "Não encontrei o cabeçalho com 'Agente', 'Vazão' e 'Volume'. Esse arquivo é o Guia de Amostragem?", agentes: [], revisar: [] };
    }
    const { linhaCabecalho, col } = achou;
    const get = (l, k) => (col[k] === undefined ? "" : String(l[col[k]] ?? "").trim());
    const getLimpo = (l, k) => limpa(get(l, k));
    const agentes = [], revisar = [];
    let ultimo = null;

    for (let i = linhaCabecalho + 1; i < linhas.length; i++) {
      const l = linhas[i] || [];
      if (!l.some(c => String(c ?? "").trim() !== "")) continue;   // linha vazia
      const nome = getLimpo(l, "agente");
      const vazaoTxt = get(l, "vazao"), volumeTxt = get(l, "volume");

      if (!nome) {                      // célula mesclada ou linha solta
        if (ultimo && (vazaoTxt || volumeTxt)) {
          revisar.push({ linha: i + 1, motivo: "linha sem nome de agente (mesclada?)", agente: ultimo.agente });
        }
        continue;
      }
      const vazao = lerFaixa(vazaoTxt), volume = lerFaixa(volumeTxt);
      const problemas = [], notas = [];
      const rotulo = { vazão: vazao, volume };
      for (const [nomeCampo, f] of Object.entries(rotulo)) {
        if (f.condicional) problemas.push(`${nomeCampo} com condição, conferir: "${f.bruto}"`);
        else if (!f.ok) problemas.push(f.bruto ? `${nomeCampo} ilegível: "${f.bruto}"` : `${nomeCampo} vazio`);
        else if (f.nota) notas.push(`${nomeCampo}: ${f.nota}`);
      }
      if (vazao.ok && (vazao.min == null || vazao.max == null)) problemas.push(`vazão incompleta: "${vazao.bruto}"`);

      const ag = {
        linha: i + 1,
        agente: nome,
        cas: getLimpo(l, "cas"),
        amostrador: getLimpo(l, "amostrador"),
        codigo: getLimpo(l, "codigo"),
        vazao, volume,
        transporte: get(l, "transporte"),
        armazenamento: get(l, "armazenamento"),
        estabilidade: get(l, "estabilidade"),
        observacao: get(l, "observacao"),
        problemas, notas,
      };
      agentes.push(ag);
      if (problemas.length) revisar.push({ linha: i + 1, motivo: problemas.join("; "), agente: nome });
      ultimo = ag;
    }
    return { ok: true, agentes, revisar };
  }

  root.Faixas = { lerFaixa, lerPlanilha, acharColunas, semAcento };
})(typeof globalThis !== "undefined" ? globalThis : window);
