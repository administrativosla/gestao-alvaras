import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, X, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { cnpjValido, formatarCnpj } from "@shared/cnpj";

interface Props {
  id?: number;
  basePath?: string;
}

export default function ClienteForm({ id, basePath = "/clientes" }: Props) {
  const [, setLocation] = useLocation();
  const isEditing = !!id;

  const [form, setForm] = useState({
    cnpj: "",
    razaoSocial: "",
    nomeFantasia: "",
    inscricaoEstadual: "",
    inscricaoMunicipal: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    cep: "",
    nomeContato: "",
    telefone: "",
    email: "",
    dataAbertura: "",
    observacoesPreventivas: "",
  });
  const [emailsAlerta, setEmailsAlerta] = useState<string[]>([]);
  const [novoEmail, setNovoEmail] = useState("");

  const { data: cliente, isLoading } = trpc.clientes.get.useQuery(
    { id: id! },
    { enabled: isEditing }
  );

  useEffect(() => {
    if (cliente) {
      setForm({
        cnpj: cliente.cnpj ?? "",
        razaoSocial: cliente.razaoSocial ?? "",
        nomeFantasia: cliente.nomeFantasia ?? "",
        inscricaoEstadual: cliente.inscricaoEstadual ?? "",
        inscricaoMunicipal: cliente.inscricaoMunicipal ?? "",
        logradouro: cliente.logradouro ?? "",
        numero: cliente.numero ?? "",
        complemento: cliente.complemento ?? "",
        bairro: cliente.bairro ?? "",
        cidade: cliente.cidade ?? "",
        uf: cliente.uf ?? "",
        cep: cliente.cep ?? "",
        nomeContato: cliente.nomeContato ?? "",
        telefone: cliente.telefone ?? "",
        email: cliente.email ?? "",
        dataAbertura: cliente.dataAbertura
          ? new Date(cliente.dataAbertura).toISOString().split("T")[0]
          : "",
        observacoesPreventivas: cliente.observacoesPreventivas ?? "",
      });
      setEmailsAlerta(cliente.emailsAlerta ?? []);
    }
  }, [cliente]);

  const createMutation = trpc.clientes.create.useMutation({
    onSuccess: (data) => {
      toast.success("Cliente cadastrado com sucesso!");
      setLocation(`${basePath}/${data.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.clientes.update.useMutation({
    onSuccess: () => {
      toast.success("Cliente atualizado com sucesso!");
      setLocation(`${basePath}/${id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cnpjValido(form.cnpj)) {
      toast.error("Informe um CNPJ válido antes de salvar.");
      document.getElementById("cnpj")?.focus();
      return;
    }
    const payload = {
      ...form,
      cnpj: formatarCnpj(form.cnpj),
      inscricaoEstadual: form.inscricaoEstadual.trim(),
      inscricaoMunicipal: form.inscricaoMunicipal.trim(),
      dataAbertura: form.dataAbertura || null,
      emailsAlerta,
    };
    if (isEditing) {
      updateMutation.mutate({ id: id!, data: payload });
    } else {
      createMutation.mutate(payload as any);
    }
  };

  const addEmail = () => {
    if (!novoEmail || !novoEmail.includes("@")) return;
    if (!emailsAlerta.includes(novoEmail)) {
      setEmailsAlerta([...emailsAlerta, novoEmail]);
    }
    setNovoEmail("");
  };

  const removeEmail = (email: string) => {
    setEmailsAlerta(emailsAlerta.filter((e) => e !== email));
  };

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isEditing && isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl animate-fade-in-up">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation(basePath)} className="h-9 w-9">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isEditing ? "Editar Cliente" : "Novo Cliente"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEditing ? "Atualize os dados do cliente" : "Preencha os dados para cadastrar um novo cliente"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identificação empresarial */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Identificação para consultas
            </CardTitle>
            <p className="text-xs text-muted-foreground pt-1">
              O CNPJ será usado nas consultas principais. As inscrições estadual e municipal ficam disponíveis para portais que as exigirem.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cnpj" className="text-xs font-medium">CNPJ *</Label>
                <Input
                  id="cnpj"
                  value={form.cnpj}
                  onChange={(e) => setForm((prev) => ({ ...prev, cnpj: formatarCnpj(e.target.value) }))}
                  placeholder="00.000.000/0000-00"
                  required
                  disabled={isEditing}
                  inputMode="numeric"
                  maxLength={18}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="razaoSocial" className="text-xs font-medium">Razão Social *</Label>
                <Input
                  id="razaoSocial"
                  value={form.razaoSocial}
                  onChange={set("razaoSocial")}
                  placeholder="Nome empresarial completo"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nomeFantasia" className="text-xs font-medium">Nome Fantasia</Label>
                <Input
                  id="nomeFantasia"
                  value={form.nomeFantasia}
                  onChange={set("nomeFantasia")}
                  placeholder="Nome fantasia (opcional)"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dataAbertura" className="text-xs font-medium">Data de Abertura</Label>
                <Input
                  id="dataAbertura"
                  type="date"
                  value={form.dataAbertura}
                  onChange={set("dataAbertura")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inscricaoEstadual" className="text-xs font-medium">Inscrição Estadual (IE)</Label>
                <Input
                  id="inscricaoEstadual"
                  value={form.inscricaoEstadual}
                  onChange={set("inscricaoEstadual")}
                  placeholder="Número ou ISENTO"
                  maxLength={50}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inscricaoMunicipal" className="text-xs font-medium">Inscrição Municipal (IM)</Label>
                <Input
                  id="inscricaoMunicipal"
                  value={form.inscricaoMunicipal}
                  onChange={set("inscricaoMunicipal")}
                  placeholder="Número da inscrição municipal"
                  maxLength={50}
                  autoComplete="off"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Endereço
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="logradouro" className="text-xs font-medium">Logradouro</Label>
                <Input id="logradouro" value={form.logradouro} onChange={set("logradouro")} placeholder="Rua, Avenida..." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="numero" className="text-xs font-medium">Número</Label>
                <Input id="numero" value={form.numero} onChange={set("numero")} placeholder="Nº" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="complemento" className="text-xs font-medium">Complemento</Label>
                <Input id="complemento" value={form.complemento} onChange={set("complemento")} placeholder="Sala, Andar..." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bairro" className="text-xs font-medium">Bairro</Label>
                <Input id="bairro" value={form.bairro} onChange={set("bairro")} placeholder="Bairro" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cep" className="text-xs font-medium">CEP</Label>
                <Input id="cep" value={form.cep} onChange={set("cep")} placeholder="00000-000" />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="cidade" className="text-xs font-medium">Cidade</Label>
                <Input id="cidade" value={form.cidade} onChange={set("cidade")} placeholder="Cidade" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uf" className="text-xs font-medium">UF</Label>
                <Input id="uf" value={form.uf} onChange={set("uf")} placeholder="SP" maxLength={2} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contato */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Contato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="nomeContato" className="text-xs font-medium">Nome do Contato</Label>
                <Input id="nomeContato" value={form.nomeContato} onChange={set("nomeContato")} placeholder="Responsável" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telefone" className="text-xs font-medium">Telefone</Label>
                <Input id="telefone" value={form.telefone} onChange={set("telefone")} placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">E-mail</Label>
                <Input id="email" type="email" value={form.email} onChange={set("email")} placeholder="email@empresa.com" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* E-mails de Alerta */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              E-mails para Alertas de Vencimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Adicione os e-mails que devem receber alertas automáticos nos marcos de 30, 15 e 7 dias antes do vencimento.
            </p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={novoEmail}
                onChange={(e) => setNovoEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail())}
                className="flex-1 h-9 text-sm"
              />
              <Button type="button" variant="outline" size="sm" onClick={addEmail} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </Button>
            </div>
            {emailsAlerta.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {emailsAlerta.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1.5 pr-1.5 font-normal">
                    {email}
                    <button
                      type="button"
                      onClick={() => removeEmail(email)}
                      className="hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Observações */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Observações Preventivas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.observacoesPreventivas}
              onChange={set("observacoesPreventivas")}
              placeholder="Informações relevantes sobre este cliente: exigências específicas do órgão emissor, histórico de atrasos, documentação especial, etc."
              rows={4}
              className="resize-none text-sm"
            />
          </CardContent>
        </Card>

        {/* Ações */}
        <div className="flex gap-3 justify-end pb-8">
          <Button type="button" variant="outline" onClick={() => setLocation(basePath)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending} className="min-w-28">
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</>
            ) : (
              isEditing ? "Salvar alterações" : "Cadastrar cliente"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
