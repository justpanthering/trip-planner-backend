import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  authMiddleware,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import prisma from "../lib/prisma.js";

interface TripListQuery {
  page?: string;
  limit?: string;
  status?: "upcoming" | "ongoing" | "past";
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

        // Build date filter based on status
        const now = new Date();
        let dateFilter: any = {};

        if (request.query.status) {
          switch (request.query.status) {
            case "upcoming":
              dateFilter = {
                startDate: {
                  gt: now,
                },
              };
              break;
            case "ongoing":
              dateFilter = {
                startDate: {
                  lte: now,
                },
                endDate: {
                  gte: now,
                },
              };
              break;
            case "past":
              dateFilter = {
                endDate: {
                  lt: now,
                },
              };
              break;
          }
        }

        // Build where clause with optional date filter
        const whereClause: any = {
          userId: userId,
        };

        if (Object.keys(dateFilter).length > 0) {
          whereClause.trip = dateFilter;
        }

        // Get total count for pagination metadata
        const totalCount = await prisma.tripMember.count({
          where: whereClause,
        });

        // Get paginated trips where the user is a member
        const tripMembers = await prisma.tripMember.findMany({
          where: whereClause,
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
