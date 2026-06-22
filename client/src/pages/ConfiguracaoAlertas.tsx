import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Bell, Plus, Trash2, Mail, Loader2, Send, CheckCircle2,
  AlertCircle, Info, FlaskConical, Zap, Globe,
  CalendarClock, Clock, FileText, Users, RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ConfiguracaoAlertas() {
  const [clienteSelecionado, setClienteSelecionado] = useState<string>("");
  const [novoEmail, setNovoEmail] = useState("");
  const [novoEmailGlobal, setNovoEmailGlobal] = useState("");
  const [descricaoGlobal, setDescricaoGlobal] = useState("");
  const [emailTeste, setEmailTeste] = useState("");
  const [testando, setTestando] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState<{ success: boolean; error?: string } | null>(null);

  const { data: clientes } = trpc.clientes.list.useQuery({});
  const clienteId = clienteSelecionado ? Number(clienteSelecionado) : null;

  const { data: emails, refetch: refetchEmails } = trpc.alertas.listarEmails.useQuery(
    { clienteId: clienteId! },
    { enabled: !!clienteId }
  );

  const { data: emailsGlobais, refetch: refetchGlobais } = trpc.alertas.listarEmailsGlobais.useQuery();

  const adicionarMutation = trpc.alertas.adicionarEmail.useMutation({
    onSuccess: () => { toast.success("E-mail adicionado!"); setNovoEmail(""); refetchEmails(); },
    onError: (e) => toast.error(e.message),
  });

  const removerMutation = trpc.alertas.removerEmail.useMutation({
    onSuccess: () => { toast.success("E-mail removido."); refetchEmails(); },
    onError: (e) => toast.error(e.message),
  });

  const adicionarGlobalMutation = trpc.alertas.adicionarEmailGlobal.useMutation({
    onSuccess: () => {
      toast.success("E-mail global adicionado!");
      setNovoEmailGlobal("");
      setDescricaoGlobal("");
      refetchGlobais();
    },
    onError: (e) => toast.error(e.message),
  });

  const removerGlobalMutation = trpc.alertas.removerEmailGlobal.useMutation({
    onSuccess: () => { toast.success("E-mail global removido."); refetchGlobais(); },
    onError: (e) => toast.error(e.message),
  });

  const toggleGlobalMutation = trpc.alertas.toggleEmailGlobal.useMutation({
    onSuccess: () => refetchGlobais(),
    onError: (e) => toast.error(e.message),
  });

  const dispararMutation = trpc.alertas.dispararAlertas.useMutation({
    onSuccess: (data) => {
      if (data.enviados > 0) toast.success(`${data.enviados} alerta(s) de vencimento enviado(s)!`);
      else toast.info("Nenhum alerta nos marcos de hoje.");
    },
    onError: (e) => toast.error("Erro ao disparar alertas: " + e.message),
  });

  const dispararRelatorioMutation = trpc.alertas.dispararRelatorio.useMutation({
    onSuccess: (data) => {
      if (!data.ok && (data as any).motivo === "sem-destinatarios") {
        toast.warning("Nenhum destinatário global ativo. Cadastre e-mails globais para receber o relatório.");
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

  const handleAdicionarEmail = () => {
    if (!clienteId) { toast.error("Selecione um cliente."); return; }
    if (!novoEmail.trim()) { toast.error("Informe um e-mail."); return; }
    adicionarMutation.mutate({ clienteId, email: novoEmail.trim() });
  };

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

  // Calcular próxima execução às 13h BRT
  const proximaExecucao = (() => {
    const agora = new Date();
    const proxima = new Date();
    proxima.setHours(13, 0, 0, 0);
    if (agora.getHours() >= 13) proxima.setDate(proxima.getDate() + 1);
    return proxima.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }) + " às 13h00";
  })();

  const totalDestinatariosGlobais = (emailsGlobais ?? []).filter((e) => e.ativo).length;

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alertas por E-mail</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure os destinatários e gerencie os envios automáticos de alertas de vencimento e relatórios diários
        </p>
      </div>

      {/* ─── Relatório Diário às 13h ─────────────────────────────────────────── */}
      <Card className="border-2 border-blue-200 shadow-sm bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-800">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900">
              <CalendarClock className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Relatório Diário — Enviado às 13h</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Todo dia às 13h, um relatório completo é enviado automaticamente para os destinatários globais
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Informações do schedule */}
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
                  {totalDestinatariosGlobais} e-mail{totalDestinatariosGlobais !== 1 ? "s" : ""} global{totalDestinatariosGlobais !== 1 ? "is" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-white dark:bg-background border border-blue-100 dark:border-blue-800">
              <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-900 shrink-0">
                <FileText className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Conteúdo do relatório</p>
                <p className="text-xs font-semibold text-foreground">Vencidos + A vencer (30d)</p>
              </div>
            </div>
          </div>

          {/* Descrição do conteúdo */}
          <div className="p-3 rounded-lg bg-white dark:bg-background border border-blue-100 dark:border-blue-800 flex gap-2">
            <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <p className="font-medium">O que é enviado no relatório diário?</p>
              <p>
                O e-mail contém <strong>duas seções separadas</strong>: (1) todos os alvarás com data de vencimento
                ultrapassada que ainda não foram renovados ou cancelados, e (2) alvarás que vencem nos{" "}
                <strong>próximos 30 dias</strong>, ordenados do mais urgente ao mais distante. Cada seção inclui
                empresa, CNPJ, tipo, número, data de vencimento, prazo e status atual.
              </p>
            </div>
          </div>

          {/* Botão de envio imediato */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              className="gap-2 flex-1 sm:flex-none"
              onClick={() => dispararRelatorioMutation.mutate()}
              disabled={dispararRelatorioMutation.isPending}
            >
              {dispararRelatorioMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando relatório...</>
                : <><RefreshCw className="h-4 w-4" /> Enviar relatório agora</>}
            </Button>
            {totalDestinatariosGlobais === 0 && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Cadastre destinatários globais para receber o relatório
              </p>
            )}
          </div>

          {/* Resultado do último envio manual */}
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
                      ? "Nenhum destinatário global ativo. Adicione e-mails na lista abaixo."
                      : "Falha ao enviar o relatório."}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Teste de e-mail ─────────────────────────────────────────────────── */}
      <Card className="border-2 border-primary/20 shadow-sm bg-primary/[0.02]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              <FlaskConical className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Testar Configuração de E-mail</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Valide se as credenciais Gmail estão corretas antes de ativar os alertas automáticos
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="seu@email.com — e-mail que receberá o teste"
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

      {/* ─── E-mails Globais ─────────────────────────────────────────────────── */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-blue-50">
              <Globe className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Lista Global de Destinatários</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Estes e-mails recebem alertas de <strong>todos os clientes</strong> e o{" "}
                <strong>relatório diário às 13h</strong>. Ideal para a equipe interna responsável pelo acompanhamento geral.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!emailsGlobais || emailsGlobais.length === 0 ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
              <Globe className="h-3.5 w-3.5 shrink-0" />
              Nenhum e-mail global cadastrado. Adicione abaixo para que a equipe receba todos os alertas e o relatório diário.
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
            <Label className="text-xs font-medium">Adicionar destinatário global</Label>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── Destinatários por cliente ─────────────────────────────────────── */}
        <div className="space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Destinatários por Cliente
              </CardTitle>
              <CardDescription className="text-xs">
                E-mails específicos por cliente, em adição à lista global — recebem alertas de pré-vencimento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Selecionar Cliente</Label>
                <Select value={clienteSelecionado} onValueChange={setClienteSelecionado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(clientes ?? []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.razaoSocial}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {clienteId && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">E-mails cadastrados</Label>
                    {!emails || emails.length === 0 ? (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        Nenhum e-mail específico para este cliente
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {emails.map((e) => (
                          <div key={e.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 border">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm flex-1 truncate">{e.email}</span>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => removerMutation.mutate({ id: e.id })}
                              disabled={removerMutation.isPending}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input type="email" placeholder="colaborador@empresa.com"
                      value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAdicionarEmail()}
                      className="text-sm h-9" />
                    <Button size="sm" className="gap-1.5 shrink-0" onClick={handleAdicionarEmail}
                      disabled={adicionarMutation.isPending}>
                      {adicionarMutation.isPending
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Plus className="h-3.5 w-3.5" />}
                      Adicionar
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── Disparo e marcos ────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Alertas de Pré-Vencimento
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 dark:bg-amber-950/20 dark:border-amber-800 flex gap-2">
                <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                  <p className="font-medium">Alertas automáticos diários às 8h</p>
                  <p>
                    O sistema verifica automaticamente nos marcos de{" "}
                    <strong>30, 15, 7, 3, 2 e 1 dia</strong> antes do vencimento e envia
                    alertas individuais por alvará. Use o botão abaixo para disparar fora do horário.
                  </p>
                </div>
              </div>

              <Button className="w-full gap-2" onClick={() => dispararMutation.mutate()}
                disabled={dispararMutation.isPending} variant="outline">
                {dispararMutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Verificando alvarás...</>
                  : <><Send className="h-4 w-4" /> Disparar alertas de pré-vencimento agora</>}
              </Button>

              {dispararMutation.data && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-700">
                    <p className="font-medium">Verificação concluída</p>
                    <p>{dispararMutation.data.enviados} e-mail(s) enviado(s)</p>
                    {(dispararMutation.data.semEmail ?? 0) > 0 && (
                      <p className="text-amber-600 mt-0.5">
                        {dispararMutation.data.semEmail} alvarás sem e-mail cadastrado
                      </p>
                    )}
                    {dispararMutation.data.erros > 0 && (
                      <p className="text-red-600 mt-0.5">{dispararMutation.data.erros} erro(s) de envio</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Marcos de Alerta Configurados
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
                Alertas são suprimidos automaticamente quando o alvará entra em{" "}
                <strong>"Em Renovação"</strong>, <strong>"Renovado"</strong> ou{" "}
                <strong>"Cancelado"</strong>.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
