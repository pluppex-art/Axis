import { useMemo, useState } from "react";
import { Card } from "../card";
import { Button } from "../button";
import { Badge } from "../badge";
import { FileText, Plus, Edit3, Check, Package } from "lucide-react";
import { toast } from "sonner";
import { useData } from "../../../contexts/DataContext";
import { useLocalization } from "../../../contexts/LocalizationContext";
import { handleDownloadPdf } from "../../../pages/crm/utils/proposalPdf";
import { PropostaEditorWordModal, PropostaEditorData } from "../modals/crm/PropostaEditorWordModal";
import { AddProdutoLeadModal } from "../modals/crm/AddProdutoLeadModal";
import { cn } from "../../../lib/utils";

interface ProductsSectionProps {
  availableProducts: any[];
  seller: string;
  setAlterationLogs: any;
  leadName?: string;
  companyName?: string;
  leadId?: string;
}

/**
 * Antes era o "Mini PDV & Orçamento": composição comercial/margem, recorrência e taxa de
 * implantação por item, catálogo inteiro pra buscar/clicar, tudo dentro do Lead Detalhes —
 * informação e controles demais pra quem só quer registrar um produto vendido. Substituído
 * por um botão único ("+ Novo Produto") que abre AddProdutoLeadModal — mesma automação de
 * fechamento de venda de antes (proposta + financeiro + lead), sem a interface de PDV aqui
 * dentro. O que sobra nesta tela é só status: a proposta comercial já vinculada ao lead, se
 * houver.
 */
