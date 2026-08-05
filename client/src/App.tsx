import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";

// Pages
import Dashboard from "./pages/Dashboard";
import ClientesList from "./pages/ClientesList";
import ClienteForm from "./pages/ClienteForm";
import ClienteDetail from "./pages/ClienteDetail";
import AlvarasList from "./pages/AlvarasList";
import AlvaraForm from "./pages/AlvaraForm";
import AlvaraDetail from "./pages/AlvaraDetail";
import ImportarPage from "./pages/ImportarPage";
import ExportarPage from "./pages/ExportarPage";
import ConfiguracaoAlertas from "./pages/ConfiguracaoAlertas";
import GestaoUsuarios from "./pages/GestaoUsuarios";
import PipelineComercial from "./pages/PipelineComercial";

function AppRoutes() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/clientes" component={ClientesList} />
        <Route path="/clientes/novo">{() => <ClienteForm />}</Route>
        <Route path="/clientes/:id/editar">
          {(params) => <ClienteForm id={Number(params.id)} />}
        </Route>
        <Route path="/clientes/:id">
          {(params) => <ClienteDetail id={Number(params.id)} />}
        </Route>
        <Route path="/alvaras" component={AlvarasList} />
        <Route path="/alvaras/novo">{() => <AlvaraForm />}</Route>
        <Route path="/alvaras/:id/editar">
          {(params) => <AlvaraForm id={Number(params.id)} />}
        </Route>
        <Route path="/alvaras/:id">
          {(params) => <AlvaraDetail id={Number(params.id)} />}
        </Route>
        <Route path="/importar" component={ImportarPage} />
        <Route path="/exportar" component={ExportarPage} />
        <Route path="/alertas" component={ConfiguracaoAlertas} />
        <Route path="/usuarios" component={GestaoUsuarios} />
        <Route path="/comercial" component={PipelineComercial} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <AppRoutes />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
