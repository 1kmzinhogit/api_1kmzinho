ALTER TABLE "pedidos" ADD COLUMN "codigo_pedido" TEXT;

WITH pedidos_numerados AS (
  SELECT
    "id",
    LPAD(COALESCE(NULLIF(SUBSTRING("lote" FROM '\d+'), ''), '1'), 2, '0') ||
      LPAD(
        ROW_NUMBER() OVER (
          PARTITION BY "nome_evento", "lote"
          ORDER BY "criado_em", "id"
        )::TEXT,
        2,
        '0'
      ) AS "codigo_pedido"
  FROM "pedidos"
)
UPDATE "pedidos"
SET "codigo_pedido" = pedidos_numerados."codigo_pedido"
FROM pedidos_numerados
WHERE "pedidos"."id" = pedidos_numerados."id"
  AND "pedidos"."codigo_pedido" IS NULL;

CREATE UNIQUE INDEX "pedidos_nome_evento_lote_codigo_pedido_key"
ON "pedidos"("nome_evento", "lote", "codigo_pedido");
