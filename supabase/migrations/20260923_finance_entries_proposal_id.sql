-- Interconexão proposta ↔ financeiro: até aqui não havia NENHUMA coluna
-- ligando um finance_entries à proposta que o gerou (AddProdutoLeadModal por
-- ciclo/parcela, ou syncAcceptedProposal ao aceitar) — a única "ligação" era o
-- texto livre em `description`. Sem uma FK real, excluir uma proposta não
-- tinha como encontrar (e limpar) as cobranças a receber que ela gerou,
-- deixando "receita fantasma" no financeiro por negócios que não existem mais.
-- proposals.id é `text` (não uuid) — sempre gerado via crypto.randomUUID() no
-- cliente, mas armazenado como texto; a FK precisa seguir o mesmo tipo.
alter table public.finance_entries add column if not exists proposal_id text references public.proposals(id) on delete set null;

create index if not exists idx_finance_entries_proposal_id on public.finance_entries(proposal_id) where proposal_id is not null;

comment on column public.finance_entries.proposal_id is
  'Vincula um lançamento financeiro à proposta que o gerou. on delete set null é só uma rede de segurança — a limpeza de verdade é feita explicitamente em DataContext.tsx (deleteProposal), que também remove o contrato vinculado.';
