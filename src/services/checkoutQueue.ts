export class CheckoutFilaCheiaError extends Error {
  constructor() {
    super("A fila de checkout está cheia. Aguarde alguns instantes e tente novamente.");
    this.name = "CheckoutFilaCheiaError";
  }
}

export function criarFilaSerial(maximoNaFila: number) {
  let cauda: Promise<void> = Promise.resolve();
  let quantidadeNaFila = 0;

  return {
    executar<T>(operacao: () => Promise<T>): Promise<T> {
      if (quantidadeNaFila >= maximoNaFila) {
        return Promise.reject(new CheckoutFilaCheiaError());
      }

      quantidadeNaFila++;
      const anterior = cauda;
      let liberar!: () => void;
      cauda = new Promise<void>((resolve) => {
        liberar = resolve;
      });

      return (async () => {
        await anterior;
        try {
          return await operacao();
        } finally {
          quantidadeNaFila--;
          liberar();
        }
      })();
    },

    tamanho() {
      return quantidadeNaFila;
    },
  };
}

// Leave room for a burst while bounding payloads retained in process memory.
export const filaCheckout = criarFilaSerial(200);
