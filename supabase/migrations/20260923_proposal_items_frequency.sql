-- Auditoria 2026-09-23: o modal "Novo Produto" (AddProdutoLeadModal.tsx)
-- confundia recorrência com parcelamento — uma assinatura de R$997/mês por
-- 12 meses virava uma cobrança única de R$11.964. `proposal_items` já tinha
-- `billing_type` (recurring/one_time) e `contract_months` (vigência total em
-- meses), mas nenhuma coluna guardava a FREQUÊNCIA do ciclo (mensal,
-- trimestral, semestral, anual, personalizado) separada da vigência —
-- sem isso não dá pra saber se "12 meses" significa 12 ciclos mensais ou
-- 1 ciclo anual. Ver src/lib/saleCalculator.ts (calculateSale()).
alter table public.proposal_items add column if not exists frequency text;

comment on column public.proposal_items.frequency is
  'Frequência do ciclo recorrente (mensal/trimestral/semestral/anual/personalizado) — distinto de contract_months (vigência total, em meses). Null para itens one_time.';
