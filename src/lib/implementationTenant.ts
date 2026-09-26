// Criar o ambiente (tenant) do cliente a partir dos dados da implementação.
// Compartilhado entre a tela (mostra o que falta) e o servidor (revalida e monta o cadastro da
// empresa — o servidor NUNCA confia no que o navegador diz estar completo).
import { isValidCnpj, onlyDigits } from "./brLookup.js";

const s = (v: unknown) => String(v ?? "").trim();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Dados mínimos para provisionar o cliente. Devolve o que ainda falta, em português. */
export function tenantReadiness(data: Record<string, any> | null | undefined): { ready: boolean; missing: string[] } {
  const d = data || {};
  const missing: string[] = [];
  if (!s(d.razao_social)) missing.push("Razão social");
  if (!s(d.nome_fantasia)) missing.push("Nome fantasia");
  if (!s(d.cnpj)) missing.push("CNPJ");
  else if (!isValidCnpj(s(d.cnpj))) missing.push("CNPJ válido");
  if (!s(d.endereco)) missing.push("Endereço");
  if (!s(d.resp_nome)) missing.push("Responsável principal");
  if (!EMAIL_RE.test(s(d.resp_email))) missing.push("E-mail do responsável");
  if (onlyDigits(s(d.resp_whatsapp)).length < 10) missing.push("WhatsApp do responsável");
  return { ready: missing.length === 0, missing };
}

/** Cadastro que vai para Configurações › Dados da Empresa do novo ambiente (chave `empresa_dados`). */
export function buildEmpresaDados(data: Record<string, any>) {
  const cep = s(data.cep);
  const endereco = s(data.endereco);
  const cepJaNoEndereco = cep && onlyDigits(endereco).includes(onlyDigits(cep));
  return {
    razaoSocial: s(data.razao_social).slice(0, 200),
    nomeFantasia: s(data.nome_fantasia).slice(0, 200),
    cnpj: s(data.cnpj).slice(0, 20),
    inscricaoEstadual: "",
    endereco: (cep && !cepJaNoEndereco ? `${endereco}, CEP ${cep}` : endereco).slice(0, 400),
    emailContato: s(data.resp_email).toLowerCase().slice(0, 200),
    telefoneContato: s(data.resp_whatsapp).slice(0, 40),
    website: s(data.site).slice(0, 200),
    logoUrl: "",
  };
}
