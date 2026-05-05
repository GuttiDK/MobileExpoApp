import { Hono } from "hono";
import { db } from "../db/schema";
import { mqttService } from "../services/mqtt";
import { z } from "zod";

export const devicesRouter = new Hono();

function getUserId(c: any): number {
  return c.get("jwtPayload").sub;
}

async function isAdmin(userId: number): Promise<boolean> {
  const user = await db.query("SELECT is_admin FROM users WHERE id = ?").get(userId) as any;
  return !!user?.is_admin;
}

// List devices accessible to the current user
devicesRouter.get("/", async (c) => {
  const userId = getUserId(c);
  const admin = await isAdmin(userId);

  let devices;
  if (admin) {
    devices = await db.query(`
      SELECT d.*, r.name as room_name, h.name as house_name
      FROM devices d
      LEFT JOIN rooms r ON r.id = d.room_id
      LEFT JOIN houses h ON h.id = r.house_id
      ORDER BY h.name NULLS LAST, r.name NULLS LAST, d.friendly_name
    `).all();
  } else {
    devices = await db.query(`
      SELECT d.*, r.name as room_name, h.name as house_name
      FROM devices d
      JOIN rooms r ON r.id = d.room_id
      JOIN houses h ON h.id = r.house_id
      JOIN house_members hm ON hm.house_id = h.id AND hm.user_id = ?
      ORDER BY h.name, r.name, d.friendly_name
    `).all(userId);
  }

  return c.json({ devices });
});

// Send a command to a device (state, brightness, color_temp, etc.)
devicesRouter.post("/:id/set", async (c) => {
  const userId = getUserId(c);
  const id = Number(c.req.param("id"));

  const device = await db.query("SELECT * FROM devices WHERE id = ?").get(id) as any;
  if (!device) return c.json({ error: "Device not found" }, 404);

  if (device.room_id) {
    const member = await db.query(`
      SELECT hm.role FROM house_members hm
      JOIN rooms r ON r.house_id = hm.house_id
      WHERE r.id = ? AND hm.user_id = ?
    `).get(device.room_id, userId) as any;
    if (!member) {
      const admin = await isAdmin(userId);
      if (!admin) return c.json({ error: "Ingen adgang" }, 403);
    }
  } else {
    const admin = await isAdmin(userId);
    if (!admin) return c.json({ error: "Ingen adgang - enheden er ikke tilknyttet et rum" }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  mqttService.publish(`zigbee2mqtt/${device.friendly_name}/set`, JSON.stringify(body));

  return c.json({ ok: true });
});

// Update device (admin only: assign room, update friendly_name)
devicesRouter.patch("/:id", async (c) => {
  const userId = getUserId(c);
  const admin = await isAdmin(userId);
  if (!admin) return c.json({ error: "Forbidden" }, 403);

  const id = Number(c.req.param("id"));
  const device = await db.query("SELECT * FROM devices WHERE id = ?").get(id) as any;
  if (!device) return c.json({ error: "Device not found" }, 404);

  const schema = z.object({
    room_id: z.number().int().positive().nullable().optional(),
    friendly_name: z.string().min(1).max(200).optional(),
  });
  const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Invalid input" }, 400);

  const updates: string[] = [];
  const values: any[] = [];

  if (parsed.data.room_id !== undefined) {
    updates.push("room_id = ?");
    values.push(parsed.data.room_id);
  }
  if (parsed.data.friendly_name !== undefined && parsed.data.friendly_name !== device.friendly_name) {
    // Tell Zigbee2MQTT to rename the device too
    mqttService.publish("zigbee2mqtt/bridge/request/device/rename", JSON.stringify({
      from: device.friendly_name,
      to: parsed.data.friendly_name,
    }));
    updates.push("friendly_name = ?");
    values.push(parsed.data.friendly_name);
  }

  if (updates.length > 0) {
    values.push(id);
    await db.run(`UPDATE devices SET ${updates.join(", ")} WHERE id = ?`, values);
  }

  const updated = await db.query(`
    SELECT d.*, r.name as room_name, h.name as house_name
    FROM devices d
    LEFT JOIN rooms r ON r.id = d.room_id
    LEFT JOIN houses h ON h.id = r.house_id
    WHERE d.id = ?
  `).get(id);
  return c.json({ device: updated });
});
