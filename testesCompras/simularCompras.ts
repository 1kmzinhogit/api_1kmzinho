/**
 * Script para simular compras (checkout) na API
 * Execute: npx tsx testesCompras/simularCompras.ts
 */

const API_URL = process.env.API_URL || "http://localhost:3000";
const GERAR_CPFS_UNICOS = process.env.UNIQUE_CPFS !== "false";
const KIT_ID = process.env.KIT_ID || "informe-o-id-do-config-lote";

interface PayloadCheckout {
  kitId: string;
  cpf: string;
  contato: string;
  nomeNaCamisa: string;
  dataNascimento: string;
  nomePessoa: string;
  corCamisa: string;
  equipe?: string;
  categoria: "MASCULINO" | "FEMININO" | "MAIOR_60" | "LGBTQIA" | "PCD";
  numeroCamisa?: string;
}

// Lista de compras para testar
const comprasTeste: PayloadCheckout[] = [
  {
    kitId: KIT_ID,
    cpf: "123.456.789-00",
    contato: "(11) 99999-0001",
    nomeNaCamisa: "JOÃO SILVA",
    dataNascimento: "1985-03-15",
    nomePessoa: "João Silva",
    corCamisa: "Branca",
    equipe: "Corredores SP",
    categoria: "MASCULINO",
    numeroCamisa: "10",
  },
  {
    kitId: KIT_ID,
    cpf: "987.654.321-00",
    contato: "(11) 99999-0002",
    nomeNaCamisa: "MARIA SANTOS",
    dataNascimento: "1990-07-22",
    nomePessoa: "Maria Santos",
    corCamisa: "Rosa",
    equipe: "",
    categoria: "FEMININO",
  },
  {
    kitId: KIT_ID,
    cpf: "456.789.123-00",
    contato: "(11) 99999-0003",
    nomeNaCamisa: "PEDRO OLIVEIRA",
    dataNascimento: "1960-01-10",
    nomePessoa: "Pedro Oliveira",
    corCamisa: "Azul",
    equipe: "Veteranos Run",
    categoria: "MAIOR_60",
    numeroCamisa: "42",
  },
  {
    kitId: KIT_ID,
    cpf: "321.654.987-00",
    contato: "(11) 99999-0004",
    nomeNaCamisa: "CARLOS SOUZA",
    dataNascimento: "1988-12-05",
    nomePessoa: "Carlos Souza",
    corCamisa: "Preta",
    equipe: "Pride Run",
    categoria: "LGBTQIA",
    numeroCamisa: "23",
  },
  {
    kitId: KIT_ID,
    cpf: "111.222.333-44",
    contato: "(11) 99999-0005",
    nomeNaCamisa: "ANA PEREIRA",
    dataNascimento: "1995-05-18",
    nomePessoa: "Ana Pereira",
    corCamisa: "Verde",
    equipe: "Runners Club",
    categoria: "FEMININO",
    numeroCamisa: "7",
  },
];

function cpfUnico(cpf: string, indice: number) {
  if (!GERAR_CPFS_UNICOS) {
    return cpf;
  }

  const digitos = cpf.replace(/\D/g, "");
  const base = Number.parseInt(digitos.slice(0, 9), 10) || 100000000;
  const timestamp = Date.now() % 1000000;
  const corpo = String((base + timestamp + indice) % 1000000000).padStart(9, "0");
  const final = digitos.slice(9).padEnd(2, "0");

  return `${corpo.slice(0, 3)}.${corpo.slice(3, 6)}.${corpo.slice(6, 9)}-${final}`;
}

async function lerResposta(resposta: Response) {
  const texto = await resposta.text();

  if (!texto) {
    return {};
  }

  try {
    return JSON.parse(texto);
  } catch {
    return { mensagem: texto };
  }
}

async function executarCheckout(compra: PayloadCheckout) {
  console.log(`\n📝 Enviando checkout para: ${compra.nomePessoa} (CPF: ${compra.cpf})`);
  
  try {
    const resposta = await fetch(`${API_URL}/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(compra),
    });

    const dados = await lerResposta(resposta);

    if (resposta.ok) {
      console.log(`✅ Sucesso!`);
      console.log(`   ID Pedido: ${dados.idPedido}`);
      console.log(`   Código Pedido: ${dados.codigoPedido}`);
      console.log(`   ID Preferência: ${dados.idPreferencia}`);
      console.log(`   Link Pagamento: ${dados.linkPagamento}`);
      if (dados.linkSandbox) {
        console.log(`   Link Sandbox: ${dados.linkSandbox}`);
      }
      return dados;
    } else {
      console.log(`❌ Erro: ${dados.erro || dados.mensagem || resposta.statusText}`);
      return null;
    }
  } catch (erro) {
    console.log(`❌ Erro de conexão: ${erro}`);
    return null;
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("🧪 SIMULAÇÃO DE COMPRAS - API 1KM");
  console.log("=".repeat(60));
  console.log(`\nAPI URL: ${API_URL}`);
  console.log(`KIT_ID: ${KIT_ID}`);
  console.log(`Total de compras a testar: ${comprasTeste.length}\n`);

  if (KIT_ID === "informe-o-id-do-config-lote") {
    console.log("❌ Informe KIT_ID com o id de config_lotes antes de rodar.");
    console.log("   Exemplo PowerShell: $env:KIT_ID='uuid-do-lote'; npx tsx testesCompras/simularCompras.ts");
    return;
  }

  const resultados = [];

  for (let i = 0; i < comprasTeste.length; i++) {
    console.log(`\n[${i + 1}/${comprasTeste.length}]`);
    const compra = { ...comprasTeste[i], cpf: cpfUnico(comprasTeste[i].cpf, i) };
    const resultado = await executarCheckout(compra);
    resultados.push({ compra, resultado });
    
    // Pequeno delay entre requisições
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 RESUMO DOS TESTES");
  console.log("=".repeat(60));
  
  const sucessos = resultados.filter(r => r.resultado !== null).length;
  const falhas = resultados.filter(r => r.resultado === null).length;
  
  console.log(`\n✅ Sucessos: ${sucessos}`);
  console.log(`❌ Falhas: ${falhas}`);
  
  if (sucessos > 0) {
    console.log("\n📋 Links de pagamento gerados:");
    resultados
      .filter(r => r.resultado)
      .forEach(r => {
        console.log(`   - ${r.resultado.linkPagamento}`);
      });
  }
}

main().catch(console.error);
