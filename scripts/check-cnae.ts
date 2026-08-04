import { getDb } from "../server/db";
import { alvaras } from "../drizzle/schema";

async function main() {
  const db = await getDb();
  const rows = await db.select({
    id: alvaras.id,
    tipo: alvaras.tipo,
    cliCnaesLicenciados: alvaras.cliCnaesLicenciados,
    validacaoCnae: alvaras.validacaoCnae,
    validacaoDetalhes: alvaras.validacaoDetalhes,
  }).from(alvaras).limit(10);

  console.log(JSON.stringify(rows, null, 2));
}

main().then(() => process.exit(0)).catch(console.error);
