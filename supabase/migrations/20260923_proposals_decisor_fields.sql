-- Interconexão lead <-> proposta: o "decisor" (tomador de decisão) já podia
-- ser registrado no lead (Lead Details, customFields.decisorNome/currentRole)
-- mas nunca chegava na proposta gerada a partir dele — quem lia a proposta
-- não tinha essa informação sem voltar no lead. Copiado no momento da
-- criação da proposta (AddProdutoLeadModal), não um vínculo ao vivo — a
-- proposta é um documento; se o decisor mudar depois no lead, a proposta já
-- emitida mantém o que valia quando foi gerada.
alter table public.proposals add column if not exists decisor_nome text;
alter table public.proposals add column if not exists decisor_cargo text;

comment on column public.proposals.decisor_nome is
  'Nome do decisor (tomador de decisão) copiado do lead vinculado no momento da criação da proposta — ver Lead Details (customFields.decisorNome).';
comment on column public.proposals.decisor_cargo is
  'Cargo do decisor, copiado de customFields.currentRole do lead vinculado.';
