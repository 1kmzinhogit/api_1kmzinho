import { type Request, type Response } from "express";
import { generateKitsPDF } from "../services/pdfService.js";

export async function kitsReport(req: Request, res: Response) {
  try {
    const { raceName } = req.params;

    if (!raceName) {
      return res.status(400).json({ error: "Nome do evento é obrigatório." });
    }

    const pdfBuffer = await generateKitsPDF(decodeURIComponent(String(raceName)));

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="kits-${raceName}.pdf"`
    );

    return res.send(pdfBuffer);
  } catch (error: unknown) {
    console.error("Erro ao gerar PDF:", error);

    if (
      error instanceof Error &&
      error.message.includes("Nenhum pedido aprovado")
    ) {
      return res.status(404).json({ error: error.message });
    }

    return res.status(500).json({ error: "Erro ao gerar relatório." });
  }
}