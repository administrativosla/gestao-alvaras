import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  alvaraHistorico,
  alvaras,
  clientes,
  emailsAlerta,
  importacoes,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "master";
    updateSet.role = "master";
    // Owner is always active
    values.userStatus = "active";
    updateSet.userStatus = "active";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Clientes ─────────────────────────────────────────────────────────────────
export async function listClientes(filters?: { search?: string; estado?: string; municipio?: string }) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(clientes).where(eq(clientes.ativo, true)).orderBy(clientes.razaoSocial);
  let result = rows;
  if (filters?.estado) {
    result = result.filter((c) => c.estado === filters.estado);
  }
  if (filters?.municipio) {
    const m = filters.municipio.toLowerCase();
    result = result.filter((c) => (c.municipio ?? "").toLowerCase() === m);
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    result = result.filter(
      (c) =>
        c.razaoSocial.toLowerCase().includes(s) ||
        c.cnpj.includes(s) ||
        (c.nomeFantasia ?? "").toLowerCase().includes(s)
    );
  }
  return result;
}

// Cobertura de alvarás por cliente
// "Sem Registro" = marcado manualmente pelo gestor (campo semRegistro=true) — prospect comercial sem CLI/alvará disponível
// "Sem Alvará"   = automático: nenhum alvará cadastrado ainda (semRegistro=false)
// "Parcial"      = tem alvará(s) mas algum está Vencido, CLI Parcial ou sem cobertura total
// "Coberto"      = todos os alvarás ativos estão Em Vigência ou Em Renovação
export type CoberturaStatus = "Sem Registro" | "Sem Alvará" | "Parcial" | "Coberto";

export async function listClientesComCobertura(
  filters?: { search?: string; estado?: string; municipio?: string; cobertura?: CoberturaStatus }
) {
  const db = await getDb();
  if (!db) return [];

  // Buscar todos os clientes ativos
  const rows = await db.select().from(clientes).where(eq(clientes.ativo, true)).orderBy(clientes.razaoSocial);

  // Buscar alvarás ativos por cliente (incluindo situacaoCli para detectar CLI Parcial)
  const alvarasRows = await db
    .select({ clienteId: alvaras.clienteId, status: alvaras.status, situacaoCli: alvaras.situacaoCli })
    .from(alvaras)
    .where(eq(alvaras.ativo, true));

  // Agrupar por clienteId
  const alvarasPorCliente = new Map<number, { status: string; situacaoCli: string | null }[]>();
  for (const a of alvarasRows) {
    const list = alvarasPorCliente.get(a.clienteId) ?? [];
    list.push({ status: a.status, situacaoCli: a.situacaoCli });
    alvarasPorCliente.set(a.clienteId, list);
  }

  // Calcular cobertura
  // Regra: CLI Parcial conta como Cobertura Parcial (não como Coberto)
  const STATUS_COBERTOS = ["Em Vigência", "Em Renovação", "Renovado"];

  let result = rows.map((c) => {
    const alvarasList = alvarasPorCliente.get(c.id) ?? [];
    let cobertura: CoberturaStatus;
    if (c.semRegistro) {
      // Marcado manualmente pelo gestor: prospect sem CLI/alvará disponível
      cobertura = "Sem Registro";
    } else if (alvarasList.length === 0) {
      // Automático: nenhum alvará cadastrado ainda
      cobertura = "Sem Alvará";
    } else if (
      alvarasList.every((a) => STATUS_COBERTOS.includes(a.status)) &&
      !alvarasList.some((a) => a.situacaoCli === "parcial")
    ) {
      cobertura = "Coberto";
    } else {
      cobertura = "Parcial";
    }
    return { ...c, cobertura, totalAlvaras: alvarasList.length };
  });

  // Aplicar filtros
  if (filters?.estado) result = result.filter((c) => c.estado === filters!.estado);
  if (filters?.municipio) {
    const m = filters.municipio.toLowerCase();
    result = result.filter((c) => (c.municipio ?? "").toLowerCase() === m);
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    result = result.filter(
      (c) =>
        c.razaoSocial.toLowerCase().includes(s) ||
        c.cnpj.includes(s) ||
        (c.nomeFantasia ?? "").toLowerCase().includes(s)
    );
  }
  if (filters?.cobertura) result = result.filter((c) => c.cobertura === filters!.cobertura);

  return result;
}

