import nodemailer from "nodemailer";

const emailUsuario = process.env.EMAIL_USUARIO ?? process.env.EMAIL_USER;
const emailSenha = process.env.EMAIL_SENHA ?? process.env.EMAIL_PASSWORD;
const emailOrganizador =
  process.env.EMAIL_ORGANIZADOR ?? process.env.EMAIL_DESTINO ?? emailUsuario;
const emailTimeoutMs = Number(process.env.EMAIL_TIMEOUT_MS ?? 15000);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: emailUsuario,
    pass: emailSenha,
  },
  connectionTimeout: emailTimeoutMs,
  greetingTimeout: emailTimeoutMs,
  socketTimeout: emailTimeoutMs,
});

export async function enviarRelatorioKits(
  pdfBuffer: Buffer,
  nomeEvento: string,
  lote: string,
  totalKits: number
) {
  validarConfiguracaoEmail();

  await transporter.sendMail({
    from: `"API 1km" <${emailUsuario}>`,
    to: emailOrganizador,
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

export async function enviarSolicitacaoReembolso(params: {
  idPedido: string;
  codigoPedido: string | null;
  nomeEvento: string;
  lote: string;
  distancia: string;
  nomePessoa: string;
  cpf: string;
  contato: string;
  emailContato: string;
  total: number;
  dataCompra: Date;
  dataLimiteReembolso: Date;
  prazoReembolsoDias: number;
  eventoComDataAlterada: boolean;
  observacao?: string;
}) {
  validarConfiguracaoEmail();

  await transporter.sendMail({
    from: `"API 1km" <${emailUsuario}>`,
    to: emailOrganizador,
    replyTo: params.emailContato,
    subject: `Solicitacao de reembolso - ${params.nomeEvento} - ${params.codigoPedido ?? params.idPedido}`,
    html: `
      <h2>Solicitacao de reembolso</h2>
      <p>Um participante solicitou reembolso pelo site.</p>

      <h3>Pedido</h3>
      <ul>
        <li><strong>ID:</strong> ${escaparHtml(params.idPedido)}</li>
        <li><strong>Codigo:</strong> ${escaparHtml(params.codigoPedido ?? "-")}</li>
        <li><strong>Evento:</strong> ${escaparHtml(params.nomeEvento)}</li>
        <li><strong>Lote:</strong> ${escaparHtml(params.lote)}</li>
        <li><strong>Distancia:</strong> ${escaparHtml(params.distancia)}</li>
        <li><strong>Total:</strong> R$ ${params.total.toFixed(2)}</li>
      </ul>

      <h3>Participante</h3>
      <ul>
        <li><strong>Nome:</strong> ${escaparHtml(params.nomePessoa)}</li>
        <li><strong>CPF:</strong> ${escaparHtml(params.cpf)}</li>
        <li><strong>Contato salvo:</strong> ${escaparHtml(params.contato)}</li>
        <li><strong>E-mail informado:</strong> ${escaparHtml(params.emailContato)}</li>
      </ul>

      <h3>Janela de reembolso</h3>
      <ul>
        <li><strong>Data da compra:</strong> ${formatarData(params.dataCompra)}</li>
        <li><strong>Data limite:</strong> ${formatarData(params.dataLimiteReembolso)}</li>
        <li><strong>Prazo:</strong> ${params.prazoReembolsoDias} dias</li>
        <li><strong>Evento com data alterada:</strong> ${params.eventoComDataAlterada ? "Sim" : "Nao"}</li>
      </ul>

      ${
        params.observacao
          ? `<h3>Observacao</h3><p>${escaparHtml(params.observacao)}</p>`
          : ""
      }

      <p>Processe o reembolso pelo Mercado Pago. Quando o Mercado Pago enviar o webhook de refund, a API atualizara o pedido para CANCELADO.</p>
      <br/>
      <small>Enviado automaticamente pela API 1km</small>
    `,
  });
}

function validarConfiguracaoEmail() {
  if (!emailUsuario || !emailSenha || !emailOrganizador) {
    throw new Error(
      "Configuração de e-mail incompleta. Verifique EMAIL_USER, EMAIL_PASSWORD e EMAIL_DESTINO no Render."
    );
  }
}

function formatarData(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(data);
}

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
