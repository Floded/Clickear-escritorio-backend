import { Prisma, type InventoryItem } from "@prisma/client";

import { prisma } from "../../prisma/client.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../shared/http-error.js";
import {
  toPaginatedResult,
  type PaginatedResult,
} from "../../shared/pagination.js";
import type {
  CreateInventoryItemInput,
  ListInventoryItemsQuery,
  UpdateInventoryItemInput,
} from "./inventory-item.dto.js";

export const inventoryItemService = {
  async list(query: ListInventoryItemsQuery): Promise<PaginatedResult<InventoryItem>> {
    const where: Prisma.InventoryItemWhereInput = {
      supplierId: query.supplierId,
      name: query.search ? { contains: query.search, mode: "insensitive" } : undefined,
      availableQuantity:
        query.hasStock === "true"
          ? { gt: 0 }
          : query.hasStock === "false"
            ? { lte: 0 }
            : undefined,
    };

    const [items, total] = await prisma.$transaction([
      prisma.inventoryItem.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { name: "asc" },
        include: {
          supplier: { select: { id: true, name: true } },
          _count: { select: { assignments: { where: { returnDate: null } } } },
        },
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    return toPaginatedResult(items, total, query);
  },

  async getById(id: number): Promise<InventoryItem> {
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true, contactPhone: true } },
        assignments: {
          where: { returnDate: null },
          orderBy: { deliveryDate: "desc" },
          include: { employee: { select: { id: true, fullName: true } } },
        },
      },
    });
    if (!item) {
      throw new NotFoundError(`Inventory item ${id} not found`);
    }
    return item;
  },

  async create(input: CreateInventoryItemInput): Promise<InventoryItem> {
    if (input.supplierId !== undefined) {
      await assertSupplierExists(input.supplierId);
    }
    return prisma.inventoryItem.create({ data: input });
  },

  async update(id: number, input: UpdateInventoryItemInput): Promise<InventoryItem> {
    await assertItemExists(id);
    if (input.supplierId !== undefined) {
      await assertSupplierExists(input.supplierId);
    }
    return prisma.inventoryItem.update({ where: { id }, data: input });
  },

  // Ajuste diferencial de stock (carga inicial, mermas, correcciones).
  // La resta queda limitada a disponible >= 0 por el where del updateMany.
  async adjustStock(id: number, quantity: number): Promise<InventoryItem> {
    if (!Number.isInteger(quantity) || quantity === 0) {
      throw new BadRequestError("La cantidad debe ser un entero distinto de cero");
    }

    const minAvailable = quantity < 0 ? -quantity : 0;
    const result = await prisma.inventoryItem.updateMany({
      where: { id, availableQuantity: { gte: minAvailable } },
      data: { availableQuantity: { increment: quantity } },
    });

    if (result.count === 0) {
      const exists = await prisma.inventoryItem.count({ where: { id } });
      if (exists === 0) {
        throw new NotFoundError(`Inventory item ${id} not found`);
      }
      throw new ConflictError("Ajuste dejaria el stock en negativo");
    }

    return prisma.inventoryItem.findUniqueOrThrow({ where: { id } });
  },

  // FK Restrict: si tiene historial de asignaciones, no se borra
  async remove(id: number): Promise<void> {
    await assertItemExists(id);

    const assignments = await prisma.itemAssignment.count({
      where: { inventoryItemId: id },
    });
    if (assignments > 0) {
      throw new ConflictError(
        `El item ${id} tiene ${assignments} asignaciones registradas; no se puede eliminar`,
      );
    }

    await prisma.inventoryItem.delete({ where: { id } });
  },
};

async function assertItemExists(id: number): Promise<void> {
  const found = await prisma.inventoryItem.count({ where: { id } });
  if (found === 0) {
    throw new NotFoundError(`Inventory item ${id} not found`);
  }
}

async function assertSupplierExists(supplierId: number): Promise<void> {
  const found = await prisma.supplier.count({ where: { id: supplierId } });
  if (found === 0) {
    throw new NotFoundError(`Supplier ${supplierId} not found`);
  }
}
