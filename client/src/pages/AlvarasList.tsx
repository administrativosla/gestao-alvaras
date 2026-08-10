import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, Plus, Search, MoreHorizontal, Eye, Pencil, Trash2, AlertTriangle, Download, ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { calcDiasParaVencimento, formatDate, formatCnpj, getAlertaInfo, TIPOS_ALVARA, STATUS_RENOVACAO } from "@/lib/alvaras";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AlvarasList() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroCli, setFiltroCli] = useState<"todos" | "parcial" | "completo">("todos");
  const [filtroValidacao, setFiltroValidacao] = useState<"todos" | "ok" | "divergente" | "inconclusivo" | "sem">("todos");
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; nome: string } | null>(null);

  // Apenas GESTOR (nível 2) e MASTER (nível 3) podem excluir alvarás
  const podeExcluir = pode("alvaras", "excluir_alvara");
  const podeImportar = pode("alvaras", "importar_pdf");

  const { data: alvarasRaw, isLoading, refetch } = trpc.alvaras.list.useQuery({
    status: filtroStatus !== "todos" ? filtroStatus : undefined,
    tipo: filtroTipo !== "todos" ? filtroTipo : undefined,
    search: search || undefined,
  });

  // Filtro local de CLI Parcial (campo situacaoCli)
  const alvaras = alvarasRaw?.filter((a) => {
    if (filtroCli === "parcial") return (a.alvara as any).situacaoCli === "parcial";
    if (filtroCli === "completo") return (a.alvara as any).situacaoCli === "completo" || (a.alvara as any).situacaoCli == null;
    return true;
  })?.filter((a) => {
    if (filtroValidacao === "todos") return true;
    const end = (a.alvara as any).validacaoEndereco as string | null;
    const cnae = (a.alvara as any).validacaoCnae as string | null;
    const sit = (a.alvara as any).validacaoSituacao as string | null;
    const temValidacao = end || cnae || sit;
    if (filtroValidacao === "sem") return !temValidacao;
    const isDivergente = end === "divergente" || cnae === "divergente" || sit === "divergente";
    const isOk = temValidacao && end !== "divergente" && cnae !== "divergente" && sit !== "divergente" && (end === "ok" || cnae === "ok" || sit === "ok");
    const isInconclusivo = temValidacao && !isDivergente && !isOk;
    if (filtroValidacao === "divergente") return isDivergente;
    if (filtroValidacao === "ok") return !!isOk;
    if (filtroValidacao === "inconclusivo") return isInconclusivo;
    return true;
  });

  const deleteMutation = trpc.alvaras.delete.useMutation({
    onSuccess: () => {
      toast.success("Alvará excluído com sucesso.");
      setDeleteTarget(null);
      refetch();
    },
    onError: (e) => {
      toast.error("Erro ao excluir: " + e.message);
      setDeleteTarget(null);
    },
  });

  const handleDeleteConfirm = () => {
    if (deleteTarget) deleteMutation.mutate({ id: deleteTarget.id });
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alvarás</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie todos os alvarás cadastrados</p>
        </div>
        <Button onClick={() => setLocation("/importar")} className="gap-2">
          <Plus className="h-4 w-4" /> {podeImportar ? "Importar Alvará" : "Importar Alvará"}
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por razão social ou CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="h-9 w-52 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_RENOVACAO.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="h-9 w-44 text-sm">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS_ALVARA.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroCli} onValueChange={(v) => setFiltroCli(v as any)}>
          <SelectTrigger className="h-9 w-48 text-sm">
            <SelectValue placeholder="Situação CLI" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os CLIs</SelectItem>
            <SelectItem value="parcial">⚠️ CLI Parcial</SelectItem>
            <SelectItem value="completo">✅ CLI Completo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroValidacao} onValueChange={(v) => setFiltroValidacao(v as any)}>
          <SelectTrigger className="h-9 w-52 text-sm">
            <SelectValue placeholder="Validação RFB" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as validações</SelectItem>
            <SelectItem value="ok">✅ Conforme</SelectItem>
            <SelectItem value="divergente">❌ Divergente</SelectItem>
            <SelectItem value="inconclusivo">⚠️ Inconclusivo</SelectItem>
            <SelectItem value="sem">— Sem validação</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : !alvaras || alvaras.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="p-4 rounded-full bg-muted">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhum alvará encontrado</p>
              <Button variant="outline" size="sm" onClick={() => setLocation("/importar")} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Importar PDF
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Tipo</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Nº Alvará</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vencimento</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Prazo</TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
          <TableHead className="w-10 hidden sm:table-cell" title="PDF anexado / Validação RFB" />
          <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {alvaras.map((a) => {
                  const dias = calcDiasParaVencimento(a.alvara.dataVencimento);
                  const info = dias !== null ? getAlertaInfo(dias) : null;
                  return (
                    <TableRow
                      key={a.alvara.id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => setLocation(`/alvaras/${a.alvara.id}`)}
                    >
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{a.cliente.razaoSocial}</p>
                          <p className="text-xs text-muted-foreground font-mono">{formatCnpj(a.cliente.cnpj)}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                        <div className="flex flex-col gap-1">
                          <span>{a.alvara.tipo}</span>
                          {(a.alvara as any).situacaoCli === "parcial" && (() => {
                            let totalPendentes = 0;
                            try {
                              if ((a.alvara as any).cliOrgaosPendentes) {
                                const orgaos = JSON.parse((a.alvara as any).cliOrgaosPendentes);
                                totalPendentes = orgaos.filter((o: any) => o.status === "pendente").length;
                              }
                            } catch { /* ignore */ }
                            return (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5 w-fit">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                CLI Parcial{totalPendentes > 0 ? ` • ${totalPendentes} órgão${totalPendentes !== 1 ? "s" : ""} pendente${totalPendentes !== 1 ? "s" : ""}` : ""}
                              </span>
                            );
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                        {a.alvara.numeroAlvara ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(a.alvara.dataVencimento)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {info && dias !== null ? (
                          <span className={`text-xs font-semibold ${info.textColor}`}>
                            {info.label}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={a.alvara.status} dataVencimento={a.alvara.dataVencimento} />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell" onClick={(e) => e.stopPropagation()}>
                        {(a.alvara as any).arquivoPdfUrl ? (
                          <a
                            href={(a.alvara as any).arquivoPdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="PDF disponível — clique para visualizar"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
                          >
                            <FileText className="h-3.5 w-3.5 text-red-600" />
                          </a>
                        ) : (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-muted/40" title="Sem PDF anexado">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground/30" />
                          </span>
                        )}
                        {/* Badge de validação RFB */}
                        {(() => {
                          const end2 = (a.alvara as any).validacaoEndereco as string | null;
                          const cnae2 = (a.alvara as any).validacaoCnae as string | null;
                          const sit2 = (a.alvara as any).validacaoSituacao as string | null;
                          if (!end2 && !cnae2 && !sit2) return null;
                          const div2 = end2 === "divergente" || cnae2 === "divergente" || sit2 === "divergente";
                          const ok2 = !div2 && (end2 === "ok" || cnae2 === "ok" || sit2 === "ok");
                          if (div2) return <span title="Divergente da Receita Federal" className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 ml-1"><ShieldAlert className="h-3 w-3 text-red-600" /></span>;
                          if (ok2) return <span title="Conforme com a Receita Federal" className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 ml-1"><ShieldCheck className="h-3 w-3 text-emerald-600" /></span>;
                          return <span title="Validação inconclusiva" className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 ml-1"><ShieldQuestion className="h-3 w-3 text-amber-600" /></span>;
        })()}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setLocation(`/alvaras/${a.alvara.id}`)}>
                              <Eye className="mr-2 h-4 w-4" /> Ver detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLocation(`/alvaras/${a.alvara.id}/editar`)}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            {(a.alvara as any).arquivoPdfUrl && (
                              <DropdownMenuItem onClick={() => window.open((a.alvara as any).arquivoPdfUrl, "_blank")}>
                                <FileText className="mr-2 h-4 w-4 text-red-500" /> Ver PDF
                              </DropdownMenuItem>
                            )}
                            {podeExcluir && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget({ id: a.alvara.id, nome: a.cliente.razaoSocial })}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Excluir alvará
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir alvará?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir o alvará de{" "}
              <span className="font-semibold">{deleteTarget?.nome}</span>.
              Esta ação não pode ser desfeita e removerá também o histórico e PDFs vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Sim, excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
import { usePermissoes } from "@/hooks/usePermissoes";
  const { pode } = usePermissoes();
