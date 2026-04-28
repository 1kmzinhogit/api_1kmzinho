export interface ItemPedidoInput {
  id: string
  titulo: string
  quantidade: number
  valor_unitario: number
}

export interface PedidoInput {
  cpf: string
  contato: string
  nomeEvento: string
  lote: string
  valorIngresso: number
  nomeNaCamisa: string
  dataNascimento: string
  nomePessoa: string
  corCamisa: string
  equipe: string
  categoria?: "MASCULINO" | "FEMININO" | "MAIOR_60" | "LGBTQIA"
  numeroCamisa?: string
  itens: ItemPedidoInput[]
}
