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

  const pedidosNoLote = await prisma.pedido.findMany({
    where: {
      nomeEvento,
      lote,
    },
    select: { codigoPedido: true },
  });

  const prefixo = numeroLote.toString().padStart(2, "0");
  const sequenciaisUsados = new Set(
    pedidosNoLote.flatMap(({ codigoPedido }) => {
      if (!codigoPedido?.startsWith(prefixo)) return [];
      const sequencial = Number(codigoPedido.slice(prefixo.length));
      return Number.isSafeInteger(sequencial) && sequencial > 0 ? [sequencial] : [];
    })
  );

  let sequencial = 1;
  while (sequenciaisUsados.has(sequencial)) sequencial++;

  return `${prefixo}${sequencial.toString().padStart(2, "0")}`;
}

function extrairNumeroLote(lote: string) {
  const encontrado = lote.match(/\d+/);

  if (!encontrado) {
    return 1;
  }

  return Number(encontrado[0]);
}
