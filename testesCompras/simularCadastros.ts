/**
 * Script para simular cadastros diretos no banco de dados
 * Execute: npx tsx testesCompras/simularCadastros.ts
 * 
 * Este script cria pedidos diretamente no banco (sem chamar Mercado Pago)
 * Útil para testar relatórios e webhooks
 */

import { PrismaClient } from "@prisma/client";
import { gerarCodigoPedido } from "../src/services/codigoPedidoService.js";

const prisma = new PrismaClient();

interface ItemData {
  titulo: string;
  quantidade: number;
  valorUnit: number;
}

interface CadastroInput {
  cpf: string;
  nomeEvento: string;
  contato: string;
  lote: string;
  valorIngresso: number;
  nomeNaCamisa: string;
  dataNascimento: string;
  nomePessoa: string;
  corCamisa: string;
  equipe?: string;
  categoria: "MASCULINO" | "FEMININO" | "MAIOR_60" | "LGBTQIA" | "PCD";
  numeroCamisa?: string;
  itens: ItemData[];
  status: "PENDENTE" | "APROVADO" | "REJEITADO" | "CANCELADO";
  idPagamento?: string;
  idPreferencia?: string;
}

// Lista de cadastros para testar
const cadastrosTeste: CadastroInput[] = [
  {
    cpf: "123.456.789-00",
    nomeEvento: "Corrida da Família 2026",
    contato: "(11) 99999-0001",
    lote: "Lote 1",
    valorIngresso: 80.0,
    nomeNaCamisa: "JOÃO SILVA",
    dataNascimento: "1985-03-15",
    nomePessoa: "João Silva",
    corCamisa: "Branca",
    equipe: "Corredores SP",
    categoria: "MASCULINO",
    numeroCamisa: "10",
    itens: [{ titulo: "Camiseta Adulto", quantidade: 1, valorUnit: 80.0 }],
    status: "PENDENTE",
  },
  {
    cpf: "987.654.321-00",
    nomeEvento: "Corrida da Família 2026",
    contato: "(11) 99999-0002",
    lote: "Lote 1",
    valorIngresso: 80.0,
    nomeNaCamisa: "MARIA SANTOS",
    dataNascimento: "1990-07-22",
    nomePessoa: "Maria Santos",
    corCamisa: "Rosa",
    equipe: "",
    categoria: "FEMININO",
    itens: [{ titulo: "Camiseta Adulto", quantidade: 1, valorUnit: 80.0 }],
    status: "APROVADO",
    idPagamento: "MP-TEST-001",
    idPreferencia: "PREF-TEST-001",
  },
  {
    cpf: "456.789.123-00",
    nomeEvento: "Corrida da Família 2026",
    contato: "(11) 99999-0003",
    lote: "Lote 2",
    valorIngresso: 100.0,
    nomeNaCamisa: "PEDRO OLIVEIRA",
    dataNascimento: "1960-01-10",
    nomePessoa: "Pedro Oliveira",
    corCamisa: "Azul",
    equipe: "Veteranos Run",
    categoria: "MAIOR_60",
    numeroCamisa: "42",
    itens: [{ titulo: "Camiseta Adulto", quantidade: 1, valorUnit: 100.0 }],
    status: "APROVADO",
    idPagamento: "MP-TEST-002",
    idPreferencia: "PREF-TEST-002",
  },
  {
    cpf: "321.654.987-00",
    nomeEvento: "Corrida da Família 2026",
    contato: "(11) 99999-0004",
    lote: "Lote 1",
    valorIngresso: 80.0,
    nomeNaCamisa: "CARLOS SOUZA",
    dataNascimento: "1988-12-05",
    nomePessoa: "Carlos Souza",
    corCamisa: "Preta",
    equipe: "Pride Run",
    categoria: "LGBTQIA",
    numeroCamisa: "23",
    itens: [{ titulo: "Camiseta Adulto", quantidade: 1, valorUnit: 80.0 }],
    status: "PENDENTE",
  },
  {
    cpf: "111.222.333-44",
    nomeEvento: "Maratona São Paulo 2026",
    contato: "(11) 99999-0005",
    lote: "Lote 1",
    valorIngresso: 150.0,
    nomeNaCamisa: "ANA PEREIRA",
    dataNascimento: "1995-05-18",
    nomePessoa: "Ana Pereira",
    corCamisa: "Verde",
    equipe: "Runners Club",
    categoria: "FEMININO",
    numeroCamisa: "7",
    itens: [
      { titulo: "Camiseta Adulto", quantidade: 1, valorUnit: 150.0 },
      { titulo: "Medalha Finisher", quantidade: 1, valorUnit: 50.0 },
    ],
    status: "APROVADO",
    idPagamento: "MP-TEST-003",
    idPreferencia: "PREF-TEST-003",
  },
  {
    cpf: "555.666.777-88",
    nomeEvento: "Corrida da Família 2026",
    contato: "(11) 99999-0006",
    lote: "Lote 2",
    valorIngresso: 100.0,
    nomeNaCamisa: "JOSÉ FERREIRA",
    dataNascimento: "1975-09-30",
    nomePessoa: "José Ferreira",
    corCamisa: "Amarela",
    equipe: "",
    categoria: "MASCULINO",
    itens: [{ titulo: "Camiseta Adulto", quantidade: 1, valorUnit: 100.0 }],
    status: "CANCELADO",
    idPagamento: "MP-TEST-004",
    idPreferencia: "PREF-TEST-004",
  },
  {
    cpf: "777.888.999-00",
    nomeEvento: "Meia Maratona Rio 2026",
    contato: "(21) 99999-0007",
    lote: "Lote 1",
    valorIngresso: 120.0,
    nomeNaCamisa: "LUCAS RODRIGUES",
    dataNascimento: "1992-11-25",
    nomePessoa: "Lucas Rodrigues",
    corCamisa: "Vermelha",
    equipe: "Rio Runners",
    categoria: "MASCULINO",
    numeroCamisa: "99",
    itens: [{ titulo: "Camiseta Adulto", quantidade: 1, valorUnit: 120.0 }],
    status: "APROVADO",
    idPagamento: "MP-TEST-005",
    idPreferencia: "PREF-TEST-005",
  },
];

