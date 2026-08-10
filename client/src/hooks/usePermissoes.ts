import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * Hook para verificar permissões do usuário logado.
 * Retorna uma função `pode(modulo, acao)` que retorna true/false.
 * Masters sempre têm acesso a tudo.
 */
export function usePermissoes() {
  const { user } = useAuth();
  const { data: permissoes } = trpc.permissoes.minhasPermissoes.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // cache 5 minutos
  });

  const pode = (modulo: string, acao: string): boolean => {
    // Master sempre pode tudo
    if (user?.role === "master") return true;
    // Se ainda carregando, assume permitido para não bloquear a UI
    if (!permissoes) return true;
    const chave = `${modulo}.${acao}`;
    return permissoes[chave] ?? false;
  };

  return { pode, permissoes };
}
