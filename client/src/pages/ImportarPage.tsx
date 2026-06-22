import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  X,
  Info,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

type ImportStep = "upload" | "mapeamento" | "revisao" | "concluido";

const CAMPOS_SISTEMA = [
  { value: "cnpj", label: "CNPJ *" },
  { value: "razaoSocial", label: "Razão Social *" },
  { value: "nomeFantasia", label: "Nome Fantasia" },
  { value: "inscricaoEstadual", label: "Inscrição Estadual (IE)" },
  { value: "inscricaoMunicipal", label: "Inscrição Municipal (IM)" },
  { value: "logradouro", label: "Logradouro" },
  { value: "numero", label: "Número" },
  { value: "bairro", label: "Bairro" },
  { value: "cidade", label: "Cidade" },
  { value: "uf", label: "UF" },
  { value: "cep", label: "CEP" },
  { value: "nomeContato", label: "Nome do Contato" },
  { value: "telefone", label: "Telefone" },
  { value: "email", label: "E-mail" },
  { value: "dataAbertura", label: "Data de Abertura" },
  { value: "tipoAlvara", label: "Tipo de Alvará" },
  { value: "numeroAlvara", label: "Número do Alvará" },
  { value: "orgaoEmissor", label: "Órgão Emissor" },
  { value: "dataEmissao", label: "Data de Emissão" },
  { value: "dataVencimento", label: "Data de Vencimento *" },
  { value: "ignorar", label: "— Ignorar coluna —" },
];

