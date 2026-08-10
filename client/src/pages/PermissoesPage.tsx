import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Shield, Crown, User, Lock, ArrowLeft, Info } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type UserRole = "operator" | "gestor" | "master";

const MODULOS_LABELS: Record<string, string> = {
  clientes: "Clientes",
  alvaras: "Alvarás",
  pipeline: "Pipeline Comercial",
  exportacao: "Exportação",
  alertas: "Alertas",
  manutencao: "Manutenção",
};

const ACOES_LABELS: Record<string, string> = {
  visualizar_lista: "Visualizar lista",
  visualizar_detalhe: "Visualizar detalhe",
  marcar_sem_registro: "Marcar/desmarcar 'Sem Registro'",
  atualizar_receita: "Atualizar dados da Receita Federal",
  importar_pdf: "Importar PDF (unitário e lote)",
  revalidar_rfb: "Revalidar conformidade com RFB",
  excluir_alvara: "Excluir alvará",
  visualizar: "Visualizar pipeline",
  criar_negociacao: "Criar/avançar negociação",
  encerrar_negociacao: "Encerrar negociação",
  exportar_relatorios: "Exportar relatórios (XLSX/CSV)",
  visualizar_configuracoes: "Visualizar configurações de alerta",
  disparar_alertas: "Disparar alertas manualmente",
  gerenciar_emails: "Gerenciar e-mails de alerta",
  acessar_painel: "Acessar painel de manutenção",
  reprocessar_pdfs: "Reprocessar PDFs / Revalidar todos",
};

const PERFIL_ICONS: Record<UserRole, React.ReactNode> = {
  operator: <User className="h-3.5 w-3.5" />,
  gestor: <Shield className="h-3.5 w-3.5" />,
  master: <Crown className="h-3.5 w-3.5" />,
};

const PERFIL_LABELS: Record<UserRole, string> = {
  operator: "Operador",
  gestor: "Gestor",
  master: "Master",
};

const PERFIL_COLORS: Record<UserRole, string> = {
  operator: "bg-slate-100 text-slate-700 border-slate-200",
  gestor: "bg-blue-50 text-blue-700 border-blue-200",
  master: "bg-amber-50 text-amber-700 border-amber-200",
};

const PERFIS: UserRole[] = ["operator", "gestor", "master"];

export default function PermissoesPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isMaster = user?.role === "master";
  const isGestor = user?.role === "gestor" || isMaster;

  const { data: permissoes, isLoading, refetch } = trpc.permissoes.listar.useQuery();

  const atualizarMutation = trpc.permissoes.atualizar.useMutation({
    onSuccess: () => { refetch(); toast.success("Permissão atualizada."); },
    onError: (e) => toast.error(e.message),
  });

  const atualizarOperadorMutation = trpc.permissoes.atualizarOperador.useMutation({
    onSuccess: () => { refetch(); toast.success("Permissão atualizada."); },
    onError: (e) => toast.error(e.message),
  });

  if (!isGestor) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Lock className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Acesso restrito a Gestores e Masters.</p>
      </div>
    );
  }

  // Agrupar permissões por módulo
  const porModulo: Record<string, Record<string, Record<UserRole, { permitido: boolean; fixo: boolean }>>> = {};
  if (permissoes) {
    for (const p of permissoes) {
      if (!porModulo[p.modulo]) porModulo[p.modulo] = {};
      if (!porModulo[p.modulo][p.acao]) porModulo[p.modulo][p.acao] = {} as any;
      porModulo[p.modulo][p.acao][p.perfil as UserRole] = { permitido: p.permitido, fixo: p.fixo };
    }
  }

  const handleToggle = (perfil: UserRole, modulo: string, acao: string, novoValor: boolean) => {
    if (perfil === "master") return; // Master é sempre fixo
    if (perfil === "gestor" && !isMaster) return; // Gestor só pode alterar Operador
    if (perfil === "operator" && isGestor) {
      atualizarOperadorMutation.mutate({ modulo, acao, permitido: novoValor });
    } else if (isMaster) {
      atualizarMutation.mutate({ perfil, modulo, acao, permitido: novoValor });
    }
  };

  const canToggle = (perfil: UserRole, fixo: boolean) => {
    if (fixo) return false;
    if (perfil === "master") return false;
    if (perfil === "gestor") return isMaster;
    if (perfil === "operator") return isGestor;
    return false;
  };

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in-up">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs -ml-2" onClick={() => setLocation("/usuarios")}>
              <ArrowLeft className="h-3.5 w-3.5" /> Usuários
            </Button>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Gestão de Permissões</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure o que cada perfil pode fazer no sistema. Permissões fixas não podem ser alteradas.
          </p>
        </div>
        <div className="flex gap-2">
          {PERFIS.map((p) => (
            <div key={p} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${PERFIL_COLORS[p]}`}>
              {PERFIL_ICONS[p]}
              {PERFIL_LABELS[p]}
            </div>
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/40 rounded-lg px-4 py-2.5 border">
        <Info className="h-3.5 w-3.5 shrink-0" />
        <span><strong>Fixo</strong> = não pode ser alterado (regra do sistema).</span>
        <span><strong>Master</strong> sempre tem acesso total e não pode ser restringido.</span>
        {!isMaster && <span className="text-amber-600"><strong>Gestor</strong> pode alterar apenas as permissões do Operador.</span>}
      </div>

      {/* Matriz por módulo */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(porModulo).map(([modulo, acoes]) => (
            <Card key={modulo} className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{MODULOS_LABELS[modulo] ?? modulo}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider w-1/2">Ação</th>
                        {PERFIS.map((perfil) => (
                          <th key={perfil} className="px-4 py-2.5 text-center">
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${PERFIL_COLORS[perfil]}`}>
                              {PERFIL_ICONS[perfil]}
                              {PERFIL_LABELS[perfil]}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(acoes).map(([acao, perfisDados], idx) => (
                        <tr key={acao} className={`border-b last:border-0 ${idx % 2 === 0 ? "" : "bg-muted/10"}`}>
                          <td className="px-4 py-3 text-sm text-foreground">
                            {ACOES_LABELS[acao] ?? acao}
                          </td>
                          {PERFIS.map((perfil) => {
                            const dado = perfisDados[perfil];
                            if (!dado) return <td key={perfil} className="px-4 py-3 text-center">—</td>;
                            const editavel = canToggle(perfil, dado.fixo);
                            return (
                              <td key={perfil} className="px-4 py-3 text-center">
                                <div className="flex flex-col items-center gap-1">
                                  {editavel ? (
                                    <Switch
                                      checked={dado.permitido}
                                      onCheckedChange={(v) => handleToggle(perfil, modulo, acao, v)}
                                      disabled={atualizarMutation.isPending || atualizarOperadorMutation.isPending}
                                      className="data-[state=checked]:bg-emerald-500"
                                    />
                                  ) : (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <div className={`w-8 h-4 rounded-full flex items-center justify-center ${dado.permitido ? "bg-emerald-100" : "bg-slate-100"}`}>
                                        {dado.permitido
                                          ? <span className="text-[10px] text-emerald-600 font-bold">✓</span>
                                          : <span className="text-[10px] text-slate-400 font-bold">✗</span>
                                        }
                                      </div>
                                      {dado.fixo && <Lock className="h-2.5 w-2.5 text-muted-foreground/50" />}
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
