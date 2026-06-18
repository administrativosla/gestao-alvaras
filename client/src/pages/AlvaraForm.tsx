import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import { TIPOS_ALVARA } from "@/lib/alvaras";

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
    tipo: "Funcionamento",
    orgaoEmissor: "",
    dataEmissao: "",
    dataVencimento: "",
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [existingPdfUrl, setExistingPdfUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: clientes } = trpc.clientes.list.useQuery({});
  const { data: alvara, isLoading } = trpc.alvaras.get.useQuery(
    { id: id! },
    { enabled: isEditing }
  );

  useEffect(() => {
    if (alvara) {
      setForm({
        clienteId: alvara.alvara.clienteId,
        numeroAlvara: alvara.alvara.numeroAlvara ?? "",
        tipo: alvara.alvara.tipo,
        orgaoEmissor: alvara.alvara.orgaoEmissor ?? "",
        dataEmissao: alvara.alvara.dataEmissao
          ? new Date(alvara.alvara.dataEmissao).toISOString().split("T")[0]
          : "",
        dataVencimento: alvara.alvara.dataVencimento
          ? new Date(alvara.alvara.dataVencimento).toISOString().split("T")[0]
          : "",
      });
      setExistingPdfUrl(alvara.alvara.arquivoPdfUrl ?? null);
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
        const arrayBuffer = await pdfFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        // Upload via API
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

  const isPending = createMutation.isPending || updateMutation.isPending || pdfUploading;

  if (isEditing && isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl animate-fade-in-up">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/alvaras")} className="h-9 w-9">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isEditing ? "Editar Alvará" : "Novo Alvará"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEditing ? "Atualize os dados do alvará" : "Cadastre um novo alvará de funcionamento"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
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
                <Label className="text-xs font-medium">Tipo de Alvará *</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) => setForm((p) => ({ ...p, tipo: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_ALVARA.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Número */}
              <div className="space-y-1.5">
                <Label htmlFor="numeroAlvara" className="text-xs font-medium">Número do Alvará</Label>
                <Input
                  id="numeroAlvara"
                  value={form.numeroAlvara}
                  onChange={set("numeroAlvara")}
                  placeholder="Número ou protocolo"
                />
              </div>

              {/* Órgão emissor */}
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="orgaoEmissor" className="text-xs font-medium">Órgão Emissor</Label>
                <Input
                  id="orgaoEmissor"
                  value={form.orgaoEmissor}
                  onChange={set("orgaoEmissor")}
                  placeholder="Ex.: Prefeitura Municipal de São Paulo"
                />
              </div>

              {/* Data de emissão */}
              <div className="space-y-1.5">
                <Label htmlFor="dataEmissao" className="text-xs font-medium">Data de Emissão</Label>
                <Input
                  id="dataEmissao"
                  type="date"
                  value={form.dataEmissao}
                  onChange={set("dataEmissao")}
                />
              </div>

              {/* Data de vencimento */}
              <div className="space-y-1.5">
                <Label htmlFor="dataVencimento" className="text-xs font-medium">Data de Vencimento *</Label>
                <Input
                  id="dataVencimento"
                  type="date"
                  value={form.dataVencimento}
                  onChange={set("dataVencimento")}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload do PDF */}
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
                  <p className="text-xs text-muted-foreground">
                    {(pdfFile.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPdfFile(null)}
                >
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
                  <a
                    href={existingPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Visualizar arquivo atual
                  </a>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
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
