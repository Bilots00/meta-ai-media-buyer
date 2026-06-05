import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";

// ─── Single-user mode — no login ───────────────────────────────────────────────
// Strumento ad uso personale: ogni richiesta viene auto-autenticata come admin.
// Nessun file simpleAuth, nessun OAuth, nessuna schermata di login.
const SIMPLE_ADMIN_USER = {
  id: 1,
  openId: "local-admin",
  name: "Andrea Bilotta",
  email: "andrea.bilotta00@gmail.com",
  loginMethod: "local",
  role: "admin" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  return {
    req: opts.req,
    res: opts.res,
    user: SIMPLE_ADMIN_USER as unknown as User,
  };
}
