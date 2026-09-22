import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

export type EnvStatus = 'operacional' | 'degradado' | 'offline' | 'em deploy';

export interface DevEnvironment {
  id: string;
  name: string;
  type: string;
  status: EnvStatus;
  url: string;
  version: string;
  lastDeploy: string;
  uptime: string;
  region: string;
  metrics: { cpu: number; memory: number; requests: string; latency: string };
  services: { name: string; status: EnvStatus }[];
}

function rowToEnv(row: any): DevEnvironment {
  return {
    id: row.env_id,
    name: row.name,
    type: row.type,
    status: row.status as EnvStatus,
    url: row.url || '',
    version: row.version || 'v1.0.0',
    lastDeploy: row.last_deploy || '-',
    uptime: row.uptime || '-',
    region: row.region || '',
    metrics: row.metrics || { cpu: 0, memory: 0, requests: '0/min', latency: '0ms' },
    services: row.services || [],
  };
}

export function useAmbientes() {
  const { activeTenantId } = useAuth();
  const [environments, setEnvironments] = useState<DevEnvironment[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = async () => {
    if (!supabase || !activeTenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('dev_environments')
      .select('*')
      .eq('tenant_id', activeTenantId)
      .order('created_at', { ascending: true });
    if (!error && data !== null) {
      setEnvironments(data.map(rowToEnv));
    }
    setLoading(false);
  };

  useEffect(() => { refetch(); }, [activeTenantId]);

  return { environments, loading, refetch };
}
