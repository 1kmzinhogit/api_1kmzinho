import PDFDocument from "pdfkit";
import { prisma } from "../config/db.js";
import { enviarRelatorioKits, type ResumoCamisasRelatorio } from "./emailService.js";
import { Buffer } from "buffer";

const ORDEM_TAMANHOS = ["PP", "P", "M", "G", "GG"];

export async function gerarPDFKits(nomeEvento: string): Promise<Buffer> {
  const pedidos = await prisma.pedido.findMany({
    where: { nomeEvento, status: "APROVADO" },
    include: { itens: true },
    orderBy: [{ equipe: "asc" }, { criadoEm: "asc" }],
  });

  if (pedidos.length === 0) {
    throw new Error("Nenhum pedido aprovado encontrado para este evento.");
  }

  return construirPDF(pedidos, nomeEvento);
}

export async function gerarPDFKitsPorLote(
  nomeEvento: string,
  lote: string
): Promise<Buffer> {
  const pedidos = await prisma.pedido.findMany({
    where: { nomeEvento, lote, status: "APROVADO" },
    include: { itens: true },
    orderBy: [{ equipe: "asc" }, { criadoEm: "asc" }],
  });

  if (pedidos.length === 0) {
    throw new Error(`Nenhum pedido aprovado encontrado para o ${lote}.`);
  }

  return construirPDF(pedidos, nomeEvento, lote);
}

export async function verificarLoteENotificar(
  nomeEvento: string,
  lote: string
): Promise<void> {
  const configLote = await prisma.configLote.findUnique({
    where: { nomeEvento_lote: { nomeEvento, lote } },
  });

  if (!configLote || configLote.notificado) return;

  const totalAprovados = await prisma.pedido.count({
    where: { nomeEvento, lote, status: "APROVADO" },
  });

  if (totalAprovados >= configLote.capacidade) {
    const pedidos = await buscarPedidosAprovadosPorLote(nomeEvento, lote);
    const pdfBuffer = await construirPDF(pedidos, nomeEvento, lote);
    const resumo = montarResumoCamisas(pedidos);
    await enviarRelatorioKits(pdfBuffer, nomeEvento, lote, totalAprovados, resumo);

    await prisma.configLote.update({
      where: { nomeEvento_lote: { nomeEvento, lote } },
      data: { notificado: true },
    });

    console.log(`✅ Lote encerrado — e-mail enviado: ${nomeEvento} | ${lote}`);
  }
}

async function buscarPedidosAprovadosPorLote(nomeEvento: string, lote: string) {
  const pedidos = await prisma.pedido.findMany({
    where: { nomeEvento, lote, status: "APROVADO" },
    include: { itens: true },
    orderBy: [{ equipe: "asc" }, { criadoEm: "asc" }],
  });

  if (pedidos.length === 0) {
    throw new Error(`Nenhum pedido aprovado encontrado para o ${lote}.`);
  }

  return pedidos;
}

export function montarResumoCamisas(pedidos: any[]): ResumoCamisasRelatorio {
  const mapaCamisas = new Map<string, { tamanho: string; cor: string; quantidade: number }>();

  for (const pedido of pedidos) {
    const tamanho = normalizarTamanhoCamisa(pedido.numeroCamisa);
    const cor = normalizarTexto(pedido.corCamisa, "Sem cor");
    const chave = `${tamanho}__${cor}`;
    const item = mapaCamisas.get(chave);

    if (item) {
      item.quantidade += 1;
    } else {
      mapaCamisas.set(chave, { tamanho, cor, quantidade: 1 });
    }
  }

  const camisas = Array.from(mapaCamisas.values()).sort((a, b) => {
    const diferencaTamanho = ordemTamanho(a.tamanho) - ordemTamanho(b.tamanho);
    return diferencaTamanho !== 0 ? diferencaTamanho : a.cor.localeCompare(b.cor, "pt-BR");
  });

  const atletas = pedidos.map((pedido) => ({
    nome: normalizarTexto(pedido.nomePessoa, "Sem nome"),
    tamanho: normalizarTamanhoCamisa(pedido.numeroCamisa),
    cor: normalizarTexto(pedido.corCamisa, "Sem cor"),
  }));

  return {
    totalCamisas: pedidos.length,
    camisas,
    atletas,
  };
}

