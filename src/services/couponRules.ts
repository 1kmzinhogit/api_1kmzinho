export type CupomElegibilidade = {
  ativo: boolean;
  nomeEvento: string;
  validadeAte: Date | null;
  limiteUsos: number | null;
};

export function validarElegibilidadeCupom(
  cupom: CupomElegibilidade | null,
  nomeEvento: string,
  usosAprovados: number,
  agora = new Date(),
): asserts cupom is CupomElegibilidade {
  if (!cupom) throw new Error("Cupom não encontrado.");
  if (!cupom.ativo) throw new Error("Este cupom está inativo.");
  if (cupom.nomeEvento !== nomeEvento) throw new Error("Este cupom não é válido para esta corrida.");
  if (cupom.validadeAte && agora >= cupom.validadeAte) throw new Error("Este cupom expirou.");
  if (cupom.limiteUsos !== null && usosAprovados >= cupom.limiteUsos) {
    throw new Error("Este cupom atingiu o limite de usos.");
  }
}
