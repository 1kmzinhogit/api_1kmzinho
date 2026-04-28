/**
 * Script para simular webhooks do Mercado Pago
 * Execute: npx tsx testesCompras/simularWebhooks.ts
 * 
 * Este script simula notificações de pagamento do Mercado Pago
 * para testar a aprovação automática de pedidos
 */

import { PrismaClient } from "@prisma/client";

const API_URL = process.env.API_URL || "http://localhost:3000";
const prisma = new PrismaClient();

interface WebhookPayload {
  action: string;
  api_version: string;
  data: {
    id: string;
  };
  date_created: string;
  id: number;
  live_mode: boolean;
  type: string;
  user_id: string;
}

// Simula diferentes cenários de webhook
const webhooksTeste: { descricao: string; idPagamento: string; statusPagamento: string }[] = [
  {
    descricao: "Pagamento aprovado",
    idPagamento: "1234567890",
    statusPagamento: "approved",
  },
  {
    descricao: "Pagamento pendente",
    idPagamento: "1234567891",
    statusPagamento: "pending",
  },
  {
    descricao: "Pagamento rejeitado",
    idPagamento: "1234567892",
    statusPagamento: "rejected",
  },
];

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

async function simularWebhook(idPedido: string, idPagamento: string, status: string) {
  console.log(`\n📝 Enviando webhook: ${status} (Pedido: ${idPedido})`);
  
  // Cria o payload do webhook como o Mercado Pago enviaria
  const payload: WebhookPayload = {
    action: "payment.updated",
    api_version: "v1",
    data: {
      id: idPagamento,
    },
    date_created: new Date().toISOString(),
    id: Math.floor(Math.random() * 1000000),
    live_mode: false,
    type: "payment",
    user_id: "123456789",
  };

  try {
    // Primeiro, busca os detalhes do pagamento no Mercado Pago (simulado)
    // Na verdade, o webhook vai direto para o endpoint
    
    const resposta = await fetch(`${API_URL}/webhooks/mercadopago`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Em produção, o Mercado Pago envia um header de autenticação
        "x-signature": "fake-signature-for-test",
      },
      body: JSON.stringify({
        ...payload,
        modoTeste: true,
        idPedido,
        status: status,
      }),
    });

    const dados = await lerResposta(resposta);

    if (resposta.ok) {
      console.log(`✅ Sucesso!`);
      console.log(`   Mensagem: ${dados.mensagem || "Webhook recebido pela API"}`);
      return dados;
    } else {
      console.log(`❌ Erro HTTP ${resposta.status}: ${dados.erro || dados.mensagem || resposta.statusText}`);
      console.log("   Observação: confirme que a API está rodando em ambiente não-produção.");
      return null;
    }
  } catch (erro) {
    console.log(`❌ Erro de conexão: ${erro}`);
    return null;
  }
}

async function listarPedidos() {
  console.log("\n📋 Pedidos atuais no banco:");
  try {
    const pedidos = await prisma.pedido.findMany({
      orderBy: { atualizadoEm: "desc" },
      take: 10,
    });

    for (const pedido of pedidos) {
      console.log(`   - ${pedido.nomePessoa} | ${pedido.status} | pagamento: ${pedido.idPagamento ?? "-"}`);
    }
  } catch (erro) {
    console.log(`   Erro ao consultar banco: ${erro}`);
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("🧪 SIMULAÇÃO DE WEBHOOKS - API 1KM");
  console.log("=".repeat(60));
  console.log(`\nAPI URL: ${API_URL}`);
  console.log(`Total de webhooks a testar: ${webhooksTeste.length}\n`);

  console.log("\n⚠️  NOTA: Para testar webhooks corretamente:");
  console.log("   1. Primeiro crie pedidos usando simularCompras.ts ou simularCadastros.ts");
  console.log("   2. Os pedidos devem ter status PENDENTE");
  console.log("   3. Este script usa modoTeste, disponível apenas fora de produção\n");

  const resultados = [];
  const pedidosPendentes = await prisma.pedido.findMany({
    where: { status: "PENDENTE" },
    orderBy: { criadoEm: "desc" },
    take: webhooksTeste.length,
  });

  if (pedidosPendentes.length === 0) {
    console.log("❌ Nenhum pedido PENDENTE encontrado. Rode primeiro: npx tsx testesCompras/simularCompras.ts");
    return;
  }

  const total = Math.min(webhooksTeste.length, pedidosPendentes.length);

  for (let i = 0; i < total; i++) {
    const webhook = webhooksTeste[i];
    const pedido = pedidosPendentes[i];
    console.log(`\n[${i + 1}/${webhooksTeste.length}] ${webhook.descricao}`);
    const idPagamento = `MP-SIM-${Date.now()}-${i}`;
    const resultado = await simularWebhook(pedido.id, idPagamento, webhook.statusPagamento);
    resultados.push({ webhook, pedido, resultado });
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 RESUMO DOS TESTES");
  console.log("=".repeat(60));
  
  const sucessos = resultados.filter(r => r.resultado !== null).length;
  const falhas = resultados.filter(r => r.resultado === null).length;
  
  console.log(`\n✅ Webhooks processados: ${sucessos}`);
  console.log(`❌ Falhas: ${falhas}`);

  await listarPedidos();
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
