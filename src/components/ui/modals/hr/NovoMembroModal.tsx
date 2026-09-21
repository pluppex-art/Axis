import React, { useEffect, useMemo, useState } from "react";
import { UserPlus, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { Modal } from "../../modal";
import { Button } from "../../button";
import { useData } from "../../../../contexts/DataContext";
import { useDepartamentoOptions } from "../../../../hooks/useDepartamentoOptions";

export type NovoMembroPayload = {
  nome: string;
  email: string;
  phone: string;
  senha: string;
  cargo: string;
  departamento: string;
  squad: string;
  filialId: string;
  permiteTrocarEmpresa: boolean;
};

type NovoMembroModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: NovoMembroPayload) => void;
  title?: string;
  submitText?: string;
  initialValue?: Partial<NovoMembroPayload> | null;
  /** Só master vê essa opção — escrever em partners/tenant_partners é restrito a
   * master via RLS, então mostrar pra quem não é master criaria um controle que nunca
   * funcionaria de verdade. */
  canGrantTenantAccess?: boolean;
  /** Lista de filiais do tenant ativo — o campo só aparece quando há mais de uma. */
  filiais?: { id: string; nome: string }[];
};

// Gera uma senha temporária forte quando o admin deixa o campo em branco —
// substitui o antigo fallback fixo "123456" (previsível/fraco, mesma senha
// pra toda conta criada sem senha explícita).
function generateTempPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "").slice(0, 14) + "!A1";
}

const labelClass = "text-xs font-bold text-[var(--color-text-muted)] mb-1 block";
const inputBaseClass =
  "w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] px-3 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-blue)] transition-all";

export function NovoMembroModal({
  isOpen,
  onClose,
  onSave,
  title = "Novo Colaborador / Membro",
  submitText = "Adicionar à Equipe",
  initialValue,
  canGrantTenantAccess = false,
  filiais = [],
}: NovoMembroModalProps) {
  const [nome, setNome] = useState(initialValue?.nome || "");
  const [email, setEmail] = useState(initialValue?.email || "");
  const [phone, setPhone] = useState(initialValue?.phone || "");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [cargo, setCargo] = useState(initialValue?.cargo || "");
  const [departamento, setDepartamento] = useState(initialValue?.departamento || "");
  const [squad, setSquad] = useState("");
  const [filialId, setFilialId] = useState(initialValue?.filialId || "");
  const [permiteTrocarEmpresa, setPermiteTrocarEmpresa] = useState(initialValue?.permiteTrocarEmpresa ?? false);
  const [loading, setLoading] = useState(false);
  const { cargos, squads } = useData();
  const departamentoOptions = useDepartamentoOptions();

  useEffect(() => {
    if (!isOpen) return;
    setNome(initialValue?.nome || "");
    setEmail(initialValue?.email || "");
    setPhone(initialValue?.phone || "");
    setSenha("");
    setShowSenha(false);
    setCargo(initialValue?.cargo || "");
    setDepartamento(initialValue?.departamento || "");
    setSquad("");
    setFilialId(initialValue?.filialId || "");
    setPermiteTrocarEmpresa(initialValue?.permiteTrocarEmpresa ?? false);
    setLoading(false);
  }, [isOpen, initialValue]);

  const canSubmit = useMemo(() => {
    if (loading) return false;
    return Boolean(nome.trim() && email.trim());
  }, [loading, nome, email]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    try {
      onSave({
        nome: nome.trim(),
        email: email.trim(),
        phone: phone.trim(),
        senha: senha || generateTempPassword(),
        cargo: cargo.trim() || "Colaborador",
        departamento: departamento.trim() || "Geral",
        squad: squad.trim(),
        filialId,
        permiteTrocarEmpresa: canGrantTenantAccess && permiteTrocarEmpresa,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Nome Completo *</label>
            <input
              type="text"
              required
              placeholder="Ex: João da Silva"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={inputBaseClass}
            />
          </div>

          <div>
            <label className={labelClass}>E-mail Corporativo *</label>
            <input
              type="email"
              required
              placeholder="joao@empresa.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputBaseClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Telefone / WhatsApp</label>
            <input
              type="tel"
              placeholder="(11) 98765-4321"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputBaseClass}
            />
          </div>

          <div>
            <label className={labelClass}>Senha de Acesso</label>
            <div className="relative">
              <input
                type={showSenha ? "text" : "password"}
                placeholder="Deixe em branco para gerar uma senha temporária"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className={inputBaseClass}
              />
              <button
                type="button"
                onClick={() => setShowSenha(!showSenha)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
              >
                {showSenha ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Cargo / Função</label>
            <select
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              className={inputBaseClass}
            >
              <option value="">Selecione...</option>
              {cargos.map((c) => (
                <option key={c.id} value={c.nome}>
                  {c.nome}
                </option>
              ))}
              <option value="SDR / Pré-Vendas">SDR / Pré-Vendas</option>
              <option value="Closer / Executivo">Closer / Executivo</option>
              <option value="Gerente Comercial">Gerente Comercial</option>
              <option value="Analista de Suporte">Analista de Suporte</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Departamento</label>
            <select
              value={departamento}
              onChange={(e) => setDepartamento(e.target.value)}
              className={inputBaseClass}
            >
              <option value="">Selecione...</option>
              {departamentoOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Squad</label>
            <select
              value={squad}
              onChange={(e) => setSquad(e.target.value)}
              className={inputBaseClass}
            >
              <option value="">Sem squad</option>
              {squads.map((s) => (
                <option key={s.id} value={s.nome}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filiais.length > 1 && (
          <div>
            <label className={labelClass}>Filial</label>
            <select
              value={filialId}
              onChange={(e) => setFilialId(e.target.value)}
              className={inputBaseClass}
            >
              <option value="">Sem filial específica</option>
              {filiais.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
        )}

        {canGrantTenantAccess && (
          <label className="flex items-start gap-2.5 p-3 bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-[var(--radius-control)] cursor-pointer">
            <input
              type="checkbox"
              checked={permiteTrocarEmpresa}
              onChange={(e) => setPermiteTrocarEmpresa(e.target.checked)}
              className="mt-0.5 w-3.5 h-3.5 accent-[var(--color-primary-blue)] cursor-pointer"
            />
            <span className="text-xs text-[var(--color-text-primary)]">
              <span className="font-bold flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[var(--color-primary-blue)]" /> Permitir trocar entre empresas clientes</span>
              <span className="block text-[var(--color-text-muted)] mt-0.5">
                Libera o seletor de tenant na barra lateral — a pessoa passa a ver e alternar entre todos os tenants ativos, não só este.
              </span>
            </span>
          </label>
        )}

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--color-border-subtle)]">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-9 px-4 text-xs font-bold border-[var(--color-border-default)]"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit || loading}
            className="h-9 px-5 text-xs font-bold shadow-xs"
          >
            {loading ? "Salvando..." : submitText}
          </Button>
        </div>
      </form>
    </Modal>
  );
}