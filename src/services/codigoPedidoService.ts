import { type PrismaClient } from "@prisma/client";

type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export async function gerarCodigoPedido(
  prisma: PrismaClient | PrismaTransaction,
  nomeEvento: string,
  lote: string
) {
  const numeroLote = extrairNumeroLote(lote);

  const totalNoLote = await prisma.pedido.count({
    where: {
      nomeEvento,
      lote,
    },
  });

  const sequencial = totalNoLote + 1;

  return `${numeroLote.toString().padStart(2, "0")}${sequencial
    .toString()
    .padStart(2, "0")}`;
}

function extrairNumeroLote(lote: string) {
  const encontrado = lote.match(/\d+/);

  if (!encontrado) {
    return 1;
  }

  return Number(encontrado[0]);
}
