-- Allow a customer to retry checkout for the same event while older attempts
-- are pending, rejected, cancelled, or abandoned.
DROP INDEX IF EXISTS "pedidos_cpf_nome_evento_key";
