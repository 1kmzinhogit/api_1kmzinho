# 🧪 Testes de Compras e Cadastros

Esta pasta contém scripts para simular compras, cadastros e webhooks na API 1KM.

## 📋 Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `simularCompras.ts` | Simula chamadas ao endpoint `/checkout` (cria preferências de pagamento no Mercado Pago) |
| `simularCadastros.ts` | Cria pedidos diretamente no banco de dados (sem Mercado Pago) |
| `simularWebhooks.ts` | Simula notificações de webhook do Mercado Pago |

## 🚀 Como Executar

### Pré-requisitos
- API rodando em `http://localhost:3000` (ou configure a variável `API_URL`)
- Banco de dados PostgreSQL conectado
- Credenciais do Mercado Pago configuradas (para `simularCompras.ts`)

### 1. Simular Compras (via API)
```bash
npx tsx testesCompras/simularCompras.ts
```
Este script envia requisições POST para `/checkout` e retorna links de pagamento do Mercado Pago.

### 2. Simular Cadastros (direto no banco)
```bash
npx tsx testesCompras/simularCadastros.ts
```
Este script cria pedidos diretamente no banco de dados usando Prisma. Útil para testar relatórios PDF.

### 3. Simular Webhooks
```bash
npx tsx testesCompras/simularWebhooks.ts
```
Este script simula notificações do Mercado Pago para testar a aprovação de pedidos.

## 📊 Dados de Teste Incluídos

Os scripts incluem dados de exemplo com:
- **Eventos**: Corrida da Família 2026, Maratona São Paulo 2026, Meia Maratona Rio 2026
- **Categorias**: MASCULINO, FEMININO, MAIOR_60, LGBTQIA, PCD
- **Lotes**: Lote 1, Lote 2
- **Status**: PENDENTE, APROVADO, REJEITADO, CANCELADO

## ⚙️ Configuração

Para usar com API em outro endereço:
```bash
export API_URL=http://seu-servidor:3000
npx tsx testesCompras/simularCompras.ts
```

Ou edite o valor padrão no início de cada arquivo:
```typescript
const API_URL = process.env.API_URL || "http://localhost:3000";
```

## 📝 Personalização

Para adicionar seus próprios dados de teste, edite os arrays `comprasTeste` ou `cadastrosTeste` em cada arquivo.

Exemplo de nova compra:
```typescript
{
  cpf: "000.000.000-00",
  nomeEvento: "Seu Evento 2026",
  contato: "(11) 99999-9999",
  lote: "Lote 1",
  valorIngresso: 100.0,
  nomeNaCamisa: "SEU NOME",
  dataNascimento: "1990-01-01",
  nomePessoa: "Seu Nome Completo",
  corCamisa: "Azul",
  equipe: "Sua Equipe",
  categoria: "MASCULINO",
  itens: [
    { id: "1", titulo: "Camiseta Adulto", quantidade: 1, valor_unitario: 100.0 },
  ],
}
```
