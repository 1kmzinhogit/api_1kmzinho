ALTER TABLE "pedidos"
  ADD COLUMN "email" TEXT,
  ADD COLUMN "numero_inscricao" INTEGER,
  ADD COLUMN "comprovante_enviado_em" TIMESTAMP(3);

CREATE UNIQUE INDEX "pedidos_nome_evento_numero_inscricao_key"
ON "pedidos"("nome_evento", "numero_inscricao");
