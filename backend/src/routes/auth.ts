import { Hono } from "hono";
import { sign } from "hono/jwt";
import { db } from "../db/schema";
import { z } from "zod";

export const authRouter = new Hono();

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey123";

const registerSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function makeToken(id: number, email: string) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  return sign({ sub: id, email, exp }, JWT_SECRET, "HS256");
}

authRouter.post("/register", async (c) => {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  const { name, email, password } = parsed.data;

  const existing = await db.query("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return c.json({ error: "Email already in use" }, 409);
  }

  const hash = await Bun.password.hash(password);

  const result = await db
    .query("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?) RETURNING id, name, email, created_at")
    .get(name, email, hash) as any;

  const token = await makeToken(result.id, result.email);

  return c.json({ user: result, token }, 201);
});

authRouter.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid input" }, 400);
  }

  const { email, password } = parsed.data;

  const user = await db
    .query("SELECT id, name, email, password_hash FROM users WHERE email = ?")
    .get(email) as any;

  if (!user) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const valid = await Bun.password.verify(password, user.password_hash);
  if (!valid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = await makeToken(user.id, user.email);

  return c.json({
    user: { id: user.id, name: user.name, email: user.email },
    token,
  });
});
