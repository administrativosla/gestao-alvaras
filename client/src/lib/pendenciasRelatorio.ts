import { diaLocal } from "./decFormat";
import { ROTA_RELATORIO_PENDENCIAS_CONTRATO } from "@shared/portal";

export type FiltrosRelatorioPendencias = {
  inicio: string;
  fim: string;
  status?: string;
  tipo?: string;
};

const STATUS_VALIDOS = new Set([
  "sem_contato",
  "cliente_contatado",
  "contato_sem_retorno",
  "fase_ajustes",
  "aprovacao_minuta",
  "links_enviados",
  "assinado_parcial",
  "assinado_total",
]);
const TIPOS_VALIDOS = new Set(["prestacao_servico", "coworking"]);

function diaValido(valor: string | null): valor is string {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T12:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

export function linkRelatorioPendencias(filtros: FiltrosRelatorioPendencias, baixar = true) {
  const params = new URLSearchParams({ inicio: filtros.inicio, fim: filtros.fim });
  if (filtros.status) params.set("status", filtros.status);
  if (filtros.tipo) params.set("tipo", filtros.tipo);
  if (baixar) params.set("baixar", "1");
  return `${ROTA_RELATORIO_PENDENCIAS_CONTRATO}?${params.toString()}`;
}

export function lerFiltrosRelatorioPendencias(search: string, agora = new Date()): FiltrosRelatorioPendencias {
  const params = new URLSearchParams(search);
  const inicioPadrao = diaLocal(new Date(agora.getFullYear(), agora.getMonth(), 1));
  const fimPadrao = diaLocal(agora);
  const status = params.get("status");
  const tipo = params.get("tipo");
  return {
    inicio: diaValido(params.get("inicio")) ? params.get("inicio")! : inicioPadrao,
    fim: diaValido(params.get("fim")) ? params.get("fim")! : fimPadrao,
    status: status && STATUS_VALIDOS.has(status) ? status : undefined,
    tipo: tipo && TIPOS_VALIDOS.has(tipo) ? tipo : undefined,
  };
}
