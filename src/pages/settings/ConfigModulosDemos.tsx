import React, { useState, useEffect, useMemo, memo } from 'react';
import { Card } from "../../components/ui/card";
import { toast } from "sonner";
import {
  Cpu, Activity, Layers, Database, UserCheck,
  Target, Award, DollarSign, Package, MessageSquare, Users, Columns3, Clock, Code2,
  Plus, X, Building2, RefreshCw, ChevronDown, Megaphone, Pencil, Trash2, AlertTriangle,
  Sparkles, Search, CheckCircle2, ShieldCheck, ArrowRight, HeartPulse, Home, Sun, ShoppingCart, Car, Server
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import {
  supabase,
  createTenantAdmin,
  fetchTenants,
  fetchTenantsDetailed,
  updateTenantInfo,
  deactivateTenant,
  fetchTenantAdminUser,
  updateTenantUserCredentials
} from "../../lib/supabase";
import { ErrorBoundary } from "../../components/ErrorBoundary";

// Fallback só usado se o Supabase estiver inacessível — a lista real vem de
// public.nichos (globais, tenant_id null) via fetchGlobalNiches().
const NICHES_FALLBACK = [
  "Parceira",
  "Solar",
  "Imobiliária",
  "Clínica",
  "Tecnologia",
  "Educação",
  "Agronegócio",
  "Varejo"
];

async function fetchGlobalNiches(): Promise<string[]> {
  if (!supabase) return NICHES_FALLBACK;
  const { data, error } = await supabase
    .from("nichos")
    .select("nome")
    .is("tenant_id", null)
    .eq("ativo", true)
    .order("nome");
  if (error || !data || data.length === 0) return NICHES_FALLBACK;
  return data.map((n: any) => n.nome);
}

// Preserva isolamento do DOM para evitar conflito com extensões de gerenciadores de senhas
const CredentialFields = memo(function CredentialFields({
  email,
  onEmailChange,
  password,
  onPasswordChange,
  passwordLabel,
  passwordPlaceholder,
  disabled,
}: {
  email: string;
  onEmailChange: (v: string) => void;
  password: string;
  onPasswordChange: (v: string) => void;
  passwordLabel: string;
  passwordPlaceholder: string;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      <div className="space-y-1.5">
        <label className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">
          E-mail do Administrador
        </label>
        <input
          type="email"
          value={email}
          onChange={e => onEmailChange(e.target.value)}
          disabled={disabled}
          placeholder="admin@empresa.com"
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore
          data-bwignore
          className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-faint)] focus:outline-none focus:border-[var(--color-primary-blue)] focus:ring-1 focus:ring-[var(--color-primary-blue)] disabled:opacity-40 transition-all"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">
          {passwordLabel}
        </label>
        <input
          type="password"
          value={password}
          onChange={e => onPasswordChange(e.target.value)}
          disabled={disabled}
          placeholder={passwordPlaceholder}
          autoComplete="new-password"
          data-lpignore="true"
          data-1p-ignore
          data-bwignore
          className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-faint)] focus:outline-none focus:border-[var(--color-primary-blue)] focus:ring-1 focus:ring-[var(--color-primary-blue)] disabled:opacity-40 transition-all"
        />
      </div>
    </div>
  );
});

