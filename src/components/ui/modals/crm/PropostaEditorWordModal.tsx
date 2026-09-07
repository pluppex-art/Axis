import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Save,
  Download,
  Link2,
  ExternalLink,
  Eye,
  Edit3,
  ShieldCheck,
  Calendar,
  CreditCard,
  Building2,
  CheckCircle2,
  X,
  Sparkles,
  Printer,
  Copy,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  HelpCircle,
} from "lucide-react";
import { Modal } from "../../modal";
import { Button } from "../../button";
import { Badge } from "../../badge";
import { toast } from "sonner";
import { useData } from "../../../../contexts/DataContext";
import { useAuth } from "../../../../contexts/AuthContext";
import { handleDownloadPdf } from "../../../../pages/crm/utils/proposalPdf";
import { cn } from "../../../../lib/utils";

export interface PropostaEditorData {
  id?: string;
  cliente: string;
  titulo: string;
  valor: number;
  validade?: string | null;
  status?: string;
  vendedor: string;
  conteudo_texto?: string | null;
  view_token?: string | null;
  itens?: Array<{
    product_name: string;
    quantidade: number;
    preco_unitario: number;
  }>;
}

interface PropostaEditorWordModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposalData: PropostaEditorData | null;
  onSaveProposal?: (data: PropostaEditorData) => Promise<void> | void;
}

const DEFAULT_TERMS_TEMPLATE = (tenantName: string) => `CLÁUSULA 1ª – DO OBJETO E ESCOPO
O presente instrumento tem por finalidade a prestação dos serviços especializados e o fornecimento das soluções discriminadas na Tabela de Itens e Escopo Financeiro deste documento, em estrita consonância com os padrões técnicos de excelência da ${tenantName}.

CLÁUSULA 2ª – DAS OBRIGAÇÕES DA CONTRATADA
A Contratada se compromete a:
a) Empregar profissionais qualificados para a perfeita execução dos serviços contratados;
b) Cumprir com presteza os prazos acordados nas reuniões de alinhamento e cronograma técnico;
c) Manter canal aberto de suporte operacional e consultivo durante todo o ciclo do projeto;
d) Comunicar previamente qualquer eventualidade que possa influenciar no cumprimento do cronograma.

CLÁUSULA 3ª – DAS OBRIGAÇÕES DO CONTRATANTE
O Contratante se compromete a:
a) Fornecer oportunamente todas as informações, credenciais e acessos necessários para a execução dos trabalhos;
b) Designar um responsável técnico ou interlocutor direto para validação de etapas e entregáveis;
c) Efetuar pontualmente os pagamentos nos termos e condições comerciais acordadas neste instrumento.

CLÁUSULA 4ª – DOS PRAZOS E VIGÊNCIA
Os serviços terão início imediato após a formalização deste instrumento e aprovação comercial, com vigência estipulada no cronograma de implantação. Eventuais alterações de escopo solicitadas pelo Contratante demandarão ajuste prévio de prazos e custos.

CLÁUSULA 5ª – DO VALOR E CONDIÇÕES DE PAGAMENTO
Pela prestação dos serviços contratados, o Contratante pagará à Contratada o valor total estipulado neste documento, conforme as condições comerciais pactuadas (via Transferência Bancária / Chave PIX Oficial ou Boleto Bancário). Em caso de atraso injustificado, incidirá multa moratória de 2% (dois por cento) sobre o saldo devedor acrescida de juros de mora legais de 1% ao mês.

CLÁUSULA 6ª – DA CONFIDENCIALIDADE E PROTEÇÃO DE DADOS (LGPD)
As partes declaram conhecer e se obrigam a cumprir as disposições da Lei Federal nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais - LGPD). Todas as informações estratégicas, financeiras, cadastrais e operacionais trocadas entre as partes serão tratadas com absoluto sigilo, sendo expressamente vedada sua divulgação a terceiros sem autorização prévia por escrito.

CLÁUSULA 7ª – DAS DISPOSIÇÕES GERAIS E FORO
O presente documento vincula as partes e seus sucessores a qualquer título. Fica eleito o Foro da Comarca da sede da Contratada para dirimir quaisquer dúvidas ou litígios oriundos deste instrumento, com renúncia expressa a qualquer outro, por mais privilegiado que seja.`;

