import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { processarContatoSemRetornoAutomatico } from "../routers/pendenciasContrato";

/**
 * Processa a transição automática: Cliente contatado → Contato sem retorno,
 * exclusivamente após a expiração de 48 horas sem atualização manual.
 */
export async function pendenciasContratoHeartbeatHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    const resultado = await processarContatoSemRetornoAutomatico();
    console.log(`[Pendências de Contrato] ${resultado.processadas} pendência(s) movida(s) automaticamente.`);
    return res.json({ ok: true, ...resultado, timestamp: new Date().toISOString() });
  } catch (err: any) {
    console.error("[Pendências de Contrato] Erro no processamento automático:", err);
    return res.status(500).json({
      error: err?.message ?? "Erro no processamento automático de pendências contratuais.",
      stack: err?.stack,
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}
