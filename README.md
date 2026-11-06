# Calculadora de Amostragem (SST / FIESC)

Calculadora de tempo de coleta para agentes químicos (higiene ocupacional).
O técnico anexa a planilha do laboratório (Guia de Amostragem), escolhe os agentes, vê os tempos e imprime uma **ficha de campo de 1 página**. A planilha não é guardada nem enviada a lugar nenhum.

## Regra central
`tempo = volume ÷ vazão` (litros ÷ litros/min = minutos).
Para cada vazão: `t_min = V_min / Q` e `t_max = V_max / Q`.

## O que a tela faz
- Faixas do método (volume e vazão) aparecem **somente leitura**. O técnico só digita a **vazão intermediária**, que precisa estar dentro da faixa (fora da faixa ela é recusada).
- Se o sistema não leu uma faixa com segurança, os campos abrem para preenchimento manual com aviso vermelho (nunca chuta).
- Mostra o **código do amostrador** de cada agente.
- Ficha de campo: todos os agentes escolhidos numa folha A4, com amostrador, tempos, observações do laboratório e linha de empresa/técnico.
- **Calor (NHO 06)**: ao anexar a planilha de gestão da informação, o sistema lê as abas "Calor" e "Dados Calor - Tabelas" e calcula o IBUTG (até 4 situações térmicas, ponderado em 60 min, com vestimenta). Os **quadros 1 a 4 vêm da planilha** (achados pelo título "Quadro N"), então quando a planilha muda a cada 6 meses o sistema acompanha sem mudar código. As **fórmulas** (IBUTG, média, ponderação) ficam em `src/calor.js`; se a fórmula da planilha mudar, o sistema avisa em vez de calcular errado em silêncio. Gera relatório A4 para imprimir.
- Funciona **offline** depois do primeiro acesso (arquivos guardados no aparelho; a planilha não).

## Estrutura
- `index.html`: a página
- `src/calculo.js`: funções de cálculo (tempo, volume, vazão, vazões da tabela)
- `src/faixas.js`: leitor do Guia de Amostragem (acha o cabeçalho pelo nome das colunas e marca o que é ambíguo)
- `src/tipos.js`: reconhece o tipo de planilha anexada
- `src/calor.js`: fórmulas do calor (IBUTG, ponderação, validação das leituras)
- `src/calor-tabelas.js`: leitor dos quadros do calor + conferência da fórmula da planilha
- `sw.js`, `manifest.webmanifest`, `icon-*.png`: modo offline / instalável
- `test/`: testes (`npm install` e depois `npm test`)
- `vendor/xlsx.full.min.js`: biblioteca que lê Excel (uso offline)

## Rodar os testes
```
npm install
npm test
```

## Publicar uma versão nova
1. Suba os arquivos alterados no GitHub.
2. Em `sw.js`, troque `VERSAO` (ex.: `amostragem-v4`) para o aparelho atualizar o cache.
3. Abra o site e use Ctrl+F5 para conferir.

## Importante
Não suba para este repositório (público) as planilhas reais do laboratório/FIESC. Os testes usam só textos de exemplo.

## Pendências
- Validar com o Josué: tempos do Guia real (215 agentes lidos; 4 a 5 linhas caem em preenchimento manual: Álcool Etílico, Metanol, Ozônio, Poeira de Farinha, linha "Varredura de Vapores Orgânicos")
- Perguntar ao Josué: o que ele quer "salvar" (resultado do dia no aparelho?) e se transporte/estabilidade devem ir na ficha
- Calor: confirmar com o Josué a regra de busca nos Quadros 1 e 2 (hoje: primeira linha com M igual ou maior que o M médio, lado conservador) e o que fazer com M acima do último valor (hoje o sistema avisa e não conclui)
- Calor: os blocos 2 e 3 da planilha ("descanso no mesmo local de trabalho") ainda não têm calculadora
- Ruído, Químico (Avaliações e Varredura) e EPI: ainda sem calculadora
- Aceitar CSV da folha de campo digital com nomes de coluna padronizados
- Entrada por PDF: não suportada (o PDF é só de saída)

## Pacote para a TI (preencher)
- Onde roda: site estático (HTML/JS), sem servidor e sem banco. Hoje em GitHub Pages
- Como atualizar a base (planilha a cada 6 meses): o técnico anexa a planilha nova; nada a instalar
- Quem mantém / quem tem acesso à conta:
- Como validar que está certo: `npm test` e conferir com o Excel do laboratório
- Se cair, o que fazer: o último arquivo carregado continua funcionando offline no aparelho
