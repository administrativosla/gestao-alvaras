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
} as const;

export type PortalArea = keyof typeof PORTAL_AREAS;

export const ROTA_HISTORICO_DEC = "/dec/historico";

export const ROTAS_CADASTRO_EMPRESARIAL: Record<PortalArea, string> = {
  alvaras: "/clientes",
  dec: "/dec/clientes",
};

export function obterAreaAlternativa(areaAtual: PortalArea): { nome: string; rota: string } {
  const destino = areaAtual === "alvaras" ? PORTAL_AREAS.dec : PORTAL_AREAS.alvaras;
  return { nome: destino.nome, rota: destino.rota };
}

export function identificarAreaPortal(caminho: string): PortalArea | "hub" {
  if (caminho === "/") return "hub";
  if (caminho === PORTAL_AREAS.dec.rota || caminho.startsWith(`${PORTAL_AREAS.dec.rota}/`)) return "dec";
  return "alvaras";
}
