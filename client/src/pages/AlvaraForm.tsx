import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2, Upload, X, Plus, Trash2, Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import { TIPOS_ALVARA } from "@/lib/alvaras";

// ─── Tipos CLI ────────────────────────────────────────────────────────────────
interface CliComponente {
  orgao: string;
  tipoManifestacao: string; // "AVCB" | "CLCB" | "Isento" | "Baixo Risco" | "Protocolo" | "Licença"
  numeroDocumento: string;
  dataEmissao: string;
  dataValidade: string;
  cnaes: string;
  restricoes: string;
}

const ORGAOS_CLI = [
  "Prefeitura",
  "Corpo de Bombeiros",
  "CETESB",
  "Vigilância Sanitária",
  "Secretaria de Agricultura (CDA)",
] as const;

const MANIFESTACOES_CLI = [
  "AVCB",
  "CLCB",
  "Isento",
  "Baixo Risco",
  "Protocolo",
  "Licença",
  "Indeterminado",
] as const;

interface Props {
  id?: number;
}

export default function AlvaraForm({ id }: Props) {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const clienteIdFromUrl = params.get("clienteId");
  const isEditing = !!id;

  const [form, setForm] = useState({
    clienteId: clienteIdFromUrl ? Number(clienteIdFromUrl) : 0,
    numeroAlvara: "",
    tipo: "CLI",
    orgaoEmissor: "Prefeitura Municipal / VRE REDESIM",
    dataEmissao: "",
    dataVencimento: "",
    // CLI específicos
    cliProtocolo: "",
    cliNumeroSolicitacao: "",
    cliDataSolicitacao: "",
    cliInscricaoMunicipal: "",
    cliNaturezaJuridica: "",
    cliFormaAtuacao: "",
    cliAreaEstabelecimento: "",
    cliCnaesLicenciados: "",
  });

  const [cliComponentes, setCliComponentes] = useState<CliComponente[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [existingPdfUrl, setExistingPdfUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isCli = form.tipo === "CLI";

  const { data: clientes } = trpc.clientes.list.useQuery({});
  const { data: alvara, isLoading } = trpc.alvaras.get.useQuery(
    { id: id! },
    { enabled: isEditing }
  );

  useEffect(() => {
    if (alvara) {
      const a = alvara.alvara;
      setForm({
        clienteId: a.clienteId,
        numeroAlvara: a.numeroAlvara ?? "",
        tipo: a.tipo,
        orgaoEmissor: a.orgaoEmissor ?? "",
        dataEmissao: a.dataEmissao ? new Date(a.dataEmissao).toISOString().split("T")[0] : "",
        dataVencimento: a.dataVencimento ? new Date(a.dataVencimento).toISOString().split("T")[0] : "",
        cliProtocolo: a.cliProtocolo ?? "",
        cliNumeroSolicitacao: a.cliNumeroSolicitacao ?? "",
        cliDataSolicitacao: a.cliDataSolicitacao ? new Date(a.cliDataSolicitacao).toISOString().split("T")[0] : "",
        cliInscricaoMunicipal: a.cliInscricaoMunicipal ?? "",
        cliNaturezaJuridica: a.cliNaturezaJuridica ?? "",
        cliFormaAtuacao: a.cliFormaAtuacao ?? "",
        cliAreaEstabelecimento: a.cliAreaEstabelecimento ?? "",
        cliCnaesLicenciados: a.cliCnaesLicenciados ?? "",
      });
      if (a.cliComponentes) {
        try { setCliComponentes(JSON.parse(a.cliComponentes)); } catch {}
      }
      setExistingPdfUrl(a.arquivoPdfUrl ?? null);
    }
  }, [alvara]);

  const createMutation = trpc.alvaras.create.useMutation({
    onSuccess: (data) => {
      toast.success("Alvará cadastrado com sucesso!");
      setLocation(`/alvaras/${data.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.alvaras.update.useMutation({
    onSuccess: () => {
      toast.success("Alvará atualizado!");
      setLocation(`/alvaras/${id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clienteId) { toast.error("Selecione um cliente."); return; }
    if (!form.dataVencimento) { toast.error("Informe a data de vencimento."); return; }

    let pdfKey: string | null = null;
    let pdfUrl: string | null = null;

    if (pdfFile) {
      setPdfUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", pdfFile);
        const res = await fetch("/api/upload-pdf", { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          pdfKey = data.key;
          pdfUrl = data.url;
        }
      } catch (err) {
        console.error("Upload error:", err);
      } finally {
        setPdfUploading(false);
      }
    }

    const payload = {
      ...form,
      dataEmissao: form.dataEmissao || null,
      dataVencimento: form.dataVencimento,
      arquivoPdfKey: pdfKey ?? (isEditing ? alvara?.alvara.arquivoPdfKey ?? null : null),
      arquivoPdfUrl: pdfUrl ?? (isEditing ? alvara?.alvara.arquivoPdfUrl ?? null : null),
      cliProtocolo: form.cliProtocolo || null,
      cliNumeroSolicitacao: form.cliNumeroSolicitacao || null,
      cliDataSolicitacao: form.cliDataSolicitacao || null,
      cliInscricaoMunicipal: form.cliInscricaoMunicipal || null,
      cliNaturezaJuridica: form.cliNaturezaJuridica || null,
      cliFormaAtuacao: form.cliFormaAtuacao || null,
      cliAreaEstabelecimento: form.cliAreaEstabelecimento || null,
      cliCnaesLicenciados: form.cliCnaesLicenciados || null,
      cliComponentes: isCli && cliComponentes.length > 0 ? JSON.stringify(cliComponentes) : null,
    };

    if (isEditing) {
      updateMutation.mutate({ id: id!, data: payload });
    } else {
      createMutation.mutate(payload as any);
    }
  };

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  // Gerenciamento de componentes CLI
  const addComponente = () => {
    setCliComponentes((prev) => [...prev, {
      orgao: "Corpo de Bombeiros",
      tipoManifestacao: "AVCB",
      numeroDocumento: "",
      dataEmissao: "",
      dataValidade: "",
      cnaes: "",
      restricoes: "",
    }]);
  };

  const removeComponente = (i: number) => {
    setCliComponentes((prev) => prev.filter((_, idx) => idx !== i));
  };

  const updateComponente = (i: number, field: keyof CliComponente, value: string) => {
    setCliComponentes((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  };

  const isPending = createMutation.isPending || updateMutation.isPending || pdfUploading;

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
        <Button variant="ghost" size="icon" onClick={() => setLocation("/alvaras")} className="h-9 w-9">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            {isEditing ? "Editar Alvará" : "Novo Alvará"}
            {isCli && (
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs font-semibold">
                CLI — VRE/REDESIM SP
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEditing ? "Atualize os dados do alvará" : "Cadastre um novo alvará de funcionamento"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ── Dados Gerais ── */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Dados do Alvará
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Cliente */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cliente *</Label>
              <Select
                value={form.clienteId ? String(form.clienteId) : ""}
                onValueChange={(v) => setForm((p) => ({ ...p, clienteId: Number(v) }))}
                disabled={isEditing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {(clientes ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.razaoSocial} — {c.cnpj}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Tipo */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Tipo de Documento *</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) => setForm((p) => ({
                    ...p,
                    tipo: v,
                    orgaoEmissor: v === "CLI" ? "Prefeitura Municipal / VRE REDESIM" : p.orgaoEmissor,
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_ALVARA.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t === "CLI" ? "CLI — Certificado de Licenciamento Integrado (SP)" : t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Número / Protocolo */}
              <div className="space-y-1.5">
                <Label htmlFor="numeroAlvara" className="text-xs font-medium">
                  {isCli ? "Número da Solicitação (VRE)" : "Número do Alvará"}
                </Label>
                <Input
                  id="numeroAlvara"
                  value={form.numeroAlvara}
                  onChange={set("numeroAlvara")}
                  placeholder={isCli ? "Ex.: 3728974" : "Número ou protocolo"}
                />
              </div>

              {/* Órgão emissor */}
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="orgaoEmissor" className="text-xs font-medium">Órgão Emissor</Label>
                <Input
                  id="orgaoEmissor"
                  value={form.orgaoEmissor}
                  onChange={set("orgaoEmissor")}
                  placeholder={isCli ? "Prefeitura Municipal / VRE REDESIM" : "Ex.: Prefeitura Municipal de São Paulo"}
                />
              </div>

              {/* Data de emissão */}
              <div className="space-y-1.5">
                <Label htmlFor="dataEmissao" className="text-xs font-medium">Data de Emissão</Label>
                <Input id="dataEmissao" type="date" value={form.dataEmissao} onChange={set("dataEmissao")} />
              </div>

              {/* Data de vencimento */}
              <div className="space-y-1.5">
                <Label htmlFor="dataVencimento" className="text-xs font-medium">
                  Data de Vencimento *
                  {isCli && (
                    <span className="ml-1 text-muted-foreground font-normal">(menor validade entre os órgãos)</span>
                  )}
                </Label>
                <Input id="dataVencimento" type="date" value={form.dataVencimento} onChange={set("dataVencimento")} required />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Campos específicos CLI ── */}
        {isCli && (
          <>
            <Card className="border shadow-sm border-blue-100">
              <CardHeader className="pb-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-blue-600 flex items-center gap-2">
                  <Info className="h-3.5 w-3.5" />
                  Dados da Solicitação — CLI
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Protocolo SPM</Label>
                    <Input
                      value={form.cliProtocolo}
                      onChange={set("cliProtocolo")}
                      placeholder="Ex.: SPM2430532320"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Nº Solicitação</Label>
                    <Input
                      value={form.cliNumeroSolicitacao}
                      onChange={set("cliNumeroSolicitacao")}
                      placeholder="Ex.: 3728974"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Data da Solicitação</Label>
                    <Input type="date" value={form.cliDataSolicitacao} onChange={set("cliDataSolicitacao")} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm border-blue-100">
              <CardHeader className="pb-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-blue-600 flex items-center gap-2">
                  <Info className="h-3.5 w-3.5" />
                  Dados da Empresa — CLI
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Inscrição Municipal</Label>
                    <Input
                      value={form.cliInscricaoMunicipal}
                      onChange={set("cliInscricaoMunicipal")}
                      placeholder="Nº de inscrição municipal"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Área do Estabelecimento</Label>
                    <Input
                      value={form.cliAreaEstabelecimento}
                      onChange={set("cliAreaEstabelecimento")}
                      placeholder="Ex.: 120 m²"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Natureza Jurídica</Label>
                    <Input
                      value={form.cliNaturezaJuridica}
                      onChange={set("cliNaturezaJuridica")}
                      placeholder="Ex.: Sociedade Limitada"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Forma de Atuação</Label>
                    <Input
                      value={form.cliFormaAtuacao}
                      onChange={set("cliFormaAtuacao")}
                      placeholder="Ex.: Estabelecimento Fixo"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium">CNAEs Licenciados</Label>
                    <Input
                      value={form.cliCnaesLicenciados}
                      onChange={set("cliCnaesLicenciados")}
                      placeholder="Ex.: 6201-5/01, 6202-3/00 (separados por vírgula)"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Componentes por Órgão ── */}
            <Card className="border shadow-sm border-blue-100">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-blue-600 flex items-center gap-2">
                    <Info className="h-3.5 w-3.5" />
                    Componentes por Órgão — CLI
                  </CardTitle>
                  <Button type="button" variant="outline" size="sm" onClick={addComponente} className="h-7 text-xs gap-1">
                    <Plus className="h-3 w-3" /> Adicionar Órgão
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Registre a manifestação de cada órgão presente no CLI (Bombeiros, CETESB, Vigilância Sanitária, etc.)
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {cliComponentes.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                    Nenhum componente adicionado. Clique em "Adicionar Órgão" para registrar as licenças individuais do CLI.
                  </div>
                ) : (
                  cliComponentes.map((comp, i) => (
                    <div key={i} className="p-4 rounded-lg border bg-muted/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Órgão {i + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeComponente(i)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Órgão</Label>
                          <Select
                            value={comp.orgao}
                            onValueChange={(v) => updateComponente(i, "orgao", v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ORGAOS_CLI.map((o) => (
                                <SelectItem key={o} value={o}>{o}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Tipo de Manifestação</Label>
                          <Select
                            value={comp.tipoManifestacao}
                            onValueChange={(v) => updateComponente(i, "tipoManifestacao", v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {MANIFESTACOES_CLI.map((m) => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Nº do Documento</Label>
                          <Input
                            className="h-8 text-xs"
                            value={comp.numeroDocumento}
                            onChange={(e) => updateComponente(i, "numeroDocumento", e.target.value)}
                            placeholder="Ex.: 0123456/2024"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Data de Emissão</Label>
                          <Input
                            className="h-8 text-xs"
                            type="date"
                            value={comp.dataEmissao}
                            onChange={(e) => updateComponente(i, "dataEmissao", e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Data de Validade</Label>
                          <Input
                            className="h-8 text-xs"
                            type="date"
                            value={comp.dataValidade}
                            onChange={(e) => updateComponente(i, "dataValidade", e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">CNAEs</Label>
                          <Input
                            className="h-8 text-xs"
                            value={comp.cnaes}
                            onChange={(e) => updateComponente(i, "cnaes", e.target.value)}
                            placeholder="Ex.: 6201-5/01"
                          />
                        </div>
                        <div className="sm:col-span-2 space-y-1.5">
                          <Label className="text-xs font-medium">Restrições / Condicionantes</Label>
                          <Input
                            className="h-8 text-xs"
                            value={comp.restricoes}
                            onChange={(e) => updateComponente(i, "restricoes", e.target.value)}
                            placeholder="Condicionantes ou restrições específicas"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Upload do PDF ── */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Arquivo do Alvará (PDF)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
            />
            {pdfFile ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                <div className="p-2 rounded bg-red-100">
                  <Upload className="h-4 w-4 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{pdfFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(pdfFile.size / 1024).toFixed(0)} KB</p>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPdfFile(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : existingPdfUrl ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                <div className="p-2 rounded bg-red-100">
                  <Upload className="h-4 w-4 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">PDF já anexado</p>
                  <a href={existingPdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                    Visualizar arquivo atual
                  </a>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  Substituir
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 p-8 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/40 hover:bg-muted/30 transition-all text-muted-foreground"
              >
                <Upload className="h-6 w-6" />
                <span className="text-sm font-medium">Clique para selecionar o PDF do alvará</span>
                <span className="text-xs">Arquivo PDF, máx. 10MB</span>
              </button>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end pb-8">
          <Button type="button" variant="outline" onClick={() => setLocation("/alvaras")}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending} className="min-w-28">
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</>
            ) : (
              isEditing ? "Salvar alterações" : "Cadastrar alvará"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
