CREATE TABLE IF NOT EXISTS "solicitacoes_reembolso" (
  "id" TEXT NOT NULL,
  "id_pedido" TEXT NOT NULL,
  "cpf" TEXT NOT NULL,
  "email_contato" TEXT NOT NULL,
  "observacao" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDENTE',
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "solicitacoes_reembolso_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "solicitacoes_reembolso_id_pedido_fkey"
    FOREIGN KEY ("id_pedido") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "solicitacoes_reembolso_id_pedido_idx"
  ON "solicitacoes_reembolso"("id_pedido");

CREATE INDEX IF NOT EXISTS "solicitacoes_reembolso_status_idx"
  ON "solicitacoes_reembolso"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "solicitacoes_reembolso_pendente_id_pedido_key"
  ON "solicitacoes_reembolso"("id_pedido")
  WHERE "status" = 'PENDENTE';
