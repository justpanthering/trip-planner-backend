import Fastify from "fastify";
import { authRoutes } from "./routes/auth.js";
import { tripRoutes } from "./routes/trips.js";
import "./lib/firebase.js"; // Initialize Firebase

const fastify = Fastify({
  logger: true,
});

// Register routes
fastify.register(authRoutes, { prefix: "/api/auth" });
fastify.register(tripRoutes, { prefix: "/api/trips" });

// Health check endpoint
fastify.get("/health", async (request, reply) => {
  return { status: "ok" };
});

export default fastify;
