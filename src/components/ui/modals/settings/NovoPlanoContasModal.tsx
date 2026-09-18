import React, { useEffect, useMemo, useState } from "react";
import { DollarSign, ShieldCheck } from "lucide-react";
import { Modal } from "../../modal";
import { Button } from "../../button";

export type FinanceCategorySubtipo = "DESPESA_FIXA" | "DESPESA_VARIAVEL" | "PESSOAS" | "IMPOSTOS";

type NovoPlanoContasPayload = {
    nome: string;
    tipo: "Receita" | "Despesa";
    subtipo: FinanceCategorySubtipo | null;
};

type NovoPlanoContasModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSave: (payload: NovoPlanoContasPayload) => void;
    title?: string;
    submitText?: string;
    initialValue?: Partial<NovoPlanoContasPayload> | null;
};

const SUBTIPO_LABELS: Record<FinanceCategorySubtipo, string> = {
    DESPESA_FIXA: "Despesa Fixa",
    DESPESA_VARIAVEL: "Despesa Variável",
    PESSOAS: "Pessoas",
    IMPOSTOS: "Impostos",
};

const labelClass = "text-[10px] font-bold text-slate-400 uppercase tracking-wider";
const inputBaseClass =
    "w-full bg-[var(--color-surface)] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-[#2563EB] focus:bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 transition-all";

export function NovoPlanoContasModal({
    isOpen,
    onClose,
    onSave,
    title = "Nova Categoria Financeira",
    submitText = "Cadastrar Categoria",
    initialValue,
}: NovoPlanoContasModalProps) {
    const [nome, setNome] = useState(initialValue?.nome || "");
    const [tipo, setTipo] = useState<"Receita" | "Despesa">(initialValue?.tipo || "Receita");
    const [subtipo, setSubtipo] = useState<FinanceCategorySubtipo>(initialValue?.subtipo || "DESPESA_VARIAVEL");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setNome(initialValue?.nome || "");
        setTipo(initialValue?.tipo || "Receita");
        setSubtipo(initialValue?.subtipo || "DESPESA_VARIAVEL");
        setLoading(false);
    }, [isOpen, initialValue]);

    const canSubmit = useMemo(() => {
        if (loading) return false;
        return Boolean(nome.trim());
    }, [loading, nome]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;

        setLoading(true);
        try {
            onSave({ nome: nome.trim(), tipo, subtipo: tipo === "Despesa" ? subtipo : null });
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            maxWidth="max-w-md"
            title={
                <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mt-0.5">
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="leading-tight">
                        <div className="text-base font-black text-white">{title}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
                            Plano de contas e classificações
                        </div>
                    </div>
                </div>
            }
            footer={
                <>
                    <Button type="button" variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white" disabled={loading}>
                        Cancelar
                    </Button>
                    <Button type="submit" form="novo-plano-contas-form" className="bg-[#2563EB] hover:bg-blue-600 text-white font-bold px-6" disabled={!canSubmit}>
                        {loading ? "Salvando..." : submitText}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="bg-[var(--color-surface)]/40 border border-white/10 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mt-0.5">
                            <ShieldCheck className="w-4 h-4 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-200 font-bold">Instrução</p>
                            <p className="text-xs text-slate-400 leading-relaxed mt-1">
                                Defina o nome da categoria e se ela representa uma entrada (receita) ou saída (despesa).
                            </p>
                        </div>
                    </div>
                </div>

                <form id="novo-plano-contas-form" onSubmit={handleSubmit} className="space-y-4 text-left">
                    <div className="space-y-2">
                        <label htmlFor="plano-nome" className={labelClass}>Nome da Categoria</label>
                        <input id="plano-nome" value={nome} onChange={(e) => setNome(e.target.value)} className={inputBaseClass} placeholder="Ex.: Software, Aluguel, Vendas PRO" required />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="plano-tipo" className={labelClass}>Tipo</label>
                        <select id="plano-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as "Receita" | "Despesa")} className={inputBaseClass}>
                            <option value="Receita">Receita</option>
                            <option value="Despesa">Despesa</option>
                        </select>
                    </div>

                    {tipo === "Despesa" && (
                        <div className="space-y-2">
                            <label htmlFor="plano-subtipo" className={labelClass}>Linha do DRE</label>
                            <select id="plano-subtipo" value={subtipo} onChange={(e) => setSubtipo(e.target.value as FinanceCategorySubtipo)} className={inputBaseClass}>
                                {(Object.keys(SUBTIPO_LABELS) as FinanceCategorySubtipo[]).map((s) => (
                                    <option key={s} value={s}>{SUBTIPO_LABELS[s]}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </form>
            </div>
        </Modal>
    );
}