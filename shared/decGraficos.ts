export type RegistroDecGraficos = {
  categoriaId: number;
  categoria: string;
  quantidade: number;
  redirecionadas: number;
  internas: number;
  semAcao: number;
  inativos: number;
  pendentes: number;
};

function percentuais(direcionadas: number, internas: number, arquivadas: number) {
  const valores = [direcionadas, internas, arquivadas];
  const total = valores.reduce((soma, valor) => soma + valor, 0);
  if (!total) return [0, 0, 0];
  const exatos = valores.map(valor => valor * 100 / total);
  const arredondados = exatos.map(Math.floor);
  // Distribui restos para que três fatias exibidas somem sempre 100%.
  const ordem = [0, 1, 2].sort((a, b) => (exatos[b] - arredondados[b]) - (exatos[a] - arredondados[a]) || a - b);
  const faltantes = 100 - arredondados.reduce((soma, valor) => soma + valor, 0);
  for (let i = 0; i < faltantes; i++) {
    arredondados[ordem[i]]++;
  }
  return arredondados;
}

export function resumirDestinacaoDec(registros: readonly RegistroDecGraficos[]) {
  const porCategoria = new Map<number, {
    categoriaId: number; categoria: string; recebidas: number; direcionadas: number;
    internas: number; arquivadasSemAcao: number; arquivadasInativos: number; arquivadas: number;
    classificadas: number; pendentes: number; percentualDirecionadas: number;
    percentualInternas: number; percentualArquivadas: number;
  }>();
  let recebidas = 0;
  let direcionadas = 0;
  let internas = 0;
  let arquivadasSemAcao = 0;
  let arquivadasInativos = 0;
  let pendentes = 0;

  for (const registro of registros) {
    recebidas += registro.quantidade;
    direcionadas += registro.redirecionadas;
    internas += registro.internas;
    arquivadasSemAcao += registro.semAcao;
    arquivadasInativos += registro.inativos;
    pendentes += registro.pendentes;
    const anterior = porCategoria.get(registro.categoriaId) ?? {
      categoriaId: registro.categoriaId, categoria: registro.categoria,
      recebidas: 0, direcionadas: 0, internas: 0, arquivadasSemAcao: 0,
      arquivadasInativos: 0, arquivadas: 0, classificadas: 0,
      pendentes: 0, percentualDirecionadas: 0, percentualInternas: 0, percentualArquivadas: 0,
    };
    anterior.recebidas += registro.quantidade;
    anterior.direcionadas += registro.redirecionadas;
    anterior.internas += registro.internas;
    anterior.arquivadasSemAcao += registro.semAcao;
    anterior.arquivadasInativos += registro.inativos;
    anterior.pendentes += registro.pendentes;
    porCategoria.set(registro.categoriaId, anterior);
  }

  const arquivadas = arquivadasSemAcao + arquivadasInativos;
  const classificadas = direcionadas + internas + arquivadas;
  const [percentualDirecionadas, percentualInternas, percentualArquivadas] = percentuais(direcionadas, internas, arquivadas);
  const categorias = Array.from(porCategoria.values()).map(categoria => {
    categoria.arquivadas = categoria.arquivadasSemAcao + categoria.arquivadasInativos;
    categoria.classificadas = categoria.direcionadas + categoria.internas + categoria.arquivadas;
    [categoria.percentualDirecionadas, categoria.percentualInternas, categoria.percentualArquivadas] = percentuais(categoria.direcionadas, categoria.internas, categoria.arquivadas);
    return categoria;
  }).sort((a, b) => b.classificadas - a.classificadas || a.categoria.localeCompare(b.categoria, "pt-BR"));

  return {
    recebidas, classificadas, direcionadas, internas, arquivadas, arquivadasSemAcao,
    arquivadasInativos, pendentes, percentualDirecionadas, percentualInternas,
    percentualArquivadas, categorias,
  };
}
