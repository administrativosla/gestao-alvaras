import { describe, expect, it } from "vitest";
import { resumirDestinacaoDec } from "../shared/decGraficos";

describe("proporção de mensagens DEC", () => {
  it("compara apenas mensagens classificadas e mantém pendências separadas", () => {
    const resumo = resumirDestinacaoDec([
      { categoriaId: 1, categoria: "Avisos", quantidade: 10, redirecionadas: 4, internas: 0, semAcao: 2, inativos: 1, pendentes: 3 },
      { categoriaId: 1, categoria: "Avisos", quantidade: 5, redirecionadas: 2, internas: 0, semAcao: 1, inativos: 0, pendentes: 2 },
      { categoriaId: 2, categoria: "Comunicados", quantidade: 5, redirecionadas: 0, internas: 0, semAcao: 2, inativos: 1, pendentes: 2 },
    ]);
    expect(resumo).toMatchObject({
      recebidas: 20, classificadas: 13, direcionadas: 6, arquivadas: 7,
      arquivadasSemAcao: 5, arquivadasInativos: 2, pendentes: 7,
      percentualDirecionadas: 46, percentualArquivadas: 54,
    });
    expect(resumo.categorias[0]).toMatchObject({ categoriaId: 1, recebidas: 15, classificadas: 10, direcionadas: 6, arquivadas: 4, pendentes: 5, percentualDirecionadas: 60, percentualArquivadas: 40 });
    expect(resumo.categorias[1]).toMatchObject({ categoriaId: 2, classificadas: 3, direcionadas: 0, arquivadas: 3, percentualDirecionadas: 0, percentualArquivadas: 100 });
  });
  it("não fabrica proporções quando não existem mensagens classificadas", () => {
    expect(resumirDestinacaoDec([])).toMatchObject({ recebidas: 0, classificadas: 0, percentualDirecionadas: 0, percentualArquivadas: 0, categorias: [] });
    const resumo = resumirDestinacaoDec([{ categoriaId: 3, categoria: "Notificação", quantidade: 8, redirecionadas: 0, internas: 0, semAcao: 0, inativos: 0, pendentes: 8 }]);
    expect(resumo).toMatchObject({ recebidas: 8, classificadas: 0, pendentes: 8, percentualDirecionadas: 0, percentualArquivadas: 0 });
    expect(resumo.categorias[0]).toMatchObject({ percentualDirecionadas: 0, percentualArquivadas: 0 });
  });
  it("arredonda dois segmentos complementares sem ultrapassar 100%", () => {
    const resumo = resumirDestinacaoDec([{ categoriaId: 4, categoria: "Intimação", quantidade: 3, redirecionadas: 2, internas: 0, semAcao: 1, inativos: 0, pendentes: 0 }]);
    expect(resumo.percentualDirecionadas).toBe(67);
    expect(resumo.percentualArquivadas).toBe(33);
    expect(resumo.percentualDirecionadas + resumo.percentualArquivadas).toBe(100);
  });
  it("separa time interno de clientes e arquivos e mantém três fatias totalizando 100%", () => {
    const resumo = resumirDestinacaoDec([{ categoriaId: 2, categoria: "Avisos", quantidade: 4, redirecionadas: 1, internas: 1, semAcao: 1, inativos: 0, pendentes: 1 }]);
    expect(resumo).toMatchObject({ recebidas: 4, classificadas: 3, direcionadas: 1, internas: 1, arquivadas: 1, pendentes: 1 });
    expect([resumo.percentualDirecionadas, resumo.percentualInternas, resumo.percentualArquivadas]).toEqual([34, 33, 33]);
    expect(resumo.categorias[0]).toMatchObject({ classificadas: 3, internas: 1, percentualInternas: 33 });
  });
  it("conta corretamente um período com só encaminhamentos internos", () => {
    const resumo = resumirDestinacaoDec([{ categoriaId: 7, categoria: "DET", quantidade: 2, redirecionadas: 0, internas: 2, semAcao: 0, inativos: 0, pendentes: 0 }]);
    expect(resumo).toMatchObject({ internas: 2, classificadas: 2, percentualDirecionadas: 0, percentualInternas: 100, percentualArquivadas: 0 });
  });
});
