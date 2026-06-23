import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Clock, LogOut, ShieldAlert } from "lucide-react";
import { getLoginUrl } from "@/const";

interface Props {
  status: "pending" | "blocked";
  userName?: string | null;
}

export default function AcessoPendente({ status, userName }: Props) {
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = getLoginUrl();
    },
  });

  const isPending = status === "pending";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
          isPending ? "bg-amber-100 dark:bg-amber-900/30" : "bg-red-100 dark:bg-red-900/30"
        }`}>
          {isPending
            ? <Clock className="h-8 w-8 text-amber-500" />
            : <ShieldAlert className="h-8 w-8 text-red-500" />}
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold">
            {isPending ? "Acesso Aguardando Aprovação" : "Acesso Bloqueado"}
          </h1>
          {userName && (
            <p className="text-sm text-muted-foreground">Olá, <strong>{userName}</strong></p>
          )}
          <p className="text-sm text-muted-foreground">
            {isPending
              ? "Seu cadastro foi registrado. Um administrador precisa aprovar seu acesso antes que você possa utilizar o sistema."
              : "Sua conta foi bloqueada por um administrador. Entre em contato com a equipe responsável para mais informações."}
          </p>
        </div>

        {isPending && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300">
            <p className="font-medium">O que acontece agora?</p>
            <p className="mt-1 text-xs">
              Um Gestor Master receberá uma notificação e aprovará seu acesso em breve. Após a aprovação, faça login novamente para acessar o sistema.
            </p>
          </div>
        )}

        <Button
          variant="outline"
          className="gap-2"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        >
          <LogOut className="h-4 w-4" />
          Sair da conta
        </Button>
      </div>
    </div>
  );
}
