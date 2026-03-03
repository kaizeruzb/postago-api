import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production-32ch";

export interface JwtPayload {
  sub: string;
  role: string;
  phone: string;
}

export function signToken(payload: JwtPayload, expiresIn = "7d"): string {
  return jwt.sign(payload, SECRET, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}
