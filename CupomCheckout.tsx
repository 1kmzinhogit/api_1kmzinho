import { useState } from "react";

type Categoria = "MASCULINO" | "FEMININO" | "MAIOR_60" | "LGBTQIA" | "PCD";

type CupomValidado = {
  codigoCupom: string;
  valorIngresso: number;
  descontoCupom: number;
  taxaServico: number;
  total: number;
};

type Props = {
  apiUrl: string;
  kitId: string;
  categoria: Categoria;
  onCupomChange?: (cupom: CupomValidado | null) => void;
};

const dinheiro = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Campo de cupom para inserir dentro do checkout do site. */
export default function CupomCheckout({ apiUrl, kitId, categoria, onCupomChange }: Props) {
  const [codigo, setCodigo] = useState("");
  const [cupom, setCupom] = useState<CupomValidado | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  function limparCupom() {
    setCupom(null);
    setErro("");
    onCupomChange?.(null);
  }

  async function aplicarCupom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!codigo.trim()) {
      setErro("Digite o código do cupom.");
      limparCupom();
      return;
    }

    setCarregando(true);
    setErro("");
    setCupom(null);
    onCupomChange?.(null);

    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, "")}/cupons/validar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kitId, categoria, cupom: codigo.trim() }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.erro ?? "Não foi possível validar o cupom.");

      const validado = body as CupomValidado;
      setCupom(validado);
      setCodigo(validado.codigoCupom);
      onCupomChange?.(validado);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível validar o cupom.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <section aria-label="Cupom de desconto" style={{ marginBlock: 16 }}>
      <form onSubmit={aplicarCupom}>
        <label htmlFor="cupom-checkout">Cupom de desconto</label>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <input
            id="cupom-checkout"
            value={codigo}
            onChange={(event) => {
              setCodigo(event.target.value.toUpperCase());
              limparCupom();
            }}
            placeholder="Digite seu cupom"
            autoComplete="off"
            maxLength={40}
            aria-invalid={Boolean(erro)}
            aria-describedby={erro ? "cupom-erro" : undefined}
          />
          <button type="submit" disabled={carregando || !kitId}>
            {carregando ? "Verificando…" : "Aplicar"}
          </button>
        </div>
      </form>

      {erro && <p id="cupom-erro" role="alert" style={{ color: "#b42318" }}>{erro}</p>}

      {cupom && (
        <div role="status" style={{ marginTop: 12 }}>
          <p>Cupom <strong>{cupom.codigoCupom}</strong> aplicado.</p>
          <p>Inscrição: {dinheiro.format(cupom.valorIngresso)}</p>
          <p>Desconto: −{dinheiro.format(cupom.descontoCupom)}</p>
          {cupom.taxaServico > 0 && <p>Taxa: {dinheiro.format(cupom.taxaServico)}</p>}
          <p><strong>Total: {dinheiro.format(cupom.total)}</strong></p>
        </div>
      )}
    </section>
  );
}
