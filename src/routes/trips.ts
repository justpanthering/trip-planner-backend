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

interface CreateTripBody {
  name: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  members: string[]; // Array of userIds
  currency?: string;
  budget?: number;
}

interface ItineraryItemInput {
  type: "TRAVEL" | "STAY" | "ACTIVITY" | "FOOD" | "NOTE";
  title: string;
  description?: string;
  startTime?: string; // ISO date string
  endTime?: string; // ISO date string
  order: number;
}

interface CreateTripDayBody {
  date: string; // ISO date string
  itineraryItems: ItineraryItemInput[];
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
                members: {
                  select: {
                    id: true,
                    user: {
                      select: {
                        id: true,
                        email: true,
                      },
                    },
                  },
                },
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

        // Transform the data to return trips with members
        const trips = tripMembers.map((tripMember) => ({
          id: tripMember.trip.id,
          name: tripMember.trip.name,
          startDate: tripMember.trip.startDate,
          endDate: tripMember.trip.endDate,
          members: tripMember.trip.members.map((member) => ({
            id: member.user.id,
            email: member.user.email,
          })),
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

  // Get trip details by id
  fastify.get<{ Params: { tripId: string } }>(
    "/:tripId",
    { preHandler: [authMiddleware] },
    async (
      request: FastifyRequest<{ Params: { tripId: string } }>,
      reply: FastifyReply
    ) => {
      const authenticatedRequest = request as AuthenticatedRequest;
      const userId = authenticatedRequest.user!.id;

      try {
        const { tripId } = request.params;

        // Verify trip exists and user has access
        const trip = await prisma.trip.findFirst({
          where: {
            id: tripId,
            members: {
              some: {
                userId: userId,
              },
            },
          },
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                  },
                },
              },
            },
            destinations: {
              orderBy: {
                order: "asc",
              },
            },
            days: {
              include: {
                items: {
                  orderBy: {
                    order: "asc",
                  },
                },
                destination: {
                  select: {
                    id: true,
                    name: true,
                    country: true,
                  },
                },
              },
              orderBy: {
                dayNumber: "asc",
              },
            },
          },
        });

        if (!trip) {
          return reply.code(404).send({
            error: "Not Found",
            message: "Trip not found or you don't have access to it",
          });
        }

        return reply.send({
          id: trip.id,
          name: trip.name,
          startDate: trip.startDate,
          endDate: trip.endDate,
          currency: trip.currency,
          budget: trip.budget,
          createdAt: trip.createdAt,
          members: trip.members.map((member) => ({
            id: member.user.id,
            email: member.user.email,
            role: member.role,
            joinedAt: member.joinedAt,
          })),
          destinations: trip.destinations.map((destination) => ({
            id: destination.id,
            name: destination.name,
            country: destination.country,
            order: destination.order,
            createdAt: destination.createdAt,
          })),
          days: trip.days.map((day) => ({
            id: day.id,
            date: day.date,
            dayNumber: day.dayNumber,
            destinationId: day.destinationId,
            destination: day.destination
              ? {
                  id: day.destination.id,
                  name: day.destination.name,
                  country: day.destination.country,
                }
              : null,
            createdAt: day.createdAt,
            items: day.items.map((item) => ({
              id: item.id,
              type: item.type,
              title: item.title,
              description: item.description,
              startTime: item.startTime,
              endTime: item.endTime,
              order: item.order,
              createdAt: item.createdAt,
            })),
          })),
        });
      } catch (error) {
        request.log.error({ error }, "Failed to fetch trip details");
        return reply.code(500).send({
          error: "Internal Server Error",
          message: "Failed to fetch trip details",
        });
      }
    }
  );

  // Create a new trip
  fastify.post<{ Body: CreateTripBody }>(
    "/",
    { preHandler: [authMiddleware] },
    async (
      request: FastifyRequest<{ Body: CreateTripBody }>,
      reply: FastifyReply
    ) => {
      const authenticatedRequest = request as AuthenticatedRequest;
      const userId = authenticatedRequest.user!.id;

      try {
        const { name, startDate, endDate, members, currency, budget } =
          request.body;

        // Validate required fields
        if (!name || !startDate || !endDate || !members) {
          return reply.code(400).send({
            error: "Bad Request",
            message:
              "Missing required fields: name, startDate, endDate, members",
          });
        }

        // Validate dates
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return reply.code(400).send({
            error: "Bad Request",
            message: "Invalid date format. Use ISO date strings.",
          });
        }

        if (start >= end) {
          return reply.code(400).send({
            error: "Bad Request",
            message: "startDate must be before endDate",
          });
        }

        // Validate members array
        if (!Array.isArray(members) || members.length === 0) {
          return reply.code(400).send({
            error: "Bad Request",
            message: "members must be a non-empty array of userIds",
          });
        }

        // Ensure the creator is in the members list (as OWNER)
        const uniqueMembers = Array.from(new Set([userId, ...members]));

        // Verify all user IDs exist
        const users = await prisma.user.findMany({
          where: {
            id: {
              in: uniqueMembers,
            },
          },
          select: {
            id: true,
          },
        });

        const foundUserIds = new Set(users.map((u) => u.id));
        const invalidUserIds = uniqueMembers.filter(
          (id) => !foundUserIds.has(id)
        );

        if (invalidUserIds.length > 0) {
          return reply.code(400).send({
            error: "Bad Request",
            message: `Invalid user IDs: ${invalidUserIds.join(", ")}`,
          });
        }

        // Create trip with members in a transaction
        const trip = await prisma.$transaction(async (tx) => {
          // Create the trip
          const newTrip = await tx.trip.create({
            data: {
              name,
              startDate: start,
              endDate: end,
              currency: currency || "USD",
              budget: budget ?? null,
              members: {
                create: uniqueMembers.map((memberId) => ({
                  userId: memberId,
                  role: memberId === userId ? "OWNER" : "EDITOR",
                })),
              },
            },
            include: {
              members: {
                include: {
                  user: {
                    select: {
                      id: true,
                      email: true,
                    },
                  },
                },
              },
            },
          });

          return newTrip;
        });

        return reply.code(201).send({
          id: trip.id,
          name: trip.name,
          startDate: trip.startDate,
          endDate: trip.endDate,
          currency: trip.currency,
          budget: trip.budget,
          createdAt: trip.createdAt,
          members: trip.members.map((member) => ({
            userId: member.userId,
            userEmail: member.user.email,
            role: member.role,
            joinedAt: member.joinedAt,
          })),
        });
      } catch (error) {
        request.log.error({ error }, "Failed to create trip");
        return reply.code(500).send({
          error: "Internal Server Error",
          message: "Failed to create trip",
        });
      }
    }
  );

  // Create a trip day
  fastify.post<{ Params: { tripId: string }; Body: CreateTripDayBody }>(
    "/:tripId/days",
    { preHandler: [authMiddleware] },
    async (
      request: FastifyRequest<{
        Params: { tripId: string };
        Body: CreateTripDayBody;
      }>,
      reply: FastifyReply
    ) => {
      const authenticatedRequest = request as AuthenticatedRequest;
      const userId = authenticatedRequest.user!.id;

      try {
        const { tripId } = request.params;
        const { date, itineraryItems } = request.body;

        // Validate required fields
        if (!date || !itineraryItems) {
          return reply.code(400).send({
            error: "Bad Request",
            message: "Missing required fields: date, itineraryItems",
          });
        }

        // Validate date
        const dayDate = new Date(date);
        if (isNaN(dayDate.getTime())) {
          return reply.code(400).send({
            error: "Bad Request",
            message: "Invalid date format. Use ISO date string.",
          });
        }

        // Validate itineraryItems array
        if (!Array.isArray(itineraryItems)) {
          return reply.code(400).send({
            error: "Bad Request",
            message: "itineraryItems must be an array",
          });
        }

        // Verify trip exists and user has access
        const trip = await prisma.trip.findFirst({
          where: {
            id: tripId,
            members: {
              some: {
                userId: userId,
              },
            },
          },
          include: {
            days: true,
          },
        });

        if (!trip) {
          return reply.code(404).send({
            error: "Not Found",
            message: "Trip not found or you don't have access to it",
          });
        }

        // Validate that the day date is within trip date range
        if (dayDate < trip.startDate || dayDate > trip.endDate) {
          return reply.code(400).send({
            error: "Bad Request",
            message: "Day date must be within the trip's date range",
          });
        }

        // Calculate dayNumber based on trip startDate
        const dayNumber =
          Math.floor(
            (dayDate.getTime() - trip.startDate.getTime()) /
              (1000 * 60 * 60 * 24)
          ) + 1;

        // Validate itinerary items
        for (const item of itineraryItems) {
          if (!item.type || !item.title || item.order === undefined) {
            return reply.code(400).send({
              error: "Bad Request",
              message: "Each itinerary item must have: type, title, and order",
            });
          }

          if (
            !["TRAVEL", "STAY", "ACTIVITY", "FOOD", "NOTE"].includes(item.type)
          ) {
            return reply.code(400).send({
              error: "Bad Request",
              message: `Invalid itinerary type: ${item.type}`,
            });
          }

          if (item.startTime) {
            const startTime = new Date(item.startTime);
            if (isNaN(startTime.getTime())) {
              return reply.code(400).send({
                error: "Bad Request",
                message: "Invalid startTime format in itinerary item",
              });
            }
          }

          if (item.endTime) {
            const endTime = new Date(item.endTime);
            if (isNaN(endTime.getTime())) {
              return reply.code(400).send({
                error: "Bad Request",
                message: "Invalid endTime format in itinerary item",
              });
            }
          }
        }

        // Create trip day with itinerary items in a transaction
        const tripDay = await prisma.$transaction(async (tx) => {
          const newTripDay = await tx.tripDay.create({
            data: {
              tripId,
              date: dayDate,
              dayNumber,
              items: {
                create: itineraryItems.map((item) => ({
                  type: item.type,
                  title: item.title,
                  description: item.description || null,
                  startTime: item.startTime ? new Date(item.startTime) : null,
                  endTime: item.endTime ? new Date(item.endTime) : null,
                  order: item.order,
                })),
              },
            },
            include: {
              items: {
                orderBy: {
                  order: "asc",
                },
              },
            },
          });

          return newTripDay;
        });

        return reply.code(201).send({
          id: tripDay.id,
          date: tripDay.date,
          dayNumber: tripDay.dayNumber,
          tripId: tripDay.tripId,
          createdAt: tripDay.createdAt,
          items: tripDay.items.map((item) => ({
            id: item.id,
            type: item.type,
            title: item.title,
            description: item.description,
            startTime: item.startTime,
            endTime: item.endTime,
            order: item.order,
            createdAt: item.createdAt,
          })),
        });
      } catch (error) {
        request.log.error({ error }, "Failed to create trip day");
        return reply.code(500).send({
          error: "Internal Server Error",
          message: "Failed to create trip day",
        });
      }
    }
  );
}
