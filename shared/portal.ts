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

export function identificarAreaPortal(caminho: string): PortalArea | "hub" {
  if (caminho === "/") return "hub";
  if (caminho.startsWith(PORTAL_AREAS.certidoes.rota)) return "certidoes";
  return "alvaras";
}