export async function listarEstadosClientes() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .selectDistinct({ estado: clientes.estado })
    .from(clientes)
    .where(and(eq(clientes.ativo, true)));
  return rows
    .map((r) => r.estado)
    .filter((e): e is string => !!e)
    .sort();
}

export async function listarMunicipiosClientes(estado?: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .selectDistinct({ municipio: clientes.municipio, estado: clientes.estado })
    .from(clientes)
    .where(eq(clientes.ativo, true));
  return rows
    .filter((r) => !!r.municipio && (!estado || r.estado === estado))
    .map((r) => r.municipio as string)
    .sort();
}

export async function getClienteById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(clientes).where(eq(clientes.id, id)).limit(1);
  return rows[0];
}

export async function getClienteByCnpj(cnpj: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(clientes).where(eq(clientes.cnpj, cnpj)).limit(1);
  return rows[0];
}

export async function createCliente(data: typeof clientes.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(clientes).values(data);
  return result.insertId as number;
}

export async function updateCliente(id: number, data: Partial<typeof clientes.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(clientes).set(data).where(eq(clientes.id, id));
}

export async function deleteCliente(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(clientes).set({ ativo: false }).where(eq(clientes.id, id));
}

// ─── E-mails de Alerta ────────────────────────────────────────────────────────
export async function getEmailsAlerta(clienteId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(emailsAlerta).where(eq(emailsAlerta.clienteId, clienteId));
}

export async function setEmailsAlerta(clienteId: number, emails: string[]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(emailsAlerta).where(eq(emailsAlerta.clienteId, clienteId));
  if (emails.length > 0) {
    await db.insert(emailsAlerta).values(emails.map((email) => ({ clienteId, email })));
  }
}

// ─── Alvarás ──────────────────────────────────────────────────────────────────
export async function listAlvaras(filters?: {
  clienteId?: number;
  status?: string;
  tipo?: string;
  diasVencimento?: number;
  search?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      alvara: alvaras,
      cliente: {
        id: clientes.id,
        cnpj: clientes.cnpj,
        razaoSocial: clientes.razaoSocial,
        nomeFantasia: clientes.nomeFantasia,
        email: clientes.email,
        telefone: clientes.telefone,
      },
    })
    .from(alvaras)
    .innerJoin(clientes, eq(alvaras.clienteId, clientes.id))
    .where(and(eq(alvaras.ativo, true), eq(clientes.ativo, true)))
    .orderBy(alvaras.dataVencimento);

  let result = rows;

  if (filters?.clienteId) {
    result = result.filter((r) => r.alvara.clienteId === filters.clienteId);
  }
  if (filters?.status) {
    result = result.filter((r) => r.alvara.status === filters.status);
  }
  if (filters?.tipo) {
    result = result.filter((r) => r.alvara.tipo === filters.tipo);
  }
  if (filters?.diasVencimento !== undefined) {
    const hoje = new Date();
    const limite = new Date();
    limite.setDate(limite.getDate() + filters.diasVencimento);
    result = result.filter((r) => {
      if (!r.alvara.dataVencimento) return false;
      const venc = new Date(r.alvara.dataVencimento);
      return venc >= hoje && venc <= limite;
    });
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    result = result.filter(
      (r) =>
        r.cliente.razaoSocial.toLowerCase().includes(s) ||
        r.cliente.cnpj.includes(s) ||
        (r.cliente.nomeFantasia ?? "").toLowerCase().includes(s)
    );
  }

  return result;
}

export async function getAlvaraById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select({
      alvara: alvaras,
      cliente: clientes,
    })
    .from(alvaras)
    .innerJoin(clientes, eq(alvaras.clienteId, clientes.id))
    .where(eq(alvaras.id, id))
    .limit(1);
  return rows[0];
}

export async function createAlvara(data: typeof alvaras.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(alvaras).values(data);
  return result.insertId as number;
}

export async function updateAlvara(id: number, data: Partial<typeof alvaras.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(alvaras).set(data).where(eq(alvaras.id, id));
}

export async function deleteAlvara(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(alvaras).set({ ativo: false }).where(eq(alvaras.id, id));
}

