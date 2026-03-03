import { describe, it, expect } from "vitest";
import { createApp } from "./app";

describe("App", () => {
  const app = createApp();

  it("GET /health returns ok", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
  });

  it("returns 404 for unknown routes", async () => {
    const res = await app.request("/unknown-route");
    expect(res.status).toBe(404);
  });
});
