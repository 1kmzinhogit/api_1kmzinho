import { prisma } from "../config/db.js";

export async function gerarExcelKits(nomeEvento: string): Promise<Buffer> {
  const pedidos = await prisma.pedido.findMany({
    where: { nomeEvento, status: "APROVADO" },
    include: { itens: true },
    orderBy: [{ lote: "asc" }, { nomePessoa: "asc" }],
  });

  if (pedidos.length === 0) {
    throw new Error("Nenhum pedido aprovado encontrado para este evento.");
  }

  const cabecalhos = [
    "Nº inscrição", "Nome completo", "CPF", "E-mail", "Contato", "Equipe",
    "Evento", "Distância", "Kit/lote", "Categoria", "Tamanho da camisa",
    "Cor da camisa", "Itens", "Valor da inscrição", "Total pago", "Data da compra",
  ];
  const linhas = pedidos.map((pedido) => [
    pedido.numeroInscricao ?? "",
    pedido.nomePessoa,
    formatarCPF(pedido.cpf),
    pedido.email ?? "",
    pedido.contato,
    pedido.equipe || "",
    pedido.nomeEvento,
    pedido.distancia,
    pedido.lote,
    pedido.categoria,
    limparProdutoAusente(pedido.numeroCamisa, ["sem tamanho"]),
    limparProdutoAusente(pedido.corCamisa, ["sem cor"]),
    pedido.itens.map((item) => `${item.titulo} (${item.quantidade}x)`).join("; "),
    pedido.valorIngresso,
    pedido.total,
    pedido.criadoEm.toISOString(),
  ]);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:x="urn:schemas-microsoft-com:office:excel">
 <Styles>
  <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#16446F" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Currency"><NumberFormat ss:Format="&quot;R$&quot; #,##0.00"/></Style>
 </Styles>
 <Worksheet ss:Name="Participantes">
  <Table>
   <Row>${cabecalhos.map((valor) => celula(valor, "String", "Header")).join("")}</Row>
   ${linhas.map((linha) => `<Row>${linha.map((valor, indice) =>
     celula(valor, typeof valor === "number" ? "Number" : "String", indice === 13 || indice === 14 ? "Currency" : undefined)
   ).join("")}</Row>`).join("\n")}
  </Table>
  <AutoFilter xmlns="urn:schemas-microsoft-com:office:excel" x:Range="R1C1:R${linhas.length + 1}C16"/>
 </Worksheet>
</Workbook>`;

  return Buffer.from(xml, "utf8");
}

function celula(valor: unknown, tipo: "String" | "Number", estilo?: string) {
  const style = estilo ? ` ss:StyleID="${estilo}"` : "";
  return `<Cell${style}><Data ss:Type="${tipo}">${escaparXml(String(valor ?? ""))}</Data></Cell>`;
}

function escaparXml(valor: string) {
  return valor.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function formatarCPF(cpf: string) {
  const numeros = cpf.replace(/\D/g, "");
  return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function limparProdutoAusente(valor: unknown, marcadoresEspecificos: string[]) {
  if (typeof valor !== "string" || !valor.trim()) return "";
  const texto = valor.trim();
  const marcador = texto.toLocaleLowerCase("pt-BR");
  const ausentes = [
    "null", "undefined", "empty", "não informado", "nao informado", "n/a", "-", "—",
    ...marcadoresEspecificos,
  ];
  return ausentes.includes(marcador) ? "" : texto;
}
