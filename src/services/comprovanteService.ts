import { Buffer } from "buffer";
import PDFDocument from "pdfkit";

export type DadosComprovante = {
  numeroInscricao: number;
  codigoPedido: string | null;
  nomePessoa: string;
  nomeEvento: string;
  distancia: string;
  lote: string;
  categoria: string;
  valorIngresso: number;
  taxaServico: number;
  total: number;
  confirmadoEm: Date;
};

export function gerarPDFComprovante(dados: DadosComprovante): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.rect(0, 0, 595, 118).fill("#123e63");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(24).text("1KMzinho", 48, 38);
    doc.font("Helvetica").fontSize(11).text("Comprovante eletrônico de inscrição", 48, 70);

    doc.fillColor("#123e63").font("Helvetica-Bold").fontSize(14)
      .text("PAGAMENTO CONFIRMADO", 48, 150);
    doc.fillColor("#111111").fontSize(22)
      .text(`Nº da sua inscrição: ${formatarNumeroInscricao(dados.numeroInscricao)}`, 48, 180);
    doc.font("Helvetica").fontSize(11).fillColor("#555555")
      .text("Guarde este comprovante para retirada do kit e atendimento.", 48, 214);

    doc.moveTo(48, 245).lineTo(547, 245).stroke("#d6dce1");
    escreverLinha(doc, "Participante", dados.nomePessoa);
    escreverLinha(doc, "Evento", dados.nomeEvento);
    escreverLinha(doc, "Distância", dados.distancia);
    escreverLinha(doc, "Kit / lote", dados.lote);
    escreverLinha(doc, "Categoria", dados.categoria);
    escreverLinha(doc, "Código do pedido", dados.codigoPedido ?? "-");
    escreverLinha(doc, "Confirmado em", formatarData(dados.confirmadoEm));

    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#123e63").text("Resumo do pagamento");
    doc.moveDown(0.45);
    escreverLinha(doc, "Inscrição", formatarMoeda(dados.valorIngresso));
    if (dados.taxaServico > 0) {
      escreverLinha(doc, "Taxa de serviço", formatarMoeda(dados.taxaServico));
    }
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#111111")
      .text(`Total pago: ${formatarMoeda(dados.total)}`, 48);

    doc.moveDown(2);
    doc.font("Helvetica").fontSize(9).fillColor("#666666")
      .text("Inscrição realizada pela plataforma 1KMzinho.", { align: "center" })
      .text("Este documento é um comprovante de inscrição e não substitui nota fiscal.", {
        align: "center",
      });
    doc.end();
  });
}

export function formatarNumeroInscricao(numero: number) {
  return String(numero).padStart(4, "0");
}

function escreverLinha(doc: PDFKit.PDFDocument, rotulo: string, valor: string) {
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#333333").text(`${rotulo}: `, 48, doc.y, {
    continued: true,
  });
  doc.font("Helvetica").fillColor("#111111").text(valor);
  doc.moveDown(0.35);
}

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

function formatarData(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(data);
}
