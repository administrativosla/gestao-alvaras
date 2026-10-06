import { diaLocal } from "./decFormat";
import { ROTA_RELATORIO_DEC } from "@shared/portal";

export type FiltrosRelatorioDec = {
  inicio: string;
  fim: string;
  categoriaId?: number;
  operadorId?: number;
  clienteId?: number;
};

function diaValido(valor: string | null): valor is string {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = new Date(`${valor}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

function idValido(valor: string | null): number | undefined {
  if (!valor || !/^[1-9]\d*$/.test(valor)) return undefined;
  const id = Number(valor);
  return Number.isSafeInteger(id) ? id : undefined;
}

export function linkRelatorioDec(filtros: FiltrosRelatorioDec, baixar = true) {
  const params = new URLSearchParams({ inicio: filtros.inicio, fim: filtros.fim });
  if (filtros.categoriaId) params.set("categoriaId", String(filtros.categoriaId));
  if (filtros.operadorId) params.set("operadorId", String(filtros.operadorId));
  if (filtros.clienteId) params.set("clienteId", String(filtros.clienteId));
  if (baixar) params.set("baixar", "1");
  return `${ROTA_RELATORIO_DEC}?${params.toString()}`;
}

export function lerFiltrosRelatorioDec(search: string, agora = new Date()): FiltrosRelatorioDec {
  const params = new URLSearchParams(search);
  const primeiroDiaMes = diaLocal(new Date(agora.getFullYear(), agora.getMonth(), 1));
  const hoje = diaLocal(agora);
  const inicio = params.get("inicio");
  const fim = params.get("fim");
  return {
    inicio: diaValido(inicio) ? inicio : primeiroDiaMes,
    fim: diaValido(fim) ? fim : hoje,
    categoriaId: idValido(params.get("categoriaId")),
    operadorId: idValido(params.get("operadorId")),
    clienteId: idValido(params.get("clienteId")),
  };
}
