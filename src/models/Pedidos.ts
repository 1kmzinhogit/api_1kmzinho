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
  numeroCamisa: string
  corCamisa: string
  equipe: string
  itens: ItemPedidoInput[]
}