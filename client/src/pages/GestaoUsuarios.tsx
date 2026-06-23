import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Users, CheckCircle2, XCircle, ShieldCheck, Clock,
  UserX, UserCheck, Crown, Shield, User, Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type UserRole = "operator" | "gestor" | "master";
type UserStatus = "pending" | "active" | "blocked";

const ROLE_LABELS: Record<UserRole, string> = {
  operator: "Operador",
  gestor: "Gestor",
  master: "Master",
};

const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  operator: <User className="h-3.5 w-3.5" />,
  gestor: <Shield className="h-3.5 w-3.5" />,
  master: <Crown className="h-3.5 w-3.5" />,
};

const ROLE_COLORS: Record<UserRole, string> = {
  operator: "border-slate-300 text-slate-700 bg-slate-50 dark:bg-slate-900/30 dark:text-slate-300",
  gestor: "border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300",
  master: "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300",
};

const STATUS_COLORS: Record<UserStatus, string> = {
  pending: "border-orange-300 text-orange-700 bg-orange-50",
  active: "border-emerald-300 text-emerald-700 bg-emerald-50",
  blocked: "border-red-300 text-red-700 bg-red-50",
};

const STATUS_LABELS: Record<UserStatus, string> = {
  pending: "Pendente",
  active: "Ativo",
  blocked: "Bloqueado",
};

