export const PORTAL_AREAS = {
  alvaras: {
    nome: "Gestor de Alvarás",
    descricao: "Controle de licenças, vencimentos, renovações e conformidade cadastral.",
    rota: "/gestor-alvaras",
  },
  dec: {
    nome: "Quantificador de Mensagens DEC",
    descricao: "Mensagens recebidas, categorias e destinações aos clientes.",
    rota: "/dec",
  },
  pendencias: {
    nome: "Gestor de Pendências",
    descricao: "Acompanhamento de contratos, abordagens e assinaturas pendentes.",
    rota: "/pendencias-contrato",
  },
} as const;

export type PortalArea = keyof typeof PORTAL_AREAS;
type PortalAreaConfig = (typeof PORTAL_AREAS)[PortalArea];

export const ROTA_HISTORICO_DEC = "/dec/historico";
export const ROTA_RELATORIO_DEC = "/dec/relatorio";
export const ROTA_PENDENCIAS_CONTRATO = "/pendencias-contrato";

export const ROTAS_CADASTRO_EMPRESARIAL: Record<PortalArea, string> = {
  alvaras: "/clientes",
  dec: "/dec/clientes",
  pendencias: "/pendencias-contrato/clientes",
};

export function obterAreasAlternativas(areaAtual: PortalArea): Array<{ nome: string; rota: string }> {
  return (Object.entries(PORTAL_AREAS) as Array<[PortalArea, PortalAreaConfig]>)
    .filter(([area]) => area !== areaAtual)
    .map(([, area]) => ({ nome: area.nome, rota: area.rota }));
}

export function obterAreaAlternativa(areaAtual: PortalArea): { nome: string; rota: string } {
  return obterAreasAlternativas(areaAtual)[0] ?? { nome: "Portal Controller", rota: "/" };
}

export function identificarAreaPortal(caminho: string): PortalArea | "hub" {
  if (caminho === "/") return "hub";
  if (caminho === PORTAL_AREAS.dec.rota || caminho.startsWith(`${PORTAL_AREAS.dec.rota}/`)) return "dec";
  if (caminho === PORTAL_AREAS.pendencias.rota || caminho.startsWith(`${PORTAL_AREAS.pendencias.rota}/`)) return "pendencias";
  return "alvaras";
}
