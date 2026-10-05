import { describe, expect, it } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { filtroPeriodoRecebimentosDec } from "./dec-db";

describe("filtro inclusivo de recebimentos DEC", () => {
  it("compara o primeiro e o último dia como datas civis sem horário", () => {
    const periodo = filtroPeriodoRecebimentosDec("2026-10-01", "2026-10-05");
    const consulta = new MySqlDialect().sqlToQuery(periodo);
    expect(consulta.params).toEqual(["2026-10-01", "2026-10-05"]);
    expect(consulta.sql).toContain("`dataRecebimento` >= ?");
    expect(consulta.sql).toContain("`dataRecebimento` <= ?");
  });
  it("mantém ambos os limites inclusivos mesmo quando o período tem um único dia", () => {
    const consulta = new MySqlDialect().sqlToQuery(filtroPeriodoRecebimentosDec("2026-10-01", "2026-10-01"));
    expect(consulta.params).toEqual(["2026-10-01", "2026-10-01"]);
  });
});
