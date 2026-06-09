ALTER TABLE "config_lotes"
ADD COLUMN "virada_por_data" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "virada_por_capacidade" BOOLEAN NOT NULL DEFAULT true;