function construirPDF(pedidos: any[], nomeEvento: string, lote?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).font("Helvetica-Bold").fillColor("#000000")
      .text("Relatório de Kits", { align: "center" });
    doc.fontSize(14).font("Helvetica").text(nomeEvento, { align: "center" });

    if (lote) {
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#1a73e8")
        .text(lote, { align: "center" });
    }

    doc.fontSize(10).fillColor("#666666")
      .text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#333333")
      .text(`Total de kits: ${pedidos.length}`, { align: "center" });
    doc.moveDown(1);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke("#cccccc");
    doc.moveDown(1);

    const grupos = agruparPorEquipe(pedidos);
    let kitNumero = 1;

    for (const [equipe, membros] of Object.entries(grupos)) {
      if (doc.y > 680) doc.addPage();

      doc.fontSize(13).font("Helvetica-Bold").fillColor("#1a73e8")
        .text(equipe === "" ? "Sem Equipe" : `Equipe: ${equipe}`, 40);
      doc.fontSize(10).font("Helvetica").fillColor("#666666")
        .text(`${membros.length} participante(s)`, 40);
      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke("#1a73e8");
      doc.moveDown(0.8);

      for (const pedido of membros) {
        if (doc.y > 680) doc.addPage();

        doc.fontSize(11).font("Helvetica-Bold").fillColor("#000000")
          .text(`Kit #${kitNumero}`, 40);
        doc.moveDown(0.3);

        doc.fontSize(10).font("Helvetica-Bold").text("Participante:", 40);
        doc.moveDown(0.2);
        doc.fontSize(10).font("Helvetica")
          .text(`CPF: ${formatarCPF(pedido.cpf)}`, 50)
          .text(`Contato: ${pedido.contato}`, 50)
          .text(`Lote: ${pedido.lote}`, 50)
          .text(`Valor do Ingresso: R$ ${pedido.valorIngresso.toFixed(2)}`, 50);

        doc.moveDown(0.4);
        doc.fontSize(10).font("Helvetica-Bold").text("Camiseta:", 40);
        doc.moveDown(0.2);
        doc.fontSize(10).font("Helvetica")
          .text(`Nome: ${pedido.nomeNaCamisa}`, 50)
          .text(`Cor: ${pedido.corCamisa}`, 50)
          .text(`Data de Nascimento: ${new Date(pedido.dataNascimento).toLocaleDateString("pt-BR")}`, 50)
          .text(`Nome Completo: ${pedido.nomePessoa}`, 50);

        doc.moveDown(0.4);
        doc.fontSize(10).font("Helvetica-Bold").text("Itens:", 40);
        doc.moveDown(0.2);
        pedido.itens.forEach((item: any) => {
          doc.fontSize(10).font("Helvetica")
            .text(`• ${item.titulo} — Qtd: ${item.quantidade} — R$ ${item.valorUnit.toFixed(2)}`, 50);
        });

        doc.moveDown(0.4);
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#000000")
          .text(`Total: R$ ${pedido.total.toFixed(2)}`, 40);
        doc.moveDown(0.5);
        doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke("#eeeeee");
        doc.moveDown(0.8);

        kitNumero++;
      }

      doc.moveDown(0.5);
    }

    doc.end();
  });
}

function normalizarTamanhoCamisa(tamanho: unknown): string {
  if (typeof tamanho !== "string" || !tamanho.trim()) {
    return "Sem tamanho";
  }

  const tamanhoNormalizado = tamanho.trim().toUpperCase();
  return ORDEM_TAMANHOS.includes(tamanhoNormalizado) ? tamanhoNormalizado : tamanho.trim();
}

function normalizarTexto(valor: unknown, fallback: string): string {
  return typeof valor === "string" && valor.trim() ? valor.trim() : fallback;
}

function ordemTamanho(tamanho: string): number {
  const indice = ORDEM_TAMANHOS.indexOf(tamanho);
  return indice >= 0 ? indice : ORDEM_TAMANHOS.length;
}

function agruparPorEquipe(pedidos: any[]): Record<string, any[]> {
  return pedidos.reduce((grupos, pedido) => {
    const equipe = pedido.equipe ?? "";
    if (!grupos[equipe]) grupos[equipe] = [];
    grupos[equipe].push(pedido);
    return grupos;
  }, {} as Record<string, any[]>);
}

function formatarCPF(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}
