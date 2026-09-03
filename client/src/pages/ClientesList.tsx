import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Building2,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  MapPin,
  Filter,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  ClipboardCheck,
  CircleGauge,
  ListChecks,
} from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { useLocation } from "wouter";
import { formatCnpj } from "@/lib/alvaras";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  CAMPOS_CADASTRO,
  type CampoCadastro,
  type CompletudeStatus,
  type PendenciaCadastro,
} from "@shared/completudeCadastro";

type CoberturaStatus = "Sem Registro" | "Sem Alvará" | "Parcial" | "Coberto";

interface ClientesListProps {
  basePath?: string;
  contexto?: "alvaras" | "certidoes";
}

function CnpjCopyCell({ cnpj }: { cnpj: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const raw = cnpj.replace(/\D/g, "");
    navigator.clipboard.writeText(raw).then(() => {
      setCopied(true);
      toast.success("CNPJ copiado!", { duration: 1500 });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex items-center gap-1.5 group">
      <span className="text-sm font-mono text-muted-foreground">{formatCnpj(cnpj)}</span>
      <button
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
        title="Copiar CNPJ"
      >
        {copied
          ? <Check className="h-3 w-3 text-green-600" />
          : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}

function CoberturaBadge({ cobertura, total, onToggleSemRegistro, canToggle, isLoading }: {
  cobertura: CoberturaStatus;
  total: number;
  onToggleSemRegistro?: (value: boolean) => void;
  canToggle?: boolean;
  isLoading?: boolean;
}) {
  if (cobertura === "Sem Registro") {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); if (canToggle) onToggleSemRegistro?.(false); }}
        title={canToggle ? "Clique para desfazer \"Sem Registro\"" : "Sem Registro"}
        disabled={isLoading}
        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-violet-300 text-violet-600 bg-violet-50 dark:bg-violet-950/30 transition-all ${canToggle ? "hover:bg-violet-100 hover:border-violet-400 cursor-pointer" : "cursor-default"}`}
      >
        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldOff className="h-3 w-3" />}
        Sem Registro
      </button>
    );
  }
  if (cobertura === "Sem Alvará") {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); if (canToggle) onToggleSemRegistro?.(true); }}
        title={canToggle ? "Marcar como \"Sem Registro\"" : "Sem Alvará"}
        disabled={isLoading}
        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-gray-300 text-gray-500 bg-gray-50 dark:bg-gray-900/30 transition-all ${canToggle ? "hover:bg-violet-50 hover:border-violet-300 hover:text-violet-600 cursor-pointer" : "cursor-default"}`}
      >
        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldOff className="h-3 w-3" />}
        Sem Alvará
      </button>
    );
  }
  if (cobertura === "Parcial") {
    return (
      <Badge variant="outline" className="gap-1 text-xs border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30">
        <ShieldAlert className="h-3 w-3" />
        Parcial ({total})
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-xs border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30">
      <ShieldCheck className="h-3 w-3" />
      Coberto ({total})
    </Badge>
  );
}

