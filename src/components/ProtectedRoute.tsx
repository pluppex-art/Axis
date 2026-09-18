import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function ProtectedRoute({
  children,
  requireMaster = false,
  requirePartner = false,
}: {
  children: React.ReactElement;
  requireMaster?: boolean;
  /** G-Tech (master) ou organização parceira (ex.: Pluppex) — ver public.users.partner_id. */
  requirePartner?: boolean;
}) {
  const { user, authLoading } = useAuth();
  const location = useLocation();

  // Aguarda a sessão do Supabase Auth ser resolvida (getSession) antes de
  // decidir — evita um redirect falso para /login em cada refresh de página
  // enquanto a sessão real ainda está sendo carregada.
  if (authLoading) {
    return null;
  }

  if (!user) {
    // If not logged in, redirect to login page with the return url
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Defesa em profundidade: o RLS já bloqueia dados de outros tenants no banco,
  // mas rotas administrativas de plataforma (ex.: /app/admin) não deveriam nem
  // renderizar pra quem não é master — sem isso, a única barreira era a RLS.
  if (requireMaster && !user.isMaster) {
    return <Navigate to="/app" replace />;
  }

  // Mesma defesa em profundidade para páginas de parceiros (ex.: /app/parceiros):
  // só G-Tech (master) e organizações parceiras (partner_id preenchido, hoje só
  // a Pluppex) devem sequer renderizar a tela — o resto já é barrado pela RLS
  // (tenant_partners) e pela RPC platform_metrics_overview, mas sem essa guarda
  // de rota qualquer usuário logado via qualquer tenant chegava a montar a página.
  if (requirePartner && !user.isMaster && !user.partnerId) {
    return <Navigate to="/app" replace />;
  }

  return children;
}
