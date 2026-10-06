export type FatiaPdf = { inicioPx: number; alturaPx: number; novaPagina: boolean };

/** Divide seções extensas em páginas A4 sem perder pixels entre as fatias. */
export function paginarSecaoPdf(larguraPx: number, alturaPx: number, larguraMm: number, alturaPaginaMm: number, espacoAtualMm: number): FatiaPdf[] {
  if (larguraPx <= 0 || alturaPx <= 0 || larguraMm <= 0 || alturaPaginaMm <= 0) throw new Error("Dimensões inválidas para a exportação.");
  const pxPorMm = larguraPx / larguraMm;
  const alturaTotalMm = alturaPx / pxPorMm;
  let proximaPagina = alturaTotalMm > espacoAtualMm;
  let disponivel = proximaPagina ? alturaPaginaMm : espacoAtualMm;
  let inicioPx = 0;
  const fatias: FatiaPdf[] = [];
  while (inicioPx < alturaPx) {
    if (disponivel < 12) { proximaPagina = true; disponivel = alturaPaginaMm; }
    const pixels = Math.min(alturaPx - inicioPx, Math.max(1, Math.floor(disponivel * pxPorMm)));
    fatias.push({ inicioPx, alturaPx: pixels, novaPagina: proximaPagina });
    inicioPx += pixels;
    proximaPagina = false;
    disponivel = alturaPaginaMm;
    if (inicioPx < alturaPx) proximaPagina = true;
  }
  return fatias;
}

export async function exportarPdfDec(raiz: HTMLElement, nomeArquivo: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
  await document.fonts.ready;
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

  const secoes = Array.from(raiz.querySelectorAll<HTMLElement>("[data-dec-pdf-secao]"));
  if (!secoes.length) throw new Error("Nenhuma seção do relatório foi encontrada.");

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const larguraPagina = pdf.internal.pageSize.getWidth();
  const alturaPagina = pdf.internal.pageSize.getHeight();
  const margem = 12;
  const larguraConteudo = larguraPagina - 2 * margem;
  const alturaUtil = alturaPagina - 2 * margem - 8; // Reserva o rodapé de cada página.
  let y = margem;

  for (const secao of secoes) {
    const canvas = await html2canvas(secao, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: Math.max(1024, raiz.scrollWidth),
    });
    if (!canvas.width || !canvas.height) throw new Error("Não foi possível capturar uma das seções do relatório.");
    const fatias = paginarSecaoPdf(canvas.width, canvas.height, larguraConteudo, alturaUtil, margem + alturaUtil - y);
    for (const fatia of fatias) {
      if (fatia.novaPagina) { pdf.addPage(); y = margem; }
      const recorte = document.createElement("canvas");
      recorte.width = canvas.width;
      recorte.height = fatia.alturaPx;
      const contexto = recorte.getContext("2d");
      if (!contexto) throw new Error("O navegador não conseguiu montar o PDF.");
      contexto.fillStyle = "#ffffff";
      contexto.fillRect(0, 0, recorte.width, recorte.height);
      contexto.drawImage(canvas, 0, fatia.inicioPx, canvas.width, fatia.alturaPx, 0, 0, canvas.width, fatia.alturaPx);
      const alturaMm = fatia.alturaPx * larguraConteudo / canvas.width;
      pdf.addImage(recorte.toDataURL("image/jpeg", 0.94), "JPEG", margem, y, larguraConteudo, alturaMm, undefined, "FAST");
      y += alturaMm;
      recorte.width = 0;
      recorte.height = 0;
    }
    canvas.width = 0;
    canvas.height = 0;
    y += 4;
  }

  const paginas = pdf.getNumberOfPages();
  for (let numero = 1; numero <= paginas; numero++) {
    pdf.setPage(numero);
    pdf.setTextColor(100, 116, 139);
    pdf.setFontSize(8);
    pdf.text("Portal Controller | Quantificador DEC", margem, alturaPagina - 7);
    pdf.text(`${numero} / ${paginas}`, larguraPagina - margem, alturaPagina - 7, { align: "right" });
  }
  pdf.save(nomeArquivo);
}
