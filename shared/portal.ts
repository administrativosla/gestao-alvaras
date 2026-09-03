export const PORTAL_AREAS = {
  alvaras: {
    nome: "Gestor de Alvarás",
    descricao: "Controle de licenças, vencimentos, renovações e conformidade cadastral.",
    rota: "/gestor-alvaras",
  },
  certidoes: {
    nome: "Gestor de Certidões",
    descricao: "Consultas, documentos emitidos e resultados por empresa e esfera.",
    rota: "/certidoes",
  },
} as const;

export type PortalArea = keyof typeof PORTAL_AREAS;

export const ROTAS_CADASTRO_EMPRESARIAL: Record<PortalArea, string> = {
  alvaras: "/clientes",
  certidoes: "/certidoes/clientes",
};

export function obterAreaAlternativa(areaAtual: PortalArea): { nome: string; rota: string } {
  const destino = areaAtual === "alvaras" ? PORTAL_AREAS.certidoes : PORTAL_AREAS.alvaras;
  return { nome: destino.nome, rota: destino.rota };
}

export function identificarAreaPortal(caminho: string): PortalArea | "hub" {
  if (caminho === "/") return "hub";
  if (caminho.startsWith(PORTAL_AREAS.certidoes.rota)) return "certidoes";
  return "alvaras";
}