export default function GestaoUsuarios() {
  const { user: me } = useAuth();
  const utils = trpc.useUtils();
  const { data: usuarios, isLoading } = trpc.usuarios.listar.useQuery();
  const [aprovandoId, setAprovandoId] = useState<number | null>(null);
  const [roleParaAprovar, setRoleParaAprovar] = useState<UserRole>("operator");

  const aprovarMutation = trpc.usuarios.aprovar.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.name} aprovado como ${ROLE_LABELS[data.role as UserRole]}!`);
      setAprovandoId(null);
      utils.usuarios.listar.invalidate();
      utils.usuarios.contarPendentes.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const alterarRoleMutation = trpc.usuarios.alterarRole.useMutation({
    onSuccess: () => {
      toast.success("Nível atualizado com sucesso!");
      utils.usuarios.listar.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const alterarStatusMutation = trpc.usuarios.alterarStatus.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.userStatus === "blocked" ? "Usuário bloqueado." : "Usuário reativado.");
      utils.usuarios.listar.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const pendentes = (usuarios ?? []).filter((u) => u.userStatus === "pending");
  const ativos = (usuarios ?? []).filter((u) => u.userStatus === "active");
  const bloqueados = (usuarios ?? []).filter((u) => u.userStatus === "blocked");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gestão de Usuários</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aprove novos acessos e gerencie os níveis de permissão da equipe
        </p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border shadow-sm">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
              <Clock className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendentes.length}</p>
              <p className="text-xs text-muted-foreground">Aguardando aprovação</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
              <UserCheck className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{ativos.length}</p>
              <p className="text-xs text-muted-foreground">Usuários ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
              <UserX className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{bloqueados.length}</p>
              <p className="text-xs text-muted-foreground">Bloqueados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pendentes */}
      {pendentes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">!</div>
            <h2 className="text-base font-semibold">Aguardando Aprovação</h2>
            <Badge className="bg-orange-100 text-orange-700 border-orange-300 text-xs">{pendentes.length}</Badge>
          </div>
          <div className="space-y-2">
            {pendentes.map((u) => (
              <Card key={u.id} className="border-2 border-orange-200 bg-orange-50/30 dark:bg-orange-950/10 dark:border-orange-800">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{u.name || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{u.email || "Sem e-mail"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Solicitou acesso em {new Date(u.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {aprovandoId === u.id ? (
                        <>
                          <Select
                            value={roleParaAprovar}
                            onValueChange={(v) => setRoleParaAprovar(v as UserRole)}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="operator">Operador</SelectItem>
                              <SelectItem value="gestor">Gestor</SelectItem>
                              <SelectItem value="master">Master</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button size="sm" className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => aprovarMutation.mutate({ userId: u.id, role: roleParaAprovar })}
                            disabled={aprovarMutation.isPending}>
                            {aprovarMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            Confirmar
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8" onClick={() => setAprovandoId(null)}>
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => { setAprovandoId(u.id); setRoleParaAprovar("operator"); }}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Aprovar
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-red-600 border-red-300 hover:bg-red-50">
                                <XCircle className="h-3.5 w-3.5" />
                                Rejeitar
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Rejeitar acesso?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  O usuário <strong>{u.name}</strong> será bloqueado e não poderá acessar o sistema.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction className="bg-red-600 hover:bg-red-700"
                                  onClick={() => alterarStatusMutation.mutate({ userId: u.id, userStatus: "blocked" })}>
                                  Rejeitar e bloquear
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Usuários ativos */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Usuários Ativos</h2>
        {ativos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum usuário ativo além de você.</p>
        ) : (
          <Card className="border shadow-sm">
            <CardContent className="pt-0 pb-0">
              <div className="divide-y">
                {ativos.map((u) => (
                  <div key={u.id} className="flex items-center gap-4 py-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{u.name || "Sem nome"}</p>
                        {u.id === me?.id && (
                          <Badge variant="outline" className="text-xs border-primary/30 text-primary">Você</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{u.email || "Sem e-mail"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Último acesso: {new Date(u.lastSignedIn).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={`text-xs gap-1 ${ROLE_COLORS[u.role as UserRole]}`}>
                        {ROLE_ICONS[u.role as UserRole]}
                        {ROLE_LABELS[u.role as UserRole] ?? u.role}
                      </Badge>
                      {u.id !== me?.id && (
                        <div className="flex items-center gap-1.5">
                          <Select
                            value={u.role}
                            onValueChange={(v) => alterarRoleMutation.mutate({ userId: u.id, role: v as UserRole })}
                            disabled={alterarRoleMutation.isPending}
                          >
                            <SelectTrigger className="w-28 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="operator">Operador</SelectItem>
                              <SelectItem value="gestor">Gestor</SelectItem>
                              <SelectItem value="master">Master</SelectItem>
                            </SelectContent>
                          </Select>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600">
                                <UserX className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Bloquear usuário?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  <strong>{u.name}</strong> perderá o acesso imediatamente. Você poderá reativar depois.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction className="bg-red-600 hover:bg-red-700"
                                  onClick={() => alterarStatusMutation.mutate({ userId: u.id, userStatus: "blocked" })}>
                                  Bloquear
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Usuários bloqueados */}
      {bloqueados.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-muted-foreground">Bloqueados</h2>
          <Card className="border shadow-sm opacity-75">
            <CardContent className="pt-0 pb-0">
              <div className="divide-y">
                {bloqueados.map((u) => (
                  <div key={u.id} className="flex items-center gap-4 py-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-muted-foreground">{u.name || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{u.email || "Sem e-mail"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={`text-xs ${STATUS_COLORS["blocked"]}`}>
                        Bloqueado
                      </Badge>
                      <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
                        onClick={() => alterarStatusMutation.mutate({ userId: u.id, userStatus: "active" })}
                        disabled={alterarStatusMutation.isPending}>
                        <UserCheck className="h-3 w-3" />
                        Reativar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Legenda de níveis */}
      <Card className="border bg-muted/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Níveis de Acesso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="flex items-start gap-2">
              <User className="h-3.5 w-3.5 text-slate-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-slate-700 dark:text-slate-300">Operador (Nível 1)</p>
                <p className="text-muted-foreground">Cadastra clientes, alvarás e atualiza status</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Shield className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-blue-700 dark:text-blue-300">Gestor (Nível 2)</p>
                <p className="text-muted-foreground">Tudo do Operador + exporta relatórios</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Crown className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-amber-700 dark:text-amber-300">Master (Nível 3)</p>
                <p className="text-muted-foreground">Acesso total + configura alertas + gerencia usuários</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
