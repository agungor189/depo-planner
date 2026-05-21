export type ISODateString = string;
export type EntityId = string;

export const WMS_SCHEMA_VERSION = 'dsdst.wms.v1' as const;

export type ProductCategory = 'Alüminyum' | 'Döküm' | 'Karbon Çelik' | 'PPR' | 'Karışık' | 'Diğer';
export type PackageHandlingUnit = 'box' | 'pallet' | 'bundle';
export type LocationFace = 'front' | 'back';
export type LocationStatus = 'active' | 'blocked' | 'maintenance' | 'reserved';
export type StockMovementType = 'receive' | 'putaway' | 'pick' | 'transfer' | 'adjustment' | 'cycle_count';
export type TaskType = 'putaway' | 'pick' | 'transfer' | 'cycle_count';
export type TaskStatus = 'draft' | 'suggested' | 'assigned' | 'in_progress' | 'waiting_scan' | 'completed' | 'cancelled' | 'failed';
export type ReservationStatus = 'open' | 'allocated' | 'released' | 'fulfilled' | 'cancelled';
export type ImportSourceType = 'label-printer-json' | 'csv' | 'xlsx' | 'unknown';
export type ImportRowStatus = 'valid' | 'warning' | 'error' | 'duplicate';
export type WmsRole = 'admin' | 'warehouse_manager' | 'operator' | 'cycle_counter' | 'viewer';
export type WmsPermission =
  | 'import:create'
  | 'putaway:approve'
  | 'stock:move'
  | 'count:approve'
  | 'location:edit'
  | 'report:view'
  | 'settings:edit';

export interface SupplierProductCode {
  supplierId?: EntityId;
  supplierName?: string;
  code: string;
}

export interface Product {
  id: EntityId;
  sku: string;
  name: string;
  category: ProductCategory;
  supplierCodes: SupplierProductCode[];
  material?: string;
  type?: string;
  dimensionsLabel?: string;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface PackageProfile {
  boxWidthCm: number;
  boxDepthCm: number;
  boxHeightCm: number;
  weightKg: number;
  quantityInsidePackage: number;
}

export interface PackageUnit {
  packageId: EntityId;
  packageKey: string;
  sku: string;
  productName: string;
  supplierCode: string;
  category: ProductCategory;
  material?: string;
  type?: string;
  lot?: string;
  packageNo?: string;
  packageIndex?: number;
  totalPackages?: number;
  profile: PackageProfile;
  currentLocationCode: string | null;
  status: 'expected' | 'received' | 'putaway_suggested' | 'placed' | 'reserved' | 'picked' | 'blocked';
  sourceImportBatchId?: EntityId;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Warehouse {
  warehouseId: EntityId;
  name: string;
  widthM: number;
  lengthM: number;
  heightM: number;
  zones: Zone[];
}

export interface Zone {
  zoneId: EntityId;
  code: string;
  name: string;
  allowedSkuGroups: ProductCategory[];
}

export interface Aisle {
  aisleId: EntityId;
  warehouseId: EntityId;
  zoneCode: string;
  code: string;
  walkingDistanceScore: number;
}

export interface RackAddress {
  warehouseId: EntityId;
  zoneCode: string;
  aisleCode: string;
  rackCode: string;
  bayCode?: string;
}

export interface Bay {
  bayId: EntityId;
  rackCode: string;
  bayCode: string;
}

export interface Level {
  levelId: EntityId;
  rackCode: string;
  levelNumber: number;
  heightCm: number;
}

export interface SlotLocation {
  locationCode: string;
  warehouseId: EntityId;
  zoneCode: string;
  aisleCode: string;
  rackCode: string;
  bayCode: string;
  face: LocationFace;
  levelNumber: number;
  slotNumber: number;
  capacityPackageCount: number;
  maxWeightKg: number;
  allowedSkuGroups: ProductCategory[];
  currentOccupancy: number;
  status: LocationStatus;
  coordinates: {
    xM: number;
    yM: number;
    zM: number;
  };
  walkingDistanceScore: number;
  pickingPriority: number;
}

export interface StockUnit {
  stockUnitId: EntityId;
  packageId: EntityId;
  sku: string;
  locationCode: string | null;
  quantity: number;
  lot?: string;
  status: 'available' | 'reserved' | 'blocked' | 'picked';
}

export interface InventoryBalance {
  sku: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  blockedQuantity: number;
  packageCount: number;
  locationCodes: string[];
}

export interface StockMovement {
  movementId: EntityId;
  movementType: StockMovementType;
  packageId: EntityId;
  sku: string;
  quantity: number;
  fromLocationCode: string | null;
  toLocationCode: string | null;
  taskId?: EntityId;
  receivingBatchId?: EntityId;
  createdAt: ISODateString;
  createdBy: EntityId;
  auditId: EntityId;
}

export interface ReceivingBatch {
  receivingBatchId: EntityId;
  sourceFileHash?: string;
  sourceName?: string;
  status: 'draft' | 'validated' | 'committed' | 'failed';
  packageIds: EntityId[];
  createdAt: ISODateString;
  committedAt?: ISODateString;
}

export interface WmsTask {
  taskId: EntityId;
  taskType: TaskType;
  status: TaskStatus;
  packageId?: EntityId;
  sku?: string;
  fromLocationCode?: string | null;
  suggestedLocationCode?: string | null;
  confirmedLocationCode?: string | null;
  assignedTo?: EntityId;
  priority: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface PutawayTask extends WmsTask {
  taskType: 'putaway';
  packageId: EntityId;
  suggestedLocationCode: string;
}

export interface PickTask extends WmsTask {
  taskType: 'pick';
  orderId: EntityId;
}

export interface TransferTask extends WmsTask {
  taskType: 'transfer';
  fromLocationCode: string;
  suggestedLocationCode: string;
}

export interface CycleCountTask extends WmsTask {
  taskType: 'cycle_count';
  locationCode: string;
}

export interface Adjustment {
  adjustmentId: EntityId;
  sku: string;
  packageId?: EntityId;
  locationCode?: string;
  quantityDelta: number;
  reason: string;
  approvedBy?: EntityId;
  createdAt: ISODateString;
}

export interface Reservation {
  reservationId: EntityId;
  orderId: EntityId;
  sku: string;
  quantity: number;
  status: ReservationStatus;
  allocatedPackageIds: EntityId[];
  createdAt: ISODateString;
}

export interface OrderAllocation {
  allocationId: EntityId;
  orderId: EntityId;
  reservationIds: EntityId[];
  pickTaskIds: EntityId[];
  createdAt: ISODateString;
}

export interface BarcodePayload {
  version: 'wms.package.v1' | 'wms.location.v1';
  packageId?: EntityId;
  locationCode?: string;
  sku?: string;
  supplierCode?: string;
  qtyPerPackage?: number;
  packageNo?: string;
  lot?: string;
  productName?: string;
  createdAt: ISODateString;
  checksum: string;
}

export interface AuditLog {
  auditId: EntityId;
  entityType: string;
  entityId: EntityId;
  action: string;
  actorId: EntityId;
  before?: unknown;
  after?: unknown;
  createdAt: ISODateString;
}

export interface User {
  userId: EntityId;
  displayName: string;
  role: WmsRole;
  permissions: WmsPermission[];
  isActive: boolean;
}

export interface ImportBatch {
  importBatchId: EntityId;
  schemaVersion: typeof WMS_SCHEMA_VERSION;
  sourceType: ImportSourceType;
  sourceFileName: string;
  sourceFileHash: string;
  rowCount: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  duplicateCount: number;
  createdAt: ISODateString;
}