export function ProductsSection({
  availableProducts = [],
  seller,
  setAlterationLogs,
  leadName,
  companyName,
  leadId,
}: ProductsSectionProps) {
  const { updateProposal, proposals, proposalItems, appSettings } = useData();
  const empresaDadosBranding = appSettings?.empresa_dados || {};
  const { formatCurrency } = useLocalization();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isWordModalOpen, setIsWordModalOpen] = useState(false);
  const [currentProposalData, setCurrentProposalData] = useState<PropostaEditorData | null>(null);

  const existingProposal = useMemo(() => {
    if (!leadId) return null;
    const linked = (proposals || []).filter((p: any) => p.lead_id === leadId);
    if (linked.length === 0) return null;
    return [...linked].sort((a: any, b: any) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    )[0];
  }, [proposals, leadId]);

  const existingProposalItems = useMemo(() => {
    if (!existingProposal) return [];
    return (proposalItems || []).filter((pi: any) => pi.proposal_id === existingProposal.id);
  }, [proposalItems, existingProposal]);

  const PROPOSAL_STATUS_VARIANT: Record<string, "success" | "info" | "warning" | "destructive" | "secondary"> = {
    Aceita: "success",
    Enviada: "info",
    Aberta: "warning",
    Recusada: "destructive",
  };
  const isProposalAccepted = existingProposal?.status === "Aceita";

  const handleOpenExistingProposal = () => {
    if (!existingProposal) return;
    setCurrentProposalData({
      id: existingProposal.id,
      cliente: existingProposal.cliente,
      titulo: existingProposal.titulo,
      valor: existingProposal.valor,
      validade: existingProposal.validade,
      status: existingProposal.status,
      vendedor: existingProposal.vendedor,
      conteudo_texto: existingProposal.conteudo_texto,
      view_token: existingProposal.view_token,
      itens: existingProposalItems.map((i: any) => ({
        product_name: i.product_name,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
      })),
    });
    setIsWordModalOpen(true);
  };

  const handleDownloadExistingProposalPdf = () => {
    if (!existingProposal) return;
    handleDownloadPdf(
      {
        id: existingProposal.id,
        cliente: existingProposal.cliente,
        titulo: existingProposal.titulo,
        valor: existingProposal.valor,
        validade: existingProposal.validade,
        vendedor: existingProposal.vendedor || seller || "Consultor S.P.Y.",
        status: existingProposal.status || "Aceita",
      },
      existingProposalItems.map((p: any) => ({
        product_name: p.product_name,
        quantidade: p.quantidade,
        preco_unitario: p.preco_unitario,
      })),
      { logoUrl: empresaDadosBranding?.logoUrl }
    );
    toast.success("PDF da proposta gerado com sucesso!");
  };

  const handleAddProdutoDone = (summary: string) => {
    setAlterationLogs((prev: any[]) => [
      { id: Date.now().toString(), author: seller || "Sistema", desc: summary, time: "Agora" },
      ...prev,
    ]);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {existingProposal && (
        <Card className={cn(
          "p-4 bg-[var(--color-surface-elevated)] shadow-sm space-y-3",
          isProposalAccepted ? "border border-emerald-500/30 bg-emerald-500/[0.03]" : "border border-blue-500/25"
        )}>
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <FileText className={cn("w-3.5 h-3.5", isProposalAccepted ? "text-emerald-400" : "text-blue-400")} />
              Proposta Comercial Vinculada
            </span>
            <Badge
              variant={PROPOSAL_STATUS_VARIANT[existingProposal.status] || "secondary"}
              className="text-[10px] font-bold px-2 py-0.5"
            >
              {existingProposal.status || "—"}
            </Badge>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{existingProposal.titulo}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {existingProposalItems.length} {existingProposalItems.length === 1 ? "item" : "itens"}
                {existingProposal.validade && (
                  <> · Válida até {new Date(existingProposal.validade + "T12:00:00").toLocaleDateString("pt-BR")}</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <span className="text-sm font-mono font-black text-emerald-400">
                {formatCurrency(existingProposal.valor || 0)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenExistingProposal}
                className="h-8 text-xs font-bold gap-1.5 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-300 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" /> Ver / Editar Proposta
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadExistingProposalPdf}
                className="h-8 text-xs font-bold gap-1.5 border-blue-500/30 hover:bg-blue-500/10 text-blue-300 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" /> Baixar PDF
              </Button>
            </div>
          </div>

          {isProposalAccepted && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Proposta Aceita & Venda Fechada!</strong> O contrato está ativado e as faturas foram provisionadas no financeiro.
              </span>
            </div>
          )}

          {isProposalAccepted && existingProposalItems.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-white/5">
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Itens da Proposta Aprovada:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto scrollbar-thin">
                {existingProposalItems.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-[var(--color-surface-sunken)] border border-white/5">
                    <span className="text-slate-300 font-medium truncate text-[11px]">{item.product_name}</span>
                    <span className="font-mono text-emerald-400 text-[11px] font-bold shrink-0 ml-2">
                      {item.quantidade}x {formatCurrency(item.preco_unitario)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      <Card className="p-6 bg-[var(--color-surface-elevated)] border border-dashed border-[var(--color-border-subtle)] text-center flex flex-col items-center justify-center gap-2.5">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-blue)]/10 text-[var(--color-primary-blue)] flex items-center justify-center">
          <Package className="w-5 h-5" />
        </div>
        <p className="text-xs font-bold text-[var(--color-text-primary)]">Adicionar um produto a este cliente</p>
        <p className="text-[11px] text-[var(--color-text-muted)] max-w-sm">
          Gera a proposta, lança o valor no financeiro e atualiza o lead automaticamente.
        </p>
        <Button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="text-xs font-bold gap-1.5 mt-1"
        >
          <Plus className="w-3.5 h-3.5" /> Novo Produto
        </Button>
      </Card>

      <AddProdutoLeadModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        availableProducts={availableProducts}
        leadId={leadId}
        leadName={leadName}
        companyName={companyName}
        seller={seller}
        onDone={handleAddProdutoDone}
      />

      <PropostaEditorWordModal
        isOpen={isWordModalOpen}
        onClose={() => setIsWordModalOpen(false)}
        proposalData={currentProposalData}
        onSaveProposal={async (updated) => {
          setCurrentProposalData(updated);
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
    </div>
  );
}
