const PRAZO_REEMBOLSO_PADRAO_DIAS = 7;
const PRAZO_REEMBOLSO_EVENTO_ALTERADO_DIAS = 30;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

export interface RefundInfo {
  dataCompra: Date;
  prazoReembolsoDias: number;
  dataLimiteReembolso: Date;
  eventoComDataAlterada: boolean;
  permiteSolicitarReembolso: boolean;
  motivoIndisponibilidadeReembolso: string | null;
}

export function calcularInfoReembolso(params: {
  status: string;
  criadoEm: Date;
  nomeEvento: string;
  agora?: Date;
}): RefundInfo {
  const dataCompra = params.criadoEm;
  const eventoComDataAlterada = eventoTemDataAlterada(params.nomeEvento);
  const prazoReembolsoDias = eventoComDataAlterada
    ? PRAZO_REEMBOLSO_EVENTO_ALTERADO_DIAS
    : PRAZO_REEMBOLSO_PADRAO_DIAS;
  const dataLimiteReembolso = adicionarDias(dataCompra, prazoReembolsoDias);
  const agora = params.agora ?? new Date();
  const pedidoAprovado = params.status === "APROVADO";
  const dentroDoPrazo = agora.getTime() <= dataLimiteReembolso.getTime();

  return {
    dataCompra,
    prazoReembolsoDias,
    dataLimiteReembolso,
    eventoComDataAlterada,
    permiteSolicitarReembolso: pedidoAprovado && dentroDoPrazo,
    motivoIndisponibilidadeReembolso: definirMotivoIndisponibilidade({
      pedidoAprovado,
      dentroDoPrazo,
      eventoComDataAlterada,
    }),
  };
}

export function eventoTemDataAlterada(nomeEvento: string): boolean {
  const eventosAlterados = (process.env.EVENTOS_COM_DATA_ALTERADA ?? "")
    .split(",")
    .map((evento) => normalizarTexto(evento))
    .filter(Boolean);

  return eventosAlterados.includes(normalizarTexto(nomeEvento));
}

function adicionarDias(data: Date, dias: number): Date {
  return new Date(data.getTime() + dias * UM_DIA_MS);
}

function definirMotivoIndisponibilidade(params: {
  pedidoAprovado: boolean;
  dentroDoPrazo: boolean;
  eventoComDataAlterada: boolean;
}): string | null {
  if (!params.pedidoAprovado) {
    return "Pedido ainda nao esta aprovado para reembolso.";
  }

  if (!params.dentroDoPrazo) {
    const prazo = params.eventoComDataAlterada
      ? PRAZO_REEMBOLSO_EVENTO_ALTERADO_DIAS
      : PRAZO_REEMBOLSO_PADRAO_DIAS;

    return `Prazo de ${prazo} dias para solicitar reembolso expirado.`;
  }

  return null;
}

function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
