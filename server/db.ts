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
    values.role = "admin";
    updateSet.role = "admin";
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
export async function listClientes(search?: string) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(clientes).where(eq(clientes.ativo, true));
  const rows = await query.orderBy(clientes.razaoSocial);
  if (!search) return rows;
  const s = search.toLowerCase();
  return rows.filter(
    (c) =>
      c.razaoSocial.toLowerCase().includes(s) ||
      c.cnpj.includes(s) ||
      (c.nomeFantasia ?? "").toLowerCase().includes(s)
  );
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

  return {
    totalClientes: Number(totalClientesRes?.count ?? 0),
    alvarasAtivos: Number(alvarasAtivosRes?.count ?? 0),
    alvarasVencidos: Number(vencidosRes?.count ?? 0),
    aVencer30: Number(aVencer30Res?.count ?? 0),
  };
}

// ─── Alertas por e-mail (para o job) ─────────────────────────────────────────
export async function getAlvarasParaAlerta(dias: 30 | 15 | 7) {
  const db = await getDb();
  if (!db) return [];

  const STATUS_SEM_ALERTA = ["Em Renovação", "Renovado", "Cancelado"];
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