export default function ImportarPage() {
  const [step, setStep] = useState<ImportStep>("upload");
  const [fileType, setFileType] = useState<"xlsx" | "csv" | "pdf">("xlsx");
  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>("");
  const [colunas, setColunas] = useState<string[]>([]);
  const [mapeamento, setMapeamento] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<any[]>([]);
  const [pdfExtracted, setPdfExtracted] = useState<any>(null);
  const [pdfRevisao, setPdfRevisao] = useState<any>({});
  const [resultado, setResultado] = useState<{ criados: number; atualizados: number; erros: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const previewMutation = trpc.importacao.parseFile.useMutation({
    onSuccess: (data) => {
      setColunas(data.headers);
      setPreview(data.preview as any[]);
      // Auto-mapeamento inteligente
      const autoMap: Record<string, string> = { ...data.sugestoes };
      data.headers.forEach((col: string) => {
        if (autoMap[col]) return; // já tem sugestão
        const lower = col.toLowerCase().replace(/\s/g, "");
        if (lower.includes("cnpj")) autoMap[col] = "cnpj";
        else if (lower.includes("razao") || lower.includes("razão")) autoMap[col] = "razaoSocial";
        else if (lower.includes("fantasia")) autoMap[col] = "nomeFantasia";
        else if (lower.includes("vencimento") || lower.includes("validade")) autoMap[col] = "dataVencimento";
        else if (lower.includes("emissao") || lower.includes("emissão")) autoMap[col] = "dataEmissao";
        else if (lower.includes("tipo")) autoMap[col] = "tipoAlvara";
        else if (lower.includes("numero") || lower.includes("número") || lower.includes("alvara")) autoMap[col] = "numeroAlvara";
        else if (lower.includes("orgao") || lower.includes("órgão") || lower.includes("emissor")) autoMap[col] = "orgaoEmissor";
        else if (lower.includes("cidade")) autoMap[col] = "cidade";
        else if (lower.includes("uf") || lower.includes("estado")) autoMap[col] = "uf";
        else if (lower.includes("telefone") || lower.includes("fone")) autoMap[col] = "telefone";
        else if (lower.includes("email") || lower.includes("e-mail")) autoMap[col] = "email";
        else autoMap[col] = "ignorar";
      });
      setMapeamento(autoMap);
      setStep("mapeamento");
    },
    onError: (e) => toast.error("Erro ao ler arquivo: " + e.message),
  });

  const pdfMutation = trpc.importacao.parsePdf.useMutation({
    onSuccess: (data) => {
      setPdfExtracted(data);
      setPdfRevisao(data);
      setStep("revisao");
    },
    onError: (e) => toast.error("Erro ao extrair PDF: " + e.message),
  });

  const importarMutation = trpc.importacao.confirmarImportacao.useMutation({
      onSuccess: (data: any) => {
      setResultado(data);
      setStep("concluido");
    },
    onError: (e: any) => toast.error("Erro na importação: " + e.message),
  });

  const confirmarPdfMutation = trpc.importacao.confirmarPdf.useMutation({
    onSuccess: (data: any) => {
      setResultado({ criados: data.success ? 1 : 0, atualizados: 0, erros: [] });
      setStep("concluido");
    },
    onError: (e: any) => toast.error("Erro ao salvar: " + e.message),
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") setFileType("pdf");
    else if (ext === "csv") setFileType("csv");
    else setFileType("xlsx");

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      setFileBase64(base64);
    };
    reader.readAsDataURL(f);
  };

  const handleProcessar = () => {
    if (!file || !fileBase64) { toast.error("Selecione um arquivo."); return; }
    if (fileType === "pdf") {
      pdfMutation.mutate({ fileBase64, fileName: file.name });
    } else {
      previewMutation.mutate({ fileBase64, fileName: file.name, fileType });
    }
  };

  const handleImportar = () => {
    importarMutation.mutate({
      fileBase64,
      fileName: file!.name,
      fileType: fileType as "xlsx" | "csv",
      mapeamento: Object.fromEntries(
        Object.entries(mapeamento).filter(([, v]) => v !== "ignorar")
      ),
    });
  };

  const resetar = () => {
    setStep("upload");
    setFile(null);
    setFileBase64("");
    setColunas([]);
    setMapeamento({});
    setPreview([]);
    setPdfExtracted(null);
    setPdfRevisao({});
    setResultado(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Importar Dados</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Importe clientes e alvarás a partir de arquivos XLSX, CSV ou PDF
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {(["upload", "mapeamento", "revisao", "concluido"] as ImportStep[]).map((s, idx) => {
          const labels = ["Upload", "Mapeamento", "Revisão", "Concluído"];
          const isActive = s === step;
          const isPast = ["upload", "mapeamento", "revisao", "concluido"].indexOf(step) > idx;
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 text-xs font-medium ${isActive ? "text-primary" : isPast ? "text-emerald-600" : "text-muted-foreground"}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${isActive ? "bg-primary text-white" : isPast ? "bg-emerald-100 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                  {isPast ? "✓" : idx + 1}
                </div>
                <span className="hidden sm:inline">{labels[idx]}</span>
              </div>
              {idx < 3 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold">Selecionar Arquivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {(["xlsx", "csv", "pdf"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => { setFileType(type); fileRef.current?.click(); }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all hover:border-primary/40 hover:bg-muted/30 ${fileType === type && file ? "border-primary bg-primary/5" : "border-dashed border-muted-foreground/25"}`}
                >
                  {type === "pdf" ? (
                    <FileText className="h-8 w-8 text-red-500" />
                  ) : (
                    <FileSpreadsheet className="h-8 w-8 text-emerald-500" />
                  )}
                  <span className="text-xs font-semibold uppercase">{type}</span>
                  <span className="text-xs text-muted-foreground text-center">
                    {type === "pdf" ? "Extração automática com IA" : "Planilha estruturada"}
                  </span>
                </button>
              ))}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.pdf"
              className="hidden"
              onChange={handleFileSelect}
            />

            {file && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                {file.name.endsWith(".pdf") ? (
                  <FileText className="h-5 w-5 text-red-500 shrink-0" />
                ) : (
                  <FileSpreadsheet className="h-5 w-5 text-emerald-500 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setFile(null); setFileBase64(""); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 flex gap-2">
              <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-700 space-y-1">
                <p className="font-medium">Formatos aceitos:</p>
                <p>• <strong>XLSX/CSV:</strong> Planilhas com colunas de dados dos clientes e alvarás. Você poderá mapear as colunas na próxima etapa.</p>
                <p>• <strong>PDF:</strong> O sistema usará IA para extrair automaticamente CNPJ, razão social e datas. Você revisará antes de salvar.</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleProcessar}
                disabled={!file || previewMutation.isPending || pdfMutation.isPending}
                className="gap-2"
              >
                {(previewMutation.isPending || pdfMutation.isPending) ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</>
                ) : (
                  <>Processar arquivo <ArrowRight className="h-4 w-4" /></>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Mapeamento de colunas */}
      {step === "mapeamento" && (
        <div className="space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold">Mapeamento de Colunas</CardTitle>
              <p className="text-xs text-muted-foreground">
                Associe cada coluna do arquivo ao campo correspondente no sistema. Campos com * são obrigatórios.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {colunas.map((col) => (
                  <div key={col} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{col}</p>
                      {preview[0]?.[col] !== undefined && (
                        <p className="text-xs text-muted-foreground truncate">
                          Ex.: {String(preview[0][col]).substring(0, 50)}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="w-56 shrink-0">
                      <Select
                        value={mapeamento[col] ?? "ignorar"}
                        onValueChange={(v) => setMapeamento((prev) => ({ ...prev, [col]: v }))}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CAMPOS_SISTEMA.map((c) => (
                            <SelectItem key={c.value} value={c.value} className="text-xs">
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          {preview.length > 0 && (
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Prévia dos dados ({preview.length} linha(s))
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="border-b">
                        {colunas.slice(0, 6).map((col) => (
                          <th key={col} className="text-left py-1.5 px-2 font-medium text-muted-foreground">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          {colunas.slice(0, 6).map((col) => (
                            <td key={col} className="py-1.5 px-2 text-muted-foreground truncate max-w-32">
                              {String(row[col] ?? "").substring(0, 30)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3 justify-between">
            <Button variant="outline" onClick={resetar}>Voltar</Button>
            <Button
              onClick={handleImportar}
              disabled={importarMutation.isPending}
              className="gap-2"
            >
              {importarMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Importando...</>
              ) : (
                <>Importar dados <ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Revisão PDF */}
      {step === "revisao" && pdfExtracted && (
        <div className="space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold">Revisão dos Dados Extraídos</CardTitle>
              <p className="text-xs text-muted-foreground">
                Verifique e corrija os dados extraídos automaticamente do PDF antes de salvar.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(pdfRevisao).map(([key, value]) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs font-medium capitalize">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </Label>
                    <Input
                      value={String(value ?? "")}
                      onChange={(e) => setPdfRevisao((prev: any) => ({ ...prev, [key]: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-between">
            <Button variant="outline" onClick={resetar}>Voltar</Button>
            <Button
              onClick={() => confirmarPdfMutation.mutate({ fileName: file?.name ?? "alvara.pdf", dados: pdfRevisao })}
              disabled={confirmarPdfMutation.isPending}
              className="gap-2"
            >
              {confirmarPdfMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
              ) : (
                <>Confirmar e salvar <ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Concluído */}
      {step === "concluido" && resultado && (
        <Card className="border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="p-4 rounded-full bg-emerald-50">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-semibold">Importação concluída!</h3>
              <p className="text-sm text-muted-foreground">
                {resultado.criados} registro(s) criado(s) · {resultado.atualizados} atualizado(s)
              </p>
            </div>
            {resultado.erros.length > 0 && (
              <div className="w-full max-w-md p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-xs font-semibold text-red-700 mb-2">
                  {resultado.erros.length} erro(s) encontrado(s):
                </p>
                <ul className="text-xs text-red-600 space-y-1">
                  {resultado.erros.slice(0, 10).map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button onClick={resetar} variant="outline">Nova importação</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
