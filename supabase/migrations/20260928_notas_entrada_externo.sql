-- Notas de Entrada importadas de um sistema externo (Max Data): guarda de onde
-- veio (externo_sistema + externo_id) pra nunca importar a mesma entrada duas
-- vezes (índice único, ignorando notas canceladas — dá pra reimportar depois
-- de cancelar).
alter table public.notas_entrada
  add column if not exists externo_sistema text,
  add column if not exists externo_id text;

alter table public.notas_entrada drop constraint if exists notas_entrada_origem_check;
alter table public.notas_entrada add constraint notas_entrada_origem_check check (origem in ('xml', 'manual', 'ia', 'maxdata'));

create unique index if not exists uq_notas_entrada_externo
  on public.notas_entrada (tenant_id, externo_sistema, externo_id)
  where externo_id is not null and status <> 'Cancelada';
