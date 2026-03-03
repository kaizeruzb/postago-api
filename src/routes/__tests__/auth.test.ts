import { describe, it, expect } from "vitest";
import { createApp } from "../../app";

const app = createApp();

describe("Auth API", () => {
  it("GET /health returns ok", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  it("POST /api/auth/otp/send rejects invalid phone", async () => {
    const res = await app.request("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "invalid" }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/auth/otp/send accepts valid phone format", async () => {
    // Will fail DB insert in unit test context — just verify validation passes
    const res = await app.request("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+998901234567" }),
    });
    // 200 (success) or 500 (no DB in test) — not 400 (validation)
    expect(res.status).not.toBe(400);
  });

  it("GET /api/auth/me returns 401 without token", async () => {
    const res = await app.request("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/me returns 401 with invalid token", async () => {
    const res = await app.request("/api/auth/me", {
      headers: { Authorization: "Bearer invalid.token.here" },
    });
    expect(res.status).toBe(401);
  });
});
