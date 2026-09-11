import { useState, useEffect } from 'react';
import { Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Building, Plug, Columns3, Briefcase, Zap, Wallet, Bell, HardDrive } from "lucide-react";
import { SectionSidebar, type SectionNavGroup } from "../../components/layout/SectionSidebar";

export default function SettingsLayout() {
  const { user, isModuleEnabled } = useAuth();

  const [activeModules, setActiveModules] = useState<{ [key: string]: boolean }>({
    crm: true, educacao: true, produtividade: true, financeiro: true,
    catalogo: true, marketing: true, engajamento: true, rh: true, bi: true, clinica: true,
  });

  useEffect(() => {
    const handleChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent?.detail) setActiveModules(customEvent.detail);
    };
    window.addEventListener("spy_modules_changed", handleChanged);
    return () => window.removeEventListener("spy_modules_changed", handleChanged);
  }, []);

  const groups: SectionNavGroup[] = [
    {
      title: "Preferências & Usuário",
      icon: Bell,
      items: [
        { title: "Meu Perfil & Conta", path: "/app/configuracoes/usuario/perfil" },
        { title: "Preferências do Sistema", path: "/app/configuracoes/usuario/preferencias" },
        { title: "Preferências de Notificação", path: "/app/configuracoes/usuario/notificacoes" },
      ],
    },
    {
      title: "Empresa",
      icon: Building,
      items: [
        { title: "Dados da empresa", path: "/app/configuracoes/empresa/dados" },
        ...(user?.isMaster ? [{ title: "Módulos & SaaS (Admin)", path: "/app/admin?tab=modules" }] : []),
        { title: "Filiais / Unidades", path: "/app/configuracoes/empresa/filiais" },
        { title: "Nichos", path: "/app/configuracoes/empresa/nichos" },
        { title: "Equipe & convites", path: "/app/configuracoes/empresa/equipe" },
        { title: "Cargos", path: "/app/configuracoes/empresa/cargos" },
        { title: "Perfis & permissões", path: "/app/configuracoes/empresa/permissoes" },
      ],
    },
    ...(activeModules.crm ? [{
      title: "CRM",
      icon: Columns3,
      items: [
        { title: "Funis & etapas", path: "/app/configuracoes/crm/funis" },
        { title: "Origens de leads", path: "/app/configuracoes/crm/origens" },
        { title: "Produtos", path: "/app/configuracoes/crm/produtos" },
        { title: "Campos personalizados", path: "/app/configuracoes/crm/campos" },
        { title: "Configuração de SLA", path: "/app/configuracoes/crm/sla" },
        { title: "Gatilhos IA", path: "/app/configuracoes/crm/gatilhos-ia" },
        { title: "Configuração de Dashboards", path: "/app/configuracoes/crm/dashboards" },
        { title: "Rodízio de Leads", path: "/app/configuracoes/crm/rodizio" },
      ],
    }] : []),
    ...(activeModules.produtividade ? [{
      title: "Produtividade",
      icon: Briefcase,
      items: [
        { title: "Categorias de tarefas", path: "/app/configuracoes/produtividade/categorias" },
        { title: "Funis & Kanbans", path: "/app/configuracoes/kanbans" },
      ],
    }] : []),
    ...(activeModules.financeiro ? [{
      title: "Financeiro",
      icon: Wallet,
      items: [
        { title: "Categorias financeiras", path: "/app/configuracoes/financeiro/categorias" },
        { title: "Gestão financeira de times", path: "/app/configuracoes/financeiro/squads" },
      ],
    }] : []),
    ...(activeModules.marketing || activeModules.engajamento ? [{
      title: "Engajamento",
      icon: Zap,
      items: [
        { title: "Modelos de mensagem", path: "/app/configuracoes/engajamento/modelos" },
        { title: "Automações", path: "/app/configuracoes/engajamento/automacoes" },
      ],
    }] : []),
    {
      title: "Integrações",
      icon: Plug,
      items: [
        { title: "Central de Aplicativos & Ads", path: "/app/configuracoes/integracoes/apps" },
        { title: "Servidores SMTP (E-mail)", path: "/app/configuracoes/integracoes/smtp" },
        { title: "Webhooks Globais & Logs", path: "/app/configuracoes/integracoes/webhooks" },
        { title: "Webhooks de SDR & Pré-Vendas", path: "/app/configuracoes/integracoes/sdr-webhooks" },
      ],
    },
    {
      title: "Sistema",
      icon: HardDrive,
      items: [
        ...(user?.isMaster && isModuleEnabled("aurora") ? [{ title: "Uso de Tokens (Aurora)", path: "/app/configuracoes/sistema/aurora" }] : []),
        { title: "Backups automáticos", path: "/app/configuracoes/sistema/backups" },
      ],
    },
  ];

  return (
    <SectionSidebar heading="Configurações" subheading="Gerenciamento Geral" groups={groups}>
      <Outlet />
    </SectionSidebar>
  );
}
