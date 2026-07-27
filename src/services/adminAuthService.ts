import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { type NextFunction, type Request, type Response } from "express";

const NOME_COOKIE = "admin_1km_session";
const DURACAO_SESSAO_MS = 8 * 60 * 60 * 1000;

type SessaoAdmin = {
  expiraEm: number;
  nonce: string;
};

export function autenticarSenhaAdmin(senha: unknown) {
  if (!autenticacaoAdminHabilitada()) {
    throw new Error("Autenticação do painel está desabilitada.");
  }

  const senhaConfigurada = process.env.ADMIN_PASSWORD ?? process.env.ADMIN_DASHBOARD_PASSWORD;
  const segredo = process.env.ADMIN_SECRET_KEY ?? process.env.ADMIN_SESSION_SECRET;

  if (!senhaConfigurada || !segredo) {
    throw new Error("Autenticação do painel não configurada.");
  }

  if (typeof senha !== "string") return false;
  return compararComSeguranca(senha, senhaConfigurada);
}

export function criarCookieSessaoAdmin() {
  const segredo = obterSegredo();
  const sessao: SessaoAdmin = {
    expiraEm: Date.now() + DURACAO_SESSAO_MS,
    nonce: randomUUID(),
  };
  const payload = Buffer.from(JSON.stringify(sessao)).toString("base64url");
  const assinatura = assinar(payload, segredo);
  return {
    cookie: `${NOME_COOKIE}=${payload}.${assinatura}; Path=/; HttpOnly; ${atributosCookie()}; Max-Age=28800`,
    expiraEm: new Date(sessao.expiraEm),
  };
}

export function limparCookieSessaoAdmin() {
  return `${NOME_COOKIE}=; Path=/; HttpOnly; Max-Age=0; ${atributosCookie()}`;
}

export function sessaoAdminValida(req: Request) {
  if (!autenticacaoAdminHabilitada()) return false;
  return Boolean(obterSessaoAdmin(req));
}

export function obterSessaoAdmin(req: Request): { expiraEm: Date } | null {
  if (!autenticacaoAdminHabilitada()) return null;
  try {
    const valor = lerCookie(req.headers.cookie, NOME_COOKIE);
    if (!valor) return null;

    const [payload, assinatura] = valor.split(".");
    if (!payload || !assinatura || !compararComSeguranca(assinatura, assinar(payload, obterSegredo()))) {
      return null;
    }

    const sessao = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessaoAdmin;
    return typeof sessao.expiraEm === "number" && sessao.expiraEm > Date.now()
      ? { expiraEm: new Date(sessao.expiraEm) }
      : null;
  } catch {
    return null;
  }
}

export function exigirSessaoAdmin(req: Request, res: Response, next: NextFunction) {
  if (!sessaoAdminValida(req)) {
    return res.status(401).json({
      authenticated: false,
      erro: "Sessão administrativa inválida ou expirada.",
    });
  }

  return next();
}

function obterSegredo() {
  const segredo = process.env.ADMIN_SECRET_KEY ?? process.env.ADMIN_SESSION_SECRET;
  if (!segredo) throw new Error("Autenticação do painel não configurada.");
  return segredo;
}

function autenticacaoAdminHabilitada() {
  return process.env.ADMIN_AUTH_ENABLED?.toLowerCase() !== "false";
}

function assinar(payload: string, segredo: string) {
  return createHmac("sha256", segredo).update(payload).digest("base64url");
}

function lerCookie(cookies: string | undefined, nome: string) {
  if (!cookies) return null;
  const prefixo = `${nome}=`;
  const item = cookies.split(";").map((parte) => parte.trim()).find((parte) => parte.startsWith(prefixo));
  return item ? item.slice(prefixo.length) : null;
}

function compararComSeguranca(valor: string, esperado: string) {
  const valorBuffer = Buffer.from(valor);
  const esperadoBuffer = Buffer.from(esperado);
  return valorBuffer.length === esperadoBuffer.length && timingSafeEqual(valorBuffer, esperadoBuffer);
}

function atributosCookie() {
  return process.env.NODE_ENV === "production"
    ? "SameSite=None; Secure"
    : "SameSite=Lax";
}
