import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { STATUS_RENOVACAO, getStatusColor } from "@/lib/alvaras";
import { ChevronRight, CalendarDays, CheckCircle2 } from "lucide-react";

interface Props {
  alvaraId: number;
  statusAtual: string;
  onUpdated?: () => void;
  trigger?: React.ReactNode;
}

export default function StatusUpdateDialog({ alvaraId, statusAtual, onUpdated, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [novoStatus, setNovoStatus] = useState(statusAtual);
  const [observacao, setObservacao] = useState("");
  const [novaDataVencimento, setNovaDataVencimento] = useState("");
  const utils = trpc.useUtils();

  const isRenovado = novoStatus === "Renovado";

  const mutation = trpc.alvaras.updateStatus.useMutation({
    onSuccess: () => {
      toast.success(
        isRenovado
          ? "Alvará renovado com sucesso! Nova data de vencimento registrada."
          : "Status atualizado com sucesso!"
      );
      setOpen(false);
      setObservacao("");
      setNovaDataVencimento("");
      utils.dashboard.alertas.invalidate();
      utils.dashboard.proximosVencimentos.invalidate();
      utils.dashboard.resumo.invalidate();
      utils.alvaras.list.invalidate();
      onUpdated?.();
    },
    onError: (err) => {
      toast.error("Erro ao atualizar status: " + err.message);
    },
  });

  const handleSave = () => {
    if (!novoStatus) return;
    if (isRenovado && !novaDataVencimento) {
      toast.error("Informe a nova data de vencimento para concluir a renovação.");
      return;
    }
    mutation.mutate({
      id: alvaraId,
      status: novoStatus as any,
      observacao: observacao || undefined,
      novaDataVencimento: isRenovado ? novaDataVencimento : undefined,
    });
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) {
      setNovoStatus(statusAtual);
      setObservacao("");
      setNovaDataVencimento("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
            Atualizar status <ChevronRight className="h-3 w-3" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Atualizar Status de Renovação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Status atual */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
            <span className="text-xs text-muted-foreground">Status atual:</span>
            <Badge
              variant="outline"
              className={`text-xs font-medium ${getStatusColor(statusAtual)}`}
            >
              {statusAtual}
            </Badge>
          </div>

          {/* Novo status */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Novo Status
            </Label>
            <Select value={novoStatus} onValueChange={setNovoStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_RENOVACAO.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Campo de nova data — aparece APENAS ao selecionar "Renovado" */}
          {isRenovado && (
            <div className="space-y-2 p-4 rounded-lg border border-green-200 bg-green-50/60">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Renovação concluída</span>
              </div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                Nova Data de Vencimento <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <Input
                type="date"
                value={novaDataVencimento}
                onChange={(e) => setNovaDataVencimento(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="text-sm bg-white"
              />
              <p className="text-xs text-muted-foreground">
                O sistema atualizará a data de vencimento e reiniciará o ciclo de alertas automaticamente.
              </p>
            </div>
          )}

          {/* Observação */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Observação (opcional)
            </Label>
            <Textarea
              placeholder={
                isRenovado
                  ? "Ex.: Alvará renovado junto à Prefeitura de SP. Protocolo nº 12345."
                  : "Descreva a ação realizada, próximos passos, etc."
              }
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
          </div>

          {/* Ações */}
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={
                mutation.isPending ||
                novoStatus === statusAtual ||
                (isRenovado && !novaDataVencimento)
              }
              className={isRenovado ? "bg-green-600 hover:bg-green-700 text-white" : ""}
            >
              {mutation.isPending
                ? "Salvando..."
                : isRenovado
                  ? "Confirmar Renovação"
                  : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
