import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Users,
  FileText,
  Upload,
  PackageOpen,
  Download,
  Bell,
  UserCog,
  Crown,
  Shield,
  User as UserIcon,
  TrendingUp,
  Wrench,
  PanelsTopLeft,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import AcessoPendente from "@/pages/AcessoPendente";

type UserRole = "operator" | "gestor" | "master";

const ROLE_LEVEL: Record<UserRole, number> = {
  operator: 1,
  gestor: 2,
  master: 3,
};

const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  operator: <UserIcon className="h-3 w-3" />,
  gestor: <Shield className="h-3 w-3" />,
  master: <Crown className="h-3 w-3" />,
};

const ROLE_LABELS: Record<UserRole, string> = {
  operator: "Operador",
  gestor: "Gestor",
  master: "Master",
};

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({ children, area = "alvaras" }: { children: React.ReactNode; area?: "alvaras" | "certidoes" }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-10 max-w-sm w-full">
          <div className="flex flex-col items-center gap-3">
            <img
              src="/manus-storage/mjp-logo_12ad3d80.png"
              alt="MJP Controller"
              className="h-14 w-auto object-contain mb-1"
            />
            <h1 className="text-xl font-semibold tracking-tight text-center">Gestor de Alvarás</h1>
            <p className="text-sm text-muted-foreground text-center">
              Sistema de controle de alvarás de funcionamento. Faça login para continuar.
            </p>
          </div>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            size="lg"
            className="w-full"
          >
            Entrar no sistema
          </Button>
        </div>
      </div>
    );
  }

  // Interceptar usuários pending ou blocked antes de mostrar o layout
  const userStatus = (user as any).userStatus as string | undefined;
  if (userStatus === "pending" || userStatus === "blocked") {
    return <AcessoPendente status={userStatus as "pending" | "blocked"} userName={user.name} />;
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth} area={area}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
  area,
}: {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
  area: "alvaras" | "certidoes";
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const userRole = ((user as any)?.role ?? "operator") as UserRole;
  const userLevel = ROLE_LEVEL[userRole] ?? 1;

  // Badge de usuários pendentes (somente master)
  const { data: pendentes } = trpc.usuarios.contarPendentes.useQuery(undefined, {
    enabled: userLevel >= 3,
    refetchInterval: 60_000,
  });

  // Menu dinâmico por nível
  const menuItems = (area === "certidoes" ? [
    { icon: PanelsTopLeft, label: "Portal Controller", path: "/", minLevel: 1 },
    { icon: LayoutDashboard, label: "Visão geral", path: "/certidoes", minLevel: 1 },
  ] : [
    { icon: PanelsTopLeft, label: "Portal Controller", path: "/", minLevel: 1 },
    { icon: LayoutDashboard, label: "Dashboard", path: "/gestor-alvaras", minLevel: 1 },
    { icon: Users, label: "Clientes", path: "/clientes", minLevel: 1 },
    { icon: FileText, label: "Alvarás", path: "/alvaras", minLevel: 1 },
    { icon: Upload, label: "Importar", path: "/importar", minLevel: 1 },
    { icon: Download, label: "Exportar", path: "/exportar", minLevel: 2 },
    { icon: TrendingUp, label: "Pipeline Comercial", path: "/comercial", minLevel: 1 },
    { icon: Bell, label: "Alertas", path: "/alertas", minLevel: 3 },
    { icon: UserCog, label: "Usuários", path: "/usuarios", minLevel: 3, badge: pendentes ?? 0 },
    { icon: Wrench, label: "Manutenção", path: "/manutencao", minLevel: 3 },
  ]).filter((item) => userLevel >= item.minLevel);

  const activeMenuItem = menuItems.find(
    (item) => item.path === location || (item.path !== "/" && location.startsWith(item.path))
  );

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          {/* Header */}
          <SidebarHeader className="border-b border-sidebar-border/50">
            <div className="flex items-center gap-3 px-3 py-2">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors focus:outline-none shrink-0"
                aria-label="Alternar menu"
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/60" />
              </button>
              {!isCollapsed && (
                <div className="flex flex-col items-start min-w-0">
                  <img
                    src="/manus-storage/mjp-logo_12ad3d80.png"
                    alt="MJP Controller"
                    style={{ height: '55px', width: 'auto', objectFit: 'contain' }}
                  />
                  <span className="text-[10px] font-medium tracking-wide uppercase mt-0.5" style={{ color: '#ffffff', textAlign: 'center', width: '110px', display: 'block' }}>
                    {area === "certidoes" ? "Gestor de Certidões" : "Gestor de Alvarás"}
                  </span>
                </div>
              )}
              {isCollapsed && (
                <img
                  src="/manus-storage/mjp-logo_12ad3d80.png"
                  alt="MJP"
                  className="h-6 w-auto object-contain"
                />
              )}
            </div>
          </SidebarHeader>

          {/* Menu */}
          <SidebarContent className="gap-0 pt-2">
            <SidebarMenu className="px-2 gap-0.5">
              {menuItems.map((item) => {
                const isActive =
                  location === item.path || (item.path !== "/" && location.startsWith(item.path + "/"));
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-10 transition-all font-normal text-sidebar-foreground/80 hover:text-sidebar-foreground"
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-sidebar-primary" : ""}`} />
                      <span className="flex-1">{item.label}</span>
                      {(item as any).badge > 0 && (
                        <Badge className="h-4 min-w-4 px-1 text-[10px] bg-orange-500 text-white border-0 rounded-full">
                          {(item as any).badge}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          {/* Footer */}
          <SidebarFooter className="p-3 border-t border-sidebar-border/50">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent transition-colors w-full text-left focus:outline-none group-data-[collapsible=icon]:justify-center">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs font-semibold bg-sidebar-primary/20 text-sidebar-primary">
                      {user?.name?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium text-sidebar-foreground truncate leading-none">
                        {user?.name ?? "Usuário"}
                      </p>
                      <span className={`inline-flex items-center gap-0.5 text-[9px] font-semibold px-1 py-0.5 rounded ${
                        userRole === "master"
                          ? "bg-amber-100 text-amber-700"
                          : userRole === "gestor"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-600"
                      }`}>
                        {ROLE_ICONS[userRole]}
                        {ROLE_LABELS[userRole]}
                      </span>
                    </div>
                    <p className="text-xs text-sidebar-foreground/50 truncate mt-1">
                      {user?.email ?? ""}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <span className="font-medium text-sm">{activeMenuItem?.label ?? "Menu"}</span>
            </div>
          </div>
        )}
        <main className="flex-1 p-6 lg:p-8 min-h-screen">{children}</main>
      </SidebarInset>
    </>
  );
}
