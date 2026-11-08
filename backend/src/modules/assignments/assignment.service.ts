import { Prisma, type ItemAssignment } from "@prisma/client";

import { prisma, isSqlite } from "../../prisma/client.js";
import {
  ConflictError,
  NotFoundError,
} from "../../shared/http-error.js";
import {
  toPaginatedResult,
  type PaginatedResult,
} from "../../shared/pagination.js";
import type {
  CreateAssignmentInput,
  ListAssignmentsQuery,
  ReturnAssignmentInput,
} from "./assignment.dto.js";

const assignmentInclude = {
  inventoryItem: { select: { id: true, name: true } },
  employee: { select: { id: true, fullName: true } },
} satisfies Prisma.ItemAssignmentInclude;

export const assignmentService = {
  // Custodia de un empleado: asignaciones activas (sin devolución) + totales
  async listByEmployee(
    employeeId: number,
  ): Promise<{ employee: Record<string, unknown>; unitsInCustody: number; data: ItemAssignment[] }> {
    await assertEmployeeExists(employeeId);

    const [items, activeAssignments, totalUnits] = await prisma.$transaction([
      prisma.employee.findUniqueOrThrow({ where: { id: employeeId } }),
      prisma.itemAssignment.findMany({
        where: { employeeId, returnDate: null },
        orderBy: { deliveryDate: "desc" },
        include: {
          inventoryItem: {
            select: { id: true, name: true, description: true },
          },
        },
      }),
      prisma.itemAssignment.aggregate({
        where: { employeeId, returnDate: null },
        _sum: { quantityAssigned: true },
      }),
    ]);

    return {
      employee: { id: items.id, fullName: items.fullName, isActive: items.isActive },
      unitsInCustody: totalUnits._sum.quantityAssigned ?? 0,
      data: activeAssignments,
    };
  },

  async list(query: ListAssignmentsQuery): Promise<PaginatedResult<ItemAssignment>> {
    const where: Prisma.ItemAssignmentWhereInput = {
      employeeId: query.employeeId,
      inventoryItemId: query.inventoryItemId,
      returnDate:
        query.status === "ACTIVE"
          ? null
          : query.status === "RETURNED"
            ? { not: null }
            : undefined,
    };

    const [items, total] = await prisma.$transaction([
      prisma.itemAssignment.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { deliveryDate: "desc" },
        include: assignmentInclude,
      }),
      prisma.itemAssignment.count({ where }),
    ]);

    return toPaginatedResult(items, total, query);
  },

  /**
   * Entrega de stock al empleado (transacción atómica):
   *  1. Bloquea la fila del ítem (SELECT ... FOR UPDATE) para evitar carreras concurrentes.
   *  2. Valida stock disponible (la transacción ve el valor "fresco").
   *  3. Registra la asignación con su delivery_date.
   *  4. Resta disponibile; el CHECK (available_quantity >= 0) queda como segunda barrera.
   */
  async create(input: CreateAssignmentInput): Promise<ItemAssignment> {
    return prisma.$transaction(async (tx) => {
      // Lock pesimista de la fila del ítem. SQLite serializa las escrituras
      // (un solo writer) y no soporta FOR UPDATE.
      if (!isSqlite) {
        await tx.$queryRaw`SELECT id FROM "inventory_items" WHERE id = ${input.inventoryItemId} FOR UPDATE`;
      }

      const item = await tx.inventoryItem.findUnique({
        where: { id: input.inventoryItemId },
        select: { id: true, name: true, availableQuantity: true },
      });
      if (!item) {
        throw new NotFoundError(`Inventory item ${input.inventoryItemId} not found`);
      }
      if (item.availableQuantity < input.quantityAssigned) {
        throw new ConflictError(
          `Stock insuficiente del item '${item.name}': disponibles ${item.availableQuantity}, solicitados ${input.quantityAssigned}`,
        );
      }

      const employee = await tx.employee.findUnique({
        where: { id: input.employeeId },
        select: { id: true, fullName: true, isActive: true },
      });
      if (!employee) {
        throw new NotFoundError(`Employee ${input.employeeId} not found`);
      }
      if (!employee.isActive) {
        throw new ConflictError(`Empleado '${employee.fullName}' esta inactivo`);
      }

      const assignment = await tx.itemAssignment.create({
        data: {
          inventoryItemId: input.inventoryItemId,
          employeeId: input.employeeId,
          quantityAssigned: input.quantityAssigned,
          deliveryDate: input.deliveryDate,
          notes: input.notes,
        },
      });

      await tx.inventoryItem.update({
        where: { id: input.inventoryItemId },
        data: { availableQuantity: { decrement: input.quantityAssigned } },
      });

      return assignment;
    });
  },

  /**
   * Devolución al depósito (transacción atómica):
   * marca return_date sobre la asignación y re-suma el stock entregado.
   * Permite devoluciones parciales: la asignación queda con el resto en custodia
   * y se registra aparte la parte devuelta (trazabilidad completa).
   */
  async return(id: number, input: ReturnAssignmentInput): Promise<ItemAssignment> {
    return prisma.$transaction(async (tx) => {
      // En SQLite la escritura ya está serializada: no aplica FOR UPDATE
      if (!isSqlite) {
        await tx.$queryRaw`SELECT id FROM "item_assignments" WHERE id = ${id} FOR UPDATE`;
      }

      const assignment = await tx.itemAssignment.findUnique({
        where: { id },
        select: {
          inventoryItemId: true,
          employeeId: true,
          quantityAssigned: true,
          deliveryDate: true,
          returnDate: true,
        },
      });
      if (!assignment) {
        throw new NotFoundError(`Assignment ${id} not found`);
      }
      if (assignment.returnDate !== null) {
        throw new ConflictError(
          `La asignacion ${id} ya fue devuelta el ${assignment.returnDate.toISOString()}`,
        );
      }

      const returnDate = input.returnDate ?? new Date();
      const quantity = input.quantity ?? assignment.quantityAssigned;
      if (quantity > assignment.quantityAssigned) {
        throw new ConflictError(
          `No se puede devolver mas de lo asignado (${assignment.quantityAssigned})`,
        );
      }

      if (quantity === assignment.quantityAssigned) {
        await tx.itemAssignment.update({
          where: { id },
          data: { returnDate, notes: input.notes ?? undefined },
        });
      } else {
        await tx.itemAssignment.update({
          where: { id },
          data: { quantityAssigned: assignment.quantityAssigned - quantity },
        });
        await tx.itemAssignment.create({
          data: {
            inventoryItemId: assignment.inventoryItemId,
            employeeId: assignment.employeeId,
            quantityAssigned: quantity,
            deliveryDate: assignment.deliveryDate,
            returnDate,
            notes: input.notes,
          },
        });
      }

      await tx.inventoryItem.update({
        where: { id: assignment.inventoryItemId },
        data: { availableQuantity: { increment: quantity } },
      });

      return tx.itemAssignment.findUniqueOrThrow({
        where: { id },
        include: assignmentInclude,
      });
    });
  },
};

async function assertEmployeeExists(employeeId: number): Promise<void> {
  const found = await prisma.employee.count({ where: { id: employeeId } });
  if (found === 0) {
    throw new NotFoundError(`Employee ${employeeId} not found`);
  }
}