// ─── Histórico ────────────────────────────────────────────────────────────────
export async function getHistoricoByAlvara(alvaraId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(alvaraHistorico)
    .where(eq(alvaraHistorico.alvaraId, alvaraId))
    .orderBy(desc(alvaraHistorico.createdAt));
}

export async function addHistorico(data: typeof alvaraHistorico.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(alvaraHistorico).values(data);
}

// ─── Dashboard / Resumo ───────────────────────────────────────────────────────
export async function getResumo() {
  const db = await getDb();
  if (!db) return { totalClientes: 0, alvarasAtivos: 0, alvarasVencidos: 0, aVencer30: 0 };

  const hoje = new Date();
  const em30 = new Date();
  em30.setDate(em30.getDate() + 30);
  const hojeStr = hoje.toISOString().split("T")[0];
  const em30Str = em30.toISOString().split("T")[0];

  const [totalClientesRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(clientes)
    .where(eq(clientes.ativo, true));

  const [alvarasAtivosRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(alvaras)
    .where(eq(alvaras.ativo, true));

  const [vencidosRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(alvaras)
    .where(
      and(
        eq(alvaras.ativo, true),
        sql`DATE(${alvaras.dataVencimento}) < ${hojeStr}`
      )
    );

  const [aVencer30Res] = await db
    .select({ count: sql<number>`count(*)` })
    .from(alvaras)
    .where(
      and(
        eq(alvaras.ativo, true),
        sql`DATE(${alvaras.dataVencimento}) >= ${hojeStr}`,
        sql`DATE(${alvaras.dataVencimento}) <= ${em30Str}`
      )
    );

  // Clientes sem nenhum alvará ativo
  const clientesComAlvara = await db
    .selectDistinct({ clienteId: alvaras.clienteId })
    .from(alvaras)
    .where(eq(alvaras.ativo, true));
  const idsComAlvara = new Set(clientesComAlvara.map((r) => r.clienteId));
  const todosClientes = await db.select({ id: clientes.id }).from(clientes).where(eq(clientes.ativo, true));
  const totalSemRegistro = todosClientes.filter((c) => !idsComAlvara.has(c.id)).length;

  return {
    totalClientes: Number(totalClientesRes?.count ?? 0),
    alvarasAtivos: Number(alvarasAtivosRes?.count ?? 0),
    alvarasVencidos: Number(vencidosRes?.count ?? 0),
    aVencer30: Number(aVencer30Res?.count ?? 0),
    totalSemRegistro,
  };
}

// ─── Alertas por e-mail (para o job) ─────────────────────────────────────────
export async function getAlvarasParaAlerta(dias: 30 | 15 | 7) {
  const db = await getDb();
  if (!db) return [];

  const STATUS_SEM_ALERTA = ["Em Renovação", "Renovado", "Cancelado", "Em Vigência"];
  const hoje = new Date();
  const alvo = new Date();
  alvo.setDate(alvo.getDate() + dias);
  const alvoStr = alvo.toISOString().split("T")[0];

  const campo =
    dias === 30
      ? alvaras.alertaEnviado30
      : dias === 15
        ? alvaras.alertaEnviado15
        : alvaras.alertaEnviado7;

  const rows = await db
    .select({
      alvara: alvaras,
      cliente: clientes,
    })
    .from(alvaras)
    .innerJoin(clientes, eq(alvaras.clienteId, clientes.id))
    .where(
      and(
        eq(alvaras.ativo, true),
        eq(campo, false),
        sql`DATE(${alvaras.dataVencimento}) = ${alvoStr}`
      )
    );

  return rows.filter((r) => !STATUS_SEM_ALERTA.includes(r.alvara.status));
}

export async function marcarAlertaEnviado(alvaraId: number, dias: 30 | 15 | 7) {
  const db = await getDb();
  if (!db) return;
  const campo =
    dias === 30
      ? { alertaEnviado30: true }
      : dias === 15
        ? { alertaEnviado15: true }
        : { alertaEnviado7: true };
  await db.update(alvaras).set(campo).where(eq(alvaras.id, alvaraId));
}

// ─── Importações ──────────────────────────────────────────────────────────────
export async function createImportacao(data: typeof importacoes.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(importacoes).values(data);
  return result.insertId as number;
}

export async function updateImportacao(id: number, data: Partial<typeof importacoes.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(importacoes).set(data).where(eq(importacoes.id, id));
}
