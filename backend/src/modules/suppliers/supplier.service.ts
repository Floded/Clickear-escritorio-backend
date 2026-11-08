import { Prisma, type Supplier } from "@prisma/client";

import { prisma } from "../../prisma/client.js";
import { NotFoundError } from "../../shared/http-error.js";
import { containsInsensitive } from "../../shared/prisma-filters.js";
import {
  toPaginatedResult,
  type PaginatedResult,
} from "../../shared/pagination.js";
import type {
  CreateSupplierInput,
  ListSuppliersQuery,
  UpdateSupplierInput,
} from "./supplier.dto.js";

export const supplierService = {
  async list(query: ListSuppliersQuery): Promise<PaginatedResult<Supplier>> {
    const where: Prisma.SupplierWhereInput = query.search
      ? {
          OR: [
            { name: containsInsensitive(query.search) },
            { contactEmail: containsInsensitive(query.search) },
          ],
        }
      : {};

    const [items, total] = await prisma.$transaction([
      prisma.supplier.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { name: "asc" },
        include: { _count: { select: { inventoryItems: true } } },
      }),
      prisma.supplier.count({ where }),
    ]);

    return toPaginatedResult(items, total, query);
  },

  async getById(id: number): Promise<Supplier> {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: { inventoryItems: true },
    });
    if (!supplier) {
      throw new NotFoundError(`Supplier ${id} not found`);
    }
    return supplier;
  },

  async create(input: CreateSupplierInput): Promise<Supplier> {
    return prisma.supplier.create({ data: input });
  },

  async update(id: number, input: UpdateSupplierInput): Promise<Supplier> {
    await assertSupplierExists(id);
    return prisma.supplier.update({ where: { id }, data: input });
  },

  // On Delete SetNull: los ítems conservan su stock sin proveedor
  async remove(id: number): Promise<void> {
    await assertSupplierExists(id);
    await prisma.supplier.delete({ where: { id } });
  },
};

async function assertSupplierExists(id: number): Promise<void> {
  const found = await prisma.supplier.count({ where: { id } });
  if (found === 0) {
    throw new NotFoundError(`Supplier ${id} not found`);
  }
}
