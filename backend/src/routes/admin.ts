import { Hono } from "hono";
import { db } from "../db/schema";
import { z } from "zod";

export const adminRouter = new Hono();

function getUserId(c: any): number {
  return c.get("jwtPayload").sub;
}

adminRouter.use("*", async (c, next) => {
  const userId = getUserId(c);
  const user = await db.query("SELECT is_admin FROM users WHERE id = ?").get(userId) as { is_admin: boolean } | undefined;
  if (!user?.is_admin) return c.json({ error: "Forbidden" }, 403);
  await next();
});

adminRouter.get("/users/:id/houses", async (c) => {
  const userId = Number(c.req.param("id"));
  const houses = await db.query(`
    SELECT h.id, h.name, h.description, h.invite_code, h.created_at,
           u.name as owner_name, hm.role as user_role,
           (SELECT COUNT(*) FROM house_members WHERE house_id = h.id) as member_count,
           (SELECT COUNT(*) FROM rooms WHERE house_id = h.id) as room_count
    FROM houses h
    JOIN house_members hm ON hm.house_id = h.id AND hm.user_id = ?
    JOIN users u ON u.id = h.owner_id
    ORDER BY h.created_at DESC
  `).all(userId);
  return c.json({ houses });
});

adminRouter.get("/users", async (c) => {
  const users = await db.query(
    "SELECT id, name, email, is_admin, created_at FROM users ORDER BY created_at ASC"
  ).all();
  return c.json({ users });
});

adminRouter.patch("/users/:id/password", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const schema = z.object({ password: z.string().min(6).max(128) });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Password must be at least 6 characters" }, 400);

  const hash = await Bun.password.hash(parsed.data.password);
  await db.run("UPDATE users SET password_hash = ? WHERE id = ?", [hash, id]);
  return c.json({ ok: true });
});

adminRouter.get("/rooms", async (c) => {
  const rooms = await db.query(`
    SELECT r.id, r.name, r.description, r.icon, r.mqtt_topic, r.house_id, h.name AS house_name
    FROM rooms r
    JOIN houses h ON r.house_id = h.id
    ORDER BY h.name, r.name
  `).all();
  return c.json({ rooms });
});

adminRouter.patch("/rooms/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const room = await db.query("SELECT id FROM rooms WHERE id = ?").get(id);
  if (!room) return c.json({ error: "Room not found" }, 404);

  const schema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    icon: z.string().max(10).optional(),
    mqtt_topic: z.string().max(256).nullable().optional(),
  });
  const parsed = schema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid input" }, 400);

  const updates: string[] = [];
  const values: any[] = [];
  const d = parsed.data;

  if (d.name !== undefined) { updates.push("name = ?"); values.push(d.name); }
  if (d.description !== undefined) { updates.push("description = ?"); values.push(d.description); }
  if (d.icon !== undefined) { updates.push("icon = ?"); values.push(d.icon); }
  if (d.mqtt_topic !== undefined) { updates.push("mqtt_topic = ?"); values.push(d.mqtt_topic); }

  if (updates.length > 0) {
    values.push(id);
    await db.run(`UPDATE rooms SET ${updates.join(", ")} WHERE id = ?`, values);
  }

  const updated = await db.query("SELECT * FROM rooms WHERE id = ?").get(id);
  return c.json({ room: updated });
});

adminRouter.post("/rooms/:id/generate", async (c) => {
  const id = Number(c.req.param("id"));
  const room = await db.query("SELECT id FROM rooms WHERE id = ?").get(id);
  if (!room) return c.json({ error: "Room not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const count = Math.min(Number(body.count) || 1, 50);

  for (let i = 0; i < count; i++) {
    const temperature = body.temperature !== undefined
      ? body.temperature
      : Math.round((18 + Math.random() * 10) * 10) / 10;
    const humidity = body.humidity !== undefined
      ? body.humidity
      : Math.round((40 + Math.random() * 30) * 10) / 10;
    await db.run(
      "INSERT INTO sensor_readings (room_id, temperature, humidity) VALUES (?, ?, ?)",
      [id, temperature, humidity]
    );
  }

  return c.json({ count });
});
