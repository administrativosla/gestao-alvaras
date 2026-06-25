import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Pencil,
  Plus,
  Building2,
  MapPin,
  Phone,
  Mail,
  Calendar,
  FileText,
  AlertCircle,
} from "lucide-react";
import { useLocation } from "wouter";
import { formatCnpj, formatDate, calcDiasParaVencimento, getAlertaInfo, getStatusColor } from "@/lib/alvaras";
import StatusBadge from "@/components/StatusBadge";

interface Props {
  id: number;
}

export default function ClienteDetail({ id }: Props) {
  const [, setLocation] = useLocation();

  const { data, isLoading } = trpc.clientes.get.useQuery({ id });
  const { data: alvaras } = trpc.alvaras.list.useQuery({ clienteId: id });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cliente não encontrado</p>
        <Button variant="outline" onClick={() => setLocation("/clientes")}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/clientes")} className="h-9 w-9 mt-0.5">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{data.razaoSocial}</h1>
            {data.nomeFantasia && (
              <p className="text-sm text-muted-foreground mt-0.5">{data.nomeFantasia}</p>
            )}
            <p className="text-sm font-mono text-muted-foreground mt-1">{formatCnpj(data.cnpj)}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocation(`/clientes/${id}/editar`)}
          className="gap-2"
        >
          <Pencil className="h-3.5 w-3.5" /> Editar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-4">
          {/* Dados cadastrais */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Dados Cadastrais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow icon={Building2} label="CNPJ" value={formatCnpj(data.cnpj)} />
              {data.inscricaoEstadual && <InfoRow icon={FileText} label="IE" value={data.inscricaoEstadual} />}
              {data.inscricaoMunicipal && <InfoRow icon={FileText} label="IM" value={data.inscricaoMunicipal} />}
              {data.dataAbertura && (
                <InfoRow icon={Calendar} label="Data de Abertura" value={formatDate(data.dataAbertura)} />
              )}
            </CardContent>
          </Card>

          {/* Endereço */}
          {(data.logradouro || data.cidade) && (
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Endereço
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-sm text-foreground">
                    {[
                      data.logradouro,
                      data.numero && `nº ${data.numero}`,
                      data.complemento,
                      data.bairro,
                      data.cidade && data.uf ? `${data.cidade}/${data.uf}` : data.cidade,
                      data.cep && `CEP ${data.cep}`,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Observações */}
          {data.observacoesPreventivas && (
            <Card className="border shadow-sm border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                  Observações Preventivas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-amber-900 whitespace-pre-wrap">{data.observacoesPreventivas}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Coluna lateral */}
        <div className="space-y-4">
          {/* Contato */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.nomeContato && <InfoRow icon={Building2} label="Responsável" value={data.nomeContato} />}
              {data.telefone && <InfoRow icon={Phone} label="Telefone" value={data.telefone} />}
              {data.email && <InfoRow icon={Mail} label="E-mail" value={data.email} />}
              {!data.nomeContato && !data.telefone && !data.email && (
                <p className="text-xs text-muted-foreground">Nenhum contato cadastrado</p>
              )}
            </CardContent>
          </Card>

          {/* E-mails de alerta */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                E-mails de Alerta
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.emailsAlerta && data.emailsAlerta.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {data.emailsAlerta.map((email) => (
                    <Badge key={email} variant="secondary" className="font-normal text-xs">
                      {email}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhum e-mail cadastrado</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Alvarás do cliente */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Alvarás</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLocation(`/alvaras/novo?clienteId=${id}`)}
            className="gap-2"
          >
            <Plus className="h-3.5 w-3.5" /> Novo Alvará
          </Button>
        </div>

        {!alvaras || alvaras.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
              <FileText className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum alvará cadastrado para este cliente</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {alvaras.map((a) => {
              const dias = calcDiasParaVencimento(a.alvara.dataVencimento);
              const info = dias !== null ? getAlertaInfo(dias) : null;
              return (
                <Card
                  key={a.alvara.id}
                  className="border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setLocation(`/alvaras/${a.alvara.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{a.alvara.tipo}</p>
                          {a.alvara.numeroAlvara && (
                            <span className="text-xs text-muted-foreground">Nº {a.alvara.numeroAlvara}</span>
                          )}
                        </div>
                        {a.alvara.orgaoEmissor && (
                          <p className="text-xs text-muted-foreground mt-0.5">{a.alvara.orgaoEmissor}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Vencimento: <span className="font-medium">{formatDate(a.alvara.dataVencimento)}</span>
                          {dias !== null && info && (
                            <span className={`ml-2 font-medium ${info.textColor}`}>
                              ({info.label})
                            </span>
                          )}
                        </p>
                      </div>
                      <StatusBadge status={a.alvara.status} dataVencimento={a.alvara.dataVencimento} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="text-xs text-muted-foreground">{label}: </span>
        <span className="text-sm font-medium">{value}</span>
      </div>
    </div>
  );
}