export function PropostaEditorWordModal({
  isOpen,
  onClose,
  proposalData,
  onSaveProposal,
}: PropostaEditorWordModalProps) {
  const { updateProposal, tenantPrimaryColor, appSettings } = useData();
  const { activeTenantName } = useAuth();

  // Multi-tenant Branding & Details
  const empresaDados = appSettings?.empresa_dados || {};
  const tenantName =
    empresaDados?.nomeFantasia ||
    empresaDados?.razaoSocial ||
    activeTenantName ||
    "Empresa Proponente";
  const brandColor = tenantPrimaryColor || "#2563EB";

  // Document Fields
  const [titulo, setTitulo] = useState("");
  const [cliente, setCliente] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [valor, setValor] = useState<number>(0);
  const [validade, setValidade] = useState("");
  const [status, setStatus] = useState("Enviada");
  const [conteudoTexto, setConteudoTexto] = useState("");
  const [itens, setItens] = useState<
    Array<{ product_name: string; quantidade: number; preco_unitario: number }>
  >([]);
  const [viewToken, setViewToken] = useState<string | null>(null);

  // View state & ergonomics
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [isMaximized, setIsMaximized] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen || !proposalData) return;

    setTitulo(proposalData.titulo || "Proposta Comercial");
    setCliente(proposalData.cliente || "Cliente");
    setVendedor(proposalData.vendedor || "Consultoria Comercial");
    setValor(proposalData.valor || 0);
    setValidade(
      proposalData.validade ||
        new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    );
    setStatus(proposalData.status || "Enviada");
    setConteudoTexto(
      proposalData.conteudo_texto?.trim() || DEFAULT_TERMS_TEMPLATE(tenantName)
    );
    setItens(proposalData.itens || []);
    setViewToken(proposalData.view_token || null);
    setMode("edit");
  }, [isOpen, proposalData, tenantName]);

  if (!isOpen || !proposalData) return null;

  // Insert helper clause at cursor position
  const insertClauseAtCursor = (clauseText: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setConteudoTexto((prev) => prev + "\n\n" + clauseText);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;
    const updated =
      current.substring(0, start) +
      "\n\n" +
      clauseText +
      "\n\n" +
      current.substring(end);
    setConteudoTexto(updated);
    toast.success("Cláusula inserida no documento!");
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + clauseText.length + 4,
        start + clauseText.length + 4
      );
    }, 50);
  };

  const handleCopyPublicLink = () => {
    if (!viewToken) {
      toast.info("Link público gerado automaticamente no salvamento.");
      return;
    }
    const publicUrl = `${window.location.origin}/proposta/${viewToken}`;
    navigator.clipboard.writeText(publicUrl);
    toast.success("Link público copiado!", {
      description: "Envie este link para o cliente acompanhar e aprovar a proposta online.",
    });
  };

  const handleOpenPublicProposal = () => {
    if (!viewToken) {
      toast.info("Salve a proposta para ativar a visualização pública com token seguro.");
      return;
    }
    window.open(`/proposta/${viewToken}`, "_blank", "noopener,noreferrer");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedData: PropostaEditorData = {
        ...proposalData,
        titulo,
        cliente,
        vendedor,
        valor,
        validade,
        status,
        conteudo_texto: conteudoTexto,
        itens,
      };

      if (onSaveProposal) {
        await onSaveProposal(updatedData);
      } else if (proposalData.id && updateProposal) {
        await updateProposal(proposalData.id, {
          titulo,
          cliente,
          vendedor,
          valor,
          validade,
          status,
          conteudo_texto: conteudoTexto,
        });
      }

      toast.success("✅ Proposta salva com sucesso!", {
        description: "Diretrizes, escopo e termos contratuais sincronizados no banco de dados.",
      });
    } catch (err: any) {
      toast.error("Erro ao salvar proposta: " + err?.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPdf = () => {
    handleDownloadPdf(
      {
        id: proposalData.id || `prop-${Date.now()}`,
        cliente,
        titulo,
        valor,
        vendedor,
        validade: validade || undefined,
        status: (status as any) || "Enviada",
        tipo: "texto",
        conteudo_texto: conteudoTexto,
      },
      itens
    );
    toast.success("PDF da Proposta gerado com sucesso!");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      noPadding={true}
      maxWidth={
        isMaximized
          ? "max-w-none w-screen h-screen m-0"
          : "max-w-[1360px] w-[96vw]"
      }
      className={cn(
        "overflow-hidden flex flex-col transition-all duration-200 border",
        "bg-[var(--color-surface-elevated)] border-[var(--color-border-default)] text-[var(--color-text-primary)] shadow-2xl",
        isMaximized
          ? "fixed inset-0 h-screen max-h-screen rounded-none z-[110]"
          : "h-[92vh] max-h-[92vh] rounded-2xl"
      )}
    >
      {/* ── TOP BAR: IDENTIDADE DO DOCUMENTO + FECHAR ── */}
      <div className="px-6 pt-3.5 pb-2.5 border-b border-[var(--color-border-default)] bg-[var(--color-surface)] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-base shadow-md shrink-0"
            style={{ backgroundColor: brandColor }}
          >
            {tenantName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider" style={{ color: brandColor }}>
                {tenantName}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]">
                Editor de Contrato
              </span>
              {viewToken && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Link Público Ativo
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] truncate">
              Ambiente de Redação Contratual & Diretrizes Executivas
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl border border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)] transition-colors cursor-pointer shrink-0"
          title="Fechar Editor"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── BARRA DE FERRAMENTAS: VISUALIZAÇÃO + AÇÕES ── */}
      <div className="px-6 py-2.5 border-b border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        {/* Visualização & zoom */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="p-0.5 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] flex items-center">
            <button
              type="button"
              onClick={() => setMode("edit")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                mode === "edit"
                  ? "bg-[var(--color-primary-blue)] text-white shadow-sm"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              )}
            >
              <Edit3 className="w-3.5 h-3.5" /> Edição
            </button>
            <button
              type="button"
              onClick={() => setMode("preview")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                mode === "preview"
                  ? "bg-[var(--color-primary-blue)] text-white shadow-sm"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              )}
            >
              <Eye className="w-3.5 h-3.5" /> Visualização A4
            </button>
          </div>

          <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] text-xs font-mono font-bold">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(80, z - 10))}
              className="p-0.5 hover:text-[var(--color-primary-blue)] cursor-pointer"
              title="Reduzir Zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="w-10 text-center">{zoomLevel}%</span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
              className="p-0.5 hover:text-[var(--color-primary-blue)] cursor-pointer"
              title="Aumentar Zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all cursor-pointer"
            title={isMaximized ? "Restaurar Janela" : "Expandir em Tela Cheia"}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Ações do documento */}
        <div className="flex items-center gap-2 flex-wrap">
          {viewToken && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyPublicLink}
                title="Copiar link público para o cliente"
                className="text-xs gap-1.5 h-8.5 font-bold cursor-pointer border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)]"
              >
                <Link2 className="w-3.5 h-3.5 text-blue-500" /> Copiar Link
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenPublicProposal}
                title="Ver proposta exatamente como o cliente vê"
                className="text-xs gap-1.5 h-8.5 font-bold cursor-pointer border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)]"
              >
                <ExternalLink className="w-3.5 h-3.5 text-emerald-500" /> Ver como Cliente
              </Button>
            </>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            className="text-xs gap-1.5 h-8.5 font-bold cursor-pointer border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)]"
          >
            <Download className="w-3.5 h-3.5" /> Baixar PDF
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isSaving}
            onClick={handleSave}
            style={{ backgroundColor: brandColor }}
            className="text-xs font-black uppercase tracking-wider gap-1.5 h-8.5 px-4 text-white shadow-md hover:brightness-110 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? "Salvando..." : "Salvar Proposta"}
          </Button>
        </div>
      </div>

      {/* ── QUICK INSERT CLAUSES RIBBON ── */}
      {mode === "edit" && (
        <div className="px-6 py-2 border-b border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] flex items-center justify-between gap-2 overflow-x-auto scrollbar-none text-xs shrink-0">
          <div className="flex items-center gap-1.5 flex-nowrap">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 mr-2 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Inserir Cláusulas com 1 Clique:
            </span>

            <button
              type="button"
              onClick={() =>
                insertClauseAtCursor(
                  `CLÁUSULA – DA ASSINATURA RECORRENTE E VIGÊNCIA\nA prestação dos serviços e soluções de software sob o regime de recorrência mensal terá vigência inicial acordada neste instrumento, com faturamento periódico emitido pela ${tenantName}. A renovação se dará automaticamente por iguais períodos, assegurado o reajuste anual pelo índice oficial (IPCA/IGP-M).`
                )
              }
              className="px-2.5 py-1 rounded border border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer hover:border-[var(--color-primary-blue)] hover:text-[var(--color-primary-blue)]"
            >
              🔄 + Recorrência & Vigência
            </button>

            <button
              type="button"
              onClick={() =>
                insertClauseAtCursor(
                  `CLÁUSULA – DA TAXA DE IMPLANTAÇÃO E SETUP DO SISTEMA\nA taxa de implantação/setup inicial contempla as etapas de parametrização da plataforma, cargas de dados, homologação dos fluxos operacionais e treinamento capacitatório dos usuários designados pelo Contratante. O cronograma de implantação pela equipe da ${tenantName} se inicia imediatamente após a formalização comercial e quitação da respectiva taxa.`
                )
              }
              className="px-2.5 py-1 rounded border border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer hover:border-[var(--color-primary-blue)] hover:text-[var(--color-primary-blue)]"
            >
              🛠️ + Implantação & Setup
            </button>

            <button
              type="button"
              onClick={() =>
                insertClauseAtCursor(
                  `CLÁUSULA – DA GARANTIA TÉCNICA E SUPORTE\nA Contratada (${tenantName}) concede garantia integral sobre os serviços executados pelo período de 90 (noventa) dias corridos, garantindo assistência corretiva sem custos adicionais decorrentes de vícios técnicos de fabricação ou parametrização.`
                )
              }
              className="px-2.5 py-1 rounded border border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer hover:border-[var(--color-primary-blue)] hover:text-[var(--color-primary-blue)]"
            >
              🛡️ + Garantia & Suporte
            </button>

            <button
              type="button"
              onClick={() =>
                insertClauseAtCursor(
                  `CLÁUSULA – DA CONTA BANCÁRIA E PAGAMENTOS\nOs pagamentos referentes a esta proposta deverão ser efetuados em favor da ${tenantName} (${empresaDados?.razaoSocial || tenantName}), CNPJ: ${empresaDados?.cnpj || "00.000.000/0001-00"}.\nO comprovante de transferência deverá ser remetido ao e-mail ${empresaDados?.emailContato || "financeiro@empresa.com.br"}.`
                )
              }
              className="px-2.5 py-1 rounded border border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer hover:border-[var(--color-primary-blue)] hover:text-[var(--color-primary-blue)]"
            >
              💳 + Dados Bancários / PIX
            </button>

            <button
              type="button"
              onClick={() =>
                insertClauseAtCursor(
                  "CLÁUSULA – DOS NÍVEIS DE SERVIÇO (SLA)\nOs atendimentos de chamados e suporte obedecerão aos seguintes níveis de severidade:\n• Crítica (paralisação total): Resposta em até 2 horas e resolução em até 8 horas úteis;\n• Alta: Resposta em até 4 horas úteis;\n• Normal/Dúvidas: Resposta em até 24 horas úteis."
                )
              }
              className="px-2.5 py-1 rounded border border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer hover:border-[var(--color-primary-blue)] hover:text-[var(--color-primary-blue)]"
            >
              ⏱️ + SLAs e Suporte
            </button>

            <button
              type="button"
              onClick={() =>
                insertClauseAtCursor(
                  "CLÁUSULA – DAS TESTEMUNHAS E ASSINATURA ELETRÔNICA\nAs partes concordam expressamente que a aceitação digital desta proposta via link web ou confirmação documental possui plena validade jurídica e eficácia probatória para todos os fins de direito, nos termos da MP 2.200-2/2001."
                )
              }
              className="px-2.5 py-1 rounded border border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer hover:border-[var(--color-primary-blue)] hover:text-[var(--color-primary-blue)]"
            >
              ✍️ + Validade Digital
            </button>
          </div>

          <div className="text-[11px] text-slate-400 font-mono hidden md:block">
            {conteudoTexto.length} caracteres
          </div>
        </div>
      )}

      {/* ── DESK ENVIRONMENT / FOLHA A4 CENTRALIZADA ── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-10 scrollbar-thin bg-[var(--color-surface-sunken)]">
        {/* A4 PAPER CANVAS — sempre branca, simulando uma folha impressa independente do tema do app */}
        <div
          style={{
            transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
            transformOrigin: "top center",
          }}
          className="bg-white text-slate-900 shadow-2xl shadow-slate-400/30 rounded-sm p-8 sm:p-14 max-w-4xl mx-auto border border-slate-300/80 min-h-[1050px] relative font-sans transition-all"
        >
          {/* HEADER DO DOCUMENTO (COM IDENTIDADE DO TENANT) */}
          <div
            className="pb-5 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2"
            style={{ borderColor: brandColor }}
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-xl font-black tracking-tight"
                  style={{ color: brandColor }}
                >
                  {tenantName.toUpperCase()}
                </span>
                <span
                  className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border"
                  style={{
                    backgroundColor: `${brandColor}15`,
                    color: brandColor,
                    borderColor: `${brandColor}30`,
                  }}
                >
                  Documento Comercial Oficial
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {empresaDados?.razaoSocial || "Sistema Integrado de Gestão & Contratos Comerciais"}
              </p>
            </div>

            <div className="text-left sm:text-right space-y-0.5 text-xs text-slate-600">
              <p className="font-bold text-slate-800">
                PROPOSTA REF:{" "}
                <span className="font-mono" style={{ color: brandColor }}>
                  PROP-{proposalData.id?.slice(0, 8) || "NOVA"}
                </span>
              </p>
              <p>
                Data de Emissão:{" "}
                <span className="font-medium text-slate-700">
                  {new Date().toLocaleDateString("pt-BR")}
                </span>
              </p>
              <p>
                Status:{" "}
                <span className="font-bold text-emerald-600 uppercase">
                  {status}
                </span>
              </p>
            </div>
          </div>

          {/* DADOS CADASTRAIS (EDITÁVEIS) */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                Identificação do Cliente (Contratante)
              </span>
              {mode === "edit" ? (
                <input
                  type="text"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="Nome do Cliente / Razão Social"
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-bold text-slate-900 text-sm focus:outline-none focus:border-blue-600 shadow-xs"
                />
              ) : (
                <p className="text-base font-bold text-slate-900">{cliente}</p>
              )}
            </div>

            <div>
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                Título do Projeto / Objeto
              </span>
              {mode === "edit" ? (
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Título da Proposta"
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-bold text-slate-900 text-sm focus:outline-none focus:border-blue-600 shadow-xs"
                />
              ) : (
                <p className="text-base font-bold text-slate-900">{titulo}</p>
              )}
            </div>

            <div>
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                Consultor Responsável (Proponente)
              </span>
              {mode === "edit" ? (
                <input
                  type="text"
                  value={vendedor}
                  onChange={(e) => setVendedor(e.target.value)}
                  placeholder="Nome do Consultor"
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 font-medium text-slate-800 focus:outline-none focus:border-blue-600 shadow-xs"
                />
              ) : (
                <p className="font-semibold text-slate-800">{vendedor}</p>
              )}
            </div>

            <div>
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                Vigência / Validade da Proposta
              </span>
              {mode === "edit" ? (
                <input
                  type="date"
                  value={validade}
                  onChange={(e) => setValidade(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 font-medium text-slate-800 focus:outline-none focus:border-blue-600 shadow-xs"
                />
              ) : (
                <p className="font-semibold text-slate-800">
                  {validade
                    ? new Date(validade).toLocaleDateString("pt-BR")
                    : "15 dias a contar da emissão"}
                </p>
              )}
            </div>
          </div>

          {/* TABELA DE PRODUTOS E ESCOPO FINANCEIRO */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" style={{ color: brandColor }} />
                Escopo Financeiro & Itens de Fornecimento
              </h4>
              <span className="text-[11px] text-slate-500 font-mono">
                {itens.length} {itens.length === 1 ? "item contratado" : "itens contratados"}
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-black uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Item / Solução</th>
                    <th className="py-2.5 px-3 text-center">Qtd</th>
                    <th className="py-2.5 px-3 text-right">Preço Unit.</th>
                    <th className="py-2.5 px-4 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {itens.length > 0 ? (
                    itens.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-slate-900">
                          {item.product_name}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          {item.quantidade}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          R$ {item.preco_unitario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                          R$ {(item.quantidade * item.preco_unitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400 italic">
                        Nenhum produto cadastrado nesta proposta.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                  <tr>
                    <td colSpan={3} className="py-3 px-4 text-right uppercase text-[11px] text-slate-600">
                      Investimento Total da Proposta:
                    </td>
                    <td
                      className="py-3 px-4 text-right font-mono text-base font-black"
                      style={{ color: brandColor }}
                    >
                      R$ {valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* DIRETRIZES E TERMOS CONTRATUAIS (O "WORD" PRINCIPAL) */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" style={{ color: brandColor }} />
                Diretrizes, Cláusulas e Termos Contratuais
              </h4>
              <span className="text-[10px] text-slate-400">
                {mode === "edit"
                  ? "Edite o texto diretamente na área abaixo"
                  : "Documento formatado para leitura oficial"}
              </span>
            </div>

            {mode === "edit" ? (
              <textarea
                ref={textareaRef}
                value={conteudoTexto}
                onChange={(e) => setConteudoTexto(e.target.value)}
                rows={18}
                placeholder="Insira as cláusulas, termos, condições e diretrizes desta proposta..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-5 text-xs font-sans text-slate-800 leading-relaxed focus:outline-none focus:border-blue-600 focus:bg-white transition-all resize-y shadow-xs"
              />
            ) : (
              <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-6 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-sans text-justify">
                {conteudoTexto}
              </div>
            )}
          </div>

          {/* TERMO DE ACEITE E ASSINATURAS */}
          <div className="mt-12 pt-8 border-t-2 border-slate-200">
            <p className="text-center text-[11px] text-slate-500 mb-10 italic">
              E por estarem justas e contratadas, as partes firmam o presente termo para que produza todos os efeitos legais.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 text-center text-xs">
              <div>
                <div className="border-t border-slate-400 pt-2 w-3/4 mx-auto">
                  <p className="font-bold text-slate-900">{cliente}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">CONTRATANTE</p>
                </div>
              </div>

              <div>
                <div className="border-t border-slate-400 pt-2 w-3/4 mx-auto">
                  <p className="font-bold text-slate-900">{vendedor}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    {tenantName.toUpperCase()} (CONTRATADA)
                  </p>
                  {empresaDados?.cnpj && (
                    <p className="text-[9px] text-slate-400 font-mono">
                      CNPJ: {empresaDados.cnpj}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