async function criarCadastro(cadastro: CadastroInput) {
  console.log(`\n📝 Criando cadastro: ${cadastro.nomePessoa} (CPF: ${cadastro.cpf})`);
  
  try {
    // Verificar se já existe
    const existente = await prisma.pedido.findFirst({
      where: {
        cpf: cadastro.cpf,
        nomeEvento: cadastro.nomeEvento,
      },
    });

    if (existente) {
      console.log(`   ⚠️  Já existe um pedido para este CPF neste evento`);
      return null;
    }

    const total = cadastro.itens.reduce(
      (soma, item) => soma + item.valorUnit * item.quantidade,
      0
    );

    const pedido = await prisma.$transaction(async (tx) => {
      const codigoPedido = await gerarCodigoPedido(tx, cadastro.nomeEvento, cadastro.lote);

      return tx.pedido.create({
      data: {
        codigoPedido,
        referenciaExterna: `REF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        status: cadastro.status,
        idPagamento: cadastro.idPagamento,
        idPreferencia: cadastro.idPreferencia,
        total,
        cpf: cadastro.cpf,
        contato: cadastro.contato,
        nomeEvento: cadastro.nomeEvento,
        lote: cadastro.lote,
        valorIngresso: cadastro.valorIngresso,
        nomeNaCamisa: cadastro.nomeNaCamisa,
        dataNascimento: cadastro.dataNascimento,
        nomePessoa: cadastro.nomePessoa,
        corCamisa: cadastro.corCamisa,
        equipe: cadastro.equipe ?? "",
        categoria: cadastro.categoria,
        numeroCamisa: cadastro.numeroCamisa,
        itens: {
          create: cadastro.itens,
        },
      },
      include: { itens: true },
    });
    });

    console.log(`   ✅ Pedido criado com sucesso!`);
    console.log(`   ID: ${pedido.id}`);
    console.log(`   Código: ${pedido.codigoPedido}`);
    console.log(`   Status: ${pedido.status}`);
    console.log(`   Total: R$ ${pedido.total.toFixed(2)}`);
    
    return pedido;
  } catch (erro: unknown) {
    if (erro instanceof Error && erro.message.includes("Já existe")) {
      console.log(`   ❌ Erro: ${erro.message}`);
    } else {
      console.log(`   ❌ Erro ao criar cadastro: ${erro}`);
    }
    return null;
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("🧪 SIMULAÇÃO DE CADASTROS - API 1KM");
  console.log("=".repeat(60));
  console.log(`\nTotal de cadastros a criar: ${cadastrosTeste.length}\n`);

  const resultados = [];

  for (let i = 0; i < cadastrosTeste.length; i++) {
    console.log(`\n[${i + 1}/${cadastrosTeste.length}]`);
    const resultado = await criarCadastro(cadastrosTeste[i]);
    resultados.push({ cadastro: cadastrosTeste[i], resultado });
    
    // Pequeno delay entre operações
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 RESUMO DOS TESTES");
  console.log("=".repeat(60));
  
  const sucessos = resultados.filter(r => r.resultado !== null).length;
  const falhas = resultados.filter(r => r.resultado === null).length;
  
  console.log(`\n✅ Cadastros criados: ${sucessos}`);
  console.log(`❌ Falhas/Existentes: ${falhas}`);
  
  // Mostrar estatísticas por status
  console.log("\n📈 Por Status:");
  const stats: Record<string, number> = {};
  for (const r of resultados) {
    if (r.resultado) {
      const status = r.resultado.status;
      stats[status] = (stats[status] || 0) + 1;
    }
  }
  Object.entries(stats).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });

  // Listar pedidos do banco
  console.log("\n📋 Pedidos no banco:");
  const pedidos = await prisma.pedido.findMany({
    orderBy: { criadoEm: "desc" },
    take: 10,
  });
  
  for (const p of pedidos) {
    console.log(
      `   - ${p.codigoPedido ?? "-"} | ${p.nomePessoa} | ${p.nomeEvento} | ${p.status} | R$ ${p.total.toFixed(2)}`
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
