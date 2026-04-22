import { Hono } from "hono";
import { db } from "../db/schema";

export const sensorsRouter = new Hono();

function getUserId(c: any): number {
  return c.get("jwtPayload").sub;
}

// Get latest readings for all rooms the user has access to
sensorsRouter.get("/latest", (c) => {
  const userId = getUserId(c);

  const readings = db.query(`
    SELECT r.id as room_id, r.name as room_name, h.name as house_name,
           sr.temperature, sr.humidity, sr.recorded_at
    FROM rooms r
    JOIN houses h ON h.id = r.house_id
    JOIN house_members hm ON hm.house_id = r.house_id AND hm.user_id = ?
    LEFT JOIN sensor_readings sr ON sr.id = (
      SELECT id FROM sensor_readings WHERE room_id = r.id ORDER BY recorded_at DESC LIMIT 1
    )
    ORDER BY h.name, r.name
  `).all(userId);

  return c.json({ readings });
});

// Manually post a sensor reading (for testing or direct input)
sensorsRouter.post("/:roomId", async (c) => {
  const userId = getUserId(c);
  const roomId = Number(c.req.param("roomId"));

  const room = db.query(`
    SELECT r.*, hm.role
    FROM rooms r
    JOIN house_members hm ON hm.house_id = r.house_id AND hm.user_id = ?
    WHERE r.id = ?
  `).get(userId, roomId) as any;

  if (!room) return c.json({ error: "Room not found or no access" }, 404);
  if (room.role === "viewer") return c.json({ error: "Viewers cannot post readings" }, 403);

  const body = await c.req.json();
  const { temperature, humidity } = body;

  if (temperature == null && humidity == null) {
    return c.json({ error: "At least one of temperature or humidity required" }, 400);
  }

  const reading = db
    .query("INSERT INTO sensor_readings (room_id, temperature, humidity) VALUES (?, ?, ?) RETURNING *")
    .get(roomId, temperature ?? null, humidity ?? null) as any;

  return c.json({ reading }, 201);
});