function CompletudeBadge({ completude }: {
  completude: { percentual: number; status: CompletudeStatus; pendencias: PendenciaCadastro[] };
}) {
  const estilos = completude.status === "Completo"
    ? { barra: "bg-emerald-500", texto: "text-emerald-700", fundo: "bg-emerald-50" }
    : completude.status === "Crítico"
      ? { barra: "bg-red-500", texto: "text-red-700", fundo: "bg-red-50" }
      : { barra: "bg-amber-500", texto: "text-amber-700", fundo: "bg-amber-50" };
  const campos = completude.pendencias.map((item) => item.label).join(", ");

  return (
    <div className="min-w-32" title={campos ? `Pendências: ${campos}` : "Cadastro completo"}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${estilos.fundo} ${estilos.texto}`}>
          {completude.status}
        </span>
        <span className="text-xs font-semibold tabular-nums">{completude.percentual}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${estilos.barra}`} style={{ width: `${completude.percentual}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {completude.pendencias.length === 0
          ? "Sem pendências"
          : `${completude.pendencias.length} campo${completude.pendencias.length > 1 ? "s" : ""} pendente${completude.pendencias.length > 1 ? "s" : ""}`}
      </p>
    </div>
  );
}

export default function ClientesList({ basePath = "/clientes", contexto = "alvaras" }: ClientesListProps) {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<string>("");
  const [municipioFiltro, setMunicipioFiltro] = useState<string>("");
  const [coberturaFiltro, setCoberturaFiltro] = useState<string>("");
  const [completudeFiltro, setCompletudeFiltro] = useState<string>("");
  const [pendenciaFiltro, setPendenciaFiltro] = useState<string>("");

  // Modal de importação
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: clientes, isLoading, refetch } = trpc.clientes.listComCobertura.useQuery({
    search: search || undefined,
    estado: estadoFiltro || undefined,
    municipio: municipioFiltro || undefined,
    cobertura: (coberturaFiltro as CoberturaStatus) || undefined,
    completude: (completudeFiltro as CompletudeStatus) || undefined,
    pendencia: (pendenciaFiltro as CampoCadastro) || undefined,
  });

  const { data: estados } = trpc.clientes.listarEstados.useQuery();
  const { data: municipios } = trpc.clientes.listarMunicipios.useQuery({
    estado: estadoFiltro || undefined,
  });

  const deleteMutation = trpc.clientes.delete.useMutation({
    onSuccess: () => {
      toast.success("Cliente removido.");
      refetch();
    },
    onError: (e) => toast.error("Erro ao remover: " + e.message),
  });

  const { user } = useAuth();
  const { pode } = usePermissoes();
  const canToggle = pode("clientes", "marcar_sem_registro");
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const toggleSemRegistroMutation = trpc.clientes.toggleSemRegistro.useMutation({
    onSuccess: () => {
      refetch();
      setTogglingId(null);
    },
    onError: (e) => {
      toast.error("Erro ao atualizar: " + e.message);
      setTogglingId(null);
    },
  });

  const handleToggleSemRegistro = (id: number, value: boolean) => {
    setTogglingId(id);
    toggleSemRegistroMutation.mutate({ id, semRegistro: value });
    toast.success(value ? "Marcado como Sem Registro" : "Marcado como Sem Alvará");
  };

  const importarMutation = trpc.clientes.importarPlanilha.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Importação concluída! ${data.criados} criado(s), ${data.atualizados} atualizado(s)${data.erros > 0 ? `, ${data.erros} erro(s)` : ""}.`
      );
      setImportOpen(false);
      setImportFile(null);
      refetch();
    },
    onError: (e) => toast.error("Erro na importação: " + e.message),
  });

  const handleDelete = (id: number, nome: string) => {
    if (confirm(`Deseja remover o cliente "${nome}"? Esta ação não pode ser desfeita.`)) {
      deleteMutation.mutate({ id });
    }
  };

  const handleFileSelect = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
      toast.error("Formato inválido. Use .xlsx, .xls ou .csv");
      return;
    }
    setImportFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const handleImport = async () => {
    if (!importFile) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      importarMutation.mutate({ fileBase64: base64, fileName: importFile.name });
    };
    reader.readAsDataURL(importFile);
  };

  const temFiltros = !!estadoFiltro || !!municipioFiltro || !!search || !!coberturaFiltro || !!completudeFiltro || !!pendenciaFiltro;

  // Contadores de cobertura para exibição no topo
  const semAlvara = clientes?.filter((c) => c.cobertura === "Sem Alvará").length ?? 0;
  const semRegistro = clientes?.filter((c) => c.cobertura === "Sem Registro").length ?? 0;
  const parcial = clientes?.filter((c) => c.cobertura === "Parcial").length ?? 0;
  const coberto = clientes?.filter((c) => c.cobertura === "Coberto").length ?? 0;
  const completos = clientes?.filter((c) => c.completude.status === "Completo").length ?? 0;
  const emComplementacao = clientes?.filter((c) => c.completude.status === "Em complementação").length ?? 0;
  const criticos = clientes?.filter((c) => c.completude.status === "Crítico").length ?? 0;
  const mediaCompletude = clientes && clientes.length > 0
    ? Math.round(clientes.reduce((total, c) => total + c.completude.percentual, 0) / clientes.length)
    : 0;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {contexto === "certidoes" ? "Cadastro empresarial" : "Clientes"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {contexto === "certidoes"
              ? "Base única compartilhada com o Gestor de Alvarás"
              : "Gerencie os clientes e acompanhe a cobertura de alvarás"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Importar Planilha
          </Button>
          <Button onClick={() => setLocation(`${basePath}/novo`)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* Mapeamento de qualidade do cadastro compartilhado */}
      {!isLoading && clientes && clientes.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4">
            <div className="flex items-center gap-2 text-blue-700">
              <CircleGauge className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Completude média</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-blue-950">{mediaCompletude}%</p>
          </div>
          <button
            type="button"
            onClick={() => setCompletudeFiltro(completudeFiltro === "Completo" ? "" : "Completo")}
            className={`rounded-xl border p-4 text-left transition-colors ${completudeFiltro === "Completo" ? "border-emerald-400 bg-emerald-100" : "border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50"}`}
          >
            <div className="flex items-center gap-2 text-emerald-700"><ClipboardCheck className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wide">Completos</span></div>
            <p className="mt-2 text-2xl font-bold text-emerald-950">{completos}</p>
          </button>
          <button
            type="button"
            onClick={() => setCompletudeFiltro(completudeFiltro === "Em complementação" ? "" : "Em complementação")}
            className={`rounded-xl border p-4 text-left transition-colors ${completudeFiltro === "Em complementação" ? "border-amber-400 bg-amber-100" : "border-amber-200 bg-amber-50/70 hover:bg-amber-50"}`}
          >
            <div className="flex items-center gap-2 text-amber-700"><ListChecks className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wide">Em complementação</span></div>
            <p className="mt-2 text-2xl font-bold text-amber-950">{emComplementacao}</p>
          </button>
          <button
            type="button"
            onClick={() => setCompletudeFiltro(completudeFiltro === "Crítico" ? "" : "Crítico")}
            className={`rounded-xl border p-4 text-left transition-colors ${completudeFiltro === "Crítico" ? "border-red-400 bg-red-100" : "border-red-200 bg-red-50/70 hover:bg-red-50"}`}
          >
            <div className="flex items-center gap-2 text-red-700"><AlertCircle className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wide">Críticos</span></div>
            <p className="mt-2 text-2xl font-bold text-red-950">{criticos}</p>
          </button>
        </div>
      )}

      {/* Cards de resumo de cobertura */}
      {contexto === "alvaras" && !isLoading && clientes && clientes.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {/* Sem Alvará — automático, cinza */}
          <button
            onClick={() => setCoberturaFiltro(coberturaFiltro === "Sem Alvará" ? "" : "Sem Alvará")}
            className={`p-3 rounded-lg border text-left transition-all ${
              coberturaFiltro === "Sem Alvará"
                ? "border-gray-400 bg-gray-100 dark:bg-gray-800/60"
                : "border-border hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/30"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <ShieldOff className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Sem Alvará</span>
            </div>
            <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{semAlvara}</p>
          </button>
          {/* Sem Registro — manual, violeta */}
          <button
            onClick={() => setCoberturaFiltro(coberturaFiltro === "Sem Registro" ? "" : "Sem Registro")}
            className={`p-3 rounded-lg border text-left transition-all ${
              coberturaFiltro === "Sem Registro"
                ? "border-violet-400 bg-violet-100 dark:bg-violet-950/40"
                : "border-border hover:border-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/20"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <ShieldOff className="h-4 w-4 text-violet-500" />
              <span className="text-xs font-medium text-violet-700 dark:text-violet-400">Sem Registro</span>
            </div>
            <p className="text-2xl font-bold text-violet-700 dark:text-violet-400">{semRegistro}</p>
          </button>
          <button
            onClick={() => setCoberturaFiltro(coberturaFiltro === "Parcial" ? "" : "Parcial")}
            className={`p-3 rounded-lg border text-left transition-all ${
              coberturaFiltro === "Parcial"
                ? "border-amber-400 bg-amber-100 dark:bg-amber-950/40"
                : "border-border hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Cobertura Parcial</span>
            </div>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{parcial}</p>
          </button>
          <button
            onClick={() => setCoberturaFiltro(coberturaFiltro === "Coberto" ? "" : "Coberto")}
            className={`p-3 rounded-lg border text-left transition-all ${
              coberturaFiltro === "Coberto"
                ? "border-emerald-400 bg-emerald-100 dark:bg-emerald-950/40"
                : "border-border hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Coberto</span>
            </div>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{coberto}</p>
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Atalho rápido: filtrar por São Paulo */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Estado
          </Label>
          <div className="flex gap-1.5 items-center">
            <button
              onClick={() => {
                if (estadoFiltro === "SP") {
                  setEstadoFiltro("");
                  setMunicipioFiltro("");
                } else {
                  setEstadoFiltro("SP");
                  setMunicipioFiltro("");
                }
              }}
              className={`h-9 px-3 rounded-md text-xs font-semibold border transition-all ${
                estadoFiltro === "SP"
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-blue-700 border-blue-300 hover:bg-blue-50"
              }`}
            >
              🇧🇷 SP
            </button>
            <Select
              value={estadoFiltro || "all"}
              onValueChange={(v) => {
                setEstadoFiltro(v === "all" ? "" : v);
                setMunicipioFiltro("");
              }}
            >
              <SelectTrigger className="h-9 text-sm w-[130px]">
                <SelectValue placeholder="Outros" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                {(estados ?? []).map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por razão social ou CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Município
          </Label>
          <Select
            value={municipioFiltro || "all"}
            onValueChange={(v) => setMunicipioFiltro(v === "all" ? "" : v)}
          >
            <SelectTrigger className="h-9 text-sm w-[180px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os municípios</SelectItem>
              {(municipios ?? []).map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <CircleGauge className="h-3 w-3" /> Completude
          </Label>
          <Select value={completudeFiltro || "all"} onValueChange={(v) => setCompletudeFiltro(v === "all" ? "" : v)}>
            <SelectTrigger className="h-9 w-[180px] text-sm"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os níveis</SelectItem>
              <SelectItem value="Completo">Completo</SelectItem>
              <SelectItem value="Em complementação">Em complementação</SelectItem>
              <SelectItem value="Crítico">Crítico</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <ListChecks className="h-3 w-3" /> Campo pendente
          </Label>
          <Select value={pendenciaFiltro || "all"} onValueChange={(v) => setPendenciaFiltro(v === "all" ? "" : v)}>
            <SelectTrigger className="h-9 w-[200px] text-sm"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as pendências</SelectItem>
              {CAMPOS_CADASTRO.map((item) => (
                <SelectItem key={item.campo} value={item.campo}>{item.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {temFiltros && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 text-muted-foreground"
            onClick={() => {
              setSearch("");
              setEstadoFiltro("");
              setMunicipioFiltro("");
              setCoberturaFiltro("");
              setCompletudeFiltro("");
              setPendenciaFiltro("");
            }}
          >
            <X className="h-3.5 w-3.5" />
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Contador */}
      {!isLoading && clientes && (
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {clientes.length} cliente{clientes.length !== 1 ? "s" : ""} encontrado{clientes.length !== 1 ? "s" : ""}
          </p>
          {temFiltros && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Filter className="h-3 w-3" />
              Filtros ativos
            </Badge>
          )}
        </div>
      )}

      {/* Tabela */}
      <Card className="border shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !clientes || clientes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="p-4 rounded-full bg-muted">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {temFiltros ? "Nenhum cliente encontrado com os filtros aplicados" : "Nenhum cliente cadastrado"}
              </p>
              {!temFiltros && (
                <Button variant="outline" size="sm" onClick={() => setLocation(`${basePath}/novo`)}>
                  Cadastrar primeiro cliente
                </Button>
              )}
            </div>
          ) : (
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[38%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Razão Social
                  </TableHead>
                  <TableHead className="w-[170px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Cadastro
                  </TableHead>
                  <TableHead className="hidden w-[180px] text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:table-cell">
                    CNPJ
                  </TableHead>
                  <TableHead className="hidden w-[180px] text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">
                    Município / Estado
                  </TableHead>
                  {contexto === "alvaras" && (
                    <TableHead className="hidden w-[130px] text-xs font-semibold uppercase tracking-wider text-muted-foreground xl:table-cell">
                      Cobertura
                    </TableHead>
                  )}
                  <TableHead className="hidden w-[140px] text-xs font-semibold uppercase tracking-wider text-muted-foreground 2xl:table-cell">
                    Contato
                  </TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((c) => {
                  const mun = c.municipio || c.cidade;
                  const est = c.estado || c.uf;
                  const localidade = mun && est ? `${mun} / ${est}` : mun ?? est ?? "—";

                  return (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => setLocation(`${basePath}/${c.id}`)}
                    >
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium" title={c.razaoSocial}>{c.razaoSocial}</p>
                          {c.nomeFantasia && (
                            <p className="truncate text-xs text-muted-foreground" title={c.nomeFantasia}>{c.nomeFantasia}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><CompletudeBadge completude={c.completude} /></TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <CnpjCopyCell cnpj={c.cnpj} />
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                        <div className="flex items-center gap-1">
                          {(mun || est) && <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/60" />}
                          <span className="truncate" title={localidade}>{localidade}</span>
                        </div>
                      </TableCell>
                      {contexto === "alvaras" && (
                        <TableCell className="hidden xl:table-cell">
                          <CoberturaBadge
                            cobertura={c.cobertura}
                            total={c.totalAlvaras}
                            canToggle={canToggle}
                            isLoading={togglingId === c.id}
                            onToggleSemRegistro={(value) => handleToggleSemRegistro(c.id, value)}
                          />
                        </TableCell>
                      )}
                      <TableCell className="hidden text-sm text-muted-foreground 2xl:table-cell">
                        {c.nomeContato ?? "—"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setLocation(`${basePath}/${c.id}`)}>
                              <Eye className="mr-2 h-4 w-4" /> Ver detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLocation(`${basePath}/${c.id}/editar`)}>
                              <Pencil className="mr-2 h-4 w-4" /> Completar cadastro
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(c.id, c.razaoSocial)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Remover
                            </DropdownMenuItem>
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

      {/* Modal de Importação */}
      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) setImportFile(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Importar Clientes via Planilha
            </DialogTitle>
            <DialogDescription>
              Suba um arquivo <strong>.xlsx</strong>, <strong>.xls</strong> ou <strong>.csv</strong>.
              Colunas obrigatórias: <code>CNPJ</code> e <code>Razão Social</code>.
              Para filtros de localidade: <code>Município</code> e <code>Estado</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : importFile
                  ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20"
                  : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
              />
              {importFile ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{importFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(importFile.size / 1024).toFixed(1)} KB — clique para trocar</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm font-medium">Arraste o arquivo ou clique para selecionar</p>
                  <p className="text-xs text-muted-foreground">.xlsx, .xls ou .csv</p>
                </div>
              )}
            </div>

            {importarMutation.isError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{importarMutation.error?.message}</p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => { setImportOpen(false); setImportFile(null); }}
                disabled={importarMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={!importFile || importarMutation.isPending}
                className="gap-2"
              >
                {importarMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Importando...</>
                ) : (
                  <><Upload className="h-4 w-4" /> Importar</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import { usePermissoes } from "@/hooks/usePermissoes";
