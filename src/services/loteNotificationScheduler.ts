import { verificarLotesEncerradosENotificar } from "./pdfService.js";

const intervaloMs = Number(process.env.RELATORIO_LOTES_INTERVAL_MS ?? 5 * 60 * 1000);

let verificadorEmExecucao = false;

export function iniciarVerificadorRelatoriosDeLote() {
  if (intervaloMs <= 0) {
    console.log("Verificador de relatórios de lote desativado.");
    return;
  }

  const executarVerificacao = async () => {
    if (verificadorEmExecucao) return;

    verificadorEmExecucao = true;
    try {
      await verificarLotesEncerradosENotificar();
    } catch (err) {
      console.error("Erro ao verificar lotes encerrados para envio de relatório:", err);
    } finally {
      verificadorEmExecucao = false;
    }
  };

  void executarVerificacao();

  const timer = setInterval(() => {
    void executarVerificacao();
  }, intervaloMs);

  timer.unref();
}
