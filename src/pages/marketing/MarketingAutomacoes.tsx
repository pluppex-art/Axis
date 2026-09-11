import { useState, useMemo } from "react";
import {
  Zap, Search, Plus, Play,
  Users, Mail,
  BarChart3, Pause, Trash2,
  MousePointer2, Edit3, MessageCircle, Clock, Send, Sparkles, CheckCircle2, ChevronRight, Copy
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Modal } from "../../components/ui/modal";
import { confirmDialog } from "../../components/ui/confirm-dialog";
import { toast } from "sonner";
import { PageContainer } from "../../components/PageContainer";
import { useData } from "../../contexts/DataContext";
import { cn } from "../../lib/utils";

interface AutomationStep {
  id: string;
  type: "whatsapp" | "email" | "delay";
  title: string;
  content?: string;
  subject?: string;
  delayHours?: number;
}

interface Automation {
  id: string;
  name: string;
  trigger: string | null;
  channel?: "whatsapp" | "email" | "misto";
  steps: number;
  stepsData?: AutomationStep[];
  active_count: number;
  conversion_rate: number;
  status: "Ativa" | "Pausada" | "Rascunho";
  last_run: string | null;
}

const DEFAULT_STEPS: AutomationStep[] = [
  {
    id: "s1",
    type: "whatsapp",
    title: "Mensagem Inicial WhatsApp",
    content: "Olá {nome}! Obrigado pelo interesse. Recebemos seu cadastro e nossa equipe já está analisando seu perfil.",
  },
  {
    id: "s2",
    type: "delay",
    title: "Aguardar Intervalo",
    delayHours: 2,
  },
  {
    id: "s3",
    type: "email",
    title: "Apresentação & Material por E-mail",
    subject: "Bem-vindo ao Axis — Seu material exclusivo",
    content: "Prezado(a) {nome},\n\nSegue o material completo com nossas soluções e tabela de investimento.\n\nAtenciosamente,\nEquipe Comercial",
  }
];

