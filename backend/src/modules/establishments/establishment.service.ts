import { Prisma, type Establishment } from "@prisma/client";

import { prisma } from "../../prisma/client.js";
import { NotFoundError } from "../../shared/http-error.js";
import {
  toPaginatedResult,
  type PaginatedResult,
} from "../../shared/pagination.js";
import type {
  CreateEstablishmentInput,
  ListEstablishmentsQuery,
  UpdateEstablishmentInput,
} from "./establishment.dto.js";

export const establishmentService = {
  async list(query: ListEstablishmentsQuery): Promise<PaginatedResult<Establishment>> {
    const where: Prisma.EstablishmentWhereInput = {
      dispatchOrderId: query.dispatchOrderId,
      department: query.department
        ? { equals: query.department, mode: "insensitive" }
        : undefined,
      locality: query.locality
        ? { equals: query.locality, mode: "insensitive" }
        : undefined,
      ...(query.search
        ? {
            OR: [
              { cue: { contains: query.search } },
              { name: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.establishment.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { name: "asc" },
        include: {
          dispatchOrder: {
            select: { id: true, dispatchCode: true, listStatus: true },
          },
        },
      }),
      prisma.establishment.count({ where }),
    ]);

    return toPaginatedResult(items, total, query);
  },

  async getByCue(cue: string): Promise<Establishment> {
    const establishment = await prisma.establishment.findUnique({
      where: { cue },
      include: {
        dispatchOrder: {
          select: {
            id: true,
            dispatchCode: true,
            listStatus: true,
            dispatchTimestamp: true,
            technicians: { select: { technician: { select: { id: true, fullName: true } } } },
          },
        },
      },
    });

    if (!establishment) {
      throw new NotFoundError(`Establishment with cue '${cue}' not found`);
    }
    return establishment;
  },

  async create(input: CreateEstablishmentInput): Promise<Establishment> {
    if (input.dispatchOrderId !== undefined) {
      await assertDispatchOrderExists(input.dispatchOrderId);
    }
    return prisma.establishment.create({ data: input });
  },

  async update(cue: string, input: UpdateEstablishmentInput): Promise<Establishment> {
    await assertEstablishmentExists(cue);
    if (input.dispatchOrderId !== undefined) {
      await assertDispatchOrderExists(input.dispatchOrderId);
    }
    return prisma.establishment.update({ where: { cue }, data: input });
  },

  async remove(cue: string): Promise<void> {
    await assertEstablishmentExists(cue);
    await prisma.establishment.delete({ where: { cue } });
  },
};

export async function assertEstablishmentExists(cue: string): Promise<void> {
  const found = await prisma.establishment.count({ where: { cue } });
  if (found === 0) {
    throw new NotFoundError(`Establishment with cue '${cue}' not found`);
  }
}

async function assertDispatchOrderExists(dispatchOrderId: number): Promise<void> {
  const found = await prisma.dispatchOrder.count({ where: { id: dispatchOrderId } });
  if (found === 0) {
    throw new NotFoundError(`Dispatch order ${dispatchOrderId} not found`);
  }
}
