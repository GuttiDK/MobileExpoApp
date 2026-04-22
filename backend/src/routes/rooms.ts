import { Hono } from "hono";
import { db } from "../db/schema";
import { z } from "zod";

export const roomsRouter = new Hono();

function getUserId(c: any): number {
  return c.get("jwtPayload").sub;
}

function hasHouseAccess(userId: number, houseId: number): string | null {
  const member = db.query(
    "SELECT role FROM house_members WHERE house_id = ? AND user_id = ?"
  ).get(houseId, userId) as any;
  return member ? member.role : null;
}

// Create a room in a house
roomsRouter.post("/", async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json();

  const schema = z.object({
    house_id: z.number().int().positive(),
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    icon: z.string().optional(),
    mqtt_topic: z.string().min(1),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);

  const { house_id, name, description, icon, mqtt_topic } = parsed.data;

  const role = hasHouseAccess(userId, house_id);
  if (!role) return c.json({ error: "No access to this house" }, 403);
  if (role === "viewer") return c.json({ error: "Viewers cannot create rooms" }, 403);

  const room = db
    .query("INSERT INTO rooms (house_id, name, description, icon, mqtt_topic) VALUES (?, ?, ?, ?, ?) RETURNING *")
    .get(house_id, name, description || null, icon || "thermometer", mqtt_topic) as any;

  return c.json({ room }, 201);
});

// Update a room
roomsRouter.patch("/:id", async (c) => {
  const userId = getUserId(c);
  const roomId = Number(c.req.param("id"));

  const room = db.query(`
    SELECT r.*, hm.role
    FROM rooms r
    JOIN house_members hm ON hm.house_id = r.house_id AND hm.user_id = ?
    WHERE r.id = ?
  `).get(userId, roomId) as any;

  if (!room) return c.json({ error: "Room not found or no access" }, 404);
  if (room.role === "viewer") return c.json({ error: "Viewers cannot edit rooms" }, 403);

  const body = await c.req.json();
  const schema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    icon: z.string().optional(),
    mqtt_topic: z.string().min(1).optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input" }, 400);

  const updates: string[] = [];
  const values: any[] = [];

  if (parsed.data.name !== undefined) { updates.push("name = ?"); values.push(parsed.data.name); }
  if (parsed.data.description !== undefined) { updates.push("description = ?"); values.push(parsed.data.description); }
  if (parsed.data.icon !== undefined) { updates.push("icon = ?"); values.push(parsed.data.icon); }
  if (parsed.data.mqtt_topic !== undefined) { updates.push("mqtt_topic = ?"); values.push(parsed.data.mqtt_topic); }

  if (updates.length === 0) return c.json({ error: "Nothing to update" }, 400);

  values.push(roomId);
  db.run(`UPDATE rooms SET ${updates.join(", ")} WHERE id = ?`, values);

  const updated = db.query("SELECT * FROM rooms WHERE id = ?").get(roomId);
  return c.json({ room: updated });
});

// Delete a room
roomsRouter.delete("/:id", (c) => {
  const userId = getUserId(c);
  const roomId = Number(c.req.param("id"));

  const room = db.query(`
    SELECT r.*, hm.role
    FROM rooms r
    JOIN house_members hm ON hm.house_id = r.house_id AND hm.user_id = ?
    WHERE r.id = ?
  `).get(userId, roomId) as any;

  if (!room) return c.json({ error: "Room not found or no access" }, 404);
  if (room.role === "viewer") return c.json({ error: "Viewers cannot delete rooms" }, 403);

  db.run("DELETE FROM rooms WHERE id = ?", [roomId]);
  return c.json({ message: "Room deleted" });
});

// Get sensor history for a room
roomsRouter.get("/:id/history", (c) => {
  const userId = getUserId(c);
  const roomId = Number(c.req.param("id"));
  const limit = Math.min(Number(c.req.query("limit") || 100), 500);

  const room = db.query(`
    SELECT r.*, hm.role
    FROM rooms r
    JOIN house_members hm ON hm.house_id = r.house_id AND hm.user_id = ?
    WHERE r.id = ?
  `).get(userId, roomId) as any;

  if (!room) return c.json({ error: "Room not found or no access" }, 404);

  const readings = db.query(`
    SELECT temperature, humidity, recorded_at
    FROM sensor_readings
    WHERE room_id = ?
    ORDER BY recorded_at DESC
    LIMIT ?
  `).all(roomId, limit);

  return c.json({ readings });
});
