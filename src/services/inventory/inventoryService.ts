import { AuditLog, EntityId, PackageUnit, StockMovement, StockUnit } from '../../domain/types';

export interface InventoryState {
  packages: PackageUnit[];
  stockUnits: StockUnit[];
  movements: StockMovement[];
  auditLogs: AuditLog[];
}

export interface InventoryTransactionResult {
  ok: boolean;
  state: InventoryState;
  movement?: StockMovement;
  error?: string;
}

export interface MovePackageCommand {
  packageId: EntityId;
  toLocationCode: string;
  taskId?: EntityId;
  actorId: EntityId;
  now: string;
}

function nextId(prefix: string, value: string): string {
  return `${prefix}-${value}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function commitPackageMove(state: InventoryState, command: MovePackageCommand): InventoryTransactionResult {
  const packageUnit = state.packages.find((item) => item.packageId === command.packageId);
  if (!packageUnit) return { ok: false, state, error: 'Paket bulunamadı.' };

  const stockUnit = state.stockUnits.find((item) => item.packageId === command.packageId);
  const fromLocationCode = packageUnit.currentLocationCode;
  const auditId = nextId('AUD', command.packageId);
  const movement: StockMovement = {
    movementId: nextId('MOV', command.packageId),
    movementType: fromLocationCode ? 'transfer' : 'putaway',
    packageId: command.packageId,
    sku: packageUnit.sku,
    quantity: packageUnit.profile.quantityInsidePackage,
    fromLocationCode,
    toLocationCode: command.toLocationCode,
    taskId: command.taskId,
    createdAt: command.now,
    createdBy: command.actorId,
    auditId,
  };

  const nextPackage: PackageUnit = {
    ...packageUnit,
    currentLocationCode: command.toLocationCode,
    status: 'placed',
    updatedAt: command.now,
  };

  const nextStockUnits = stockUnit
    ? state.stockUnits.map((item) =>
        item.packageId === command.packageId
          ? { ...item, locationCode: command.toLocationCode, status: 'available' as const }
          : item,
      )
    : [
        ...state.stockUnits,
        {
          stockUnitId: nextId('STU', command.packageId),
          packageId: command.packageId,
          sku: packageUnit.sku,
          locationCode: command.toLocationCode,
          quantity: packageUnit.profile.quantityInsidePackage,
          lot: packageUnit.lot,
          status: 'available' as const,
        },
      ];

  const audit: AuditLog = {
    auditId,
    entityType: 'PackageUnit',
    entityId: command.packageId,
    action: movement.movementType,
    actorId: command.actorId,
    before: packageUnit,
    after: nextPackage,
    createdAt: command.now,
  };

  return {
    ok: true,
    state: {
      packages: state.packages.map((item) => item.packageId === command.packageId ? nextPackage : item),
      stockUnits: nextStockUnits,
      movements: [...state.movements, movement],
      auditLogs: [...state.auditLogs, audit],
    },
    movement,
  };
}
