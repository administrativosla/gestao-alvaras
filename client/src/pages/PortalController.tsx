import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getLoginUrl } from "@/const";
import { PORTAL_AREAS } from "@shared/portal";
import AcessoPendente from "@/pages/AcessoPendente";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileCheck2,
  Files,
  Landmark,
  LogOut,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import { useLocation } from "wouter";

const areas = [
  {
    id: "alvaras" as const,
    icon: Landmark,
    eyebrow: "Operação consolidada",
    destaque: "Controle preventivo",
    recursos: ["Alvarás e CLIs", "Alertas de vencimento", "Validação cadastral"],
    className: "from-slate-950 via-slate-900 to-blue-950",
    iconClassName: "bg-blue-400/15 text-blue-200 ring-blue-300/20",
  },
  {
    id: "certidoes" as const,
    icon: FileCheck2,
    eyebrow: "Nova área",
    destaque: "Pesquisa centralizada",
    recursos: ["Consultas por CNPJ", "Download de documentos", "Leitura de resultados"],
    className: "from-emerald-950 via-slate-900 to-teal-950",
    iconClassName: "bg-emerald-400/15 text-emerald-200 ring-emerald-300/20",
  },
];

export default function PortalController() {
  const { loading, user, logout } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f4f7fb] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/70">
          <img src="/manus-storage/mjp-logo_12ad3d80.png" alt="MJP Controller" className="h-16 w-auto object-contain" />
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">Portal Controller</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Um acesso para toda a operação.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Entre para acessar os gestores de alvarás e certidões com o mesmo cadastro empresarial e as mesmas permissões.
          </p>
          <Button onClick={() => { window.location.href = getLoginUrl(); }} size="lg" className="mt-8 w-full">
            Entrar no Portal Controller
          </Button>
        </div>
      </div>
    );
  }

  const userStatus = (user as { userStatus?: string }).userStatus;
  if (userStatus === "pending" || userStatus === "blocked") {
    return <AcessoPendente status={userStatus} userName={user.name} />;
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-950">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-4">
            <img src="/manus-storage/mjp-logo_12ad3d80.png" alt="MJP Controller" className="h-11 w-auto object-contain" />
            <div className="hidden border-l border-slate-200 pl-4 sm:block">
              <p className="text-sm font-semibold tracking-tight">Portal Controller</p>
              <p className="text-xs text-slate-500">Central de gestão regulatória</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-none">{user.name ?? "Usuário"}</p>
              <p className="mt-1 text-xs text-slate-500">{user.email ?? "Acesso autenticado"}</p>
            </div>
            <Avatar className="h-9 w-9 border border-slate-200">
              <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-700">
                {user.name?.charAt(0).toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Sair do Portal Controller">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div>
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Ambiente integrado</Badge>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-5xl">
              Escolha a frente de trabalho para continuar.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Os dois gestores utilizam a mesma base de empresas, usuários e permissões. Você alterna de contexto sem duplicar cadastros.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><ShieldCheck className="h-5 w-5" /></div>
              <div>
                <p className="text-sm font-semibold">Base corporativa única</p>
                <p className="mt-1 text-sm leading-5 text-slate-500">CNPJ, inscrições estadual e municipal ficam disponíveis para os dois módulos.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          {areas.map((area) => {
            const conteudo = PORTAL_AREAS[area.id];
            const Icon = area.icon;
            return (
              <article key={area.id} className={`group relative overflow-hidden rounded-[28px] bg-gradient-to-br ${area.className} p-7 text-white shadow-[0_26px_70px_-36px_rgba(15,23,42,0.8)] sm:p-9`}>
                <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/[0.06] blur-2xl transition-transform duration-300 group-hover:scale-110" />
                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <div className={`rounded-2xl p-3 ring-1 ${area.iconClassName}`}><Icon className="h-7 w-7" /></div>
                    <span className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-white/70">{area.eyebrow}</span>
                  </div>
                  <p className="mt-8 text-sm font-medium text-white/55">{area.destaque}</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight">{conteudo.nome}</h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">{conteudo.descricao}</p>
                  <div className="mt-7 flex flex-wrap gap-2">
                    {area.recursos.map((recurso) => (
                      <span key={recurso} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1.5 text-xs text-white/75 ring-1 ring-white/10">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {recurso}
                      </span>
                    ))}
                  </div>
                  <Button onClick={() => setLocation(conteudo.rota)} className="mt-9 h-11 bg-white text-slate-950 hover:bg-white/90">
                    Acessar gestor <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </article>
            );
          })}
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Building2, titulo: "Empresas compartilhadas", texto: "Uma única ficha empresarial abastece todos os fluxos." },
            { icon: SearchCheck, titulo: "Consultas rastreáveis", texto: "Cada execução poderá manter resultado, horário e fonte." },
            { icon: Files, titulo: "Documentos centralizados", texto: "Certidões emitidas ficarão vinculadas ao respectivo CNPJ." },
          ].map((item) => (
            <div key={item.titulo} className="rounded-2xl border border-slate-200 bg-white p-5">
              <item.icon className="h-5 w-5 text-slate-700" />
              <p className="mt-4 text-sm font-semibold">{item.titulo}</p>
              <p className="mt-1 text-sm leading-5 text-slate-500">{item.texto}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
