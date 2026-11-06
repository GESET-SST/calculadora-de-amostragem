// Núcleo da calculadora: funções puras (entram números, sai número).
// Sem tela, sem planilha, sem estado. Por isso é fácil de testar.
// Roda no navegador e no Node (mesmo padrão de faixas.js e tipos.js).
(function (root) {
  const EPS = 1e-9;

  // Só aceita número de verdade e maior que zero. "2" (texto), NaN, Infinity, 0 e negativo são recusados.
  const positivo = n => typeof n === "number" && Number.isFinite(n) && n > 0;

  /** Tempo de coleta em minutos = volume (L) ÷ vazão (L/min). */
  function tempoMinutos(volumeL, vazaoLpm) {
    if (!positivo(volumeL)) throw new Error("Volume deve ser um número maior que zero");
    if (!positivo(vazaoLpm)) throw new Error("Vazão deve ser um número maior que zero");
    return volumeL / vazaoLpm;
  }

  /** Volume em litros = vazão (L/min) × tempo (min). */
  function volumeLitros(vazaoLpm, tempoMin) {
    if (!positivo(vazaoLpm)) throw new Error("Vazão deve ser um número maior que zero");
    if (!positivo(tempoMin)) throw new Error("Tempo deve ser um número maior que zero");
    return vazaoLpm * tempoMin;
  }

  /** Vazão em L/min = volume (L) ÷ tempo (min). */
  function vazaoLitrosPorMin(volumeL, tempoMin) {
    if (!positivo(volumeL)) throw new Error("Volume deve ser um número maior que zero");
    if (!positivo(tempoMin)) throw new Error("Tempo deve ser um número maior que zero");
    return volumeL / tempoMin;
  }

  /** x está entre min e max? (null = sem limite daquele lado; tolera erro de arredondamento) */
  function dentroDaFaixa(x, min, max) {
    if (!Number.isFinite(x)) return false;
    if (Number.isFinite(min) && x < min - EPS) return false;
    if (Number.isFinite(max) && x > max + EPS) return false;
    return true;
  }

  /**
   * Quais vazões entram na tabela?
   *  - vazão do método com valores alternativos (ex.: ciclone 1,7 ou 2,5): só essas, sem intermediária
   *  - faixa contínua: mínima, máxima e, se informada e DENTRO da faixa, a intermediária
   * @param {{min:?number,max:?number,opcoes:?number[]}} vazao
   * @param {number} [intermediaria] vazão escolhida pelo técnico (NaN/undefined = nenhuma)
   * @returns {{lista:{valor:number,intermediaria:boolean}[], erro:string}}
   */
  function vazoesParaCalcular(vazao, intermediaria) {
    const lista = [];
    const add = (valor, intermediaria) => {
      if (Number.isFinite(valor) && !lista.some(x => Math.abs(x.valor - valor) < EPS)) lista.push({ valor, intermediaria });
    };
    let erro = "";
    if (vazao.opcoes && vazao.opcoes.length) {
      vazao.opcoes.forEach(v => add(v, false));
    } else {
      add(vazao.min, false);
      add(vazao.max, false);
      if (Number.isFinite(intermediaria)) {
        if (!(intermediaria > 0)) erro = "A vazão intermediária deve ser maior que zero.";
        else if (!dentroDaFaixa(intermediaria, vazao.min, vazao.max)) erro = "fora da faixa do método";
        else add(intermediaria, true);
      }
    }
    lista.sort((a, b) => a.valor - b.valor);
    return { lista, erro };
  }

  /**
   * Para cada vazão, o tempo do volume mínimo e do máximo.
   * tmin/tmax ficam null quando aquele volume não existe no método.
   */
  function tabelaTempos(vmin, vmax, vazoes) {
    const tempo = (v, q) => (positivo(v) && positivo(q)) ? tempoMinutos(v, q) : null;
    return vazoes.map(q => ({ vazao: q.valor, intermediaria: !!q.intermediaria, tmin: tempo(vmin, q.valor), tmax: tempo(vmax, q.valor) }));
  }

  root.Calculo = { tempoMinutos, volumeLitros, vazaoLitrosPorMin, dentroDaFaixa, vazoesParaCalcular, tabelaTempos };
})(typeof globalThis !== "undefined" ? globalThis : window);
