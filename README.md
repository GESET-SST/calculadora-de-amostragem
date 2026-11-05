# Calculadora de Amostragem (SST / FIESC)

Calculadora de tempo de coleta para agentes químicos (higiene ocupacional).
O técnico anexa a planilha do laboratório (Guia de Amostragem), escolhe os agentes e calcula. Nada é guardado.

## Regra central
`tempo = volume ÷ vazão` (litros ÷ litros/min = minutos).
Para cada vazão: `t_min = V_min / Q` e `t_max = V_max / Q`.

## Estrutura
- `index.html`: a página (abre com duplo clique, sem servidor)
- `src/faixas.js`: leitor da planilha (acha o cabeçalho pelo nome das colunas e lê as faixas)
- `src/calculo.js`: função de cálculo (**a ser implementada pelo Wendel**)
- `test/`: testes (`npm install` e depois `npm test`)
- `vendor/xlsx.full.min.js`: biblioteca que lê Excel (uso offline)

## Rodar os testes
```
npm install
npm test
```
Os testes de `calculo.test.js` falham até a função `tempoMinutos` ser escrita. É esperado.

## Pendências
- Testar com a planilha real do laboratório (colunas mescladas, linhas com mais de um agente)
- Entrada por PDF: não suportada
- Modo instalável/offline (PWA): não feito
- Gerar PDF da ficha com memória de cálculo (hoje só imprime a tela)

## Pacote para a TI (preencher)
- Onde roda:
- Como atualizar a base (planilha a cada 6 meses):
- Quem mantém / quem tem acesso à conta:
- Como validar que está certo:
- Se cair, o que fazer:
