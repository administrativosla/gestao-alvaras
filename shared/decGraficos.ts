export type RegistroDecGraficos = {
  categoriaId: number;
  categoria: string;
  quantidade: number;
  redirecionadas: number;
  semAcao: number;
  inativos: number;
  pendentes: number;
};

export function resumirDestinacaoDec(registros: readonly RegistroDecGraficos[]) {
  const porCategoria = new Map<number, {
    categoriaId: number; categoria: string; recebidas: number; direcionadas: number;
    arquivadasSemAcao: number; arquivadasInativos: number; arquivadas: number;
    classificadas: number; pendentes: number; percentualDirecionadas: number; percentualArquivadas: number;
  }>();
  let recebidas = 0;
  let direcionadas = 0;
  let arquivadasSemAcao = 0;
  let arquivadasInativos = 0;
  let pendentes = 0;

  for (const registro of registros) {
    recebidas += registro.quantidade;
    direcionadas += registro.redirecionadas;
    arquivadasSemAcao += registro.semAcao;
    arquivadasInativos += registro.inativos;
    pendentes += registro.pendentes;
    const anterior = porCategoria.get(registro.categoriaId) ?? {
      categoriaId: registro.categoriaId, categoria: registro.categoria,
      recebidas: 0, direcionadas: 0, arquivadasSemAcao: 0,
      arquivadasInativos: 0, arquivadas: 0, classificadas: 0,
      pendentes: 0, percentualDirecionadas: 0, percentualArquivadas: 0,
    };
    anterior.recebidas += registro.quantidade;
    anterior.direcionadas += registro.redirecionadas;
    anterior.arquivadasSemAcao += registro.semAcao;
    anterior.arquivadasInativos += registro.inativos;
    anterior.pendentes += registro.pendentes;
    porCategoria.set(registro.categoriaId, anterior);
  }

  const arquivadas = arquivadasSemAcao + arquivadasInativos;
  const classificadas = direcionadas + arquivadas;
  const percentualDirecionadas = classificadas ? Math.round(direcionadas / classificadas * 100) : 0;
  const categorias = Array.from(porCategoria.values()).map(categoria => {
    categoria.arquivadas = categoria.arquivadasSemAcao + categoria.arquivadasInativos;
    categoria.classificadas = categoria.direcionadas + categoria.arquivadas;
    categoria.percentualDirecionadas = categoria.classificadas ? Math.round(categoria.direcionadas / categoria.classificadas * 100) : 0;
    categoria.percentualArquivadas = categoria.classificadas ? 100 - categoria.percentualDirecionadas : 0;
    return categoria;
  }).sort((a, b) => b.classificadas - a.classificadas || a.categoria.localeCompare(b.categoria, "pt-BR"));

  return {
    recebidas, classificadas, direcionadas, arquivadas, arquivadasSemAcao,
    arquivadasInativos, pendentes, percentualDirecionadas,
    percentualArquivadas: classificadas ? 100 - percentualDirecionadas : 0,
    categorias,
  };
}