export default function MarketingAutomacoes() {
  const { marketingAutomations, addMarketingAutomation, updateMarketingAutomation, deleteMarketingAutomation } = useData();
  const automations = (marketingAutomations || []) as Automation[];

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selectedChannelFilter, setSelectedChannelFilter] = useState<string>("Todos");

  // Modal State (Create & Edit)
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [flowName, setFlowName] = useState("");
  const [flowTrigger, setFlowTrigger] = useState("Novo Lead Cadastrado");
  const [flowChannel, setFlowChannel] = useState<"whatsapp" | "email" | "misto">("whatsapp");
  const [flowStatus, setFlowStatus] = useState<"Ativa" | "Pausada" | "Rascunho">("Ativa");
  const [flowSteps, setFlowSteps] = useState<AutomationStep[]>(DEFAULT_STEPS);

  // Stats calculation
  const totalLeads = useMemo(() => automations.reduce((s, a) => s + (a.active_count || 0), 0), [automations]);
  const avgConversion = useMemo(() => {
    if (automations.length === 0) return 0;
    return (automations.reduce((s, a) => s + (a.conversion_rate || 0), 0) / automations.length).toFixed(1);
  }, [automations]);

  const openCreateModal = () => {
    setEditingId(null);
    setFlowName("");
    setFlowTrigger("Novo Lead Cadastrado");
    setFlowChannel("whatsapp");
    setFlowStatus("Ativa");
    setFlowSteps(DEFAULT_STEPS);
    setIsEditorModalOpen(true);
  };

  const openEditModal = (auto: Automation) => {
    setEditingId(auto.id);
    setFlowName(auto.name);
    setFlowTrigger(auto.trigger || "Novo Lead Cadastrado");
    setFlowChannel(auto.channel || "whatsapp");
    setFlowStatus(auto.status);
    setFlowSteps(auto.stepsData || DEFAULT_STEPS);
    setIsEditorModalOpen(true);
  };

  const handleSaveAutomation = () => {
    if (!flowName.trim()) {
      toast.error("Preencha o nome da automação.");
      return;
    }

    if (editingId) {
      updateMarketingAutomation(editingId, {
        name: flowName.trim(),
        trigger: flowTrigger,
        channel: flowChannel,
        status: flowStatus,
        steps: flowSteps.length,
        stepsData: flowSteps,
      });
      toast.success(`Fluxo "${flowName}" atualizado com sucesso!`);
    } else {
      addMarketingAutomation({
        id: Math.random().toString(36).substring(7),
        name: flowName.trim(),
        trigger: flowTrigger,
        channel: flowChannel,
        steps: flowSteps.length,
        stepsData: flowSteps,
        active_count: 0,
        conversion_rate: 0,
        status: flowStatus,
        last_run: null,
      });
      toast.success("✨ Nova régua de automação criada!");
    }

    setIsEditorModalOpen(false);
  };

  const toggleStatus = (id: string) => {
    const a = automations.find(a => a.id === id);
    if (a) {
      const nextStatus = a.status === "Ativa" ? "Pausada" : "Ativa";
      updateMarketingAutomation(id, { status: nextStatus });
      toast.success(`Automação "${a.name}" ${nextStatus === "Ativa" ? "ativada" : "pausada"}`);
    }
  };

  const handleSimulateExecution = (auto: Automation) => {
    const nextCount = (auto.active_count || 0) + 1;
    const nextRate = Math.min(100, (auto.conversion_rate || 15) + (Math.random() * 2));
    updateMarketingAutomation(auto.id, {
      active_count: nextCount,
      conversion_rate: parseFloat(nextRate.toFixed(1)),
      last_run: "Hoje às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    });
    toast.success(`⚡ Simulação executada para "${auto.name}"!`, {
      description: `Disparou via ${auto.channel === "whatsapp" ? "WhatsApp" : auto.channel === "email" ? "E-mail" : "WhatsApp & E-mail"}.`,
    });
  };

  const handleAddStep = (type: "whatsapp" | "email" | "delay") => {
    const newStep: AutomationStep = {
      id: crypto.randomUUID(),
      type,
      title: type === "whatsapp" ? "Disparo WhatsApp" : type === "email" ? "Envio de E-mail" : "Espera / Delay",
      content: type === "whatsapp" ? "Olá {nome}, tudo bem? Podemos conversar hoje?" : type === "email" ? "Prezado(a) {nome},\n\nGostaria de compartilhar novidades..." : undefined,
      subject: type === "email" ? "Follow-up Comercial" : undefined,
      delayHours: type === "delay" ? 4 : undefined,
    };
    setFlowSteps(prev => [...prev, newStep]);
  };

  const handleRemoveStep = (index: number) => {
    setFlowSteps(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateStep = (index: number, updates: Partial<AutomationStep>) => {
    setFlowSteps(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const filtered = automations.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.trigger || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !activeFilter || a.status === activeFilter;
    const matchesChannel = selectedChannelFilter === "Todos" || a.channel === selectedChannelFilter || (!a.channel && selectedChannelFilter === "whatsapp");
    return matchesSearch && matchesStatus && matchesChannel;
  });

  return (
    <PageContainer
      title="Central de Automações S.P.Y."
      description="Crie réguas multicanal inteligentes via WhatsApp e E-mail disparadas por eventos do CRM."
      actions={
        <div className="flex items-center gap-3">
          <Button
            onClick={openCreateModal}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white h-10 px-5 rounded-xl font-black uppercase tracking-wider text-[10px] shadow-lg shadow-purple-600/25 cursor-pointer gap-2"
          >
            <Plus className="w-4 h-4" /> Criar Fluxo Automatizado
          </Button>
        </div>
      }
    >
      <div className="space-y-8 pb-20">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 bg-[var(--color-surface-elevated)] border border-white/5 backdrop-blur-md">
            <Users className="w-5 h-5 text-indigo-400 mb-3" />
            <div className="text-2xl font-black text-white font-mono mb-1">{totalLeads}</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Leads Impactados</div>
          </Card>

          <Card className="p-5 bg-[var(--color-surface-elevated)] border border-white/5 backdrop-blur-md">
            <MessageCircle className="w-5 h-5 text-emerald-400 mb-3" />
            <div className="text-2xl font-black text-emerald-400 font-mono mb-1">
              {automations.filter(a => a.channel === "whatsapp" || a.channel === "misto" || !a.channel).length}
            </div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fluxos WhatsApp Ativos</div>
          </Card>

          <Card className="p-5 bg-[var(--color-surface-elevated)] border border-white/5 backdrop-blur-md">
            <Mail className="w-5 h-5 text-blue-400 mb-3" />
            <div className="text-2xl font-black text-blue-400 font-mono mb-1">
              {automations.filter(a => a.channel === "email" || a.channel === "misto").length}
            </div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fluxos E-mail Ativos</div>
          </Card>

          <Card className="p-5 bg-[var(--color-surface-elevated)] border border-white/5 backdrop-blur-md">
            <BarChart3 className="w-5 h-5 text-amber-400 mb-3" />
            <div className="text-2xl font-black text-amber-400 font-mono mb-1">{avgConversion}%</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Taxa de Conversão Média</div>
          </Card>
        </div>

        {/* Barra de Filtros e Busca */}
        <Card className="p-4 bg-[var(--color-surface-elevated)] border border-white/5 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, gatilho ou mensagem..."
              className="w-full bg-[var(--color-surface-sunken)] border-white/10 pl-12 h-11 rounded-xl text-xs text-white focus:border-purple-500/50"
            />
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            {/* Filtro de Canal */}
            <div className="flex bg-[var(--color-surface-sunken)] border border-white/10 rounded-xl p-0.5 text-[10px] font-bold">
              {["Todos", "whatsapp", "email", "misto"].map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setSelectedChannelFilter(ch)}
                  className={cn(
                    "px-2.5 py-1.5 rounded-lg capitalize transition-all cursor-pointer",
                    selectedChannelFilter === ch
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  {ch === "whatsapp" ? "WhatsApp" : ch === "email" ? "E-mail" : ch === "misto" ? "Misto" : "Todos"}
                </button>
              ))}
            </div>

            {/* Filtro de Status */}
            <button
              onClick={() => setActiveFilter(activeFilter === "Ativa" ? null : "Ativa")}
              className={`h-9 px-3 rounded-xl cursor-pointer transition-all border text-[10px] uppercase tracking-wider font-bold ${
                activeFilter === "Ativa"
                  ? "bg-emerald-600 text-white border-emerald-500"
                  : "bg-white/5 text-slate-400 hover:text-white border-white/10"
              }`}
            >
              Ativas
            </button>
            <button
              onClick={() => setActiveFilter(activeFilter === "Pausada" ? null : "Pausada")}
              className={`h-9 px-3 rounded-xl cursor-pointer transition-all border text-[10px] uppercase tracking-wider font-bold ${
                activeFilter === "Pausada"
                  ? "bg-amber-600 text-white border-amber-500"
                  : "bg-white/5 text-slate-400 hover:text-white border-white/10"
              }`}
            >
              Pausadas
            </button>
          </div>
        </Card>

        {/* Grid de Automações */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((item) => {
            const isWhatsApp = item.channel === "whatsapp" || (!item.channel && true);
            const isEmail = item.channel === "email";
            const isMisto = item.channel === "misto";

            return (
              <Card
                key={item.id}
                className={cn(
                  "p-5 rounded-2xl border transition-all space-y-4",
                  item.status === "Pausada"
                    ? "bg-[var(--color-surface-elevated)]/40 border-white/5 opacity-80"
                    : "bg-[var(--color-surface-elevated)] border-white/10 hover:border-purple-500/40 shadow-sm"
                )}
              >
                {/* Cabeçalho do Card */}
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm",
                      isWhatsApp ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" :
                      isEmail ? "bg-blue-500/15 border-blue-500/30 text-blue-400" :
                      "bg-purple-500/15 border-purple-500/30 text-purple-400"
                    )}>
                      {isWhatsApp ? <MessageCircle className="w-5 h-5" /> : isEmail ? <Mail className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-white truncate">{item.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-purple-400" /> {item.trigger}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge className={cn(
                      "text-[9px] font-bold px-2 py-0.5 border",
                      isWhatsApp ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                      isEmail ? "bg-blue-500/10 text-blue-400 border-blue-500/30" :
                      "bg-purple-500/10 text-purple-400 border-purple-500/30"
                    )}>
                      {isWhatsApp ? "WhatsApp" : isEmail ? "E-mail" : "Misto"}
                    </Badge>

                    <Badge className={cn(
                      "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 border",
                      item.status === "Ativa" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                      item.status === "Pausada" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                      "bg-slate-500/10 text-slate-400 border-slate-500/30"
                    )}>
                      {item.status}
                    </Badge>
                  </div>
                </div>

                {/* Métricas do Fluxo */}
                <div className="grid grid-cols-3 gap-2 font-mono text-center">
                  <div className="p-2.5 rounded-xl bg-black/20 border border-white/5">
                    <span className="text-[8px] font-bold text-slate-500 uppercase block">Etapas</span>
                    <span className="text-base font-black text-white">{item.steps || item.stepsData?.length || 1}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/20 border border-white/5">
                    <span className="text-[8px] font-bold text-slate-500 uppercase block">Leads Ativos</span>
                    <span className="text-base font-black text-indigo-300">{item.active_count || 0}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/20 border border-white/5">
                    <span className="text-[8px] font-bold text-slate-500 uppercase block">Conversão</span>
                    <span className="text-base font-black text-emerald-400">{(item.conversion_rate || 0).toFixed(1)}%</span>
                  </div>
                </div>

                {/* Rodapé do Card com Ações (incluindo o Botão de Editar solicitado) */}
                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <span className="text-[10px] text-slate-500 font-mono truncate">
                    Último disparo: {item.last_run || "Não executado"}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {/* Botão de Simular Disparo */}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleSimulateExecution(item)}
                      className="h-8 px-2.5 text-[10px] font-bold gap-1 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10"
                      title="Testar disparo da automação"
                    >
                      <Send className="w-3 h-3 text-purple-400" /> Testar
                    </Button>

                    {/* Botão de Editar Solicitado */}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openEditModal(item)}
                      className="h-8 px-2.5 text-[10px] font-bold gap-1 bg-slate-800 hover:bg-slate-700 text-white border-slate-700 cursor-pointer shadow-sm"
                      title="Editar Fluxo e Mensagens"
                    >
                      <Edit3 className="w-3 h-3 text-blue-400" /> Editar
                    </Button>

                    {/* Botão Pausar / Ativar */}
                    <Button
                      type="button"
                      size="icon"
                      onClick={() => toggleStatus(item.id)}
                      className={cn(
                        "h-8 w-8 rounded-xl border transition-all cursor-pointer",
                        item.status === "Ativa"
                          ? "bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25"
                          : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
                      )}
                      title={item.status === "Ativa" ? "Pausar" : "Ativar"}
                    >
                      {item.status === "Ativa" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </Button>

                    {/* Botão Excluir */}
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={async () => {
                        if (!(await confirmDialog({
                          title: "Excluir automação",
                          description: `Excluir o fluxo "${item.name}"? Essa ação não pode ser desfeita.`
                        }))) return;
                        deleteMarketingAutomation(item.id);
                        toast.success("Automação excluída com sucesso.");
                      }}
                      className="h-8 w-8 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border-slate-700 cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── MODAL COMPLETO DE CRIAÇÃO E EDIÇÃO DE FLUXO (WHATSAPP & E-MAIL) ── */}
      <Modal
        isOpen={isEditorModalOpen}
        onClose={() => setIsEditorModalOpen(false)}
        title={editingId ? "Editar Fluxo de Automação" : "Configurar Novo Fluxo de Automação"}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4 max-h-[78vh] overflow-y-auto pr-1">
          {/* Informações Básicas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Nome da Automação *
              </label>
              <input
                type="text"
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                placeholder="Ex: Boas-vindas Imediatas WhatsApp"
                className="w-full bg-[var(--color-surface-sunken)] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Gatilho de Disparo
              </label>
              <select
                value={flowTrigger}
                onChange={(e) => setFlowTrigger(e.target.value)}
                className="w-full bg-[var(--color-surface-sunken)] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              >
                <option value="Novo Lead Cadastrado">Novo Lead Cadastrado (Qualquer Origem)</option>
                <option value="Proposta Aceita">Proposta Aceita (Venda Fechada)</option>
                <option value="Reunião Agendada">Reunião Agendada no Calendário</option>
                <option value="Lead em Negociação">Lead Mudou de Etapa no Funil</option>
                <option value="Indicação Recebida">Nova Indicação de Afiliado</option>
              </select>
            </div>
          </div>

          {/* Seleção do Canal Principal */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Canal de Comunicação
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFlowChannel("whatsapp")}
                className={cn(
                  "flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                  flowChannel === "whatsapp"
                    ? "bg-emerald-600/20 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/30"
                    : "bg-[var(--color-surface-sunken)] border-white/5 text-slate-400 hover:text-white"
                )}
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" /> WhatsApp
              </button>

              <button
                type="button"
                onClick={() => setFlowChannel("email")}
                className={cn(
                  "flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                  flowChannel === "email"
                    ? "bg-blue-600/20 border-blue-500 text-blue-300 ring-1 ring-blue-500/30"
                    : "bg-[var(--color-surface-sunken)] border-white/5 text-slate-400 hover:text-white"
                )}
              >
                <Mail className="w-4 h-4 text-blue-400" /> E-mail
              </button>

              <button
                type="button"
                onClick={() => setFlowChannel("misto")}
                className={cn(
                  "flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                  flowChannel === "misto"
                    ? "bg-purple-600/20 border-purple-500 text-purple-300 ring-1 ring-purple-500/30"
                    : "bg-[var(--color-surface-sunken)] border-white/5 text-slate-400 hover:text-white"
                )}
              >
                <Zap className="w-4 h-4 text-purple-400" /> Misto (Ambos)
              </button>
            </div>
          </div>

          {/* Construtor de Etapas / Ações */}
          <div className="space-y-3 pt-2 border-t border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-white tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Sequência de Ações ({flowSteps.length})
              </span>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddStep("whatsapp")}
                  className="h-7 text-[10px] font-bold gap-1 bg-emerald-950/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-900/30"
                >
                  <Plus className="w-3 h-3" /> WhatsApp
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddStep("email")}
                  className="h-7 text-[10px] font-bold gap-1 bg-blue-950/20 text-blue-400 border-blue-500/30 hover:bg-blue-900/30"
                >
                  <Plus className="w-3 h-3" /> E-mail
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddStep("delay")}
                  className="h-7 text-[10px] font-bold gap-1 bg-amber-950/20 text-amber-400 border-amber-500/30 hover:bg-amber-900/30"
                >
                  <Clock className="w-3 h-3" /> Delay
                </Button>
              </div>
            </div>

            <div className="space-y-2.5">
              {flowSteps.map((step, idx) => (
                <div
                  key={step.id}
                  className="p-3.5 rounded-xl bg-[var(--color-surface-sunken)] border border-white/5 space-y-2.5 relative group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-white/10 text-white font-mono text-[10px] flex items-center justify-center font-black">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        {step.type === "whatsapp" && <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />}
                        {step.type === "email" && <Mail className="w-3.5 h-3.5 text-blue-400" />}
                        {step.type === "delay" && <Clock className="w-3.5 h-3.5 text-amber-400" />}
                        {step.title}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveStep(idx)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                      title="Remover etapa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {step.type === "delay" ? (
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <span>Aguardar por:</span>
                      <input
                        type="number"
                        min="1"
                        value={step.delayHours || 2}
                        onChange={(e) => handleUpdateStep(idx, { delayHours: parseInt(e.target.value) || 1 })}
                        className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 font-mono text-center text-amber-400 font-bold focus:outline-none"
                      />
                      <span>horas antes de avançar para a próxima ação.</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {step.type === "email" && (
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                            Assunto do E-mail
                          </label>
                          <input
                            type="text"
                            value={step.subject || ""}
                            onChange={(e) => handleUpdateStep(idx, { subject: e.target.value })}
                            placeholder="Assunto da mensagem..."
                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            Conteúdo da Mensagem {step.type === "whatsapp" ? "(WhatsApp)" : "(Corpo do E-mail)"}
                          </label>
                          <span className="text-[9px] text-purple-400 font-mono">
                            Variáveis: {"{nome}"}, {"{empresa}"}, {"{valor}"}
                          </span>
                        </div>
                        <textarea
                          rows={3}
                          value={step.content || ""}
                          onChange={(e) => handleUpdateStep(idx, { content: e.target.value })}
                          placeholder="Digite o texto da mensagem automática..."
                          className="w-full bg-black/30 border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500 font-sans resize-none leading-relaxed"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Rodapé com Salvar */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold">Status do Fluxo:</span>
              <select
                value={flowStatus}
                onChange={(e) => setFlowStatus(e.target.value as any)}
                className="bg-[var(--color-surface-sunken)] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white font-bold focus:outline-none"
              >
                <option value="Ativa">Ativa (Rodando)</option>
                <option value="Pausada">Pausada</option>
                <option value="Rascunho">Rascunho</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditorModalOpen(false)}
                className="h-9 px-4 text-xs font-bold"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSaveAutomation}
                className="h-9 px-5 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white gap-1.5 shadow-md shadow-purple-600/20"
              >
                <CheckCircle2 className="w-4 h-4" /> {editingId ? "Salvar Alterações" : "Criar Automação"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
