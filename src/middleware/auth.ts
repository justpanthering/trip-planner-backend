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
      reply.code(401).send({
        error: "Unauthorized: Missing or invalid authorization header",
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Get or create user in database (auto-sync from Firebase)
    const user = await prisma.user.upsert({
      where: { firebaseUid: decodedToken.uid },
      update: {
        email: decodedToken.email || "", // Update email in case it changed
      },
      create: {
        firebaseUid: decodedToken.uid,
        email: decodedToken.email || "",
      },
    });

    // Attach user to request object
    request.user = {
      firebaseUid: user.firebaseUid,
      email: user.email,
      id: user.id,
    };
  } catch (error) {
    reply.code(401).send({ error: "Unauthorized: Invalid token" });
  }
}
