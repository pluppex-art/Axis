/**
 * API pública do IBGE (servicodados.ibge.gov.br) pra estados/municípios reais
 * do Brasil — sem chave, sem custo. Criada porque os formulários de
 * cidade/estado (NovoClienteModal, Empresas, Clientes...) eram texto livre
 * com um valor padrão fixo ("São Paulo"/"SP") que virava dado real sempre
 * que o usuário não mexia no campo, mesmo em tenants de outras cidades
 * (ex.: Palmas/TO). Usada primeiro em NovoClienteModal.tsx; outros
 * formulários de cidade/estado podem reaproveitar este mesmo hook.
 */
import { useEffect, useState } from "react";

export interface IbgeEstado {
  id: number;
  sigla: string;
  nome: string;
}

export interface IbgeMunicipio {
  id: number;
  nome: string;
}

let estadosCache: IbgeEstado[] | null = null;
const municipiosCache = new Map<string, IbgeMunicipio[]>();

export async function fetchEstados(): Promise<IbgeEstado[]> {
  if (estadosCache) return estadosCache;
  const res = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome");
  if (!res.ok) throw new Error("Falha ao buscar estados (IBGE)");
  estadosCache = await res.json();
  return estadosCache!;
}

export async function fetchMunicipios(uf: string): Promise<IbgeMunicipio[]> {
  const key = uf.toUpperCase();
  if (municipiosCache.has(key)) return municipiosCache.get(key)!;
  const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${key}/municipios?orderBy=nome`);
  if (!res.ok) throw new Error("Falha ao buscar municípios (IBGE)");
  const data = await res.json();
  municipiosCache.set(key, data);
  return data;
}

/** Carrega estados uma vez e municípios sempre que a UF selecionada muda —
 * falha silenciosa (deixa listas vazias) pra não travar o formulário se a
 * API do IBGE estiver fora do ar; quem usa continua podendo digitar livre. */
export function useIbgeLocalidades(ufSelecionada: string) {
  const [estados, setEstados] = useState<IbgeEstado[]>([]);
  const [municipios, setMunicipios] = useState<IbgeMunicipio[]>([]);
  const [loadingEstados, setLoadingEstados] = useState(false);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingEstados(true);
    fetchEstados()
      .then((data) => { if (!cancelled) setEstados(data); })
      .catch(() => { /* API fora do ar — formulário continua usável em texto livre */ })
      .finally(() => { if (!cancelled) setLoadingEstados(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ufSelecionada) { setMunicipios([]); return; }
    let cancelled = false;
    setLoadingMunicipios(true);
    fetchMunicipios(ufSelecionada)
      .then((data) => { if (!cancelled) setMunicipios(data); })
      .catch(() => { if (!cancelled) setMunicipios([]); })
      .finally(() => { if (!cancelled) setLoadingMunicipios(false); });
    return () => { cancelled = true; };
  }, [ufSelecionada]);

  return { estados, municipios, loadingEstados, loadingMunicipios };
}
