import React, { useState } from 'react';
import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';

interface NovoClienteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAction: (data: Record<string, string | string[] | null>) => void;
}

interface Field {
    name: string;
    label: string;
    type: 'text' | 'email' | 'tel' | 'select' | 'multi-select' | 'textarea';
    placeholder?: string;
    required?: boolean;
    options?: string[];
    defaultValue?: string | string[];
}

const fields: Field[] = [
    { name: "nome", label: "Nome do Cliente/Empresa", type: "text", required: true, placeholder: "Ex: Vértice Innovations" },
    { name: "documento", label: "CPF/CNPJ (Opcional)", type: "text", placeholder: "Ex: 00.000.000/0000-00" },
    { name: "industry", label: "Setor / Indústria", type: "select", options: ["Tecnologia", "Engenharia", "Saúde", "Varejo", "Indústria"], required: true },
    { name: "email", label: "E-mail Principal", type: "email", required: true, placeholder: "contato@empresa.com" },
    { name: "telefone", label: "Telefone", type: "tel", required: true, placeholder: "(XX) XXXXX-XXXX" },
    // Sem defaultValue fixo — nem todo tenant fica em São Paulo (o placeholder já
    // dá o exemplo de formato sem forçar um valor real caso o usuário não mexa).
    { name: "cidade", label: "Cidade", type: "text", required: true, placeholder: "Ex: São Paulo" },
    { name: "estado", label: "Estado (Sigla)", type: "text", required: true, placeholder: "Ex: SP" },
];

export function NovoClienteModal({ isOpen, onClose, onAction }: NovoClienteModalProps) {
    const [loading, setLoading] = useState(false);

    const handleSubmit = (h: React.FormEvent<HTMLFormElement>) => {
        h.preventDefault();
        setLoading(true);
        if (onAction) {
            const f = new FormData(h.currentTarget);
            const x: Record<string, any> = {};
            fields.forEach(m => {
                m.type === "multi-select" ? x[m.name] = f.getAll(m.name) : x[m.name] = f.get(m.name);
            });
            onAction(x);
            toast.success("Dados enviados para processamento");
        }
        setLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Novo Cliente" maxWidth="max-w-md" footer={
            <Button form="action-modal-form" type="submit" className="bg-[#2563EB] hover:bg-blue-600 text-white font-bold px-6">
                {loading ? "Salvando..." : "Salvar Cliente"}
            </Button>
        }>
            <form id="action-modal-form" onSubmit={handleSubmit} className="space-y-4">
                {fields.map(field => (
                    <div key={field.name} className="space-y-2">
                        <label className="text-sm font-medium text-slate-400">{field.label}</label>
                        {field.type === "select" ? (
                            <select
                                name={field.name}
                                defaultValue={field.defaultValue}
                                className="w-full bg-[var(--color-surface)] border border-white/10 rounded-lg px-4 py-2 text-white focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                                required={field.required}
                            >
                                {field.options?.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        ) : field.type === "multi-select" ? (
                            <div className="w-full max-h-40 overflow-y-auto bg-[var(--color-surface)] border border-white/10 rounded-lg p-2 space-y-1">
                                {field.options?.map(m => {
                                    let b = false;
                                    if (Array.isArray(field.defaultValue)) b = field.defaultValue.includes(m);
                                    else if (typeof field.defaultValue === "string") b = field.defaultValue === m;
                                    return (
                                        <label key={m} className="flex items-center gap-2 p-1.5 hover:bg-white/5 rounded cursor-pointer">
                                            <input type="checkbox" name={field.name} value={m} defaultChecked={b} className="w-4 h-4 rounded border-white/20 bg-[var(--color-surface-elevated)] text-blue-500 focus:ring-blue-500/50" />
                                            <span className="text-sm text-slate-200">{m}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        ) : field.type === "textarea" ? (
                            <textarea name={field.name} defaultValue={field.defaultValue} rows={3} className="w-full bg-[var(--color-surface)] border border-white/10 rounded-lg px-4 py-2 text-white focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]" placeholder={field.placeholder} required={field.required} />
                        ) : (
                            <input name={field.name} type={field.type} defaultValue={field.defaultValue} className="w-full bg-[var(--color-surface)] border border-white/10 rounded-lg px-4 py-2 text-white focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]" placeholder={field.placeholder} required={field.required} />
                        )}
                    </div>
                ))}
            </form>
        </Modal>
    );
}