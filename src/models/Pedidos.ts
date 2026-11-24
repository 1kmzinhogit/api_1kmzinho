export interface ItemPedidoInput {
  id: string
  titulo: string
  quantidade: number
  valor_unitario: number
}

export type CategoriaPedido = "MASCULINO" | "FEMININO" | "MAIOR_60" | "LGBTQIA" | "PCD"

export interface CheckoutInput {
  kitId: string
  cpf: string
  contato: string
  email: string
  nomeNaCamisa: string
  dataNascimento: string
  nomePessoa: string
  corCamisa: string
  equipe: string
  categoria?: CategoriaPedido
  cupom?: string
  numeroCamisa?: string
  /** Distância personalizada informada pelo participante em quilômetros. */
  distanciaPersonalizada?: string | number
}

export interface PedidoInput extends CheckoutInput {
  nomeEvento: string
  lote: string
  valorIngresso: number
  itens: ItemPedidoInput[]
}
