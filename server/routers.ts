import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { clientesRouter } from "./routers/clientes";
import { alvarasRouter } from "./routers/alvaras";
import { dashboardRouter } from "./routers/dashboard";
import { importacaoRouter } from "./routers/importacao";
import { exportacaoRouter } from "./routers/exportacao";
import { alertasRouter } from "./routers/alertas";
import { usuariosRouter } from "./routers/usuarios";
import { negociacoesRouter } from "./routers/negociacoes";
import { adminRouter } from "./routers/admin";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  clientes: clientesRouter,
  alvaras: alvarasRouter,
  dashboard: dashboardRouter,
  importacao: importacaoRouter,
  exportacao: exportacaoRouter,
  alertas: alertasRouter,
  usuarios: usuariosRouter,
  negociacoes: negociacoesRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
