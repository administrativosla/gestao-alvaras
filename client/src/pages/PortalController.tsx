import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { getLoginUrl } from "@/const";
import AcessoPendente from "@/pages/AcessoPendente";
import { PORTAL_AREAS } from "@shared/portal";
import { ArrowRight, FileCheck2, Landmark, LogOut } from "lucide-react";
import { useLocation } from "wouter";

const areas = [
  {
    id: "alvaras" as const,
    icon: Landmark,
    className: "from-slate-950 via-slate-900 to-blue-950",
    iconClassName: "bg-blue-400/15 text-blue-200 ring-blue-300/20",
  },
  {
    id: "certidoes" as const,
    icon: FileCheck2,
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
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Acesso ao sistema</h1>
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
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-4">
            <img src="/manus-storage/mjp-logo_12ad3d80.png" alt="MJP Controller" className="h-11 w-auto object-contain" />
            <span className="hidden border-l border-slate-200 pl-4 text-sm font-semibold tracking-tight sm:block">Portal Controller</span>
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

      <main className="mx-auto flex max-w-6xl flex-1 flex-col justify-center px-5 py-12 sm:min-h-[calc(100vh-74px)] sm:px-8 sm:py-16">
        <h1 className="text-center text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
          Escolha a ferramenta desejada
        </h1>

        <section className="mt-9 grid gap-6 lg:grid-cols-2">
          {areas.map((area) => {
            const conteudo = PORTAL_AREAS[area.id];
            const Icon = area.icon;
            return (
              <button
                key={area.id}
                type="button"
                onClick={() => setLocation(conteudo.rota)}
                className={`group relative min-h-72 overflow-hidden rounded-[28px] bg-gradient-to-br ${area.className} p-8 text-left text-white shadow-[0_26px_70px_-36px_rgba(15,23,42,0.8)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_30px_75px_-32px_rgba(15,23,42,0.9)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 sm:p-10`}
                aria-label={`Acessar ${conteudo.nome}`}
              >
                <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/[0.06] blur-2xl transition-transform duration-300 group-hover:scale-110" />
                <div className="relative flex h-full flex-col">
                  <div className={`w-fit rounded-2xl p-3 ring-1 ${area.iconClassName}`}><Icon className="h-7 w-7" /></div>
                  <h2 className="mt-9 text-3xl font-semibold tracking-tight">{conteudo.nome}</h2>
                  <span className="mt-auto inline-flex items-center gap-2 pt-10 text-sm font-semibold text-white">
                    Acessar ferramenta <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </button>
            );
          })}
        </section>
      </main>
    </div>
  );
}
