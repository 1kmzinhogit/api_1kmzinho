import { type Categoria } from "@prisma/client";
import { prisma } from "../config/db.js";

const CATEGORIAS_ACEITAS = new Set<Categoria>([
  "MASCULINO",
  "FEMININO",
  "MAIOR_60",
  "LGBTQIA",
  "PCD",
]);

type PrecoInput = {
  categoria?: unknown;
  valor?: unknown;
  ativo?: unknown;
};

type LoteInput = {
  id?: unknown;
  lote?: unknown;
  capacidade?: unknown;
  capacidadeAtual?: unknown;
  dataInicio?: unknown;
  dataFim?: unknown;
  ativo?: unknown;
  precos?: unknown;
};

type CadastroEventoLotesInput = {
  nomeEvento?: unknown;
  distancia?: unknown;
  lotes?: unknown;
};

export async function cadastrarEventoLotes(payload: CadastroEventoLotesInput) {
  const dados = validarCadastroEventoLotes(payload);

  const lotesSalvos = await prisma.$transaction(async (tx) => {
    const salvos = [];

    for (const lote of dados.lotes) {
      await tx.configLote.upsert({
        where: { id: lote.id },
        create: {
          id: lote.id,
          nomeEvento: dados.nomeEvento,
          distancia: dados.distancia,
          lote: lote.lote,
          capacidade: lote.capacidade,
          capacidadeAtual: lote.capacidadeAtual,
          dataInicio: lote.dataInicio,
          dataFim: lote.dataFim,
          ativo: lote.ativo,
          notificado: false,
        },
        update: {
          nomeEvento: dados.nomeEvento,
          distancia: dados.distancia,
          lote: lote.lote,
          capacidade: lote.capacidade,
          capacidadeAtual: lote.capacidadeAtual,
          dataInicio: lote.dataInicio,
          dataFim: lote.dataFim,
          ativo: lote.ativo,
        },
      });

      for (const preco of lote.precos) {
        await tx.precoLote.upsert({
          where: {
            configLote_categoria: {
              idConfigLote: lote.id,
              categoria: preco.categoria,
            },
          },
          create: {
            idConfigLote: lote.id,
            categoria: preco.categoria,
            valor: preco.valor,
            ativo: preco.ativo,
          },
          update: {
            valor: preco.valor,
            ativo: preco.ativo,
          },
        });
      }

      salvos.push({
        id: lote.id,
        lote: lote.lote,
        capacidade: lote.capacidade,
        precos: lote.precos.length,
      });
    }

    return salvos;
  });

  return {
    ok: true,
    evento: dados.nomeEvento,
    lotesSalvos,
  };
}

function validarCadastroEventoLotes(payload: CadastroEventoLotesInput) {
  const nomeEvento = stringObrigatoria(payload.nomeEvento, "nomeEvento");
  const distancia = stringObrigatoria(payload.distancia, "distancia");

  if (!Array.isArray(payload.lotes) || payload.lotes.length === 0) {
    throw new Error("lotes precisa ser um array com pelo menos 1 item.");
  }

  return {
    nomeEvento,
    distancia,
    lotes: payload.lotes.map((loteRaw, index) => validarLote(loteRaw, index)),
  };
}

function validarLote(loteRaw: unknown, index: number) {
  if (!isRecord(loteRaw)) {
    throw new Error(`lotes[${index}] precisa ser um objeto.`);
  }

  const lote = loteRaw as LoteInput;
  const id = stringObrigatoria(lote.id, `lotes[${index}].id`);
  const nomeLote = stringObrigatoria(lote.lote, `lotes[${index}].lote`);
  const capacidade = numeroInteiroMaiorQueZero(
    lote.capacidade,
    `lotes[${index}].capacidade`
  );
  const capacidadeAtual =
    lote.capacidadeAtual === undefined || lote.capacidadeAtual === null
      ? 0
      : numeroInteiroNaoNegativo(lote.capacidadeAtual, `lotes[${index}].capacidadeAtual`);
  const dataInicio = dataOpcional(lote.dataInicio, `lotes[${index}].dataInicio`);
  const dataFim = dataOpcional(lote.dataFim, `lotes[${index}].dataFim`);

  if (dataInicio && dataFim && dataFim <= dataInicio) {
    throw new Error(`lotes[${index}].dataFim precisa ser maior que dataInicio.`);
  }

  if (!Array.isArray(lote.precos) || lote.precos.length === 0) {
    throw new Error(`lotes[${index}].precos precisa ser um array com pelo menos 1 item.`);
  }

  return {
    id,
    lote: nomeLote,
    capacidade,
    capacidadeAtual,
    dataInicio,
    dataFim,
    ativo: booleanOpcional(lote.ativo, true, `lotes[${index}].ativo`),
    precos: lote.precos.map((preco, precoIndex) =>
      validarPreco(preco, `lotes[${index}].precos[${precoIndex}]`)
    ),
  };
}

function validarPreco(precoRaw: unknown, caminho: string) {
  if (!isRecord(precoRaw)) {
    throw new Error(`${caminho} precisa ser um objeto.`);
  }

  const preco = precoRaw as PrecoInput;
  const categoria = stringObrigatoria(preco.categoria, `${caminho}.categoria`) as Categoria;

  if (!CATEGORIAS_ACEITAS.has(categoria)) {
    throw new Error(`${caminho}.categoria inválida.`);
  }

  const valor = numeroNaoNegativo(preco.valor, `${caminho}.valor`);

  return {
    categoria,
    valor,
    ativo: booleanOpcional(preco.ativo, true, `${caminho}.ativo`),
  };
}

function stringObrigatoria(valor: unknown, campo: string) {
  if (typeof valor !== "string" || !valor.trim()) {
    throw new Error(`${campo} é obrigatório.`);
  }

  return valor.trim();
}

function numeroInteiroMaiorQueZero(valor: unknown, campo: string) {
  const numero = Number(valor);

  if (!Number.isInteger(numero) || numero <= 0) {
    throw new Error(`${campo} precisa ser maior que 0.`);
  }

  return numero;
}

function numeroInteiroNaoNegativo(valor: unknown, campo: string) {
  const numero = Number(valor);

  if (!Number.isInteger(numero) || numero < 0) {
    throw new Error(`${campo} precisa ser número inteiro maior ou igual a 0.`);
  }

  return numero;
}

function numeroNaoNegativo(valor: unknown, campo: string) {
  const numero = Number(valor);

  if (!Number.isFinite(numero) || numero < 0) {
    throw new Error(`${campo} precisa ser número maior ou igual a 0.`);
  }

  return numero;
}

function dataOpcional(valor: unknown, campo: string) {
  if (valor === undefined || valor === null || valor === "") {
    return null;
  }

  if (typeof valor !== "string") {
    throw new Error(`${campo} precisa ser string ISO ou null.`);
  }

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    throw new Error(`${campo} inválida.`);
  }

  return data;
}

function booleanOpcional(valor: unknown, padrao: boolean, campo: string) {
  if (valor === undefined || valor === null) {
    return padrao;
  }

  if (typeof valor !== "boolean") {
    throw new Error(`${campo} precisa ser boolean.`);
  }

  return valor;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
