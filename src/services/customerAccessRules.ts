export function gerarVariacoesCpf(cpf: string): string[] {
  const cpfLimpo = cpf.replace(/\D/g, "");

  if (cpfLimpo.length !== 11) {
    return [];
  }

  return Array.from(new Set([
    cpf,
    cpfLimpo,
    cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"),
  ]));
}

export function normalizarEmailCliente(email: unknown): string | null {
  if (typeof email !== "string") return null;

  const emailNormalizado = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado)
    ? emailNormalizado
    : null;
}

export function credenciaisClienteCorrespondem(
  pedido: { cpf: string; email: string | null },
  cpf: string,
  email: string
): boolean {
  const cpfInformado = cpf.replace(/\D/g, "");
  const cpfPedido = pedido.cpf.replace(/\D/g, "");
  const emailInformado = normalizarEmailCliente(email);
  const emailPedido = normalizarEmailCliente(pedido.email);

  return cpfInformado.length === 11
    && cpfInformado === cpfPedido
    && emailInformado !== null
    && emailInformado === emailPedido;
}
