import { Prisma, type Technician } from "@prisma/client";

import { prisma } from "../../prisma/client.js";
import {
  toPaginatedResult,
  type PaginatedResult,
} from "../../shared/pagination.js";
import { containsInsensitive } from "../../shared/prisma-filters.js";
import type {
  CreateTechnicianInput,
  ListTechniciansQuery,
} from "./technician.dto.js";

export const technicianService = {
  async list(query: ListTechniciansQuery): Promise<PaginatedResult<Technician>> {
    const where: Prisma.TechnicianWhereInput = query.search
      ? { fullName: containsInsensitive(query.search) }
      : {};

    const [items, total] = await prisma.$transaction([
      prisma.technician.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { fullName: "asc" },
      }),
      prisma.technician.count({ where }),
    ]);

    return toPaginatedResult(items, total, query);
  },

  async create(input: CreateTechnicianInput): Promise<Technician> {
    return prisma.technician.create({ data: input });
  },
};
