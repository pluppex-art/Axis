import { useState } from "react";
import { Card } from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { EmptyState } from "../../../../components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../../../../components/ui/table";
import {
  FileText, Search, Clock, CheckCircle2, XCircle, User, Download, Trash2, History, Send, Link2, Eye, Edit3,
} from "lucide-react";
import { toast } from "sonner";
import { handleDownloadPdf } from "../../utils/proposalPdf";
import { confirmDialog } from "../../../../components/ui/confirm-dialog";
import {
  PropostaEditorWordModal,
  PropostaEditorData,
} from "../../../../components/ui/modals/crm/PropostaEditorWordModal";

interface Proposta {
  id: string;
  cliente: string;
  titulo: string;
  valor: number;
  created_at?: string;
  validade?: string;
  status: "Aceita" | "Enviada" | "Aberta" | "Recusada" | string;
  vendedor: string;
  tipo?: "itens" | "texto" | "arquivo";
  conteudo_texto?: string | null;
  link_pdf?: string | null;
  view_token?: string | null;
  view_count?: number;
  last_viewed_at?: string | null;
}

const TIPO_LABEL: Record<string, string> = { itens: "Modelo", texto: "Texto", arquivo: "Arquivo" };

interface PropostaItem {
  proposal_id: string;
  product_id: string | null;
  product_name: string;
  quantidade: number;
  preco_unitario: number;
}

const fmtCurrency = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const STATUS_CONFIG = {
  Aceita:   { variant: "success" as const, icon: CheckCircle2 },
  Enviada:  { variant: "info" as const, icon: Send },
  Aberta:   { variant: "warning" as const, icon: Clock },
  Recusada: { variant: "destructive" as const, icon: XCircle },
};
const DEFAULT_STATUS = { variant: "secondary" as const, icon: History };

interface PropostasTableProps {
  propostas: Proposta[];
  proposalItems: PropostaItem[];
  search: string;
  onSearchChange: (v: string) => void;
  onUpdateStatus: (id: string, status: Proposta["status"]) => void;
  onDelete: (id: string) => void;
  updateProposal?: (id: string, updates: any) => Promise<void> | void;
}

