# Demonstração para a Labo Vida — Comparação de Tabelas

Empresa de demonstração: **Labo Vida (Demonstração)** — dados 100% sintéticos (70 exames de
laboratório + uma tabela de parceiro "Medprev" com 185 linhas). Nada aqui é dado da Labo Vida.

## Antes da reunião (checklist)
- [ ] O trabalho da Comparação de Tabelas está **commitado, publicado e no ar** na Vercel (a análise da
      Aurora e a fila de revisão ainda estavam em edição não commitada em 25/09).
- [ ] Na Vercel, variável **`TABLE_COMPARISON_AI_WEBHOOK_URL`** cadastrada (valor no `.env` local) e novo deploy feito.
- [ ] `vercel.json` já define `maxDuration: 60` no `/api` (commit `de1b047`) — a análise da Aurora leva 10–30 s.
- [ ] Entrar como **master** → seletor de empresa → **Labo Vida (Demonstração)** → Clínicas e Saúde → Comparação de Tabelas.
- [ ] Ensaiar uma vez o roteiro abaixo (leva ~7 min). Tela cheia, zoom 100%.
- [ ] **Plano B** (sem internet/site fora): `scripts/exemplos/saida-demo/comparacao-medprev-demo.pdf` e `.xlsx`.
- [ ] Para refazer tudo do zero: `npx tsx scripts/seedDemoLaboVida.ts --reset` (só mexe na empresa de demonstração).

## Roteiro (≈ 7 min)
1. **O problema (30 s).** "Cada parceiro manda uma tabela com nomes diferentes: 'Vitamina D' × '25-OH Vit D', 'TGO' × 'AST'.
   Hoje alguém compara linha por linha."
2. **Base de Exames.** Mostre os 70 exames com sinônimos e códigos — "essa é a sua base oficial; cada empresa tem a sua, isolada".
3. **Comparação já processada (Medprev).** Painel: **185 itens → 114 correspondências, 10 para revisão, 61 não identificados**, valor
   da tabela, custo, diferença e margem.
4. **Abra um item automático** ("TGO" → TGO (AST)): score, motivo, evidência. **Abra uma armadilha** ("T4 TOTAL", "Toxoplasmose IgA"):
   está em *não identificado* — "o sistema prefere não dizer nada a inventar uma correspondência".
5. **Fila de revisão.** Confirme 2–3 sugestões da Aurora e rejeite uma. "O que você confirma vira memória da sua empresa."
6. **Nova comparação ao vivo** com `tabela-parceiro-medprev.csv`: mapeamento de colunas → processa em segundos → agora as revisões que
   você confirmou aparecem como **"Memória confirmada"**.
7. **Relatórios.** Botões **Excel** e **PDF** — abra o PDF (resumo, metodologia, pendências).
8. **Fecho (30 s).** "Hoje você importa a planilha. O próximo passo é o seu sistema enviar a tabela por **API** e receber o resultado pronto."

## O que dizer com honestidade
- Os números da demo vêm de um teste com dados de exemplo: **0 correspondências automáticas erradas em 185 linhas**, ~65% dos exames
  resolvidos sem ninguém olhar, o restante vai para revisão. Com as tabelas reais da Labo Vida os percentuais vão variar — o
  ganho é ajustar sinônimos e a memória nas primeiras rodadas.
- **Ainda não existe** (não prometa como pronto): integração por API/chave para o sistema da Labo Vida enviar tabelas, fila com barra
  de progresso para milhares de linhas, pesquisa externa como reforço. Apresente como próximos passos.
- A IA (Aurora) só entra nos casos ambíguos e **nunca** vira "automático" sozinha; roda no n8n com limite de tokens por empresa.
