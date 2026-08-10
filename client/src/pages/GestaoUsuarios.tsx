import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  UserX, UserCheck, Crown, Shield, User, Loader2, Mail,
  Send, Ban, RotateCcw, ChevronDown, ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type UserRole = "operator" | "gestor" | "master";
type UserStatus = "pending" | "active" | "blocked";
type ConviteStatus = "pending" | "accepted" | "cancelled";

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
  operator: "border-slate-300 text-slate-700 bg-slate-50",
  gestor: "border-blue-300 text-blue-700 bg-blue-50",
  master: "border-amber-300 text-amber-700 bg-amber-50",
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

const CONVITE_STATUS_LABELS: Record<ConviteStatus, string> = {
  pending: "Aguardando",
  accepted: "Aceito",
  cancelled: "Cancelado",
};

const CONVITE_STATUS_COLORS: Record<ConviteStatus, string> = {
  pending: "border-blue-300 text-blue-700 bg-blue-50",
  accepted: "border-emerald-300 text-emerald-700 bg-emerald-50",
  cancelled: "border-slate-300 text-slate-500 bg-slate-50",
};

export default function GestaoUsuarios() {
  const { user: me } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // Queries
  const { data: usuarios, isLoading } = trpc.usuarios.listar.useQuery();
  const { data: listaConvites, isLoading: loadingConvites } = trpc.usuarios.listarConvites.useQuery();

  // Estados do formulário de convite
  const [emailConvite, setEmailConvite] = useState("");
  const [roleConvite, setRoleConvite] = useState<UserRole>("operator");
  const [emailError, setEmailError] = useState("");
  const [showConvites, setShowConvites] = useState(true);

  // Estados de aprovação
  const [aprovandoId, setAprovandoId] = useState<number | null>(null);
  const [roleParaAprovar, setRoleParaAprovar] = useState<UserRole>("operator");

  // Mutations
  const convidarMutation = trpc.usuarios.convidar.useMutation({
    onSuccess: (data) => {
      if (data.ok) {
        toast.success(`Convite enviado para ${data.email}!`);
      } else {
        toast.warning(`Convite registrado, mas houve um problema ao enviar o e-mail para ${data.email}. Verifique as configurações SMTP.`);
      }
      setEmailConvite("");
      setRoleConvite("operator");
      utils.usuarios.listarConvites.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const cancelarConviteMutation = trpc.usuarios.cancelarConvite.useMutation({
    onSuccess: () => {
      toast.success("Convite cancelado.");
      utils.usuarios.listarConvites.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

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
  const convitesPendentes = (listaConvites ?? []).filter((c) => c.status === "pending");
  const convitesHistorico = (listaConvites ?? []).filter((c) => c.status !== "pending");

  function handleEnviarConvite() {
    if (!emailConvite.trim()) {
      setEmailError("Informe o e-mail do usuário.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailConvite.trim())) {
      setEmailError("E-mail inválido.");
      return;
    }
    setEmailError("");
    convidarMutation.mutate({
      email: emailConvite.trim().toLowerCase(),
      role: roleConvite,
      origin: window.location.origin,
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl animate-fade-in-up">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gestão de Usuários</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Convide novos usuários, aprove acessos e gerencie os níveis de permissão da equipe
        </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={() => setLocation("/usuarios/permissoes")}>
          <ShieldCheck className="h-4 w-4" />
          Gerenciar Permissões
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border shadow-sm">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <Mail className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{convitesPendentes.length}</p>
              <p className="text-xs text-muted-foreground">Convites enviados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-50">
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
            <div className="p-2 rounded-lg bg-emerald-50">
              <UserCheck className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{ativos.length}</p>
              <p className="text-xs text-muted-foreground">Usuários ativos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Box de Convite ─────────────────────────────────────────────────────── */}
      <Card className="border-2 border-primary/20 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Send className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Convidar Novo Usuário</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                O usuário receberá um e-mail com o link de acesso e instruções para entrar no sistema
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <Label htmlFor="email-convite" className="text-xs font-medium mb-1.5 block">
                E-mail do usuário
              </Label>
              <Input
                id="email-convite"
                type="email"
                placeholder="usuario@empresa.com.br"
                value={emailConvite}
                onChange={(e) => { setEmailConvite(e.target.value); setEmailError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleEnviarConvite()}
                className={emailError ? "border-red-400 focus-visible:ring-red-400" : ""}
              />
              {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
            </div>
            <div className="w-36">
              <Label className="text-xs font-medium mb-1.5 block">Nível de acesso</Label>
              <Select value={roleConvite} onValueChange={(v) => setRoleConvite(v as UserRole)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">
                    <span className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-slate-500" /> Operador
                    </span>
                  </SelectItem>
                  <SelectItem value="gestor">
                    <span className="flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-blue-500" /> Gestor
                    </span>
                  </SelectItem>
                  <SelectItem value="master">
                    <span className="flex items-center gap-1.5">
                      <Crown className="h-3.5 w-3.5 text-amber-500" /> Master
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleEnviarConvite}
              disabled={convidarMutation.isPending}
              className="gap-2 h-9"
            >
              {convidarMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar Convite
            </Button>
          </div>

          {/* Descrição do fluxo */}
          <div className="mt-4 flex gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px]">1</span>
              Convite enviado por e-mail
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px]">2</span>
              Usuário faz login via Manus
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px]">3</span>
              Master aprova o acesso
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ─── Convites Pendentes ──────────────────────────────────────────────────── */}
      {(convitesPendentes.length > 0 || convitesHistorico.length > 0) && (
        <div className="space-y-3">
          <button
            className="flex items-center gap-2 w-full text-left group"
            onClick={() => setShowConvites((v) => !v)}
          >
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold flex-1">Convites Enviados</h2>
            {convitesPendentes.length > 0 && (
              <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs">{convitesPendentes.length} pendente{convitesPendentes.length > 1 ? "s" : ""}</Badge>
            )}
            {showConvites ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {showConvites && (
            <Card className="border shadow-sm">
              <CardContent className="pt-0 pb-0">
                {loadingConvites ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="divide-y">
                    {[...convitesPendentes, ...convitesHistorico].map((c) => {
                      const isExpired = c.status === "pending" && new Date(c.expiresAt) < new Date();
                      const statusDisplay = isExpired ? "cancelled" : (c.status as ConviteStatus);
                      return (
                        <div key={c.id} className="flex items-center gap-4 py-3 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{c.email}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Enviado em {new Date(c.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                              {c.status === "pending" && !isExpired && (
                                <> · Válido até {new Date(c.expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</>
                              )}
                              {isExpired && <> · <span className="text-red-500">Expirado</span></>}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className={`text-xs gap-1 ${ROLE_COLORS[c.role as UserRole]}`}>
                              {ROLE_ICONS[c.role as UserRole]}
                              {ROLE_LABELS[c.role as UserRole]}
                            </Badge>
                            <Badge variant="outline" className={`text-xs ${CONVITE_STATUS_COLORS[statusDisplay]}`}>
                              {isExpired ? "Expirado" : CONVITE_STATUS_LABELS[statusDisplay]}
                            </Badge>
                            {c.status === "pending" && !isExpired && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600">
                                    <Ban className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Cancelar convite?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      O convite para <strong>{c.email}</strong> será cancelado. Você poderá enviar um novo convite depois.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Manter</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-red-600 hover:bg-red-700"
                                      onClick={() => cancelarConviteMutation.mutate({ conviteId: c.id })}
                                    >
                                      Cancelar convite
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ─── Pendentes de Aprovação ──────────────────────────────────────────────── */}
      {pendentes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">!</div>
            <h2 className="text-base font-semibold">Aguardando Aprovação</h2>
            <Badge className="bg-orange-100 text-orange-700 border-orange-300 text-xs">{pendentes.length}</Badge>
          </div>
          <div className="space-y-2">
            {pendentes.map((u) => (
              <Card key={u.id} className="border-2 border-orange-200 bg-orange-50/30">
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

      {/* ─── Usuários Ativos ─────────────────────────────────────────────────────── */}
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

      {/* ─── Usuários Bloqueados ─────────────────────────────────────────────────── */}
      {bloqueados.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-muted-foreground">Usuários Bloqueados</h2>
          <Card className="border shadow-sm">
            <CardContent className="pt-0 pb-0">
              <div className="divide-y">
                {bloqueados.map((u) => (
                  <div key={u.id} className="flex items-center gap-4 py-3 flex-wrap opacity-60">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-through">{u.name || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{u.email || "Sem e-mail"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs border-red-300 text-red-600 bg-red-50">
                        <UserX className="h-3 w-3 mr-1" /> Bloqueado
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        onClick={() => alterarStatusMutation.mutate({ userId: u.id, userStatus: "active" })}
                        disabled={alterarStatusMutation.isPending}
                      >
                        <RotateCcw className="h-3 w-3" />
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
    </div>
  );
}
