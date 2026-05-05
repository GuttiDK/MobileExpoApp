import { Hono } from "hono";
import { cors } from "hono/cors";
import { jwt } from "hono/jwt";
import { logger } from "hono/logger";
import { authRouter } from "./routes/auth";
import { housesRouter } from "./routes/houses";
import { roomsRouter } from "./routes/rooms";
import { sensorsRouter } from "./routes/sensors";
import { adminRouter } from "./routes/admin";
import { devicesRouter } from "./routes/devices";
import { mqttService } from "./services/mqtt";

const app = new Hono();

app.use("*", cors());
app.use("*", logger());

// Public routes
app.route("/api/auth", authRouter);

// Protected routes
const api = new Hono();
api.use(
  "*",
  jwt({
    secret: process.env.JWT_SECRET || "supersecretkey123",
    alg: "HS256",
  })
);

api.route("/houses", housesRouter);
api.route("/rooms", roomsRouter);
api.route("/sensors", sensorsRouter);
api.route("/admin", adminRouter);
api.route("/devices", devicesRouter);

app.route("/api", api);

app.get("/", (c) => c.json({ status: "ok", version: "1.0.0" }));

// Start MQTT service
mqttService.connect();

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};