export function PropostasTable({ propostas, proposalItems, search, onSearchChange, onUpdateStatus, onDelete, updateProposal }: PropostasTableProps) {
  const [editingProposal, setEditingProposal] = useState<PropostaEditorData | null>(null);
  const [isWordModalOpen, setIsWordModalOpen] = useState(false);

  const filtered = propostas.filter(p =>
    (p.cliente || "").toLowerCase().includes(search.toLowerCase()) ||
    p.titulo.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Card className="p-4 flex flex-col md:flex-row gap-4 items-center mb-6">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por cliente ou título..."
            className="w-full pl-12 h-12 rounded-xl text-sm italic"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => toast.info("Filtros extras ativados automaticamente para seller ativo.")}
            className="text-[10px] font-black uppercase tracking-widest"
          >
            Filtros Avançados
          </Button>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhuma proposta encontrada"
          description="Ajuste a busca ou crie uma nova proposta"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente / Título</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Datas</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item) => {
              const status = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] || DEFAULT_STATUS;
              const itens = proposalItems.filter(pi => pi.proposal_id === item.id);
              return (
                <TableRow key={item.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-sunken)] flex items-center justify-center text-[var(--color-text-muted)] group-hover:text-[var(--color-primary-blue)] transition-colors">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <div className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-tight">{item.cliente}</div>
                          {item.tipo && item.tipo !== "itens" && (
                            <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-[var(--color-surface-sunken)] text-[var(--color-text-faint)]">
                              {TIPO_LABEL[item.tipo]}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] italic">{item.titulo}</div>
                        {itens.length > 0 && (
                          <div className="text-[10px] text-[var(--color-text-faint)] mt-0.5 truncate max-w-[220px]">
                            {itens.map(i => `${i.quantidade}x ${i.product_name}`).join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-black text-[var(--color-text-primary)]">{fmtCurrency(item.valor)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={status.variant} className="font-black uppercase tracking-widest text-[9px] px-2.5 py-1 flex items-center gap-1.5 w-fit">
                        <status.icon className="w-3 h-3" />
                        {item.status}
                      </Badge>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button onClick={() => onUpdateStatus(item.id, "Aceita")} className="px-1.5 py-0.5 text-[8px] font-extrabold uppercase bg-success/10 text-success rounded hover:bg-success/20">Aceitar</button>
                        <button onClick={() => onUpdateStatus(item.id, "Recusada")} className="px-1.5 py-0.5 text-[8px] font-extrabold uppercase bg-danger/10 text-danger rounded hover:bg-danger/20">Recusar</button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-[10px] font-bold text-[var(--color-text-muted)]">Criada: {fmtDate(item.created_at)}</div>
                    <div className="text-[10px] font-bold text-danger">Venc: {fmtDate(item.validade)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-[var(--color-primary-blue)]/10 flex items-center justify-center">
                        <User className="w-3 h-3 text-[var(--color-primary-blue)]" />
                      </div>
                      <span className="text-xs font-bold text-[var(--color-text-muted)]">{item.vendedor}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {item.view_token && (
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/proposta/${item.view_token}`;
                            navigator.clipboard.writeText(url);
                            toast.success("Link público copiado! Envie para o cliente acompanhar a proposta.");
                          }}
                          title={item.view_count ? `Link público — visualizado ${item.view_count}x` : "Copiar link público"}
                          className="p-2 bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-primary-blue)] hover:bg-[var(--color-primary-blue)]/10 rounded-lg transition-colors relative"
                        >
                          <Link2 className="w-4 h-4" />
                          {!!item.view_count && (
                            <span className="absolute -top-1 -right-1 flex items-center gap-0.5 text-[8px] font-black bg-emerald-500 text-white rounded-full px-1">
                              <Eye className="w-2 h-2" />{item.view_count}
                            </span>
                          )}
                        </button>
                      )}
                        <button
                          onClick={() => {
                            setEditingProposal({
                              id: item.id,
                              cliente: item.cliente,
                              titulo: item.titulo,
                              valor: item.valor,
                              validade: item.validade,
                              status: item.status,
                              vendedor: item.vendedor,
                              conteudo_texto: item.conteudo_texto,
                              view_token: item.view_token,
                              itens: itens.map((i) => ({
                                product_name: i.product_name,
                                quantidade: i.quantidade,
                                preco_unitario: i.preco_unitario,
                              })),
                            });
                            setIsWordModalOpen(true);
                          }}
                          title="Visualizar / Editar no Modo Word (Diretrizes e Contrato)"
                          className="p-2 bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => item.tipo === "arquivo" && item.link_pdf
                            ? window.open(item.link_pdf, "_blank", "noopener,noreferrer")
                            : handleDownloadPdf(item as any, itens)}
                          title={item.tipo === "arquivo" ? "Abrir Arquivo Anexado" : "Baixar Contrato (PDF)"}
                          className="p-2 bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-primary-blue)] hover:bg-[var(--color-primary-blue)]/10 rounded-lg transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            if (await confirmDialog({
                              title: "Excluir proposta",
                              description: `Excluir a proposta "${item.titulo}" (${item.cliente})? Essa ação não pode ser desfeita.`,
                              confirmText: "Excluir",
                            })) onDelete(item.id);
                          }}
                          title="Deletar Proposta"
                          className="p-2 bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                        >

                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      <PropostaEditorWordModal
        isOpen={isWordModalOpen}
        onClose={() => setIsWordModalOpen(false)}
        proposalData={editingProposal}
        onSaveProposal={async (updated) => {
          setEditingProposal(updated);
          if (updated.id && updateProposal) {
            await updateProposal(updated.id, {
              titulo: updated.titulo,
              cliente: updated.cliente,
              vendedor: updated.vendedor,
              valor: updated.valor,
              validade: updated.validade,
              status: updated.status,
              conteudo_texto: updated.conteudo_texto,
            });
          }
        }}
      />
    </>
  );
}
