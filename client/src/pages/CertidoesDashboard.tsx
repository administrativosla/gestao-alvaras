import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, FileCheck2, Info, Landmark, Search, ShieldAlert } from "lucide-react";
import { useLocation } from "wouter";

const fontes = [
  { nome: "Receita Federal", esfera: "Federal", estado: "Fluxo assistido", detalhe: "Emissão com hCaptcha e captura do PDF ou da mensagem apresentada." },
  { nome: "SEFAZ São Paulo", esfera: "Estadual", estado: "Automação candidata", detalhe: "Consulta pública por CNPJ, sujeita à validação funcional da emissão." },
  { nome: "PGE São Paulo", esfera: "Dívida ativa", estado: "API ou Gov.br", detalhe: "Prioridade para integração oficial; alternativa com sessão autenticada." },
  { nome: "CAIXA / FGTS", esfera: "Federal", estado: "Ambiente dedicado", detalhe: "O portal restringe acessos de datacenter e exige validação em ambiente permitido." },
  { nome: "TST / CNDT", esfera: "Trabalhista", estado: "Fluxo assistido", detalhe: "Consulta por CNPJ com CAPTCHA e download direto da certidão." },
];

export default function CertidoesDashboard() {
  const [, setLocation] = useLocation();

  return (
    <div className="mx-auto max-w-6xl space-y-7 animate-fade-in-up">
      <section className="overflow-hidden rounded-[28px] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-9 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div>
            <Badge className="border border-emerald-300/20 bg-emerald-300/10 text-emerald-200 hover:bg-emerald-300/10">Estrutura inicial</Badge>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Gestor de Certidões</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Central para pesquisar várias fontes sobre o mesmo CNPJ, armazenar documentos emitidos e registrar respostas apresentadas pelos portais.
            </p>
          </div>
          <div className="rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10">
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-5 w-5 text-emerald-300" />
              <div>
                <p className="text-sm font-semibold">Cadastro empresarial compartilhado</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">CNPJ, IE e IM já ficam disponíveis como insumos dos conectores.</p>
              </div>
            </div>
            <Button variant="secondary" className="mt-4 w-full" onClick={() => setLocation("/certidoes/clientes")}>Abrir cadastro de empresas</Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="shadow-sm"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><Landmark className="h-5 w-5" /></div><div><p className="text-2xl font-semibold">5</p><p className="text-xs text-muted-foreground">fontes mapeadas</p></div></CardContent></Card>
        <Card className="shadow-sm"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-blue-50 p-3 text-blue-700"><FileCheck2 className="h-5 w-5" /></div><div><p className="text-2xl font-semibold">PDF + tela</p><p className="text-xs text-muted-foreground">dois tipos de resultado</p></div></CardContent></Card>
        <Card className="shadow-sm"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-xl bg-amber-50 p-3 text-amber-700"><ShieldAlert className="h-5 w-5" /></div><div><p className="text-2xl font-semibold">Assistido</p><p className="text-xs text-muted-foreground">quando houver CAPTCHA</p></div></CardContent></Card>
      </section>

      <Card className="shadow-sm">
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Fontes da primeira etapa</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Classificação técnica preliminar dos portais indicados.</p>
          </div>
          <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600"><Search className="h-5 w-5" /></div>
        </CardHeader>
        <CardContent className="grid gap-3">
          {fontes.map((fonte) => (
            <div key={fonte.nome} className="grid gap-3 rounded-xl border border-border/70 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{fonte.nome}</p>
                  <span className="text-xs text-muted-foreground">{fonte.esfera}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{fonte.detalhe}</p>
              </div>
              <Badge variant="outline" className="w-fit bg-background">{fonte.estado}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
        <p className="text-sm leading-6">Os portais municipais ficarão para uma etapa posterior, com conectores específicos por prefeitura, sem alterar o cadastro empresarial compartilhado.</p>
      </div>
    </div>
  );
}
