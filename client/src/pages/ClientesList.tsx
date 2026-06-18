import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, Plus, Search, MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { formatCnpj } from "@/lib/alvaras";
import { toast } from "sonner";

export default function ClientesList() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const { data: clientes, isLoading, refetch } = trpc.clientes.list.useQuery({ search: search || undefined });

  const deleteMutation = trpc.clientes.delete.useMutation({
    onSuccess: () => {
      toast.success("Cliente removido.");
      refetch();
    },
    onError: (e) => toast.error("Erro ao remover: " + e.message),
  });

  const handleDelete = (id: number, nome: string) => {
    if (confirm(`Deseja remover o cliente "${nome}"? Esta ação não pode ser desfeita.`)) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os clientes cadastrados no sistema
          </p>
        </div>
        <Button onClick={() => setLocation("/clientes/novo")} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Cliente
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar por razão social ou CNPJ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      <Card className="border shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !clientes || clientes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="p-4 rounded-full bg-muted">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado</p>
              <Button variant="outline" size="sm" onClick={() => setLocation("/clientes/novo")}>
                Cadastrar primeiro cliente
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Razão Social</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">CNPJ</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Cidade/UF</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Contato</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">E-mail</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => setLocation(`/clientes/${c.id}`)}
                  >
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{c.razaoSocial}</p>
                        {c.nomeFantasia && (
                          <p className="text-xs text-muted-foreground">{c.nomeFantasia}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">
                      {formatCnpj(c.cnpj)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                      {c.cidade && c.uf ? `${c.cidade}/${c.uf}` : c.cidade ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">
                      {c.nomeContato ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">
                      {c.email ?? "—"}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setLocation(`/clientes/${c.id}`)}>
                            <Eye className="mr-2 h-4 w-4" /> Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setLocation(`/clientes/${c.id}/editar`)}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(c.id, c.razaoSocial)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
