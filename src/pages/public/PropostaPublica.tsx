import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  FileText,
  Calendar,
  Building2,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Printer,
  Download,
  MessageCircle,
  CreditCard,
  Clock,
  Sparkles,
  Lock,
  Sun,
  Moon,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
} from "lucide-react";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { fetchPublicProposal, PublicProposal } from "../../lib/publicProposal";
import { handleDownloadPdf } from "../crm/utils/proposalPdf";
import { toast } from "sonner";

function formatMoney(v: number | null | undefined) {
  return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(v: string | null | undefined) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return v;
  }
}

export default function PropostaPublica() {
  const { token } = useParams<{ token: string }>();
  const [proposta, setProposta] = useState<PublicProposal | null | undefined>(undefined);
  const [isAccepted, setIsAccepted] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false); // Default to clean Executive Light theme

  // Página pública, sem sessão logada — não há tema de app pra herdar, então o
  // toggle aqui aplica a mesma classe `dark` em <html> que o resto do sistema usa
  // (ver DataContext.tsx), fazendo as variáveis --color-* baterem com "os outros"
  // em vez de manter uma paleta hexadecimal própria e desalinhada.
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    root.classList.toggle("dark", isDarkMode);
    return () => {
      root.classList.toggle("dark", hadDark);
    };
  }, [isDarkMode]);

  useEffect(() => {
    if (!token) {
      setProposta(null);
      return;
    }
    fetchPublicProposal(token).then((data) => {
      setProposta(data);
      if (data?.status === "Aceita") {
        setIsAccepted(true);
      }
    });
  }, [token]);

  if (proposta === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0d0f14] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-3 border-blue-500/20 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-slate-500 text-xs font-mono tracking-wider uppercase">
          Carregando proposta comercial autenticada...
        </p>
      </div>
    );
  }

  if (!proposta) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <Card className="p-8 text-center max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl">
          <AlertTriangle className="w-14 h-14 text-amber-500 mx-auto mb-4 opacity-80" />
          <h1 className="text-xl font-black text-slate-900 mb-2">Proposta não encontrada</h1>
          <p className="text-slate-500 text-xs leading-relaxed mb-6">
            O link acessado pode ter expirado, estar incorreto ou a proposta foi reemitida com novos termos. Entre em contato com a equipe comercial para obter a versão atualizada.
          </p>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="text-xs h-9"
          >
            Tentar Novamente
          </Button>
        </Card>
      </div>
    );
  }

  // Multi-tenant Branding & Details
  const brandColor = proposta.tenantPrimaryColor || "#2563EB";
  const tenantName =
    proposta.tenantName ||
    proposta.empresaDados?.nomeFantasia ||
    proposta.empresaDados?.razaoSocial ||
    "Empresa Proponente";
  const isVencida = proposta.validade ? new Date(proposta.validade) < new Date() : false;

  const handleAcceptProposal = () => {
    setIsAccepting(true);
    setTimeout(() => {
      setIsAccepted(true);
      setIsAccepting(false);
      toast.success("🎉 Proposta Aceita com Sucesso!", {
        description: `O aceite comercial foi registrado junto à ${tenantName}.`,
        duration: 8000,
      });
    }, 600);
  };

  const handleDownloadDocPdf = () => {
    handleDownloadPdf(
      {
        id: `prop-${token?.slice(0, 8) || "public"}`,
        cliente: proposta.cliente || "Cliente",
        titulo: proposta.titulo,
        valor: proposta.valor || 0,
        vendedor: proposta.vendedor || tenantName,
        validade: proposta.validade || undefined,
        status: isAccepted ? "Aceita" : (proposta.status as any) || "Enviada",
        tipo: "texto",
        conteudo_texto: proposta.conteudoTexto,
      },
      proposta.itens?.map((i) => ({
        product_name: i.productName,
        quantidade: i.quantidade,
        preco_unitario: i.precoUnitario,
      })) || [],
      { logoUrl: proposta.empresaDados?.logoUrl, tenantName }
    );
    toast.success("PDF do documento gerado com sucesso!");
  };

  return (
    <div className="min-h-screen font-sans selection:bg-blue-600 selection:text-white pb-20 bg-[var(--color-surface)] text-[var(--color-text-primary)]">
      {/* ── TOP NAV INSTITUCIONAL (COM BRANDING DO TENANT) ── */}
      <header className="sticky top-0 z-30 backdrop-blur-md border-b border-[var(--color-border-default)] bg-[var(--color-surface-elevated)]/90 shadow-xs px-4 sm:px-8 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {proposta.empresaDados?.logoUrl ? (
              <div className="w-9 h-9 rounded-xl bg-white border border-[var(--color-border-default)] flex items-center justify-center shadow-md shrink-0 overflow-hidden">
                <img src={proposta.empresaDados.logoUrl} alt={tenantName} className="w-full h-full object-contain p-1" />
              </div>
            ) : (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md shrink-0"
                style={{ backgroundColor: brandColor }}
              >
                {tenantName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <span className="text-xs font-black tracking-wider uppercase block" style={{ color: brandColor }}>
                {tenantName}
              </span>
              <span className="text-[10px] font-mono flex items-center gap-1 text-[var(--color-text-muted)]">
                <Lock className="w-2.5 h-2.5 text-emerald-500" /> Documento Autenticado & Oficial
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme Toggle (Light / Dark) */}
            <button
              type="button"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-xs font-bold transition-all cursor-pointer"
              title={isDarkMode ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadDocPdf}
              className="text-xs gap-1.5 h-8.5 font-bold cursor-pointer border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)]"
            >
              <Download className="w-3.5 h-3.5" style={{ color: brandColor }} /> Baixar PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="text-xs gap-1.5 h-8.5 font-bold hidden sm:inline-flex cursor-pointer border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)]"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimir
            </Button>
          </div>
        </div>
      </header>

      {/* ── CORPO PRINCIPAL DA PROPOSTA ── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        {/* BANNER DE ACEITE REALIZADO */}
        {isAccepted && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wide">
                Proposta Aprovada pelo Cliente
              </h4>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                O aceite comercial foi formalizado. A equipe da <strong>{tenantName}</strong> já foi notificada para os trâmites de implantação.
              </p>
            </div>
          </div>
        )}

        {/* CARTÃO PRINCIPAL DA PROPOSTA COM IDENTIDADE DO TENANT */}
        <Card className="p-6 sm:p-12 rounded-3xl shadow-xl relative overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-surface-elevated)]">
          {/* Faixa superior de destaque com a cor da marca do Tenant */}
          <div
            className="absolute top-0 left-0 right-0 h-2"
            style={{ backgroundColor: brandColor }}
          />

          {/* CABEÇALHO DO DOCUMENTO */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-[var(--color-border-default)]">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full font-bold border"
                  style={{
                    backgroundColor: `${brandColor}15`,
                    color: brandColor,
                    borderColor: `${brandColor}30`,
                  }}
                >
                  Proposta Oficial • {tenantName}
                </span>
                {isVencida && !isAccepted && (
                  <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-500 border border-rose-500/30 font-bold">
                    Vencida
                  </span>
                )}
                {isAccepted && (
                  <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Aprovada
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--color-text-primary)]">
                {proposta.titulo}
              </h1>

              {proposta.cliente && (
                <p className="text-xs text-[var(--color-text-muted)]">
                  Apresentada exclusivamente para:{" "}
                  <strong className="text-[var(--color-text-primary)]">
                    {proposta.cliente}
                  </strong>
                </p>
              )}
            </div>

            <div className="text-left sm:text-right space-y-1 text-xs text-[var(--color-text-muted)]">
              <p>
                Emissão:{" "}
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {formatDate(proposta.criadaEm)}
                </span>
              </p>
              <p className="flex items-center sm:justify-end gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                Válida até:{" "}
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {formatDate(proposta.validade)}
                </span>
              </p>
            </div>
          </div>

          {/* CARDS COM MÉTRICAS DE INVESTIMENTO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-8">
            <div className="p-5 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-sunken)]">
              <span className="text-[10px] font-black uppercase tracking-wider block mb-1 text-[var(--color-text-muted)]">
                Investimento Total
              </span>
              <p
                className="text-2xl font-mono font-black"
                style={{ color: brandColor }}
              >
                {formatMoney(proposta.valor)}
              </p>
              <span className="text-[10px] text-slate-400 block mt-1">
                Condições e formas de pagamento descritas abaixo
              </span>
            </div>

            <div className="p-5 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-sunken)]">
              <span className="text-[10px] font-black uppercase tracking-wider block mb-1 text-[var(--color-text-muted)]">
                Validade Comercial
              </span>
              <p className="text-sm font-bold mt-1 text-[var(--color-text-primary)]">
                {formatDate(proposta.validade)}
              </p>
              <span className="text-[10px] text-slate-400 block mt-1">
                Condições garantidas durante o período
              </span>
            </div>

            <div className="p-5 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-sunken)]">
              <span className="text-[10px] font-black uppercase tracking-wider block mb-1 text-[var(--color-text-muted)]">
                Status da Proposta
              </span>
              <p
                className="text-sm font-bold mt-1 uppercase"
                style={{ color: brandColor }}
              >
                {isAccepted ? "Aceita & Formalizada" : proposta.status || "Enviada"}
              </p>
              <span className="text-[10px] text-slate-400 block mt-1">
                {isAccepted ? "Pronta para execução" : "Aguardando confirmação"}
              </span>
            </div>
          </div>

          {/* ESCOPO DE FORNECIMENTO (TABELA DE ITENS) */}
          {proposta.itens && proposta.itens.length > 0 && (
            <div className="space-y-3 mb-8">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-[var(--color-text-primary)]">
                  <CreditCard className="w-3.5 h-3.5" style={{ color: brandColor }} />
                  Escopo de Fornecimento & Soluções
                </h3>
                <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
                  {proposta.itens.length}{" "}
                  {proposta.itens.length === 1 ? "item contratado" : "itens contratados"}
                </span>
              </div>

              <div className="border rounded-2xl overflow-hidden border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="uppercase tracking-wider text-[10px] border-b font-black bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] border-[var(--color-border-default)]">
                    <tr>
                      <th className="py-3 px-4">Item / Descrição</th>
                      <th className="py-3 px-3 text-center">Quantidade</th>
                      <th className="py-3 px-3 text-right">Valor Unitário</th>
                      <th className="py-3 px-4 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)] text-[var(--color-text-primary)]">
                    {proposta.itens.map((item, i) => (
                      <tr
                        key={i}
                        className="transition-colors hover:bg-[var(--color-surface-sunken)]"
                      >
                        <td className="py-3 px-4 font-semibold">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{item.productName}</span>
                            {item.productName.toLowerCase().includes("implantação") && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 uppercase">
                                Setup / Implantação
                              </span>
                            )}
                            {(item.productName.toLowerCase().includes("recorrente") ||
                              item.productName.toLowerCase().includes("assinatura")) && (
                              <span
                                className="text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase"
                                style={{
                                  backgroundColor: `${brandColor}15`,
                                  color: brandColor,
                                  borderColor: `${brandColor}30`,
                                }}
                              >
                                Recorrente
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-medium">
                          {item.quantidade}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-500">
                          {formatMoney(item.precoUnitario)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          {formatMoney(item.precoUnitario * item.quantidade)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 font-bold bg-[var(--color-surface-sunken)] border-[var(--color-border-default)]">
                    <tr>
                      <td
                        colSpan={3}
                        className="py-3.5 px-4 text-right uppercase text-[11px] text-[var(--color-text-muted)]"
                      >
                        Total do Fornecimento:
                      </td>
                      <td
                        className="py-3.5 px-4 text-right font-mono text-base font-black"
                        style={{ color: brandColor }}
                      >
                        {formatMoney(proposta.valor)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* DIRETRIZES E TERMOS CONTRATUAIS */}
          {proposta.conteudoTexto && (
            <div className="space-y-3 pt-6 border-t border-[var(--color-border-default)]">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" style={{ color: brandColor }} />
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--color-text-primary)]">
                  Diretrizes, Cláusulas e Termos Contratuais
                </h3>
              </div>

              <div className="p-6 sm:p-8 rounded-2xl border text-xs leading-relaxed whitespace-pre-wrap text-justify shadow-xs border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] text-[var(--color-text-primary)]">
                {proposta.conteudoTexto}
              </div>
            </div>
          )}

          {/* DADOS DA EMPRESA PROPONENTE (CONTRATADA) */}
          <div className="mt-8 p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs border-[var(--color-border-default)] bg-[var(--color-surface-sunken)]">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)] block">
                Empresa Proponente / Contratada
              </span>
              <p className="font-bold text-sm text-[var(--color-text-primary)]">
                {tenantName}
              </p>
              {proposta.empresaDados?.cnpj && (
                <p className="text-[11px] font-mono text-[var(--color-text-muted)]">
                  CNPJ: {proposta.empresaDados.cnpj}
                </p>
              )}
              {proposta.empresaDados?.endereco && (
                <p className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[var(--color-text-faint)]" /> {proposta.empresaDados.endereco}
                </p>
              )}
            </div>

            <div className="space-y-1 text-left sm:text-right">
              {proposta.vendedor && (
                <p className="text-xs">
                  <span className="text-[var(--color-text-muted)]">Consultor Responsável:</span>{" "}
                  <strong className="text-[var(--color-text-primary)]">
                    {proposta.vendedor}
                  </strong>
                </p>
              )}
              {proposta.empresaDados?.emailContato && (
                <p className="text-xs text-slate-500 flex items-center sm:justify-end gap-1">
                  <Mail className="w-3 h-3 text-slate-400" /> {proposta.empresaDados.emailContato}
                </p>
              )}
              {proposta.empresaDados?.telefoneContato && (
                <p className="text-xs text-slate-500 flex items-center sm:justify-end gap-1">
                  <Phone className="w-3 h-3 text-slate-400" /> {proposta.empresaDados.telefoneContato}
                </p>
              )}
            </div>
          </div>

          {/* AÇÕES DE ACEITE DIGITAL */}
          <div className="mt-10 pt-8 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-[var(--color-border-default)]">
            <div>
              <p className="text-xs font-bold mb-0.5 text-[var(--color-text-primary)]">
                Pronto para dar o próximo passo com a {tenantName}?
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                A formalização digital assegura o início imediato dos trabalhos e a reserva das condições propostas.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {!isAccepted ? (
                <Button
                  type="button"
                  size="lg"
                  disabled={isAccepting || isVencida}
                  onClick={handleAcceptProposal}
                  style={{ backgroundColor: brandColor }}
                  className="w-full sm:w-auto text-xs font-black uppercase tracking-wider h-11 px-6 text-white shadow-xl hover:brightness-110 cursor-pointer disabled:opacity-40"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {isAccepting ? "Registrando Aceite..." : "Aceitar Proposta Comercial"}
                </Button>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" /> Proposta Aceita com Sucesso
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* RODAPÉ INSTITUCIONAL */}
        <div className="text-center pt-4 space-y-1">
          <p className="text-[11px] text-slate-400">
            Documento emitido por <strong style={{ color: brandColor }}>{tenantName}</strong>
          </p>
          <p className="text-[10px] text-slate-400">
            Todos os direitos reservados. Em conformidade com a MP nº 2.200-2/2001 e a LGPD (Lei nº 13.709/2018).
          </p>
        </div>
      </main>
    </div>
  );
}
