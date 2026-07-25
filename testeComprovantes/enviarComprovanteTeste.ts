/**
 * Envia um comprovante fictício para EMAIL_DESTINO, sem criar pedido ou alterar o banco.
 * Execute: npx tsx testeComprovantes/enviarComprovanteTeste.ts
 */
import "dotenv/config";
import { enviarComprovanteInscricao } from "../src/services/emailService.js";

const destinatario = process.env.EMAIL_DESTINO;

if (!destinatario) {
  throw new Error("Defina EMAIL_DESTINO no arquivo .env antes de executar o teste.");
}

await enviarComprovanteInscricao({
  email: destinatario,
  numeroInscricao: 1,
  codigoPedido: "0101",
  nomePessoa: "Maria da Silva (teste)",
  nomeEvento: "Juntos Rumo ao Céu",
  distancia: "5km",
  lote: "Kit Completo",
  categoria: "FEMININO",
  valorIngresso: 80,
  taxaServico: 5,
  total: 85,
  confirmadoEm: new Date(),
});

console.log(`Comprovante de teste enviado para ${destinatario}.`);
