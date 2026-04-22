import { Hono } from "hono";
import { db } from "../db/schema";
import { z } from "zod";

export const housesRouter = new Hono();

function getUserId(c: any): number {
  return c.get("jwtPayload").sub;
}

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// List all houses the user is part of
housesRouter.get("/", (c) => {
  const userId = getUserId(c);

  const houses = db.query(`
    SELECT h.*, u.name as owner_name,
           hm.role as my_role,
           (SELECT COUNT(*) FROM house_members WHERE house_id = h.id) as member_count
    FROM houses h
    JOIN house_members hm ON hm.house_id = h.id AND hm.user_id = ?
    JOIN users u ON u.id = h.owner_id
    ORDER BY h.created_at DESC
  `).all(userId);

  return c.json({ houses });
});

// Create a new house
housesRouter.post("/", async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json();

  const schema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input" }, 400);

  const { name, description } = parsed.data;
  let invite_code = generateInviteCode();

  // Ensure unique invite code
  while (db.query("SELECT id FROM houses WHERE invite_code = ?").get(invite_code)) {
    invite_code = generateInviteCode();
  }

  const house = db
    .query("INSERT INTO houses (name, description, owner_id, invite_code) VALUES (?, ?, ?, ?) RETURNING *")
    .get(name, description || null, userId, invite_code) as any;

  // Add owner as member
  db.run(
    "INSERT INTO house_members (house_id, user_id, role) VALUES (?, ?, 'owner')",
    house.id, userId
  );

  return c.json({ house }, 201);
});

// Get a specific house
housesRouter.get("/:id", (c) => {
  const userId = getUserId(c);
  const houseId = Number(c.req.param("id"));

  const member = db.query(
    "SELECT role FROM house_members WHERE house_id = ? AND user_id = ?"
  ).get(houseId, userId) as any;

  if (!member) return c.json({ error: "Not found or no access" }, 404);

  const house = db.query(`
    SELECT h.*, u.name as owner_name
    FROM houses h JOIN users u ON u.id = h.owner_id
    WHERE h.id = ?
  `).get(houseId) as any;

  const members = db.query(`
    SELECT u.id, u.name, u.email, hm.role, hm.joined_at
    FROM house_members hm JOIN users u ON u.id = hm.user_id
    WHERE hm.house_id = ?
    ORDER BY hm.joined_at ASC
  `).all(houseId);

  const rooms = db.query(`
    SELECT r.*, 
      (SELECT temperature FROM sensor_readings WHERE room_id = r.id ORDER BY recorded_at DESC LIMIT 1) as last_temperature,
      (SELECT humidity FROM sensor_readings WHERE room_id = r.id ORDER BY recorded_at DESC LIMIT 1) as last_humidity,
      (SELECT recorded_at FROM sensor_readings WHERE room_id = r.id ORDER BY recorded_at DESC LIMIT 1) as last_reading_at
    FROM rooms r WHERE r.house_id = ? ORDER BY r.created_at ASC
  `).all(houseId);

  return c.json({ house: { ...house, my_role: member.role }, members, rooms });
});

// Join a house with invite code
housesRouter.post("/join", async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json();

  const schema = z.object({ invite_code: z.string() });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid input" }, 400);

  const house = db.query("SELECT * FROM houses WHERE invite_code = ?").get(parsed.data.invite_code.toUpperCase()) as any;
  if (!house) return c.json({ error: "Invalid invite code" }, 404);

  const existing = db.query(
    "SELECT id FROM house_members WHERE house_id = ? AND user_id = ?"
  ).get(house.id, userId);

  if (existing) return c.json({ error: "Already a member" }, 409);

  db.run(
    "INSERT INTO house_members (house_id, user_id, role) VALUES (?, ?, 'member')",
    house.id, userId
  );

  return c.json({ message: "Joined successfully", house_id: house.id, house_name: house.name });
});

// Regenerate invite code (owner only)
housesRouter.post("/:id/regenerate-invite", (c) => {
  const userId = getUserId(c);
  const houseId = Number(c.req.param("id"));

  const member = db.query(
    "SELECT role FROM house_members WHERE house_id = ? AND user_id = ?"
  ).get(houseId, userId) as any;

  if (!member || member.role !== "owner") return c.json({ error: "Only owner can regenerate invite" }, 403);

  let invite_code = generateInviteCode();
  while (db.query("SELECT id FROM houses WHERE invite_code = ?").get(invite_code)) {
    invite_code = generateInviteCode();
  }

  db.run("UPDATE houses SET invite_code = ? WHERE id = ?", invite_code, houseId);

  return c.json({ invite_code });
});

// Update member role (owner only)
housesRouter.patch("/:id/members/:userId", async (c) => {
  const currentUserId = getUserId(c);
  const houseId = Number(c.req.param("id"));
  const targetUserId = Number(c.req.param("userId"));

  const member = db.query(
    "SELECT role FROM house_members WHERE house_id = ? AND user_id = ?"
  ).get(houseId, currentUserId) as any;

  if (!member || member.role !== "owner") return c.json({ error: "Only owner can change roles" }, 403);

  const body = await c.req.json();
  const schema = z.object({ role: z.enum(["member", "viewer"]) });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid role" }, 400);

  db.run(
    "UPDATE house_members SET role = ? WHERE house_id = ? AND user_id = ?",
    parsed.data.role, houseId, targetUserId
  );

  return c.json({ message: "Role updated" });
});

// Remove member (owner only)
housesRouter.delete("/:id/members/:userId", (c) => {
  const currentUserId = getUserId(c);
  const houseId = Number(c.req.param("id"));
  const targetUserId = Number(c.req.param("userId"));

  const member = db.query(
    "SELECT role FROM house_members WHERE house_id = ? AND user_id = ?"
  ).get(houseId, currentUserId) as any;

  if (!member || member.role !== "owner") return c.json({ error: "Only owner can remove members" }, 403);

  db.run("DELETE FROM house_members WHERE house_id = ? AND user_id = ?", houseId, targetUserId);

  return c.json({ message: "Member removed" });
});

// Leave a house
housesRouter.delete("/:id/leave", (c) => {
  const userId = getUserId(c);
  const houseId = Number(c.req.param("id"));

  const member = db.query(
    "SELECT role FROM house_members WHERE house_id = ? AND user_id = ?"
  ).get(houseId, userId) as any;

  if (!member) return c.json({ error: "Not a member" }, 404);
  if (member.role === "owner") return c.json({ error: "Owner cannot leave. Delete the house instead." }, 400);

  db.run("DELETE FROM house_members WHERE house_id = ? AND user_id = ?", houseId, userId);

  return c.json({ message: "Left house" });
});

// Delete house (owner only)
housesRouter.delete("/:id", (c) => {
  const userId = getUserId(c);
  const houseId = Number(c.req.param("id"));

  const member = db.query(
    "SELECT role FROM house_members WHERE house_id = ? AND user_id = ?"
  ).get(houseId, userId) as any;

  if (!member || member.role !== "owner") return c.json({ error: "Only owner can delete house" }, 403);

  db.run("DELETE FROM houses WHERE id = ?", houseId);

  return c.json({ message: "House deleted" });
});
