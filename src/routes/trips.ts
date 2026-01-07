import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  authMiddleware,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import prisma from "../lib/prisma.js";

interface TripListQuery {
  page?: string;
  limit?: string;
}

export async function tripRoutes(fastify: FastifyInstance) {
  // Get list of trips for the authenticated user
  fastify.get<{ Querystring: TripListQuery }>(
    "/",
    { preHandler: [authMiddleware] },
    async (
      request: FastifyRequest<{ Querystring: TripListQuery }>,
      reply: FastifyReply
    ) => {
      const authenticatedRequest = request as AuthenticatedRequest;
      const userId = authenticatedRequest.user!.id;

      try {
        // Parse pagination parameters
        const page = Math.max(1, parseInt(request.query.page || "1", 10));
        const limit = Math.min(
          100,
          Math.max(1, parseInt(request.query.limit || "20", 10))
        );
        const skip = (page - 1) * limit;

        // Get total count for pagination metadata
        const totalCount = await prisma.tripMember.count({
          where: {
            userId: userId,
          },
        });

        // Get paginated trips where the user is a member
        const tripMembers = await prisma.tripMember.findMany({
          where: {
            userId: userId,
          },
          select: {
            role: true,
            trip: {
              select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
              },
            },
          },
          orderBy: {
            trip: {
              createdAt: "desc",
            },
          },
          skip,
          take: limit,
        });

        // Transform the data to return trips with user's role
        const trips = tripMembers.map((tripMember) => ({
          id: tripMember.trip.id,
          name: tripMember.trip.name,
          startDate: tripMember.trip.startDate,
          endDate: tripMember.trip.endDate,
          role: tripMember.role,
        }));

        const totalPages = Math.ceil(totalCount / limit);

        return reply.send({
          trips,
          pagination: {
            page,
            limit,
            totalCount,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
          },
        });
      } catch (error) {
        request.log.error({ error }, "Failed to fetch user trips");
        return reply.code(500).send({
          error: "Internal Server Error",
          message: "Failed to fetch trips",
        });
      }
    }
  );
}
