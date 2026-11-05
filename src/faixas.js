// Leitor da planilha do laboratório (Guia de Amostragem).
// Funções puras: entra texto/linhas, sai objeto. Roda no navegador e no Node.
(function (root) {
  const semAcento = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  // "1.000" -> 1000 ; "0,05" -> 0.05 ; "0.05" -> 0.05
  function numero(txt) {
    let t = String(txt).trim();
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, "");
    t = t.replace(",", ".");
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  }

  // Converte textos como "0,01 - 0,05 L/min", "200 L - 1000 L", "mínimo 480 L", "Máx 10L"
  // em { min, max, unidade, ok, bruto }. Volumes em L, vazões em L/min (mL é convertido).
  function lerFaixa(bruto) {
    const original = String(bruto ?? "").trim();
    const r = { min: null, max: null, ok: false, bruto: original };
    if (!original) return r;
    // tira a unidade "/min" para não confundir com a palavra "mínimo"
    const t = semAcento(original).replace(/\s+/g, " ").replace(/\/\s*min\b/g, "");

    const ml = /\bml\b/.test(t);               // mL ou mL/min
    const fator = ml ? 1 / 1000 : 1;
    const nums = (t.match(/\d+(?:[.,]\d+)*/g) || []).map(numero).filter(Number.isFinite);
    if (!nums.length) return r;

    if (/\b(minimo|min)\b/.test(t) && nums.length === 1) {
      r.min = nums[0] * fator;
    } else if (/\b(maximo|max)\b/.test(t) && nums.length === 1) {
      r.max = nums[0] * fator;
    } else if (nums.length >= 2) {
      r.min = Math.min(nums[0], nums[1]) * fator;
      r.max = Math.max(nums[0], nums[1]) * fator;
    } else {
      r.min = r.max = nums[0] * fator;       // valor único
    }
    r.ok = true;
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
      transporte: h => h.includes("transporte") || h.includes("armazenamento"),
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
    const agentes = [], revisar = [];
    let ultimo = null;

    for (let i = linhaCabecalho + 1; i < linhas.length; i++) {
      const l = linhas[i] || [];
      if (!l.some(c => String(c ?? "").trim() !== "")) continue;   // linha vazia
      const nome = get(l, "agente");
      const vazaoTxt = get(l, "vazao"), volumeTxt = get(l, "volume");

      if (!nome) {                      // célula mesclada: herda do agente anterior
        if (ultimo && (vazaoTxt || volumeTxt)) {
          revisar.push({ linha: i + 1, motivo: "linha sem nome de agente (mesclada?)", agente: ultimo.agente });
        }
        continue;
      }
      const vazao = lerFaixa(vazaoTxt), volume = lerFaixa(volumeTxt);
      const problemas = [];
      if (!vazao.ok) problemas.push(`vazão ilegível: "${vazaoTxt}"`);
      if (!volume.ok) problemas.push(`volume ilegível: "${volumeTxt}"`);
      if (vazao.ok && (vazao.min == null || vazao.max == null)) problemas.push(`vazão incompleta: "${vazaoTxt}"`);

      const ag = {
        linha: i + 1,
        agente: nome,
        cas: get(l, "cas"),
        amostrador: get(l, "amostrador"),
        codigo: get(l, "codigo"),
        vazao, volume,
        transporte: get(l, "transporte"),
        estabilidade: get(l, "estabilidade"),
        observacao: get(l, "observacao"),
        problemas,
      };
      agentes.push(ag);
      if (problemas.length) revisar.push({ linha: i + 1, motivo: problemas.join("; "), agente: nome });
      ultimo = ag;
    }
    return { ok: true, agentes, revisar };
  }

  root.Faixas = { lerFaixa, lerPlanilha, acharColunas, semAcento };
})(typeof globalThis !== "undefined" ? globalThis : window);
