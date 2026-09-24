# Verificar se os dados estão sendo puxados do banco

## 1. Abra o DevTools (F12)
- Vá para a aba **Console**

## 2. Procure as mensagens de debug
Ao carregar o app você deve ver logs como (os textos exatos vêm de `src/lib/supabase.ts` e `src/contexts/DataContext.tsx` e podem mudar — procure pelos prefixos `[Supabase]` e `[DataContext]`):

```
[Supabase] env VITE_SUPABASE_URL set? true
[Supabase] env VITE_SUPABASE_ANON_KEY set? true
[Supabase] ✅ Configurado e pronto para uso
[DataContext] 🔄 Carregando dados do Supabase (tenant <uuid>)...
[DataContext] ✅ Dados carregados do Supabase.
```

Se algo falhar no carregamento você verá `[DataContext] ❌ Falha ao carregar <tabela>` (ou `... módulo de nicho`) com o erro do PostgREST logo depois.

## 3. Se não estiver vendo dados

### Se vir: `[Supabase] ⚠️ NÃO CONFIGURADO`
- [ ] Verifique se o `.env` tem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (os dois primeiros logs mostram `true`/`false`)
- [ ] Reinicie o dev server (`npm run dev`) — o Vite só lê o `.env` na inicialização
- [ ] Verifique se o projeto Supabase está online (não pausado)

### Se vir: "row violates row-level security policy" (ou `permission denied`, ou listas vazias sem erro)

**Nunca "resolva" isso desabilitando RLS nem criando policies públicas (`using (true)`, `GRANT` para `anon`).** A RLS é a autoridade de isolamento entre tenants (ver [docs/DATABASE_SECURITY.md](docs/DATABASE_SECURITY.md)); desligá-la expõe os dados de todas as empresas. O erro quase sempre significa que a RLS **está funcionando** e algo do lado do usuário/da requisição está errado. Causas mais comuns:

1. **Usuário sem tenant / sem linha em `public.users`.** `current_tenant_id()` lê `users.tenant_id` pelo `auth.uid()`; se o usuário existe no Auth mas não em `public.users` (ou está com `tenant_id` nulo), `has_tenant_access()` devolve falso para tudo.
2. **`tenant_id` faltando (ou de outro tenant) no `insert`/`update`.** A policy `tenant_isolation` exige `has_tenant_access(tenant_id)` também no `WITH CHECK`. O `DataContext` carimba `tenant_id` automaticamente; código novo que faz `supabase.from(...).insert(...)` direto precisa fazer o mesmo.
3. **Sessão expirada / sem JWT.** Sem sessão a requisição vai como `anon`, que não tem acesso às tabelas de negócio. Faça logout/login e confira se `supabase.auth.getSession()` devolve sessão.
4. **Policy mais restritiva que o padrão.** Algumas tabelas não usam só `has_tenant_access` (ex.: escrita em `cargos`/`squads` só para admin do tenant/master, quando a migration CR1 estiver aplicada; tabelas sem caminho de parceiro; módulos por cargo). Confira a matriz em [docs/DATABASE_SECURITY.md](docs/DATABASE_SECURITY.md) e [docs/projeto/05-ESQUEMA-BACKEND.md](docs/projeto/05-ESQUEMA-BACKEND.md) §10.
5. **Tabela nova sem policy** (RLS ligada e 0 policies = ninguém além de `service_role` acessa). Crie a policy `tenant_isolation` seguindo o checklist da seção 10.5 do mesmo documento.

**Como diagnosticar com segurança** (SQL Editor do Supabase; a sessão simulada só vale dentro da transação e o `rollback` desfaz qualquer teste):

```sql
begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    '{"sub":"<uuid-do-usuario>","role":"authenticated"}', true);

  select auth.uid(), public.current_tenant_id(), public.is_super_admin();
  -- current_tenant_id() nulo => usuário sem linha/tenant em public.users

  select count(*) from public.leads;                        -- leitura
  -- insert de teste com o tenant esperado (desfeito no rollback):
  -- insert into public.leads (tenant_id, name) values (public.current_tenant_id(), 'teste');
rollback;

-- policies da tabela (fora da simulação de papel):
select policyname, cmd, qual, with_check from pg_policies where tablename = 'leads';
```

Compare o resultado com o esperado para aquele usuário. Também vale rodar `get_advisors` (security) depois de qualquer migration. Corrija o **dado** (usuário/tenant/payload) ou a **policy específica** — nunca desabilite a RLS.

### Se vir: `{ leads: 0, tasks: 0, ... }` ou listas vazias sem erro
- [ ] As tabelas podem estar vazias (comportamento correto na primeira vez): crie alguns registros e recarregue
- [ ] Confirme o tenant ativo (`activeTenantId`): master/parceiro enxergam vários tenants e a tela filtra pelo ativo
- [ ] Se for um usuário comum, confirme o item 1 acima (usuário sem tenant retorna zero linhas sem erro)

## 4. Sequência de logs esperada

1. `[Supabase] env ... set?` (URL e anon key)
2. `[Supabase] ✅ Configurado e pronto para uso`
3. `[DataContext] 🔄 Carregando dados do Supabase (tenant ...)`
4. `[DataContext] ✅ Dados carregados do Supabase.`

**Se falhar antes do passo 3/4:** URL/KEY inválida, rede offline, projeto pausado ou sessão sem tenant.

## 5. Para adicionar dados de teste
1. Acesse `https://app.supabase.com` e abra o seu projeto
2. Vá para **Table Editor** e insira registros em `leads`, `tasks`, `contracts` **com o `tenant_id` do tenant que você está usando** (o Table Editor usa `service_role` e ignora a RLS, então um `tenant_id` errado "funciona" ali mas não aparece no app)
3. Recarregue o app

---

**Cole aqui a mensagem de erro exata do Console para análise:**
