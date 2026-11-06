// Reconhece QUE TIPO de planilha foi anexada, olhando nomes de abas e cabeçalhos.
// Cada tipo tem seu leitor/calculadora. Tipo desconhecido: diz o que viu, sem fingir que entendeu.
(function (root) {
  const sa = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  // Primeiro texto "de título" da aba (ignora botões como "Voltar")
  function titulo(aoa) {
    for (let i = 0; i < Math.min(aoa.length, 12); i++) {
      for (const c of aoa[i] || []) {
        const t = String(c ?? "").replace(/\s+/g, " ").trim();
        if (t.length >= 12 && !/^voltar$/i.test(t) && isNaN(Number(t))) return t.slice(0, 90);
      }
    }
    return "";
  }

  // abas: { "Nome da aba": [[...linhas...]] }
  function detectarTipo(abas) {
    const nomes = Object.keys(abas);
    const info = nomes.map(n => ({ nome: n, titulo: titulo(abas[n]) }));

    for (const n of nomes) {
      if (root.Faixas && root.Faixas.acharColunas(abas[n])) {
        return { tipo: "guia-amostragem", rotulo: "Guia de Amostragem do laboratório", aba: n, abas: info };
      }
    }
    const lista = nomes.map(sa);
    const temCalor = lista.some(n => n.includes("calor"));
    const temOutras = lista.some(n => n.includes("ruido") || n.includes("quimico"));
    const textoCalor = nomes.some(n => abas[n].slice(0, 6).some(l => (l || []).some(c => sa(c).includes("nho 06"))));
    if ((temCalor && temOutras) || textoCalor) {
      return { tipo: "gestao-informacao", rotulo: "Planilha de gestão da informação (calculadoras de calor, ruído e químico)", abas: info };
    }
    return { tipo: "desconhecido", rotulo: "Tipo não reconhecido", abas: info };
  }

  root.Tipos = { detectarTipo, titulo };
})(typeof globalThis !== "undefined" ? globalThis : window);
