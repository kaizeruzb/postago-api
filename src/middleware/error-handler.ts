import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

export function errorHandler(err: Error, c: Context): Response {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  if (err instanceof ZodError) {
    return c.json(
      { error: "Validation error", details: err.flatten().fieldErrors },
      400
    );
  }
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
}
