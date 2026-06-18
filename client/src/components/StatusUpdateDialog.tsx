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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { STATUS_RENOVACAO } from "@/lib/alvaras";
import { ChevronRight } from "lucide-react";

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

  const utils = trpc.useUtils();
  const mutation = trpc.alvaras.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado com sucesso!");
      setOpen(false);
      setObservacao("");
      utils.dashboard.alertas.invalidate();
      utils.alvaras.list.invalidate();
      onUpdated?.();
    },
    onError: (err) => {
      toast.error("Erro ao atualizar status: " + err.message);
    },
  });

  const handleSave = () => {
    if (!novoStatus) return;
    mutation.mutate({
      id: alvaraId,
      status: novoStatus as any,
      observacao: observacao || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Observação (opcional)
            </Label>
            <Textarea
              placeholder="Descreva a ação realizada, próximos passos, etc."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={mutation.isPending || novoStatus === statusAtual}
            >
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
