import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { verifyToken, type JwtPayload } from "../lib/jwt";

declare module "hono" {
  interface ContextVariableMap {
    user: JwtPayload;
  }
}

export const requireAuth = createMiddleware(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Требуется авторизация" });
  }

  try {
    const payload = verifyToken(header.slice(7));
    c.set("user", payload);
    await next();
  } catch {
    throw new HTTPException(401, { message: "Недействительный токен" });
  }
});

export function requireRole(...roles: string[]) {
  return createMiddleware(async (c, next) => {
    const user = c.get("user");
    if (!roles.includes(user.role)) {
      throw new HTTPException(403, { message: "Нет доступа" });
    }
    await next();
  });
}
