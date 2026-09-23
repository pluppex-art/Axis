-- Mesma classe de bug já corrigida em createClientFromWonLead/NovoClienteModal/
-- Empresas/Filiais: `cidade` tinha um DEFAULT fixo 'São Paulo' no próprio banco
-- (não só no app) — qualquer INSERT sem cidade explícita virava "São Paulo"
-- silenciosamente, mesmo pra tenants de outras cidades (ex.: Palmas/TO).
alter table public.imobiliario_imoveis alter column cidade drop default;

comment on column public.imobiliario_imoveis.cidade is
  'Cidade do imóvel — sem default fixo (antes valia São Paulo pra qualquer registro sem cidade informada, mesmo em tenants de outras cidades).';
