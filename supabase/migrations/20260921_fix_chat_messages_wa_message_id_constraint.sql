-- O índice único PARCIAL (WHERE wa_message_id IS NOT NULL) criado na
-- migration anterior (20260921_whatsapp_real_chat_persistence) não serve de
-- "arbiter" pro .upsert(..., {onConflict:'wa_message_id'}) do supabase-js —
-- testado direto: erro "no unique or exclusion constraint matching",
-- mesmo com a constraint existindo e o schema do PostgREST recarregado
-- (NOTIFY pgrst, 'reload schema'). Troca pra um UNIQUE CONSTRAINT completo:
-- Postgres permite múltiplos NULL num UNIQUE normal (NULL nunca é igual a
-- NULL), então o comportamento desejado (mensagens sem id de origem nunca
-- colidem) continua o mesmo, só que agora resolvível pelo PostgREST. O
-- endpoint do webhook também passou a usar insert() simples + checagem do
-- código de erro 23505 em vez de depender do upsert (ver server.ts).
DROP INDEX IF EXISTS public.idx_chat_messages_wa_message_id;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_wa_message_id_key UNIQUE (wa_message_id);
