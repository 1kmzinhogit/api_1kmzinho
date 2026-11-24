ALTER TABLE "cupons"
ADD COLUMN "limite_usos" INTEGER,
ADD COLUMN "validade_ate" TIMESTAMP(3);

ALTER TABLE "cupons"
ADD CONSTRAINT "cupons_limite_usos_check"
CHECK ("limite_usos" IS NULL OR "limite_usos" > 0);