export default function ConfigModulosDemos({ 
  embedded = false,
  onOpenNewTenant,
  reloadTrigger
}: { 
  embedded?: boolean;
  onOpenNewTenant?: () => void;
  reloadTrigger?: number;
}) {
  const { login, user, allTenantModules, updateTenantModules, getTenantModules } = useAuth();
  const { setSidebarModules } = useData();

  const DEFAULT_MODULES: Record<string, boolean> = {
    crm: true,
    educacao: true,
    produtividade: true,
    financeiro: true,
    catalogo: true,
    marketing: true,
    engajamento: true,
    rh: true,
    bi: true,
    clinica: true,
    dev: true,
    imobiliaria: false,
    concessionaria: false,
    automotivo: false,
    varejo: false,
    solar: false,
    aurora: true,
  };

  const [niches, setNiches] = useState<string[]>(NICHES_FALLBACK);
  const [selectedTenant, setSelectedTenant] = useState<string>(() => user?.tenantName || "G-Tech Master");
  const [activeModules, setActiveModules] = useState<Record<string, boolean>>(DEFAULT_MODULES);
  const [tenantOptions, setTenantOptions] = useState<string[]>(Object.keys(allTenantModules));
  const [searchTenant, setSearchTenant] = useState("");
  const [simulationRole, setSimulationRole] = useState("Administrador / Sócio");
  const [showTenantList, setShowTenantList] = useState(false);

  // Add partner state
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantNiche, setNewTenantNiche] = useState("Parceira");
  const [newTenantEmail, setNewTenantEmail] = useState("");
  const [newTenantPassword, setNewTenantPassword] = useState("");
  const [savingTenant, setSavingTenant] = useState(false);
  const [reloading, setReloading] = useState(false);

  // Edit/Delete partner state
  const [tenantDetails, setTenantDetails] = useState<{ id: string; name: string; niche: string }[]>([]);
  const [showEditTenant, setShowEditTenant] = useState(false);
  const [editTenantName, setEditTenantName] = useState("");
  const [editTenantNiche, setEditTenantNiche] = useState("Parceira");
  const [editAdminUserId, setEditAdminUserId] = useState<string | null>(null);
  const [editAdminEmail, setEditAdminEmail] = useState("");
  const [editAdminPassword, setEditAdminPassword] = useState("");
  const [loadingAdminUser, setLoadingAdminUser] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingTenant, setDeletingTenant] = useState(false);

  const loadTenantDetails = async () => {
    const details = await fetchTenantsDetailed();
    setTenantDetails(details);
  };

  useEffect(() => {
    const loadDirect = async () => {
      const dbTenants = await fetchTenants();
      if (Object.keys(dbTenants).length > 0) {
        const merged: Record<string, any> = {
          "G-Tech Master": allTenantModules["G-Tech Master"] || {},
          ...dbTenants
        };
        setTenantOptions(Object.keys(merged));
      }
    };
    loadDirect();
    loadTenantDetails();
    fetchGlobalNiches().then(setNiches);
  }, []);

  useEffect(() => {
    setTenantOptions(Object.keys(allTenantModules));
  }, [allTenantModules]);

  useEffect(() => {
    if (reloadTrigger !== undefined && reloadTrigger > 0) {
      handleReloadTenants(true);
    }
  }, [reloadTrigger]);

  useEffect(() => {
    const modules = getTenantModules(selectedTenant);
    setActiveModules({ ...DEFAULT_MODULES, ...modules });
  }, [selectedTenant, allTenantModules]);

  const handleToggleModule = async (key: string) => {
    const newVal = !activeModules[key];
    const updated = { ...activeModules, [key]: newVal };
    if (key === 'concessionaria' || key === 'automotivo') {
      updated.concessionaria = newVal;
      updated.automotivo = newVal;
    }
    setActiveModules(updated);
    await updateTenantModules(selectedTenant, updated as any);
    if (selectedTenant === user?.tenantName) {
      setSidebarModules(updated);
    }
    toast.success(`Módulo "${key.toUpperCase()}" ${newVal ? 'ATIVADO' : 'OCULTADO'} para ${selectedTenant}!`);
  };

  const handleSwitchRole = (role: string) => {
    setSimulationRole(role);
    if (user) login({ ...user, role });
    toast.info(`Simulando visualização para a função: ${role}`);
  };

  const applyPreset = async (presetName: string) => {
    let preset: Record<string, boolean>;
    switch (presetName) {
      case "ALL_ACTIVE":
        preset = { crm: true, educacao: true, produtividade: true, financeiro: true, catalogo: true, engajamento: true, rh: true, bi: true, clinica: true, marketing: true, dev: true, imobiliaria: true, concessionaria: true, varejo: true, solar: true, aurora: true };
        toast.success("Preset Aplicado: Ecossistema Global (Todos os Módulos Ativos)");
        break;
      case "EDUCACAO":
        preset = { crm: true, educacao: true, produtividade: true, financeiro: true, catalogo: false, engajamento: true, rh: true, bi: true, clinica: false, marketing: true, dev: false, imobiliaria: false, concessionaria: false, varejo: false, solar: false, aurora: true };
        toast.success("Preset Aplicado: Escola & Acadêmico");
        break;
      case "SDR_CLOSER":
        preset = { crm: true, educacao: false, produtividade: true, financeiro: false, catalogo: false, engajamento: true, rh: false, bi: true, clinica: false, marketing: true, dev: false, imobiliaria: false, concessionaria: false, varejo: false, solar: false, aurora: true };
        toast.success("Preset Aplicado: Agência SDR & Closers");
        break;
      case "CLINICA":
        preset = { crm: true, educacao: false, produtividade: true, financeiro: true, catalogo: false, engajamento: true, rh: true, bi: true, clinica: true, marketing: false, dev: false, imobiliaria: false, concessionaria: false, varejo: false, solar: false, aurora: true };
        toast.success("Preset Aplicado: Clínica & Saúde Integrada");
        break;
      case "IMOBILIARIA":
        preset = { crm: true, educacao: false, produtividade: true, financeiro: true, catalogo: false, engajamento: true, rh: true, bi: true, clinica: false, marketing: true, dev: false, imobiliaria: true, concessionaria: false, varejo: false, solar: false, aurora: true };
        toast.success("Preset Aplicado: Imobiliária");
        break;
      case "CONCESSIONARIA":
        preset = { crm: true, educacao: false, produtividade: true, financeiro: true, catalogo: false, engajamento: true, rh: true, bi: true, clinica: false, marketing: true, dev: false, imobiliaria: false, concessionaria: true, varejo: false, solar: false, aurora: true };
        toast.success("Preset Aplicado: Concessionária");
        break;
      case "VAREJO":
        preset = { crm: true, educacao: false, produtividade: true, financeiro: true, catalogo: true, engajamento: true, rh: true, bi: true, clinica: false, marketing: true, dev: false, imobiliaria: false, concessionaria: false, varejo: true, solar: false, aurora: true };
        toast.success("Preset Aplicado: Varejo & Lojas");
        break;
      case "SOLAR":
        preset = { crm: true, educacao: false, produtividade: true, financeiro: true, catalogo: false, engajamento: true, rh: true, bi: true, clinica: false, marketing: false, dev: false, imobiliaria: false, concessionaria: false, varejo: false, solar: true, aurora: true };
        toast.success("Preset Aplicado: Energia Solar");
        break;
      default:
        return;
    }
    if (preset.concessionaria !== undefined) preset.automotivo = preset.concessionaria;
    setActiveModules(preset);
    await updateTenantModules(selectedTenant, preset as any);
    if (selectedTenant === user?.tenantName) {
      setSidebarModules(preset);
    }
  };

  const handleReloadTenants = async (silent = false) => {
    setReloading(true);
    const dbTenants = await fetchTenants();
    if (Object.keys(dbTenants).length > 0) {
      const merged: Record<string, any> = { "G-Tech Master": allTenantModules["G-Tech Master"] || {}, ...dbTenants };
      setTenantOptions(Object.keys(merged));
      if (!silent) toast.success(`${Object.keys(dbTenants).length} empresa(s) carregada(s).`);
    } else if (!silent) {
      toast.error("Nenhuma empresa parceira encontrada no banco.");
    }
    await loadTenantDetails();
    setReloading(false);
  };

  const openEditTenant = async (tenantName: string) => {
    const willShow = !(showEditTenant && selectedTenant === tenantName);
    const current = tenantDetails.find(t => t.name === tenantName);
    setSelectedTenant(tenantName);
    setEditTenantName(current?.name || tenantName);
    setEditTenantNiche(current?.niche || "Parceira");
    setEditAdminUserId(null);
    setEditAdminEmail("");
    setEditAdminPassword("");
    setConfirmingDelete(false);
    setShowEditTenant(willShow);

    if (willShow && current) {
      setLoadingAdminUser(true);
      try {
        const result = await fetchTenantAdminUser(current.id);
        if (result.success && result.user) {
          setEditAdminUserId(result.user.id);
          setEditAdminEmail(result.user.email);
        } else {
          toast.error(result.error || "Não foi possível carregar o administrador desta empresa.");
        }
      } catch (err: any) {
        toast.error(err?.message || "Erro ao carregar o administrador desta empresa.");
      } finally {
        setLoadingAdminUser(false);
      }
    }
  };

  const openDeleteConfirm = (tenantName: string) => {
    setSelectedTenant(tenantName);
    setShowEditTenant(false);
    setConfirmingDelete(v => !(v && selectedTenant === tenantName));
  };

  const handleSaveEditTenant = async () => {
    const current = tenantDetails.find(t => t.name === selectedTenant);
    if (!current) {
      toast.error("Empresa não encontrada no banco de dados.");
      return;
    }
    if (!editTenantName.trim()) {
      toast.error("Informe o nome da empresa.");
      return;
    }
    if (editAdminPassword && editAdminPassword.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    setSavingEdit(true);
    const result = await updateTenantInfo(current.id, { name: editTenantName.trim(), niche: editTenantNiche });
    if (!result.success) {
      toast.error(`Erro: ${result.error}`);
      setSavingEdit(false);
      return;
    }

    if (editAdminUserId && (editAdminEmail.trim() || editAdminPassword)) {
      const credUpdates: { email?: string; password?: string } = {};
      if (editAdminEmail.trim()) credUpdates.email = editAdminEmail.trim();
      if (editAdminPassword) credUpdates.password = editAdminPassword;
      const credResult = await updateTenantUserCredentials(editAdminUserId, credUpdates);
      if (!credResult.success) {
        toast.error(`Empresa salva, mas falha ao atualizar credenciais: ${credResult.error}`);
        setSavingEdit(false);
        return;
      }
    }

    toast.success(`Empresa "${editTenantName.trim()}" atualizada com sucesso.`);
    setShowEditTenant(false);
    setEditAdminPassword("");
    setSelectedTenant(editTenantName.trim());
    await handleReloadTenants(true);
    setSavingEdit(false);
  };

  const handleDeleteTenant = async () => {
    const current = tenantDetails.find(t => t.name === selectedTenant);
    if (!current) {
      toast.error("Empresa não encontrada no banco de dados.");
      return;
    }
    setDeletingTenant(true);
    const result = await deactivateTenant(current.id);
    if (result.success) {
      toast.success(`Empresa "${current.name}" desativada com sucesso.`);
      setConfirmingDelete(false);
      setShowEditTenant(false);
      setSelectedTenant("G-Tech Master");
      await handleReloadTenants(true);
    } else {
      toast.error(`Erro: ${result.error}`);
    }
    setDeletingTenant(false);
  };

  const handleAddTenant = async () => {
    if (!newTenantName.trim()) {
      toast.error("Informe o nome da empresa.");
      return;
    }
    if (!newTenantEmail.trim()) {
      toast.error("Informe o e-mail do administrador da empresa.");
      return;
    }
    if (newTenantPassword.length < 6) {
      toast.error("A senha do administrador precisa ter pelo menos 6 caracteres.");
      return;
    }
    setSavingTenant(true);
    const result = await createTenantAdmin(newTenantName.trim(), newTenantNiche, newTenantEmail.trim(), newTenantPassword);
    if (result.success) {
      toast.success(`Empresa "${newTenantName}" cadastrada — acesso gerado para ${newTenantEmail}.`);
      setNewTenantName("");
      setNewTenantNiche("Parceira");
      setNewTenantEmail("");
      setNewTenantPassword("");
      setShowAddTenant(false);
      await handleReloadTenants(true);
    } else {
      toast.error(`Erro: ${result.error}`);
    }
    setSavingTenant(false);
  };

  const filteredTenants = useMemo(() => {
    return tenantOptions.filter(name =>
      name.toLowerCase().includes(searchTenant.toLowerCase())
    );
  }, [tenantOptions, searchTenant]);

  const activeModulesCount = useMemo(() => {
    return Object.values(activeModules).filter(Boolean).length;
  }, [activeModules]);

  const selectedTenantDetail = useMemo(() => {
    return tenantDetails.find(t => t.name === selectedTenant);
  }, [tenantDetails, selectedTenant]);

  return (
    <div className="space-y-6 max-w-6xl pb-24 animate-in fade-in duration-300">

      {/* Hero Header Card (shown only if not embedded) */}
      {!embedded && (
        <div className="border border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] p-6 sm:p-7 rounded-3xl relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--color-primary-blue)]/5 blur-3xl rounded-full pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--color-primary-blue)]/10 border border-[var(--color-primary-blue)]/20 rounded-full text-[10px] text-[var(--color-primary-blue)] font-bold uppercase tracking-wider">
                <Cpu className="w-3.5 h-3.5" /> Arquitetura Multitenant Modular
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-[var(--color-text-primary)] tracking-tight">
                Gestão de Empresas & Módulos
              </h1>
              <p className="text-xs sm:text-sm text-[var(--color-text-muted)] max-w-2xl leading-relaxed">
                Cadastre e gerencie as empresas parceiras da plataforma e configure os módulos visíveis para cada operação.
              </p>
            </div>

            <div className="flex items-center gap-4 bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] p-4 rounded-2xl shrink-0 shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-[var(--color-primary-blue)] flex items-center justify-center text-white shadow-xs">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Tenant Ativo</span>
                </div>
                <h4 className="text-sm font-black text-[var(--color-text-primary)] max-w-[220px] truncate mt-0.5">
                  {user?.tenantName || "G-Tech Master"}
                </h4>
                <span className="inline-block text-[9px] font-extrabold uppercase tracking-widest text-[var(--color-primary-blue)] bg-[var(--color-primary-blue)]/10 px-2 py-0.5 rounded-md mt-1 border border-[var(--color-primary-blue)]/20">
                  Nicho: {user?.tenantNiche || "Master"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EMPRESAS PARCEIRAS — Central de Gerenciamento & Seletor Rápido */}
      {user?.isMaster && (
        <Card className="border border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] rounded-3xl p-5 sm:p-6 space-y-5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-blue)]/10 border border-[var(--color-primary-blue)]/20 flex items-center justify-center text-[var(--color-primary-blue)] shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)] block">
                  Empresa / Tenant Selecionado
                </span>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <select
                    value={selectedTenant}
                    onChange={e => setSelectedTenant(e.target.value)}
                    className="bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-xl px-3.5 py-2 text-xs font-black text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)] cursor-pointer"
                  >
                    {tenantOptions.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-primary-blue)] bg-[var(--color-primary-blue)]/10 border border-[var(--color-primary-blue)]/20 px-2.5 py-1 rounded-lg">
                    Nicho: {selectedTenantDetail?.niche || (selectedTenant === "G-Tech Master" ? "Infraestrutura" : "Parceira")}
                  </span>
                  <span className="text-[10px] font-bold text-[var(--color-text-muted)] bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] px-2.5 py-1 rounded-lg">
                    <strong className="text-[var(--color-primary-blue)]">{activeModulesCount}</strong> de 16 módulos ativos
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleReloadTenants()}
                disabled={reloading}
                title="Recarregar parceiros do banco"
                className="p-2 bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} />
              </button>

              {selectedTenant !== "G-Tech Master" && (
                <button
                  type="button"
                  onClick={() => openEditTenant(selectedTenant)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface)] border border-[var(--color-border-default)] text-xs font-bold text-[var(--color-text-primary)] rounded-xl transition-all cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 text-[var(--color-primary-blue)]" /> Editar Empresa
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (onOpenNewTenant) {
                    onOpenNewTenant();
                  } else {
                    setShowAddTenant(v => !v);
                    setShowEditTenant(false);
                    setConfirmingDelete(false);
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[var(--color-primary-blue)] hover:opacity-90 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-xs cursor-pointer"
              >
                {showAddTenant ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {showAddTenant ? "Cancelar" : "Nova Empresa"}
              </button>

              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("tenant-directory-section");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface)] border border-[var(--color-border-default)] text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded-xl transition-all cursor-pointer"
              >
                <Server className="w-3.5 h-3.5 text-[var(--color-primary-blue)]" />
                Instâncias ({tenantOptions.length})
              </button>
            </div>
          </div>

          {/* Form: Cadastrar Nova Empresa */}
          {showAddTenant && (
            <ErrorBoundary compact>
              <div className="p-5 bg-[var(--color-surface-sunken)] border border-[var(--color-primary-blue)]/30 rounded-2xl space-y-4 shadow-sm animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-[var(--color-primary-blue)] text-xs font-bold uppercase tracking-wider">
                  <Building2 className="w-4 h-4" /> Cadastrar Nova Empresa Parceira
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">
                      Nome da Empresa
                    </label>
                    <input
                      value={newTenantName}
                      onChange={e => setNewTenantName(e.target.value)}
                      placeholder="Ex: Prime Incorporadora Ltda"
                      className="w-full bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-faint)] focus:outline-none focus:border-[var(--color-primary-blue)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">
                      Nicho Operacional
                    </label>
                    <div className="relative">
                      <select
                        value={newTenantNiche}
                        onChange={e => setNewTenantNiche(e.target.value)}
                        className="w-full appearance-none bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)] pr-8 cursor-pointer font-bold"
                      >
                        {niches.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)] pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--color-border-subtle)]">
                  <CredentialFields
                    email={newTenantEmail}
                    onEmailChange={setNewTenantEmail}
                    password={newTenantPassword}
                    onPasswordChange={setNewTenantPassword}
                    passwordLabel="Senha Provisória"
                    passwordPlaceholder="Mínimo 6 caracteres"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddTenant(false)}
                    className="px-4 py-2.5 bg-[var(--color-surface)] hover:bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAddTenant}
                    disabled={savingTenant}
                    className="px-6 py-2.5 bg-[var(--color-primary-blue)] hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-xs cursor-pointer"
                  >
                    {savingTenant ? "Cadastrando..." : "Cadastrar Empresa"}
                  </button>
                </div>
              </div>
            </ErrorBoundary>
          )}

          {/* Form: Editar Empresa */}
          {showEditTenant && (
            <ErrorBoundary compact>
              <div className="p-5 bg-[var(--color-surface-sunken)] border border-[var(--color-primary-blue)]/40 rounded-2xl space-y-4 shadow-sm animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-[var(--color-primary-blue)] text-xs font-bold uppercase tracking-wider">
                  <Pencil className="w-4 h-4" /> Editar Dados de "{selectedTenant}"
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">
                      Nome da Empresa
                    </label>
                    <input
                      value={editTenantName}
                      onChange={e => setEditTenantName(e.target.value)}
                      className="w-full bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">
                      Nicho
                    </label>
                    <div className="relative">
                      <select
                        value={editTenantNiche}
                        onChange={e => setEditTenantNiche(e.target.value)}
                        className="w-full appearance-none bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-blue)] pr-8 cursor-pointer font-bold"
                      >
                        {niches.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)] pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--color-border-subtle)] space-y-2">
                  <div className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">
                    Credenciais do Administrador
                  </div>
                  <CredentialFields
                    email={editAdminEmail}
                    onEmailChange={setEditAdminEmail}
                    password={editAdminPassword}
                    onPasswordChange={setEditAdminPassword}
                    passwordLabel="Nova Senha"
                    passwordPlaceholder="Deixe em branco para manter a atual"
                    disabled={!editAdminUserId || loadingAdminUser}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditTenant(false)}
                    className="px-4 py-2 bg-[var(--color-surface)] hover:bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditTenant}
                    disabled={savingEdit}
                    className="px-6 py-2 bg-[var(--color-primary-blue)] hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                  >
                    {savingEdit ? "Salvando..." : "Salvar Alterações"}
                  </button>
                </div>
              </div>
            </ErrorBoundary>
          )}

          {/* Delete confirmation modal */}
          {confirmingDelete && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-rose-500 text-xs font-bold uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4" /> Desativar Empresa "{selectedTenant}"?
              </div>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                A empresa deixará de aparecer na lista de parceiros ativos e os acessos de usuários serão suspensos. O histórico de dados é preservado com segurança.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="px-4 py-2 bg-[var(--color-surface)] hover:bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteTenant}
                  disabled={deletingTenant}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  {deletingTenant ? "Desativando..." : "Confirmar Desativação"}
                </button>
              </div>
            </div>
          )}

          {/* Collapsible Tenants List */}
          {showTenantList && (
            <div className="pt-4 border-t border-[var(--color-border-subtle)] space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--color-text-primary)]">
                  Todas as Empresas Cadastradas ({tenantOptions.length})
                </span>
              </div>
              {tenantOptions.length > 3 && (
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input
                    type="text"
                    placeholder="Filtrar por nome..."
                    value={searchTenant}
                    onChange={e => setSearchTenant(e.target.value)}
                    className="w-full bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] rounded-xl pl-10 pr-4 py-2 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-faint)] focus:outline-none focus:border-[var(--color-primary-blue)]"
                  />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
                {filteredTenants.map((name) => {
                  const detail = tenantDetails.find(t => t.name === name);
                  const isMaster = name === "G-Tech Master";
                  const isSelected = selectedTenant === name;

                  return (
                    <div
                      key={name}
                      onClick={() => setSelectedTenant(name)}
                      className={`flex items-center justify-between gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--color-primary-blue)]/10 border-[var(--color-primary-blue)] ring-1 ring-[var(--color-primary-blue)]/30'
                          : 'bg-[var(--color-surface-sunken)] border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)] hover:bg-[var(--color-surface)]'
                      }`}
                    >
                      <div className="min-w-0 flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                          isSelected ? 'bg-[var(--color-primary-blue)] text-white' : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'
                        }`}>
                          {name[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--color-text-primary)] truncate">{name}</p>
                          <p className="text-[9px] text-[var(--color-text-muted)] truncate">{isMaster ? "Master" : detail?.niche || "Parceira"}</p>
                        </div>
                      </div>
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-[var(--color-primary-blue)] shrink-0" />
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedTenant(name); }}
                          className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] px-2 py-0.5 rounded border border-[var(--color-border-default)]"
                        >
                          Ativar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Module Configuration for Selected Tenant */}
          <div className="pt-6 border-t border-[var(--color-border-subtle)] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)] flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[var(--color-primary-blue)]" /> Módulos de "{selectedTenant}"
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Ative ou desative seções inteiras da barra lateral para personalizar a interface e as ferramentas desta empresa.
                </p>
              </div>
              <span className="text-[11px] font-bold text-[var(--color-text-muted)] bg-[var(--color-surface-sunken)] px-3 py-1 rounded-full border border-[var(--color-border-default)] shrink-0 self-start sm:self-auto">
                <strong className="text-[var(--color-primary-blue)]">{activeModulesCount}</strong> de 16 módulos ativos
              </span>
            </div>

            {/* Presets Estratégicos */}
            <div className="bg-[var(--color-surface-sunken)] border border-[var(--color-border-default)] p-4 sm:p-5 rounded-2xl space-y-3 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary-blue)] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Presets Estratégicos de Operação em 1 Clique
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-2.5">
                <button
                  type="button"
                  onClick={() => applyPreset("ALL_ACTIVE")}
                  className="flex flex-col items-center justify-center p-3 bg-[var(--color-surface)] hover:bg-[var(--color-surface-elevated)] hover:border-[var(--color-primary-blue)]/50 text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-xl transition-all cursor-pointer shadow-2xs group"
                >
                  <span className="text-lg mb-1 group-hover:scale-110 transition-transform">🌐</span>
                  <span className="text-[11px] font-bold">Geral Full</span>
                  <span className="text-[9px] text-[var(--color-text-muted)]">Todos Ativos</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset("SDR_CLOSER")}
                  className="flex flex-col items-center justify-center p-3 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25 rounded-xl transition-all cursor-pointer shadow-2xs group"
                >
                  <span className="text-lg mb-1 group-hover:scale-110 transition-transform">⚡</span>
                  <span className="text-[11px] font-bold">SDR & Closers</span>
                  <span className="text-[9px] opacity-80">Funil Comercial</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset("EDUCACAO")}
                  className="flex flex-col items-center justify-center p-3 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/25 rounded-xl transition-all cursor-pointer shadow-2xs group"
                >
                  <span className="text-lg mb-1 group-hover:scale-110 transition-transform">🎓</span>
                  <span className="text-[11px] font-bold">Escola / Edu</span>
                  <span className="text-[9px] opacity-80">Turmas & Aulas</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset("CLINICA")}
                  className="flex flex-col items-center justify-center p-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 rounded-xl transition-all cursor-pointer shadow-2xs group"
                >
                  <span className="text-lg mb-1 group-hover:scale-110 transition-transform">🩺</span>
                  <span className="text-[11px] font-bold">Clínica & Saúde</span>
                  <span className="text-[9px] opacity-80">Prontuários EHR</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset("IMOBILIARIA")}
                  className="flex flex-col items-center justify-center p-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/25 rounded-xl transition-all cursor-pointer shadow-2xs group"
                >
                  <span className="text-lg mb-1 group-hover:scale-110 transition-transform">🏢</span>
                  <span className="text-[11px] font-bold">Imobiliária</span>
                  <span className="text-[9px] opacity-80">Portfólio de Imóveis</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset("CONCESSIONARIA")}
                  className="flex flex-col items-center justify-center p-3 bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/25 rounded-xl transition-all cursor-pointer shadow-2xs group"
                >
                  <span className="text-lg mb-1 group-hover:scale-110 transition-transform">🚗</span>
                  <span className="text-[11px] font-bold">Concessionária</span>
                  <span className="text-[9px] opacity-80">Estoque de Veículos</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset("VAREJO")}
                  className="flex flex-col items-center justify-center p-3 bg-pink-500/10 hover:bg-pink-500/20 text-pink-600 dark:text-pink-400 border border-pink-500/25 rounded-xl transition-all cursor-pointer shadow-2xs group"
                >
                  <span className="text-lg mb-1 group-hover:scale-110 transition-transform">🛍️</span>
                  <span className="text-[11px] font-bold">Varejo & Lojas</span>
                  <span className="text-[9px] opacity-80">Catálogo & Estoque</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset("SOLAR")}
                  className="flex flex-col items-center justify-center p-3 bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/25 rounded-xl transition-all cursor-pointer shadow-2xs group"
                >
                  <span className="text-lg mb-1 group-hover:scale-110 transition-transform">☀️</span>
                  <span className="text-[11px] font-bold">Energia Solar</span>
                  <span className="text-[9px] opacity-80">Funil Fotovoltaico</span>
                </button>
              </div>
            </div>

            {/* Individual Modules Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
              {[
                { id: 'crm', title: "CRM & Pipeline Comercial", desc: "Leads, Funil Comercial, Rodízio e SDR IA", icon: Target, color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
                { id: 'aurora', title: "Aurora Diretoria IA", desc: "Assistente de voz, WhatsApp e IA Executiva", icon: Sparkles, color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20" },
                { id: 'produtividade', title: "Tarefas & Produtividade", desc: "Quadro Kanban operacional e follow-ups", icon: Clock, color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20" },
                { id: 'financeiro', title: "Cofre & Financeiro", desc: "Receitas, despesas, DRE e metas financeiras", icon: DollarSign, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
                { id: 'catalogo', title: "Catálogo de Produtos & SKUs", desc: "Estoque, rastreamento e tabela de preços", icon: Package, color: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
                { id: 'marketing', title: "Marketing & Campanhas", desc: "Conteúdos, landing pages e social media", icon: Megaphone, color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
                { id: 'engajamento', title: "Engajamento & WhatsApp", desc: "Disparos, webhooks, NPS e central de mensagens", icon: MessageSquare, color: "text-rose-500 bg-rose-500/10 border-rose-500/20" },
                { id: 'educacao', title: "Educação & Acadêmico", desc: "Turmas, matrículas, certificados e alunos", icon: Award, color: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
                { id: 'clinica', title: "Clínica Médica & Saúde", desc: "Prontuários EHR, telemedicina e consultas", icon: Activity, color: "text-teal-500 bg-teal-500/10 border-teal-500/20" },
                { id: 'rh', title: "RH & Colaboradores", desc: "Equipe interna, comissões e organograma", icon: Users, color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
                { id: 'bi', title: "BI & Inteligência de Dados", desc: "Dashboards analíticos, OTE e métricas avançadas", icon: Columns3, color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20" },
                { id: 'imobiliaria', title: "Imobiliária", desc: "Portfólio de imóveis, visitas, corretores e funil de leads", icon: Home, color: "text-orange-500 bg-orange-500/10 border-orange-500/20" },
                { id: 'concessionaria', title: "Concessionária", desc: "Estoque de veículos, financiamento, consignação e funil de leads", icon: Car, color: "text-orange-500 bg-orange-500/10 border-orange-500/20" },
                { id: 'solar', title: "Energia Solar", desc: "Análise de fatura por IA, dimensionamento e funil fotovoltaico", icon: Sun, color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
                { id: 'varejo', title: "Varejo & Ponto de Venda", desc: "Carrinho, baixa de estoque na venda e catálogo público compartilhável", icon: ShoppingCart, color: "text-lime-500 bg-lime-500/10 border-lime-500/20" },
                { id: 'dev', title: "Engenharia & Sprint Dev", desc: "Quadro de sprints, releases e demandas tech", icon: Code2, color: "text-slate-500 bg-slate-500/10 border-slate-500/20" },
              ].map((mod) => {
                const isEnabled = activeModules[mod.id] ?? true;
                return (
                  <div
                    key={mod.id}
                    onClick={() => handleToggleModule(mod.id)}
                    className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3.5 cursor-pointer select-none ${
                      isEnabled
                        ? 'bg-[var(--color-surface)] border-[var(--color-primary-blue)]/50 shadow-xs ring-1 ring-[var(--color-primary-blue)]/20'
                        : 'bg-[var(--color-surface-sunken)] border-[var(--color-border-subtle)] opacity-50 hover:opacity-90'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2.5 rounded-xl border shrink-0 ${mod.color}`}>
                        <mod.icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-[var(--color-text-primary)] block truncate">
                          {mod.title}
                        </span>
                        <span className="text-[10px] text-[var(--color-text-muted)] block truncate mt-0.5">
                          {mod.desc}
                        </span>
                      </div>
                    </div>

                    {/* Switch Toggle */}
                    <div className="shrink-0">
                      <div className={`w-10 h-6 rounded-full p-0.5 transition-all flex items-center ${
                        isEnabled ? 'bg-[var(--color-primary-blue)] justify-end shadow-xs' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                      }`}>
                        <div className="w-5 h-5 rounded-full bg-white transition-transform shadow-xs" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Simulador de Cargos & Permissões */}
          <div className="pt-6 border-t border-[var(--color-border-subtle)] space-y-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-[var(--color-text-primary)] flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-500" /> Simulador de Visão por Cargo
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Alterne os níveis de autorização para validar como a interface e o menu lateral se comportam para cada perfil de usuário.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { title: "Administrador / Sócio", desc: "Acesso irrestrito a todas as áreas, finanças e configurações globais." },
                { title: "Médico / Clínico Closer", desc: "Focado em prontuários eletrônicos EHR, telemedicina e agenda clínica." },
                { title: "SDR / Pré-Vendas", desc: "Focado em triagem de leads, contatos rápidos e agendamento de reuniões." },
                { title: "Professor / Mentor", desc: "Acesso restrito ao módulo acadêmico, turmas, aulas e certificados." },
              ].map((role) => {
                const isSelected = simulationRole === role.title;
                return (
                  <button
                    key={role.title}
                    type="button"
                    onClick={() => handleSwitchRole(role.title)}
                    className={`text-left p-3.5 rounded-2xl border text-xs transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? "bg-[var(--color-primary-blue)]/10 border-[var(--color-primary-blue)] text-[var(--color-text-primary)] font-bold shadow-xs"
                        : "bg-[var(--color-surface-sunken)] border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <h5 className="font-bold text-xs text-[var(--color-text-primary)]">{role.title}</h5>
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        isSelected ? "border-[var(--color-primary-blue)] bg-[var(--color-primary-blue)]" : "border-slate-400"
                      }`}>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                    </div>
                    <span className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
                      {role.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="p-3 bg-[var(--color-primary-blue)]/5 rounded-xl border border-[var(--color-primary-blue)]/15 text-[10px] text-[var(--color-text-muted)] leading-relaxed flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--color-primary-blue)] shrink-0" />
              <span>
                <strong>Regra de Governança Multitenant:</strong> Todas as alterações de módulos aplicadas são gravadas em tempo real no banco de dados e refletidas na barra lateral do tenant selecionado.
              </span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
