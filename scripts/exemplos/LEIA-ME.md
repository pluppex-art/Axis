# Teste da Comparação de Tabelas — passo a passo

Dados **sintéticos** (nenhum cliente real): uma base de laboratório com 70 exames e uma tabela de
parceiro com 185 linhas (sinônimos, abreviações, erros de digitação e armadilhas de propósito).

## Antes de testar
1. **A IA (Aurora) roda no n8n**, no workflow "Comparação de Tabelas - Analisar Itens (IA)"
   (`6Cb8wS7AMofvb8Uc`, ativo). O backend do SPY precisa da variável `TABLE_COMPARISON_AI_WEBHOOK_URL`
   (já está no `.env` local; **no servidor de produção/Vercel ela precisa ser cadastrada** — ver
   `.env.example`). Sem ela, "Analisar pendências com a Aurora" responde 503. As regras
   determinísticas funcionam sem IA. O consumo entra no limitador de tokens da empresa
   (`ai_usage_log`, grupo "Clínicas e Saúde").
2. Use uma empresa de **teste** com o módulo **Clínica** ativo (nunca uma empresa de cliente).

## Passo a passo na tela (Clínicas e Saúde)
1. **Base de Exames** → Importar → `base-exames-laboratorio.csv` (as colunas são reconhecidas
   sozinhas; confira o mapeamento) → 70 exames.
2. **Comparação de Tabelas** → Nova comparação → parceiro `Medprev` →
   `tabela-parceiro-medprev.csv` → confira o mapeamento (Nome do exame, Código, Quantidade, Valor) → Iniciar.
3. Resultado esperado **antes** da Aurora (é o mesmo do teste offline):
   - ≈ **108 correspondências automáticas**, **0 erradas**;
   - o restante em revisão / não identificado (≈ 77); as **armadilhas** (T4 total, Vitamina B6,
     Toxoplasmose IgA, Cálcio iônico…) **nunca** aparecem como automáticas;
   - "Exame 40304361", "Prova 40302040" e "Dosagem X 40316521" (nome estranho, código certo) caem em **revisão**.
4. **Analisar pendências com a Aurora** → esperado: ≈ 16 exames certos sugeridos na fila de revisão no total (3 já vinham
   das regras, ≈ 13 novos da Aurora), nenhuma sugestão errada; a Aurora **não** promove nada a automático (a menos que a empresa autorize).
5. Confirme/rejeite alguns na fila de revisão → gere **Excel** e **PDF** (botões no topo do resultado).
6. Faça uma **2ª comparação** com o mesmo arquivo: o que você confirmou antes deve vir da
   **memória** ("Memória confirmada").

## Teste offline (sem tela, sem banco)
```
npx tsx scripts/tableMatchLabTest.ts          # motor determinístico — "AUTO ERRADO" tem que ser 0
npx tsx scripts/tableMatchLabTestAurora.ts    # com a Aurora real, passando pelo n8n (~5 chamadas)
```

## Regenerar os CSVs
`npx tsx scripts/gerarExemplosComparacao.ts`
