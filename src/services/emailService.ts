import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USUARIO,
    pass: process.env.EMAIL_SENHA,
  },
});

export async function enviarRelatorioKits(
  pdfBuffer: Buffer,
  nomeEvento: string,
  lote: string,
  totalKits: number
) {
  await transporter.sendMail({
    from: `"API 1km" <${process.env.EMAIL_USUARIO}>`,
    to: process.env.EMAIL_ORGANIZADOR,
    subject: `📦 Kits prontos — ${nomeEvento} | ${lote}`,
    html: `
      <h2>Relatório de Kits — ${lote} encerrado!</h2>
      <p>O <strong>${lote}</strong> do evento <strong>${nomeEvento}</strong> foi encerrado.</p>
      <p>Total de kits aprovados neste lote: <strong>${totalKits}</strong></p>
      <p>O PDF com todos os kits está anexado a este e-mail.</p>
      <br/>
      <small>Enviado automaticamente pela API 1km</small>
    `,
    attachments: [
      {
        filename: `kits-${nomeEvento}-${lote}.pdf`.replace(/\s+/g, "_"),
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
}