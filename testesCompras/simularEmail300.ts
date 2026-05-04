/**
 * Script para testar envio de e-mail com PDF de 300 participantes.
 * Execute: npx tsx testesCompras/simularEmail300.ts
 *
 * Variaveis opcionais:
 * - EVENTO_TESTE_EMAIL="Corrida X - Teste PDF 300"
 * - LOTE_TESTE_EMAIL="Lote 1"
 * - TOTAL_PARTICIPANTES=300
 */

import "dotenv/config";
import { prisma } from "../src/config/db.js";
import { enviarRelatorioKits } from "../src/services/emailService.js";
import { gerarPDFKitsPorLote } from "../src/services/pdfService.js";

const totalParticipantes = Number(process.env.TOTAL_PARTICIPANTES ?? 300);
const nomeEvento =
  process.env.EVENTO_TESTE_EMAIL ?? "Corrida X - Teste PDF 300";
const lote = process.env.LOTE_TESTE_EMAIL ?? "Lote 1";
const valorIngresso = Number(process.env.VALOR_INGRESSO_TESTE_EMAIL ?? 89.9);
const limparEventoAntes = process.env.LIMPAR_EVENTO_TESTE_EMAIL !== "false";

const categorias = ["MASCULINO", "FEMININO", "MAIOR_60", "LGBTQIA", "PCD"] as const;

const participantesBase = [
  {
    cpf: "123.456.789-00",
    contato: "(11) 99999-0001",
    nomePessoa: "Ana Souza",
    nomeNaCamisa: "ANA SOUZA",
    dataNascimento: "1988-04-12",
    corCamisa: "Branca",
    equipe: "Corredores SP",
    categoria: "FEMININO",
  },
  {
    cpf: "987.654.321-00",
    contato: "(11) 99999-0002",
    nomePessoa: "Bruno Lima",
    nomeNaCamisa: "BRUNO LIMA",
    dataNascimento: "1984-09-23",
    corCamisa: "Preta",
    equipe: "Run Club Centro",
    categoria: "MASCULINO",
  },
  {
    cpf: "456.789.123-00",
    contato: "(11) 99999-0003",
    nomePessoa: "Carla Mendes",
    nomeNaCamisa: "CARLA MENDES",
    dataNascimento: "1992-01-18",
    corCamisa: "Azul",
    equipe: "Equipe Superacao",
    categoria: "FEMININO",
  },
  {
    cpf: "321.654.987-00",
    contato: "(11) 99999-0004",
    nomePessoa: "Daniel Rocha",
    nomeNaCamisa: "DANIEL ROCHA",
    dataNascimento: "1979-06-30",
    corCamisa: "Verde",
    equipe: "",
    categoria: "MASCULINO",
  },
  {
    cpf: "111.222.333-44",
    contato: "(11) 99999-0005",
    nomePessoa: "Eduarda Alves",
    nomeNaCamisa: "EDUARDA ALVES",
    dataNascimento: "1963-11-05",
    corCamisa: "Rosa",
    equipe: "Vida Ativa",
    categoria: "MAIOR_60",
  },
  {
    cpf: "555.666.777-88",
    contato: "(11) 99999-0006",
    nomePessoa: "Felipe Costa",
    nomeNaCamisa: "FELIPE COSTA",
    dataNascimento: "1995-02-27",
    corCamisa: "Amarela",
    equipe: "Pace Forte",
    categoria: "LGBTQIA",
  },
] satisfies Array<{
  cpf: string;
  contato: string;
  nomePessoa: string;
  nomeNaCamisa: string;
  dataNascimento: string;
  corCamisa: string;
  equipe: string;
  categoria: (typeof categorias)[number];
}>;

async function garantirLote() {
  await prisma.configLote.upsert({
    where: {
      nomeEvento_lote: {
        nomeEvento,
        lote,
      },
    },
    update: {
      capacidade: totalParticipantes,
      ativo: true,
      notificado: false,
      distancia: "1KM",
    },
    create: {
      nomeEvento,
      lote,
      distancia: "1KM",
      capacidade: totalParticipantes,
      ativo: true,
      notificado: false,
      precos: {
        create: categorias.map((categoria) => ({
          categoria,
          valor: valorIngresso,
          ativo: true,
        })),
      },
    },
  });
}

async function criarPedidos() {
  const timestamp = Date.now();

  for (let i = 0; i < totalParticipantes; i++) {
    const participante = participantesBase[i % participantesBase.length];
    const codigoPedido = `01${String(i + 1).padStart(4, "0")}`;

    await prisma.pedido.create({
      data: {
        codigoPedido,
        referenciaExterna: `REF-EMAIL-300-${timestamp}-${i}`,
        status: "APROVADO",
        idPagamento: `MP-EMAIL-300-${timestamp}-${i}`,
        idPreferencia: `PREF-EMAIL-300-${timestamp}-${i}`,
        total: valorIngresso,
        cpf: participante.cpf,
        contato: participante.contato,
        nomeEvento,
        lote,
        distancia: "1KM",
        valorIngresso,
        nomeNaCamisa: participante.nomeNaCamisa,
        dataNascimento: participante.dataNascimento,
        nomePessoa: participante.nomePessoa,
        corCamisa: participante.corCamisa,
        equipe: participante.equipe,
        categoria: participante.categoria,
        numeroCamisa: String(i + 1),
        itens: {
          create: {
            titulo: `Kit ${lote} - ${participante.categoria}`,
            quantidade: 1,
            valorUnit: valorIngresso,
          },
        },
      },
    });

    if ((i + 1) % 50 === 0 || i + 1 === totalParticipantes) {
      console.log(`Criados ${i + 1}/${totalParticipantes} participantes...`);
    }
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("TESTE DE EMAIL COM PDF - 300 PARTICIPANTES");
  console.log("=".repeat(60));
  console.log(`Evento: ${nomeEvento}`);
  console.log(`Lote: ${lote}`);
  console.log(`Total: ${totalParticipantes}`);

  if (limparEventoAntes) {
    console.log("Limpando dados anteriores desse evento/lote de teste...");
    await prisma.pedido.deleteMany({ where: { nomeEvento, lote } });
    await prisma.configLote.deleteMany({ where: { nomeEvento, lote } });
  }

  await garantirLote();
  await criarPedidos();

  console.log("Gerando PDF...");
  const pdfBuffer = await gerarPDFKitsPorLote(nomeEvento, lote);
  console.log(`PDF gerado: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);

  console.log("Enviando e-mail...");
  await enviarRelatorioKits(pdfBuffer, nomeEvento, lote, totalParticipantes);
  console.log("E-mail enviado com sucesso.");
}

main()
  .catch((erro) => {
    console.error("Falha no teste de e-mail:", erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
