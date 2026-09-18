-- Reaproveita a tabela "clientes" (já usada pelo CRM) como o Contato da
-- especificação financeira, em vez de criar uma tabela nova e duplicada —
-- só adiciona os campos que faltam pra cobrir Cliente/Fornecedor/Funcionário
-- com endereço completo. Linhas existentes (todas vieram do CRM) recebem
-- tipos={CLIENTE} por padrão.
alter table public.clientes
  add column if not exists tipos text[] not null default '{CLIENTE}',
  add column if not exists tipo_pessoa text check (tipo_pessoa is null or tipo_pessoa in ('PF','PJ')),
  add column if not exists cep text,
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists bairro text,
  add column if not exists complemento text,
  add column if not exists cidade_ibge text;

alter table public.finance_entries
  add column if not exists contato_id text references public.clientes(id);

create index if not exists idx_finance_entries_contato_id on public.finance_entries (contato_id);
