import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { STATUS_RENOVACAO, TIPOS_ALVARA } from "@/lib/alvaras";

export default function ExportarPage() {
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [search, setSearch] = useState("");

  const exportMutation = trpc.exportacao.alvaras.useMutation({
    onSuccess: (data) => {
      const link = document.createElement("a");
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${data.base64}`;
      link.download = data.fileName;
      link.click();
      toast.success("Arquivo exportado com sucesso!");
    },
    onError: (e) => toast.error("Erro ao exportar: " + e.message),
  });

  const handleExportar = () => {
    exportMutation.mutate({
      status: filtroStatus !== "todos" ? filtroStatus : undefined,
      tipo: filtroTipo !== "todos" ? filtroTipo : undefined,
      search: search || undefined,
    });
  };

  return (
    <div className="space-y-6 max-w-2xl animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Exportar Dados</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Exporte a lista de alvarás para planilha XLSX
        </p>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold">Filtros de Exportação</CardTitle>
          <p className="text-xs text-muted-foreground">
            Aplique filtros para exportar apenas os registros desejados. Deixe em branco para exportar tudo.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Busca por razão social ou CNPJ
            </label>
            <Input
              placeholder="Filtrar por nome ou CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  {STATUS_RENOVACAO.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Tipo de Alvará
              </label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  {TIPOS_ALVARA.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-2">
            <Button
              onClick={handleExportar}
              disabled={exportMutation.isPending}
              className="gap-2 w-full sm:w-auto"
            >
              {exportMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Gerando arquivo...</>
              ) : (
                <><FileSpreadsheet className="h-4 w-4" /> Exportar para XLSX</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-dashed">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-50">
              <Download className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">O que será exportado?</p>
              <p className="text-xs text-muted-foreground">
                A planilha exportada conterá: CNPJ, Razão Social, Nome Fantasia, Número do Alvará,
                Tipo, Órgão Emissor, Data de Emissão, Data de Vencimento, Status atual e
                Dias para Vencimento.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Para exportar o histórico de movimentações de um alvará específico, acesse a página
                de detalhes do alvará.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
