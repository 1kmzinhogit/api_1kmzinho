export interface OrderItemInput {
  id: string
  title: string
  quantity: number
  unit_price: number
}

export interface OrderInput {
  cpf: string
  contactNumber: string
  raceName: string
  lot: string
  ticketValue: number
  shirtName: string
  shirtNumber: string
  shirtColor: string
  items: OrderItemInput[]
}