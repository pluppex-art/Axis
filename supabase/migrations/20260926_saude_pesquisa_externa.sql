-- Marca os itens que já passaram pela pesquisa externa (web) da Aurora, para não repetir a busca.
alter table public.saude_comparacao_itens add column if not exists pesquisa_externa boolean not null default false;
