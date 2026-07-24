export type RegraCapacidadeCompartilhada = {
  nomeEvento: string;
  distancia: string;
  capacidadeTotal: number;
  kitIds: [string, string];
};

// Novas corridas com vagas compartilhadas podem ser incluídas nesta lista sem
// alterar a regra padrão dos demais lotes.
const REGRAS: RegraCapacidadeCompartilhada[] = [
  {
    nomeEvento: "Juntos Rumo ao Céu",
    distancia: "5KM",
    capacidadeTotal: 300,
    kitIds: [
      "juntos-rumo-ao-ceu-kit-completo",
      "juntos-rumo-ao-ceu-kit-simples",
    ],
  },
];

export function encontrarRegraCapacidadeCompartilhada(kitId: string) {
  return REGRAS.find((regra) => regra.kitIds.includes(kitId));
}

export function encontrarRegraPorEventoEDistancia(nomeEvento: string, distancia: string) {
  return REGRAS.find(
    (regra) =>
      regra.nomeEvento === nomeEvento && normalizarDistancia(distancia) === regra.distancia
  );
}

export function normalizarDistancia(distancia: string): string {
  return distancia.trim().toUpperCase();
}
