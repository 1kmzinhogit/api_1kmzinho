import PDFDocument from "pdfkit";
import { prisma } from "../config/db.js";

export async function generateKitsPDF(
  raceName: string
): Promise<Buffer> {
  const orders = await prisma.order.findMany({
    where: {
      raceName,
      status: "APPROVED",
    },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  if (orders.length === 0) {
    throw new Error("Nenhum pedido aprovado encontrado para este evento.");
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Cabeçalho ──────────────────────────────────────────────
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text(`Relatório de Kits`, { align: "center" });

    doc
      .fontSize(14)
      .font("Helvetica")
      .text(raceName, { align: "center" });

    doc
      .fontSize(10)
      .fillColor("#666666")
      .text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, {
        align: "center",
      });

    doc.moveDown(0.5);

    doc
      .fontSize(10)
      .fillColor("#333333")
      .text(`Total de kits aprovados: ${orders.length}`, { align: "center" });

    doc.moveDown(1);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke("#cccccc");
    doc.moveDown(1);

    // ── Kits ───────────────────────────────────────────────────
    orders.forEach((order, index) => {
      // Verifica se precisa de nova página
      if (doc.y > 700) {
        doc.addPage();
      }

      const startY = doc.y;

      // Número do kit
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#000000")
        .text(`Kit #${index + 1}`, 40, startY);

      doc.moveDown(0.3);

      // Dados pessoais
      doc.fontSize(10).font("Helvetica-Bold").text("Dados do Participante:", 40);
      doc.moveDown(0.2);

      doc
        .fontSize(10)
        .font("Helvetica")
        .text(`CPF: ${formatCPF(order.cpf)}`, 50)
        .text(`Contato: ${order.contactNumber}`, 50)
        .text(`Lote: ${order.lot}`, 50)
        .text(`Valor do Ingresso: R$ ${order.ticketValue.toFixed(2)}`, 50);

      doc.moveDown(0.4);

      // Dados da camiseta
      doc.fontSize(10).font("Helvetica-Bold").text("Camiseta:", 40);
      doc.moveDown(0.2);

      doc
        .fontSize(10)
        .font("Helvetica")
        .text(`Nome: ${order.shirtName}`, 50)
        .text(`Número: ${order.shirtNumber}`, 50)
        .text(`Cor: ${order.shirtColor}`, 50);

      doc.moveDown(0.4);

      // Itens do pedido
      doc.fontSize(10).font("Helvetica-Bold").text("Itens:", 40);
      doc.moveDown(0.2);

      order.items.forEach((item) => {
        doc
          .fontSize(10)
          .font("Helvetica")
          .text(
            `• ${item.title} — Qtd: ${item.quantity} — R$ ${item.unitPrice.toFixed(2)}`,
            50
          );
      });

      doc.moveDown(0.4);

      // Total
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(`Total: R$ ${order.totalAmount.toFixed(2)}`, 40);

      doc.moveDown(0.5);

      // Linha separadora
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke("#eeeeee");
      doc.moveDown(0.8);
    });

    doc.end();
  });
}

function formatCPF(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}