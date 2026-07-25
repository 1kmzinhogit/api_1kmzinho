ALTER TABLE "config_lotes"
  ADD COLUMN "grupo_capacidade" TEXT,
  ADD COLUMN "capacidade_grupo" INTEGER;

CREATE INDEX "config_lotes_grupo_capacidade_idx"
ON "config_lotes"("grupo_capacidade");
