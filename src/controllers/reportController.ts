import { type Request, type Response } from "express";
import {
  buscarParticipantesRelatorio,
  gerarPDFKitIndividual,
  gerarPDFKits,
  gerarPDFKitsPorLote,
} from "../services/pdfService.js";
import { gerarExcelKits } from "../services/excelService.js";

export async function relatorioPorEvento(req: Request, res: Response) {
  try {
    const { nomeEvento } = req.params;

    if (!nomeEvento) {
      return res.status(400).json({ erro: "Nome do evento é obrigatório." });
    }

    const nomeDecodificado = decodeURIComponent(String(nomeEvento));
    const pdfBuffer = await gerarPDFKits(nomeDecodificado);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="kits-${nomeEvento}.pdf"`
    );

    return res.send(pdfBuffer);
  } catch (error: unknown) {
    console.error("Erro ao gerar PDF:", error);

    if (error instanceof Error && error.message.includes("Nenhum pedido aprovado")) {
      return res.status(404).json({ erro: error.message });
    }

    return res.status(500).json({ erro: "Erro ao gerar relatório." });
  }
}

export async function relatorioPorLote(req: Request, res: Response) {
  try {
    const { nomeEvento, lote } = req.params;

    if (!nomeEvento || !lote) {
      return res.status(400).json({ erro: "Nome do evento e lote são obrigatórios." });
    }

    const pdfBuffer = await gerarPDFKitsPorLote(
      decodeURIComponent(String(nomeEvento)),
      decodeURIComponent(String(lote))
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="kits-${nomeEvento}-${lote}.pdf"`
    );

    return res.send(pdfBuffer);
  } catch (error: unknown) {
    console.error("Erro ao gerar PDF por lote:", error);

    if (error instanceof Error && error.message.includes("Nenhum pedido aprovado")) {
      return res.status(404).json({ erro: error.message });
    }

    return res.status(500).json({ erro: "Erro ao gerar relatório." });
  }
}

export async function relatorioExcelPorEvento(req: Request, res: Response) {
  try {
    const nomeEvento = decodeURIComponent(String(req.params.nomeEvento ?? ""));
    if (!nomeEvento) return res.status(400).json({ erro: "Nome do evento é obrigatório." });

    const buffer = await gerarExcelKits(nomeEvento);
    res.setHeader(
      "Content-Type",
      "application/vnd.ms-excel; charset=utf-8"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="participantes-${nomeArquivo(nomeEvento)}.xls"`
    );
    return res.send(buffer);
  } catch (error: unknown) {
    console.error("Erro ao gerar Excel:", error);
    if (error instanceof Error && error.message.includes("Nenhum pedido aprovado")) {
      return res.status(404).json({ erro: error.message });
    }
    return res.status(500).json({ erro: "Erro ao gerar relatório Excel." });
  }
}

export async function pesquisarParticipantesRelatorio(req: Request, res: Response) {
  try {
    const nomeEvento = decodeURIComponent(String(req.params.nomeEvento ?? ""));
    const busca = typeof req.query.busca === "string" ? req.query.busca : "";
    if (!nomeEvento || busca.trim().length < 2) {
      return res.status(400).json({ erro: "Informe ao menos 2 caracteres do nome ou CPF." });
    }
    const participantes = await buscarParticipantesRelatorio(nomeEvento, busca);
    return res.json({ participantes });
  } catch (error) {
    console.error("Erro ao pesquisar participante do relatório:", error);
    return res.status(500).json({ erro: "Erro ao pesquisar participante." });
  }
}

export async function relatorioPDFIndividual(req: Request, res: Response) {
  try {
    const nomeEvento = decodeURIComponent(String(req.params.nomeEvento ?? ""));
    const idPedido = String(req.params.idPedido ?? "");
    if (!nomeEvento || !idPedido) {
      return res.status(400).json({ erro: "Evento e participante são obrigatórios." });
    }
    const buffer = await gerarPDFKitIndividual(nomeEvento, idPedido);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="kit-individual-${nomeArquivo(nomeEvento)}.pdf"`
    );
    return res.send(buffer);
  } catch (error: unknown) {
    console.error("Erro ao gerar PDF individual:", error);
    if (error instanceof Error && error.message.includes("não encontrado")) {
      return res.status(404).json({ erro: error.message });
    }
    return res.status(500).json({ erro: "Erro ao gerar relatório individual." });
  }
}

function nomeArquivo(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}
