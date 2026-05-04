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
  nomeNaCamisa: string
  dataNascimento: string
  nomePessoa: string
  corCamisa: string
  equipe: string
  categoria?: CategoriaPedido
  numeroCamisa?: string
}

export interface PedidoInput extends CheckoutInput {
  nomeEvento: string
  lote: string
  valorIngresso: number
  itens: ItemPedidoInput[]
}
