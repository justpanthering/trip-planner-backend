import { PrismaClient } from "../../generated/prisma/client.js";

// Cast to any to allow using PrismaClient with its default configuration
const prisma = new (PrismaClient as any)();

export default prisma;
