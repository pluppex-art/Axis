-- Intencionalmente vazia (no-op).
-- O trigger de updated_at em public.colaboradores já existe no banco (colaboradores_updated_at /
-- update_colaboradores_modtime, ver 20260606_colaboradores_table.sql); este arquivo ficou sem conteúdo
-- por engano e é mantido só para não quebrar a ordem/histórico de migrations já aplicadas.
select 1;
