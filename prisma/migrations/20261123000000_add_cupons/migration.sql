CREATE TABLE "cupons" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome_evento" TEXT NOT NULL,
    "desconto" DOUBLE PRECISION NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cupons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cupons_codigo_key" ON "cupons"("codigo");
CREATE INDEX "cupons_nome_evento_ativo_idx" ON "cupons"("nome_evento", "ativo");

ALTER TABLE "pedidos" ADD COLUMN "codigo_cupom" TEXT;
ALTER TABLE "pedidos" ADD COLUMN "desconto_cupom" DOUBLE PRECISION NOT NULL DEFAULT 0;
