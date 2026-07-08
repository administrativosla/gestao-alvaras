import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Bell, Plus, Trash2, Loader2, Send, CheckCircle2,
  AlertCircle, Info, FlaskConical, Zap, Globe,
  CalendarClock, Clock, FileText, Users, RefreshCw,
  Download, Mail, ShieldOff, Upload, X, Building2,
} from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export default function ConfiguracaoAlertas() {
  const [novoEmailGlobal, setNovoEmailGlobal] = useState("");
  const [descricaoGlobal, setDescricaoGlobal] = useState("");
  const [emailTeste, setEmailTeste] = useState("");
  const [testando, setTestando] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState<{ success: boolean; error?: string } | null>(null);

  const { data: emailsGlobais, refetch: refetchGlobais } = trpc.alertas.listarEmailsGlobais.useQuery();

  const adicionarGlobalMutation = trpc.alertas.adicionarEmailGlobal.useMutation({
    onSuccess: () => {
      toast.success("Destinatário adicionado!");
      setNovoEmailGlobal("");
      setDescricaoGlobal("");
      refetchGlobais();
    },
    onError: (e) => toast.error(e.message),
  });

  const removerGlobalMutation = trpc.alertas.removerEmailGlobal.useMutation({
    onSuccess: () => { toast.success("Destinatário removido."); refetchGlobais(); },
    onError: (e) => toast.error(e.message),
  });

  const toggleGlobalMutation = trpc.alertas.toggleEmailGlobal.useMutation({
    onSuccess: () => refetchGlobais(),
    onError: (e) => toast.error(e.message),
  });

  const dispararMutation = trpc.alertas.dispararAlertas.useMutation({
    onSuccess: (data) => {
      if (data.enviados > 0) toast.success(`${data.enviados} alerta(s) de pré-vencimento enviado(s)!`);
      else toast.info("Nenhum alerta nos marcos de hoje.");
    },
    onError: (e) => toast.error("Erro ao disparar alertas: " + e.message),
  });

  const exportarPlanilhaMutation = trpc.alertas.exportarRelatorioAVencer.useMutation({
    onSuccess: (data) => {
      // Fazer download do XLSX no browser
      const link = document.createElement("a");
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${data.base64}`;
      link.download = data.fileName;
      link.click();
      toast.success(`Planilha exportada! ${data.total} alvará(s) a vencer nos próximos 30 dias.`);
    },
    onError: (e) => toast.error("Erro ao exportar planilha: " + e.message),
  });

  const enviarEmailConsolidadoMutation = trpc.alertas.enviarEmailConsolidadoAVencer.useMutation({
    onSuccess: (data) => {
      if (!data.ok && (data as any).motivo === "sem-destinatarios") {
        toast.warning("Nenhum destinatário ativo. Cadastre destinatários para receber o e-mail.");
      } else if (data.ok) {
        toast.success(`E-mail consolidado enviado! ${data.total} alvará(s) para ${data.destinatarios} destinatário(s).`);
      } else {
        toast.error("Falha ao enviar e-mail consolidado. Verifique as credenciais de e-mail.");
      }
    },
    onError: (e) => toast.error("Erro ao enviar e-mail: " + e.message),
  });

  const dispararRelatorioMutation = trpc.alertas.dispararRelatorio.useMutation({
    onSuccess: (data) => {
      if (!data.ok && (data as any).motivo === "sem-destinatarios") {
        toast.warning("Nenhum destinatário ativo. Cadastre destinatários para receber o relatório.");
      } else if (data.ok) {
        toast.success(`Relatório enviado! ${data.vencidos} vencido(s), ${data.aVencer} a vencer — para ${data.destinatarios} destinatário(s).`);
      } else {
        toast.error("Falha ao enviar o relatório. Verifique as credenciais de e-mail.");
      }
    },
    onError: (e) => toast.error("Erro ao enviar relatório: " + e.message),
  });

  const testarMutation = trpc.alertas.testarEmail.useMutation({
    onSuccess: (data) => {
      setTestando(false);
      setResultadoTeste(data);
      if (data.success) toast.success("E-mail de teste enviado! Verifique sua caixa de entrada.");
      else toast.error("Falha ao enviar e-mail de teste.");
    },
    onError: (e) => {
      setTestando(false);
      setResultadoTeste({ success: false, error: e.message });
      toast.error("Erro ao testar e-mail: " + e.message);
    },
  });

  const handleAdicionarGlobal = () => {
    if (!novoEmailGlobal.trim()) { toast.error("Informe um e-mail."); return; }
    adicionarGlobalMutation.mutate({ email: novoEmailGlobal.trim(), descricao: descricaoGlobal.trim() || undefined });
  };

  const handleTestarEmail = () => {
    if (!emailTeste.trim()) { toast.error("Informe o e-mail de destino para o teste."); return; }
    setTestando(true);
    setResultadoTeste(null);
    testarMutation.mutate({ destinatario: emailTeste.trim() });
  };

  const proximaExecucao = (() => {
    const agora = new Date();
    const proxima = new Date();
    proxima.setHours(13, 0, 0, 0);
    if (agora.getHours() >= 13) proxima.setDate(proxima.getDate() + 1);
    return proxima.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }) + " às 13h00";
  })();

  const totalDestinatariosAtivos = (emailsGlobais ?? []).filter((e) => e.ativo).length;

  // ─── Painel Comercial: Sem Registro ──────────────────────────────────────────
  const PAGE_SIZE_COMERCIAL = 10;
  const [paginaComercial, setPaginaComercial] = useState(1);
  const [emailsComerciais, setEmailsComerciais] = useState<string[]>([]);
  const [novoEmailComercial, setNovoEmailComercial] = useState("");
  const [emailsImportados, setEmailsImportados] = useState<string[]>([]);
  const fileInputComercialRef = useRef<HTMLInputElement>(null);

  const { data: clientesSemRegistro } = trpc.clientes.listSemRegistro.useQuery();

  const exportarSemRegistroMutation = trpc.clientes.exportarSemRegistroXlsx.useMutation({
    onSuccess: (data) => {
      const link = document.createElement("a");
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${data.base64}`;
      link.download = data.filename;
      link.click();
      toast.success(`Planilha exportada! ${data.total} cliente(s) sem registro.`);
    },
    onError: (e) => toast.error("Erro ao exportar: " + e.message),
  });

  const enviarEmailComercialMutation = trpc.clientes.enviarEmailComercialSemRegistro.useMutation({
    onSuccess: (data) => {
      if (data.success) toast.success(`E-mail enviado para ${emailsComerciais.length + emailsImportados.length} destinatário(s)! ${data.total} clientes sem registro.`);
      else toast.warning(data.message ?? "Nenhum cliente sem registro encontrado.");
    },
    onError: (e) => toast.error("Erro ao enviar e-mail: " + e.message),
  });

  const handleAdicionarEmailComercial = () => {
    const email = novoEmailComercial.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("E-mail inválido."); return; }
    if (emailsComerciais.includes(email) || emailsImportados.includes(email)) { toast.error("E-mail já adicionado."); return; }
    setEmailsComerciais((prev) => [...prev, email]);
    setNovoEmailComercial("");
  };

  const handleImportarEmailsComercial = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const emails: string[] = [];
        rows.forEach((row: any[]) => {
          row.forEach((cell) => {
            const val = String(cell ?? "").trim().toLowerCase();
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) && !emailsComerciais.includes(val) && !emailsImportados.includes(val) && !emails.includes(val)) {
              emails.push(val);
            }
          });
        });
        if (emails.length === 0) { toast.error("Nenhum e-mail válido encontrado no arquivo."); return; }
        setEmailsImportados((prev) => [...prev, ...emails]);
        toast.success(`${emails.length} e-mail(s) importado(s) do arquivo.`);
      } catch {
        toast.error("Erro ao ler o arquivo. Use XLSX ou CSV.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const todosDestinatariosComerciais = [...emailsComerciais, ...emailsImportados];

  const handleEnviarEmailComercial = () => {
    if (todosDestinatariosComerciais.length === 0) { toast.error("Adicione ao menos um e-mail destinatário."); return; }
    enviarEmailComercialMutation.mutate({ destinatarios: todosDestinatariosComerciais });
  };

  return (
    <div className="space-y-8 max-w-3xl animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alertas por E-mail</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie os envios automáticos de alertas de vencimento e relatórios diários
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SEÇÃO 1 — ALERTAS PRÉ-VENCIMENTO
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold shrink-0">1</div>
          <div>
            <h2 className="text-base font-semibold">Alertas de Pré-Vencimento</h2>
            <p className="text-xs text-muted-foreground">Disparados automaticamente às 8h nos marcos de 30, 15, 7, 3, 2 e 1 dia antes do vencimento</p>
          </div>
        </div>

        {/* Destinatários globais */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-900">
                <Globe className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Lista de Destinatários</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Estes e-mails recebem os alertas de pré-vencimento de <strong>todos os alvarás</strong> e também o relatório diário às 13h
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!emailsGlobais || emailsGlobais.length === 0 ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
                <Globe className="h-3.5 w-3.5 shrink-0" />
                Nenhum destinatário cadastrado. Adicione abaixo para ativar os alertas automáticos.
              </div>
            ) : (
              <div className="space-y-2">
                {emailsGlobais.map((eg) => (
                  <div key={eg.id} className={`flex items-center gap-3 p-2.5 rounded-lg border transition-opacity ${eg.ativo ? "bg-muted/30" : "bg-muted/10 opacity-60"}`}>
                    <Globe className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{eg.email}</p>
                      {eg.descricao && <p className="text-xs text-muted-foreground truncate">{eg.descricao}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={eg.ativo}
                        onCheckedChange={(ativo) => toggleGlobalMutation.mutate({ id: eg.id, ativo })}
                        className="scale-75"
                      />
                      <Badge variant="outline" className={`text-xs ${eg.ativo ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-muted text-muted-foreground"}`}>
                        {eg.ativo ? "Ativo" : "Pausado"}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removerGlobalMutation.mutate({ id: eg.id })}
                        disabled={removerGlobalMutation.isPending}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs font-medium">Adicionar destinatário</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="equipe@empresa.com"
                  value={novoEmailGlobal}
                  onChange={(e) => setNovoEmailGlobal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdicionarGlobal()}
                  className="text-sm h-9"
                />
                <Input
                  placeholder="Descrição (ex: Equipe Alvarás)"
                  value={descricaoGlobal}
                  onChange={(e) => setDescricaoGlobal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdicionarGlobal()}
                  className="text-sm h-9"
                />
                <Button size="sm" className="gap-1.5 shrink-0" onClick={handleAdicionarGlobal}
                  disabled={adicionarGlobalMutation.isPending}>
                  {adicionarGlobalMutation.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Plus className="h-3.5 w-3.5" />}
                  Adicionar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Relatório consolidado manual — exportar planilha e e-mail */}
        <Card className="border-2 border-amber-200 shadow-sm bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                <p className="font-medium">Relatório Consolidado — Alvarás a Vencer (1–30 dias)</p>
                <p>
                  Gere uma planilha XLSX ou envie um e-mail com a lista completa de todos os alvarás
                  que vencem nos próximos 30 dias, ordenados por urgência.
                  Funcionalidade independente dos alertas automáticos por marco.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300"
                onClick={() => exportarPlanilhaMutation.mutate()}
                disabled={exportarPlanilhaMutation.isPending}
                size="sm"
              >
                {exportarPlanilhaMutation.isPending
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando...</>
                  : <><Download className="h-3.5 w-3.5" /> Exportar Planilha</>}
              </Button>
              <Button
                className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => enviarEmailConsolidadoMutation.mutate()}
                disabled={enviarEmailConsolidadoMutation.isPending}
                size="sm"
              >
                {enviarEmailConsolidadoMutation.isPending
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando...</>
                  : <><Mail className="h-3.5 w-3.5" /> Enviar E-mail Consolidado</>}
              </Button>
            </div>
            {enviarEmailConsolidadoMutation.data && (
              <div className={`p-2.5 rounded-lg flex items-start gap-2 text-xs border ${
                enviarEmailConsolidadoMutation.data.ok
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-amber-50 border-amber-200 text-amber-700"
              }`}>
                {enviarEmailConsolidadoMutation.data.ok
                  ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  : <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                <div>
                  {enviarEmailConsolidadoMutation.data.ok ? (
                    <p className="font-medium">
                      E-mail enviado para <strong>{enviarEmailConsolidadoMutation.data.destinatarios}</strong> destinatário(s)
                      com <strong>{enviarEmailConsolidadoMutation.data.total}</strong> alvará(s) a vencer.
                    </p>
                  ) : (
                    <p className="font-medium">
                      {(enviarEmailConsolidadoMutation.data as any).motivo === "sem-destinatarios"
                        ? "Nenhum destinatário ativo. Adicione e-mails na lista de destinatários."
                        : "Falha ao enviar o e-mail consolidado."}
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Disparo manual + marcos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Disparo Manual
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 dark:bg-amber-950/20 dark:border-amber-800 flex gap-2">
                <Info className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Automático às <strong>8h diárias</strong>. Use abaixo para disparar fora do horário.
                </p>
              </div>
              <Button className="w-full gap-2" onClick={() => dispararMutation.mutate()}
                disabled={dispararMutation.isPending} variant="outline" size="sm">
                {dispararMutation.isPending
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Verificando...</>
                  : <><Send className="h-3.5 w-3.5" /> Disparar alertas agora</>}
              </Button>
              {dispararMutation.data && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-700">
                    <p className="font-medium">{dispararMutation.data.enviados} e-mail(s) enviado(s)</p>
                    {(dispararMutation.data.semEmail ?? 0) > 0 && (
                      <p className="text-amber-600">{dispararMutation.data.semEmail} sem destinatário</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Marcos Configurados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {[30, 15, 7, 3, 2, 1].map((dias) => (
                  <Badge key={dias} variant="outline" className={`text-xs font-semibold ${
                    dias <= 3
                      ? "border-red-300 text-red-700 bg-red-50"
                      : dias <= 7
                        ? "border-orange-300 text-orange-700 bg-orange-50"
                        : "border-yellow-300 text-yellow-700 bg-yellow-50"
                  }`}>
                    <Bell className="h-3 w-3 mr-1" />
                    {dias} dia{dias > 1 ? "s" : ""}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Suprimidos quando o alvará entra em <strong>"Em Renovação"</strong>, <strong>"Renovado"</strong> ou <strong>"Cancelado"</strong>.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SEÇÃO 2 — ALERTAS PÓS-VENCIMENTO (RELATÓRIO DIÁRIO ÀS 13H)
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold shrink-0">2</div>
          <div>
            <h2 className="text-base font-semibold">Relatório de Pós-Vencimento</h2>
            <p className="text-xs text-muted-foreground">Enviado automaticamente todo dia às 13h com listagem de vencidos e a vencer nos próximos 30 dias</p>
          </div>
        </div>

        <Card className="border-2 border-blue-200 shadow-sm bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-800">
          <CardContent className="pt-5 space-y-4">
            {/* Cards informativos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-white dark:bg-background border border-blue-100 dark:border-blue-800">
                <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-900 shrink-0">
                  <Clock className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Próximo envio</p>
                  <p className="text-xs font-semibold text-foreground truncate">{proximaExecucao}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-white dark:bg-background border border-blue-100 dark:border-blue-800">
                <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-900 shrink-0">
                  <Users className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Destinatários ativos</p>
                  <p className="text-xs font-semibold text-foreground">
                    {totalDestinatariosAtivos} e-mail{totalDestinatariosAtivos !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-white dark:bg-background border border-blue-100 dark:border-blue-800">
                <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-900 shrink-0">
                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Conteúdo</p>
                  <p className="text-xs font-semibold text-foreground">Vencidos + A vencer (30d)</p>
                </div>
              </div>
            </div>

            {/* Descrição */}
            <div className="p-3 rounded-lg bg-white dark:bg-background border border-blue-100 dark:border-blue-800 flex gap-2">
              <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <p className="font-medium">O que é enviado no relatório diário?</p>
                <p>
                  Duas seções separadas: <strong>(1) Alvarás vencidos</strong> que ainda não foram renovados ou cancelados,
                  e <strong>(2) Alvarás a vencer nos próximos 30 dias</strong>, ordenados do mais urgente ao mais distante.
                  Cada linha inclui empresa, CNPJ, tipo, número, data de vencimento, prazo e status.
                </p>
              </div>
            </div>

            {/* Botão de envio imediato */}
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                className="gap-2"
                onClick={() => dispararRelatorioMutation.mutate()}
                disabled={dispararRelatorioMutation.isPending}
              >
                {dispararRelatorioMutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando relatório...</>
                  : <><RefreshCw className="h-4 w-4" /> Enviar relatório agora</>}
              </Button>
              {totalDestinatariosAtivos === 0 && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Cadastre destinatários na seção 1 para receber o relatório
                </p>
              )}
            </div>

            {/* Resultado */}
            {dispararRelatorioMutation.data && (
              <div className={`p-3 rounded-lg flex items-start gap-2 text-xs border ${
                dispararRelatorioMutation.data.ok
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400"
                  : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400"
              }`}>
                {dispararRelatorioMutation.data.ok
                  ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                <div>
                  {dispararRelatorioMutation.data.ok ? (
                    <>
                      <p className="font-medium">Relatório enviado com sucesso!</p>
                      <p className="mt-0.5">
                        <strong>{dispararRelatorioMutation.data.vencidos}</strong> vencido(s) ·{" "}
                        <strong>{dispararRelatorioMutation.data.aVencer}</strong> a vencer ·{" "}
                        <strong>{dispararRelatorioMutation.data.destinatarios}</strong> destinatário(s)
                      </p>
                    </>
                  ) : (
                    <p className="font-medium">
                      {(dispararRelatorioMutation.data as any).motivo === "sem-destinatarios"
                        ? "Nenhum destinatário ativo. Adicione e-mails na seção 1."
                        : "Falha ao enviar o relatório."}
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SEÇÃO 3 — TESTE DE ENVIOS
      ════════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-bold shrink-0">3</div>
          <div>
            <h2 className="text-base font-semibold">Teste de Envios</h2>
            <p className="text-xs text-muted-foreground">Valide a configuração de e-mail antes de ativar os alertas automáticos</p>
          </div>
        </div>

        <Card className="border-2 border-primary/20 shadow-sm bg-primary/[0.02]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10">
                <FlaskConical className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Testar Configuração de E-mail</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Envie um e-mail de teste para confirmar que as credenciais SMTP estão funcionando
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="seu@email.com — receberá o e-mail de teste"
                value={emailTeste}
                onChange={(e) => setEmailTeste(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTestarEmail()}
                className="text-sm h-9"
              />
              <Button size="sm" className="gap-1.5 shrink-0" onClick={handleTestarEmail}
                disabled={testando || testarMutation.isPending}>
                {testando || testarMutation.isPending
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando...</>
                  : <><Send className="h-3.5 w-3.5" /> Enviar teste</>}
              </Button>
            </div>

            {resultadoTeste && (
              <div className={`p-3 rounded-lg flex items-start gap-2 text-xs border ${
                resultadoTeste.success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}>
                {resultadoTeste.success
                  ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                <div>
                  <p className="font-medium">
                    {resultadoTeste.success
                      ? "✅ Configuração funcionando! E-mail enviado com sucesso."
                      : "❌ Falha na configuração de e-mail."}
                  </p>
                  {resultadoTeste.error && <p className="mt-0.5 font-mono text-xs opacity-80">{resultadoTeste.error}</p>}
                  {resultadoTeste.success && (
                    <p className="mt-0.5 opacity-80">Verifique a caixa de entrada (e spam) de <strong>{emailTeste}</strong>.</p>
                  )}
                </div>
              </div>
            )}

            <div className="p-2.5 rounded-lg bg-muted/50 flex gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Remetente configurado: <strong>alvarasmjp@gmail.com</strong> — Gmail com Senha de App.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Seção 4: Painel Comercial — Clientes Sem Registro ───────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-600 text-xs font-bold">4</span>
          <h2 className="text-base font-semibold">Painel Comercial — Clientes Sem Registro</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4 ml-8">
          Clientes que não possuem nenhum alvará ou CLI cadastrado. Use esta seção para exportar a lista ou enviar ao time comercial para prospecção.
        </p>
        <Card className="border-violet-200 dark:border-violet-900/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldOff className="h-4 w-4 text-violet-500" />
                <CardTitle className="text-sm font-medium">Clientes Sem Registro</CardTitle>
              </div>
              <Badge variant="outline" className="border-violet-300 text-violet-600 bg-violet-50 dark:bg-violet-950/30">
                {clientesSemRegistro?.length ?? 0} cliente(s)
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Lista atualizada em tempo real. Exporte ou envie por e-mail para o time comercial.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Lista paginada */}
            {clientesSemRegistro && clientesSemRegistro.length > 0 && (() => {
              const totalPaginas = Math.ceil(clientesSemRegistro.length / PAGE_SIZE_COMERCIAL);
              const inicio = (paginaComercial - 1) * PAGE_SIZE_COMERCIAL;
              const paginaAtual = clientesSemRegistro.slice(inicio, inicio + PAGE_SIZE_COMERCIAL);
              return (
                <div className="rounded-lg border overflow-hidden">
                  <div className="bg-muted/50 px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">
                        {clientesSemRegistro.length} clientes sem registro
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">Pág. {paginaComercial}/{totalPaginas}</span>
                  </div>
                  <div className="divide-y">
                    {paginaAtual.map((c, i) => (
                      <div key={c.id} className="px-3 py-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground shrink-0 w-6 text-right">{inicio + i + 1}.</span>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{c.razaoSocial}</p>
                            <p className="text-xs text-muted-foreground font-mono">{c.cnpj}</p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {c.municipio ?? c.cidade ?? ""}{(c.estado ?? c.uf) ? ` / ${c.estado ?? c.uf}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                  {totalPaginas > 1 && (
                    <div className="bg-muted/30 px-3 py-2 flex items-center justify-between border-t">
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 text-xs"
                        onClick={() => setPaginaComercial((p) => Math.max(1, p - 1))}
                        disabled={paginaComercial === 1}
                      >
                        ← Anterior
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {inicio + 1}–{Math.min(inicio + PAGE_SIZE_COMERCIAL, clientesSemRegistro.length)} de {clientesSemRegistro.length}
                      </span>
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 text-xs"
                        onClick={() => setPaginaComercial((p) => Math.min(totalPaginas, p + 1))}
                        disabled={paginaComercial === totalPaginas}
                      >
                        Próxima →
                      </Button>
                    </div>
                  )}
                </div>
              );
            })()}

            {clientesSemRegistro?.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Todos os clientes já possuem alvarás cadastrados.
              </div>
            )}

            <Separator />

            {/* Exportar planilha */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exportar Lista</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => exportarSemRegistroMutation.mutate({})}
                  disabled={exportarSemRegistroMutation.isPending || !clientesSemRegistro?.length}
                >
                  {exportarSemRegistroMutation.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Download className="h-3.5 w-3.5" />}
                  Exportar Planilha XLSX
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Baixa uma planilha com todos os clientes sem registro (razão social, CNPJ, município, estado, contato, e-mail).</p>
            </div>

            <Separator />

            {/* Enviar e-mail comercial */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Enviar E-mail ao Time Comercial</Label>

              {/* Adicionar e-mails manualmente */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Destinatários (adicionar manualmente)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="email@empresa.com.br"
                    value={novoEmailComercial}
                    onChange={(e) => setNovoEmailComercial(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdicionarEmailComercial()}
                    className="h-8 text-sm"
                  />
                  <Button variant="outline" size="sm" onClick={handleAdicionarEmailComercial} className="gap-1 shrink-0">
                    <Plus className="h-3.5 w-3.5" /> Adicionar
                  </Button>
                </div>
              </div>

              {/* Importar e-mails via XLSX/CSV */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Ou importar lista de e-mails (XLSX / CSV)</Label>
                <div
                  className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-950/10 transition-colors"
                  onClick={() => fileInputComercialRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) handleImportarEmailsComercial(file);
                  }}
                >
                  <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Arraste ou clique para importar XLSX / CSV com e-mails</p>
                  <input
                    ref={fileInputComercialRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImportarEmailsComercial(file);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>

              {/* Lista de destinatários */}
              {todosDestinatariosComerciais.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {todosDestinatariosComerciais.length} destinatário(s) configurado(s)
                  </Label>
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-muted/40 border">
                    {emailsComerciais.map((email) => (
                      <span key={email} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-xs">
                        {email}
                        <button onClick={() => setEmailsComerciais((prev) => prev.filter((e) => e !== email))} className="hover:text-red-500">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    {emailsImportados.map((email) => (
                      <span key={email} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs">
                        <Upload className="h-3 w-3" />
                        {email}
                        <button onClick={() => setEmailsImportados((prev) => prev.filter((e) => e !== email))} className="hover:text-red-500">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-violet-600">●</span> Adicionados manualmente  ·  <span className="text-blue-500">●</span> Importados de arquivo
                  </p>
                </div>
              )}

              {/* Botão enviar */}
              <Button
                className="gap-2 bg-violet-600 hover:bg-violet-700 text-white w-full"
                onClick={handleEnviarEmailComercial}
                disabled={enviarEmailComercialMutation.isPending || todosDestinatariosComerciais.length === 0 || !clientesSemRegistro?.length}
              >
                {enviarEmailComercialMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Mail className="h-4 w-4" />}
                Enviar E-mail Comercial ({todosDestinatariosComerciais.length} destinatário{todosDestinatariosComerciais.length !== 1 ? "s" : ""})
              </Button>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
