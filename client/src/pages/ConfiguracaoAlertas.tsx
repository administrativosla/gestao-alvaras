import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  Plus,
  Trash2,
  Mail,
  Loader2,
  Send,
  CheckCircle2,
  AlertCircle,
  Info,
  FlaskConical,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ConfiguracaoAlertas() {
  const [clienteSelecionado, setClienteSelecionado] = useState<string>("");
  const [novoEmail, setNovoEmail] = useState("");
  const [emailTeste, setEmailTeste] = useState("");
  const [testando, setTestando] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState<{ success: boolean; error?: string } | null>(null);

  const { data: clientes } = trpc.clientes.list.useQuery({});
  const clienteId = clienteSelecionado ? Number(clienteSelecionado) : null;

  const { data: emails, refetch: refetchEmails } = trpc.alertas.listarEmails.useQuery(
    { clienteId: clienteId! },
    { enabled: !!clienteId }
  );

  const adicionarMutation = trpc.alertas.adicionarEmail.useMutation({
    onSuccess: () => {
      toast.success("E-mail adicionado com sucesso!");
      setNovoEmail("");
      refetchEmails();
    },
    onError: (e) => toast.error(e.message),
  });

  const removerMutation = trpc.alertas.removerEmail.useMutation({
    onSuccess: () => {
      toast.success("E-mail removido.");
      refetchEmails();
    },
    onError: (e) => toast.error(e.message),
  });

  const dispararMutation = trpc.alertas.dispararAlertas.useMutation({
    onSuccess: (data) => {
      if (data.enviados > 0) {
        toast.success(`${data.enviados} alerta(s) enviado(s) com sucesso!`);
      } else {
        toast.info("Nenhum alerta nos marcos de hoje.");
      }
    },
    onError: (e) => toast.error("Erro ao disparar alertas: " + e.message),
  });

  const testarMutation = trpc.alertas.testarEmail.useMutation({
    onSuccess: (data) => {
      setTestando(false);
      setResultadoTeste(data);
      if (data.success) {
        toast.success("E-mail de teste enviado! Verifique sua caixa de entrada.");
      } else {
        toast.error("Falha ao enviar e-mail de teste.");
      }
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

  const handleTestarEmail = () => {
    if (!emailTeste.trim()) { toast.error("Informe o e-mail de destino para o teste."); return; }
    setTestando(true);
    setResultadoTeste(null);
    testarMutation.mutate({ destinatario: emailTeste.trim() });
  };

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alertas por E-mail</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure os destinatários e valide o envio automático de alertas de vencimento
        </p>
      </div>

      {/* Seção de teste de e-mail — destaque no topo */}
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
            <Button
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={handleTestarEmail}
              disabled={testando || testarMutation.isPending}
            >
              {testando || testarMutation.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando...</>
              ) : (
                <><Send className="h-3.5 w-3.5" /> Enviar teste</>
              )}
            </Button>
          </div>

          {resultadoTeste && (
            <div className={`p-3 rounded-lg flex items-start gap-2 text-xs border ${
              resultadoTeste.success
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}>
              {resultadoTeste.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-medium">
                  {resultadoTeste.success
                    ? "✅ Configuração funcionando! E-mail enviado com sucesso."
                    : "❌ Falha na configuração de e-mail."}
                </p>
                {resultadoTeste.error && (
                  <p className="mt-0.5 font-mono text-xs opacity-80">{resultadoTeste.error}</p>
                )}
                {resultadoTeste.success && (
                  <p className="mt-0.5 opacity-80">
                    Verifique a caixa de entrada (e spam) de <strong>{emailTeste}</strong>.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="p-2.5 rounded-lg bg-muted/50 flex gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Remetente configurado: <strong>alvarasmjp@gmail.com</strong> — Gmail com Senha de App.
              Para trocar o remetente, atualize as credenciais SMTP nas configurações do sistema.
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuração por cliente */}
        <div className="space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Destinatários por Cliente
              </CardTitle>
              <CardDescription className="text-xs">
                Cada cliente pode ter múltiplos e-mails internos que receberão os alertas
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
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.razaoSocial}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {clienteId && (
                <>
                  <Separator />

                  {/* Lista de e-mails */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                      E-mails cadastrados
                    </Label>
                    {!emails || emails.length === 0 ? (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        Nenhum e-mail cadastrado para este cliente
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {emails.map((e) => (
                          <div
                            key={e.id}
                            className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 border"
                          >
                            <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm flex-1 truncate">{e.email}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => removerMutation.mutate({ id: e.id })}
                              disabled={removerMutation.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Adicionar novo e-mail */}
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="colaborador@empresa.com"
                      value={novoEmail}
                      onChange={(e) => setNovoEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAdicionarEmail()}
                      className="text-sm h-9"
                    />
                    <Button
                      size="sm"
                      className="gap-1.5 shrink-0"
                      onClick={handleAdicionarEmail}
                      disabled={adicionarMutation.isPending}
                    >
                      {adicionarMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      Adicionar
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Painel de disparo e marcos */}
        <div className="space-y-4">
          {/* Disparo manual */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Disparo Manual de Alertas
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 flex gap-2">
                <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-700 space-y-1">
                  <p className="font-medium">Alertas automáticos diários às 8h</p>
                  <p>
                    O sistema verifica automaticamente nos marcos de{" "}
                    <strong>30, 15, 7, 3, 2 e 1 dia</strong> antes do vencimento.
                    Use o botão abaixo para disparar manualmente fora do horário programado.
                  </p>
                </div>
              </div>

              <Button
                className="w-full gap-2"
                onClick={() => dispararMutation.mutate()}
                disabled={dispararMutation.isPending}
                variant="outline"
              >
                {dispararMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Verificando alvarás...</>
                ) : (
                  <><Send className="h-4 w-4" /> Disparar alertas agora</>
                )}
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

          {/* Marcos de alerta */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Marcos de Alerta Configurados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {[30, 15, 7, 3, 2, 1].map((dias) => (
                  <Badge
                    key={dias}
                    variant="outline"
                    className={`text-xs font-semibold ${
                      dias <= 3
                        ? "border-red-300 text-red-700 bg-red-50"
                        : dias <= 7
                          ? "border-orange-300 text-orange-700 bg-orange-50"
                          : "border-yellow-300 text-yellow-700 bg-yellow-50"
                    }`}
                  >
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
