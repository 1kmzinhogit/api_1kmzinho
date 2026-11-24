export class CheckoutPagamentoIndisponivelError extends Error {
  constructor() {
    super("Compra não realizada. Tente novamente em alguns minutos.");
    this.name = "CheckoutPagamentoIndisponivelError";
  }
}
