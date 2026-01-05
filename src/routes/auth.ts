import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  authMiddleware,
  type AuthenticatedRequest,
} from "../middleware/auth.js";

export async function authRoutes(fastify: FastifyInstance) {
  // Get current user (protected route)
  // User is automatically synced to database by authMiddleware on first request
  fastify.get(
    "/me",
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authenticatedRequest = request as AuthenticatedRequest;
      return reply.send({
        user: authenticatedRequest.user,
      });
    }
  );
}
