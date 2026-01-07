import type { FastifyRequest, FastifyReply } from "fastify";
import admin from "../lib/firebase.js";
import prisma from "../lib/prisma.js";

export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    firebaseUid: string;
    email: string;
    id: string;
  };
}

export async function authMiddleware(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      request.log.warn("Missing or invalid authorization header");
      reply.code(401).send({
        error: "Unauthorized: Missing or invalid authorization header",
        message:
          "Please provide a valid Bearer token in the Authorization header",
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the Firebase ID token
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      request.log.error({ error }, "Firebase token verification failed");
      const errorMessage =
        error instanceof Error ? error.message : "Invalid token";
      reply.code(401).send({
        error: "Unauthorized: Invalid token",
        message: errorMessage,
      });
      return;
    }

    // Get or create user in database (auto-sync from Firebase)
    let user;
    try {
      user = await prisma.user.upsert({
        where: { firebaseUid: decodedToken.uid },
        update: {
          email: decodedToken.email || "", // Update email in case it changed
        },
        create: {
          firebaseUid: decodedToken.uid,
          email: decodedToken.email || "",
        },
      });
    } catch (error: any) {
      // Handle database connection errors separately
      request.log.error({ error }, "Database operation failed");

      // Check if it's a connection error (Prisma throws PrismaClientKnownRequestError with code ECONNREFUSED)
      const isConnectionError =
        error?.code === "ECONNREFUSED" ||
        error?.name === "PrismaClientInitializationError" ||
        error?.name === "PrismaClientKnownRequestError";

      if (isConnectionError) {
        reply.code(503).send({
          error: "Service Unavailable",
          message:
            "Database connection failed. Please check if the database is running and DATABASE_URL is configured correctly.",
        });
      } else {
        reply.code(500).send({
          error: "Internal Server Error",
          message: "An error occurred while processing your request",
        });
      }
      return;
    }

    // Attach user to request object
    request.user = {
      firebaseUid: user.firebaseUid,
      email: user.email,
      id: user.id,
    };
  } catch (error) {
    // Fallback for any unexpected errors
    request.log.error({ error }, "Unexpected error in auth middleware");
    reply.code(500).send({
      error: "Internal Server Error",
      message: "An unexpected error occurred",
    });
    return;
  }
}
