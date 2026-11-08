import { Prisma, type DispatchOrder } from "@prisma/client";

import { prisma } from "../../prisma/client.js";
import { NotFoundError } from "../../shared/http-error.js";
import {
  toPaginatedResult,
  type PaginatedResult,
} from "../../shared/pagination.js";
import type {
  CreateDispatchOrderInput,
  ListDispatchOrdersQuery,
} from "./dispatch.dto.js";

const dispatchOrderInclude = {
  establishments: {
    select: { cue: true, name: true, department: true, locality: true },
  },
  technicians: { select: { technician: { select: { id: true, fullName: true } } } },
} satisfies Prisma.DispatchOrderInclude;

async function findOrder(
  client: Prisma.TransactionClient,
  id: number,
): Promise<DispatchOrder> {
  const order = await client.dispatchOrder.findUnique({
    where: { id },
    include: dispatchOrderInclude,
  });
  if (!order) {
    throw new NotFoundError(`Dispatch order ${id} not found`);
  }
  return order;
}

async function assertTechniciansExist(technicianIds: number[]): Promise<void> {
  if (technicianIds.length === 0) return;

  const uniqueIds = [...new Set(technicianIds)];
  const found = await prisma.technician.count({ where: { id: { in: uniqueIds } } });
  if (found !== uniqueIds.length) {
    throw new NotFoundError("Uno o mas tecnicos no existen");
  }
}

export const dispatchOrderService = {
  async list(query: ListDispatchOrdersQuery): Promise<PaginatedResult<DispatchOrder>> {
    const where: Prisma.DispatchOrderWhereInput = {
      listStatus: query.listStatus,
      ...(query.dispatchCode
        ? { dispatchCode: { contains: query.dispatchCode } }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.dispatchOrder.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { dispatchTimestamp: "desc" },
        include: dispatchOrderInclude,
      }),
      prisma.dispatchOrder.count({ where }),
    ]);

    return toPaginatedResult(items, total, query);
  },

  async getById(id: number): Promise<DispatchOrder> {
    return findOrder(prisma, id);
  },

  // Crea la orden, vincula técnicos (N:M) y asigna establecimientos de forma atómica
  async create(input: CreateDispatchOrderInput): Promise<DispatchOrder> {
    await assertTechniciansExist(input.technicianIds);
    const establishmentCues = [...new Set(input.establishmentCues)];

    return prisma.$transaction(async (tx) => {
      const order = await tx.dispatchOrder.create({
        data: {
          dispatchCode: input.dispatchCode,
          dispatchTimestamp: input.dispatchTimestamp,
          listStatus: input.listStatus,
        },
      });

      if (input.technicianIds.length > 0) {
        await tx.dispatchTechnician.createMany({
          data: input.technicianIds.map((technicianId) => ({
            dispatchOrderId: order.id,
            technicianId,
          })),
        });
      }

      if (establishmentCues.length > 0) {
        const found = await tx.establishment.findMany({
          where: { cue: { in: establishmentCues } },
          select: { cue: true },
        });
        if (found.length !== establishmentCues.length) {
          const missing = establishmentCues.filter(
            (cue) => !found.some((e) => e.cue === cue),
          );
          throw new NotFoundError(`Establecimientos inexistentes: ${missing.join(", ")}`);
        }

        await tx.establishment.updateMany({
          where: { cue: { in: establishmentCues } },
          data: { dispatchOrderId: order.id },
        });
      }

      return findOrder(tx, order.id);
    });
  },
};
