import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Upload,
  FileText,
  Archive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ArrowRight,
  Pencil,
  PackageOpen,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useRef, useState, useCallback } from "react";
import { toast } from "sonner";

type LoteStep = "upload" | "extraindo" | "revisao" | "concluido";

interface ArquivoStatus {
  name: string;
  size: number;
  status: "aguardando" | "extraindo" | "ok" | "erro";
  erro?: string;
}

interface RegistroLote {
  fileName: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  inscricaoEstadual?: string | null;
  inscricaoMunicipal?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  numeroAlvara?: string | null;
  tipo?: string | null;
  orgaoEmissor?: string | null;
  dataEmissao?: string | null;
  dataVencimento?: string | null;
  _erro?: string | null;
  _incluir: boolean;
}

const TIPOS_ALVARA = ["Funcionamento", "Sanitário", "Bombeiros", "Ambiental", "Publicidade", "Obras", "Outros", "CLI", "AVCB"];

export default function ImportacaoLotePage() {
  const [step, setStep] = useState<LoteStep>("upload");
  const [arquivosStatus, setArquivosStatus] = useState<ArquivoStatus[]>([]);
  const [registros, setRegistros] = useState<RegistroLote[]>([]);
  const [editandoIdx, setEditandoIdx] = useState<number | null>(null);
  const [resultado, setResultado] = useState<{ importados: number; atualizados: number; erros: number; errosList: string[] } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseLoteMutation = trpc.importacao.parsePdfLote.useMutation();
  const parseZipMutation = trpc.importacao.parseZip.useMutation();
  const confirmarLoteMutation = trpc.importacao.confirmarLote.useMutation({
    onSuccess: (data) => {
      setResultado(data);
      setStep("concluido");
    },
    onError: (e) => toast.error("Erro ao importar: " + e.message),
  });

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const processarArquivos = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    // Separar PDFs de ZIPs
    const pdfs = files.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    const zips = files.filter((f) => f.name.toLowerCase().endsWith(".zip"));
    const outros = files.filter((f) => !f.name.toLowerCase().endsWith(".pdf") && !f.name.toLowerCase().endsWith(".zip"));

    if (outros.length > 0) {
      toast.warning(`${outros.length} arquivo(s) ignorado(s): apenas PDF e ZIP são suportados.`);
    }

    if (pdfs.length === 0 && zips.length === 0) {
      toast.error("Nenhum arquivo PDF ou ZIP selecionado.");
      return;
    }

    // Inicializar status dos arquivos
    const statusInicial: ArquivoStatus[] = [
      ...pdfs.map((f) => ({ name: f.name, size: f.size, status: "aguardando" as const })),
      ...zips.map((f) => ({ name: f.name, size: f.size, status: "aguardando" as const })),
    ];
    setArquivosStatus(statusInicial);
    setStep("extraindo");

    const todosRegistros: RegistroLote[] = [];

    // Processar ZIPs primeiro — extrair PDFs internos
    for (const zipFile of zips) {
      setArquivosStatus((prev) =>
        prev.map((a) => (a.name === zipFile.name ? { ...a, status: "extraindo" } : a))
      );
      try {
        const base64 = await toBase64(zipFile);
        const { arquivos, erros } = await parseZipMutation.mutateAsync({ fileBase64: base64, fileName: zipFile.name });

        if (erros.length > 0) {
          toast.warning(`ZIP ${zipFile.name}: ${erros.length} arquivo(s) ignorado(s) dentro do ZIP.`);
        }

        // Processar os PDFs extraídos do ZIP
        if (arquivos.length > 0) {
          const resultados = await parseLoteMutation.mutateAsync({ arquivos });
          resultados.forEach((r) => {
            if (r.dados && !r.erro) {
              todosRegistros.push({ ...r.dados, fileName: r.fileName, _incluir: true });
            } else {
              todosRegistros.push({
                fileName: r.fileName,
                cnpj: "",
                razaoSocial: "",
                _erro: r.erro ?? "Falha na extração",
                _incluir: false,
              });
            }
          });
        }

        setArquivosStatus((prev) =>
          prev.map((a) => (a.name === zipFile.name ? { ...a, status: "ok" } : a))
        );
      } catch (e: any) {
        setArquivosStatus((prev) =>
          prev.map((a) => (a.name === zipFile.name ? { ...a, status: "erro", erro: e.message } : a))
        );
      }
    }

    // Processar PDFs diretos em lote
    if (pdfs.length > 0) {
      pdfs.forEach((f) => {
        setArquivosStatus((prev) =>
          prev.map((a) => (a.name === f.name ? { ...a, status: "extraindo" } : a))
        );
      });

      try {
        const arquivos = await Promise.all(
          pdfs.map(async (f) => ({ fileName: f.name, fileBase64: await toBase64(f) }))
        );
        const resultados = await parseLoteMutation.mutateAsync({ arquivos });

        resultados.forEach((r, i) => {
          const fileName = pdfs[i]?.name ?? r.fileName;
          if (r.dados && !r.erro) {
            todosRegistros.push({ ...r.dados, fileName, _incluir: true });
            setArquivosStatus((prev) =>
              prev.map((a) => (a.name === fileName ? { ...a, status: "ok" } : a))
            );
          } else {
            todosRegistros.push({
              fileName,
              cnpj: "",
              razaoSocial: "",
              _erro: r.erro ?? "Falha na extração",
              _incluir: false,
            });
            setArquivosStatus((prev) =>
              prev.map((a) => (a.name === fileName ? { ...a, status: "erro", erro: r.erro ?? "Falha" } : a))
            );
          }
        });
      } catch (e: any) {
        pdfs.forEach((f) => {
          setArquivosStatus((prev) =>
            prev.map((a) => (a.name === f.name ? { ...a, status: "erro", erro: e.message } : a))
          );
        });
      }
    }

    setRegistros(todosRegistros);
    setStep("revisao");
  }, [parseLoteMutation, parseZipMutation]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      processarArquivos(files);
    },
    [processarArquivos]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    processarArquivos(files);
  };

  const updateRegistro = (idx: number, field: string, value: string) => {
    setRegistros((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value || null } : r))
    );
  };

  const toggleIncluir = (idx: number) => {
    setRegistros((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, _incluir: !r._incluir } : r))
    );
  };

  const handleConfirmar = () => {
    const validos = registros.filter((r) => r._incluir && r.cnpj && r.razaoSocial);
    if (validos.length === 0) {
      toast.error("Nenhum registro válido selecionado para importar.");
      return;
    }
    confirmarLoteMutation.mutate({ registros: validos });
  };

  const resetar = () => {
    setStep("upload");
    setArquivosStatus([]);
    setRegistros([]);
    setEditandoIdx(null);
    setResultado(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const registrosValidos = registros.filter((r) => r._incluir && r.cnpj && r.razaoSocial);
  const registrosComErro = registros.filter((r) => r._erro);
  const registrosSemVencimento = registros.filter((r) => r._incluir && !r.dataVencimento);

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Importação em Lote</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Envie múltiplos PDFs ou um arquivo ZIP — a IA extrai os dados automaticamente para revisão
        </p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["upload", "extraindo", "revisao", "concluido"] as LoteStep[]).map((s, idx) => {
          const labels = ["Envio", "Extração IA", "Revisão", "Concluído"];
          const order = ["upload", "extraindo", "revisao", "concluido"];
          const isActive = s === step;
          const isPast = order.indexOf(step) > idx;
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
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <PackageOpen className="h-4 w-4 text-primary" />
              Selecionar Arquivos
            </CardTitle>
            <CardDescription>
              Arraste e solte múltiplos PDFs ou um arquivo ZIP contendo os alvarás. Limite: 50 PDFs por importação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dropzone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                isDragOver
                  ? "border-primary bg-primary/5 scale-[1.01]"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="flex gap-3">
                  <div className="p-3 bg-red-50 rounded-xl">
                    <FileText className="h-7 w-7 text-red-500" />
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl">
                    <Archive className="h-7 w-7 text-amber-500" />
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-sm">Arraste PDFs ou um arquivo ZIP aqui</p>
                  <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar arquivos</p>
                </div>
                <div className="flex gap-2 flex-wrap justify-center">
                  <Badge variant="secondary" className="text-xs">PDF — alvarás individuais</Badge>
                  <Badge variant="secondary" className="text-xs">ZIP — vários PDFs compactados</Badge>
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".pdf,.zip"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>

            {/* Dica */}
            <div className="flex gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <Sparkles className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700">
                A IA lê o conteúdo de cada PDF e extrai automaticamente CNPJ, Razão Social, tipo de alvará, datas de emissão e vencimento, órgão emissor e endereço. Você poderá revisar e corrigir antes de confirmar.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Extraindo */}
      {step === "extraindo" && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              Extraindo dados com IA...
            </CardTitle>
            <CardDescription>
              Processando {arquivosStatus.length} arquivo(s). Aguarde — pode levar alguns segundos por arquivo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {arquivosStatus.map((arq) => (
                <div key={arq.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1 truncate">{arq.name}</span>
                  <span className="text-xs text-muted-foreground">{(arq.size / 1024).toFixed(0)} KB</span>
                  {arq.status === "aguardando" && (
                    <Badge variant="secondary" className="text-xs">Aguardando</Badge>
                  )}
                  {arq.status === "extraindo" && (
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      <span className="text-xs text-primary font-medium">Extraindo...</span>
                    </div>
                  )}
                  {arq.status === "ok" && (
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">Extraído</span>
                    </div>
                  )}
                  {arq.status === "erro" && (
                    <div className="flex items-center gap-1.5 text-red-500">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">Erro</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Revisão */}
      {step === "revisao" && (
        <div className="space-y-4">
          {/* Resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-muted/40 border text-center">
              <p className="text-xl font-bold">{registros.length}</p>
              <p className="text-xs text-muted-foreground">Total extraídos</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-center">
              <p className="text-xl font-bold text-emerald-700">{registrosValidos.length}</p>
              <p className="text-xs text-emerald-600">Prontos para importar</p>
            </div>
            {registrosSemVencimento.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 text-center">
                <p className="text-xl font-bold text-amber-700">{registrosSemVencimento.length}</p>
                <p className="text-xs text-amber-600">Sem data de vencimento</p>
              </div>
            )}
            {registrosComErro.length > 0 && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-center">
                <p className="text-xl font-bold text-red-700">{registrosComErro.length}</p>
                <p className="text-xs text-red-600">Com erro de extração</p>
              </div>
            )}
          </div>

          {registrosSemVencimento.length > 0 && (
            <div className="flex gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <TriangleAlert className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">
                {registrosSemVencimento.length} registro(s) sem data de vencimento. Esses alvarás serão importados sem data — edite-os abaixo ou eles não terão alertas de vencimento.
              </p>
            </div>
          )}

          {/* Lista de registros */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Revisar Registros Extraídos</CardTitle>
              <CardDescription>
                Clique no ícone de edição para corrigir campos. Desmarque registros que não deseja importar.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[500px]">
                <div className="divide-y">
                  {registros.map((reg, idx) => (
                    <div key={idx} className={`p-4 ${!reg._incluir ? "opacity-50 bg-muted/20" : ""}`}>
                      <div className="flex items-start gap-3">
                        {/* Checkbox incluir */}
                        <input
                          type="checkbox"
                          checked={reg._incluir}
                          onChange={() => toggleIncluir(idx)}
                          className="mt-1 h-4 w-4 rounded border-border cursor-pointer"
                          disabled={!!reg._erro}
                        />

                        <div className="flex-1 min-w-0">
                          {reg._erro ? (
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-red-600">{reg.fileName}</p>
                                <p className="text-xs text-red-500 mt-0.5">{reg._erro}</p>
                              </div>
                            </div>
                          ) : editandoIdx === idx ? (
                            /* Modo edição */
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground font-medium">{reg.fileName}</p>
                                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditandoIdx(null)}>
                                  Fechar edição
                                </Button>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {[
                                  { key: "cnpj", label: "CNPJ *" },
                                  { key: "razaoSocial", label: "Razão Social *" },
                                  { key: "nomeFantasia", label: "Nome Fantasia" },
                                  { key: "tipo", label: "Tipo de Alvará" },
                                  { key: "numeroAlvara", label: "Número do Alvará" },
                                  { key: "orgaoEmissor", label: "Órgão Emissor" },
                                  { key: "dataEmissao", label: "Data Emissão (YYYY-MM-DD)" },
                                  { key: "dataVencimento", label: "Data Vencimento (YYYY-MM-DD) *" },
                                  { key: "cidade", label: "Cidade" },
                                  { key: "uf", label: "UF" },
                                ].map(({ key, label }) => (
                                  key === "tipo" ? (
                                    <div key={key} className="space-y-1">
                                      <Label className="text-xs">{label}</Label>
                                      <Select
                                        value={(reg as any)[key] ?? ""}
                                        onValueChange={(v) => updateRegistro(idx, key, v)}
                                      >
                                        <SelectTrigger className="h-7 text-xs">
                                          <SelectValue placeholder="Selecionar..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {TIPOS_ALVARA.map((t) => (
                                            <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  ) : (
                                    <div key={key} className="space-y-1">
                                      <Label className="text-xs">{label}</Label>
                                      <Input
                                        className="h-7 text-xs"
                                        value={(reg as any)[key] ?? ""}
                                        onChange={(e) => updateRegistro(idx, key, e.target.value)}
                                      />
                                    </div>
                                  )
                                ))}
                              </div>
                            </div>
                          ) : (
                            /* Modo visualização */
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-semibold truncate">{reg.razaoSocial || <span className="text-red-500">Razão Social ausente</span>}</p>
                                  {reg.tipo && (
                                    <Badge variant="outline" className="text-xs shrink-0">{reg.tipo}</Badge>
                                  )}
                                  {!reg.dataVencimento && reg._incluir && (
                                    <Badge variant="outline" className="text-xs border-amber-300 text-amber-600 shrink-0">Sem vencimento</Badge>
                                  )}
                                </div>
                                <div className="flex gap-3 mt-1 flex-wrap">
                                  <span className="text-xs text-muted-foreground">{reg.cnpj || <span className="text-red-400">CNPJ ausente</span>}</span>
                                  {reg.dataVencimento && (
                                    <span className="text-xs text-muted-foreground">Vence: {new Date(reg.dataVencimento + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                                  )}
                                  {reg.orgaoEmissor && (
                                    <span className="text-xs text-muted-foreground">{reg.orgaoEmissor}</span>
                                  )}
                                  {reg.cidade && reg.uf && (
                                    <span className="text-xs text-muted-foreground">{reg.cidade}/{reg.uf}</span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground/60 mt-0.5">{reg.fileName}</p>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 shrink-0"
                                onClick={() => setEditandoIdx(editandoIdx === idx ? null : idx)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-between">
            <Button variant="outline" onClick={resetar}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmar}
              disabled={registrosValidos.length === 0 || confirmarLoteMutation.isPending}
            >
              {confirmarLoteMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importando...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-2" />Importar {registrosValidos.length} registro(s)</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Concluído */}
      {step === "concluido" && resultado && (
        <Card className="border shadow-sm">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-4 bg-emerald-50 rounded-full">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Importação concluída!</h2>
                <p className="text-sm text-muted-foreground mt-1">Os dados foram salvos no sistema com sucesso.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg">
                <div className="p-3 bg-muted/40 rounded-lg text-center">
                  <p className="text-2xl font-bold">{resultado.importados + resultado.atualizados + resultado.erros}</p>
                  <p className="text-xs text-muted-foreground">Total processado</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-emerald-700">{resultado.importados}</p>
                  <p className="text-xs text-emerald-600">Novos alvarás</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-700">{resultado.atualizados}</p>
                  <p className="text-xs text-blue-600">Clientes existentes</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-700">{resultado.erros}</p>
                  <p className="text-xs text-red-600">Erros</p>
                </div>
              </div>

              {resultado.errosList.length > 0 && (
                <div className="w-full max-w-lg text-left">
                  <p className="text-xs font-semibold text-red-600 mb-1">Erros encontrados:</p>
                  <ScrollArea className="max-h-32">
                    <div className="space-y-1">
                      {resultado.errosList.map((e, i) => (
                        <p key={i} className="text-xs text-red-500 bg-red-50 rounded px-2 py-1">{e}</p>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={resetar}>
                  Nova importação
                </Button>
                <Button onClick={() => window.location.href = "/alvaras"}>
                  Ver alvarás
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
