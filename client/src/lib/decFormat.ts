export function diaLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dataLocal(d: string) {
  const [ano, mes, dia] = d.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

export function periodoAnterior(inicio: string, fim: string) {
  const primeiro = dataLocal(inicio);
  const ultimo = dataLocal(fim);
  const dias = Math.round((ultimo.getTime() - primeiro.getTime()) / 86400000) + 1;
  const anteriorFim = new Date(primeiro);
  anteriorFim.setDate(anteriorFim.getDate() - 1);
  const anteriorInicio = new Date(anteriorFim);
  anteriorInicio.setDate(anteriorInicio.getDate() - dias + 1);
  return { inicio: diaLocal(anteriorInicio), fim: diaLocal(anteriorFim) };
}

export function dataExibida(d: Date | string) {
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function chaveDia(d: Date | string) {
  return new Date(d).toISOString().slice(0, 10);
}

export function csvSeguro(valor: unknown) {
  const texto = String(valor ?? "");
  return `"${(/^[=+@-]/.test(texto) ? "'" : "") + texto.replace(/"/g, '""')}"`;
}
