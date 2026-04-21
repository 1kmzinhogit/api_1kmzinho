import { type Request, type Response } from "express";
import { gerarPDFKits, gerarPDFKitsPorLote } from "../services/pdfService.js";

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