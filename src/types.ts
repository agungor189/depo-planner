export type UnitPreference = 'm' | 'cm';

export type ObjectType =
  | 'rack'
  | 'column'
  | 'packing'
  | 'path'
  | 'door'
  | 'shipping'
  | 'receiving'
  | 'safety'
  | 'note';

export type ViewMode = '2D' | '3D' | 'ISO' | 'TOP';

export type ProductGroup =
  | 'Alüminyum'
  | 'Döküm'
  | 'Karbon Çelik'
  | 'PPR'
  | 'Karışık'
  | 'Diğer';

export type LocationFormat = 'standard' | 'padded' | 'verbose' | 'slash';

export interface WarehouseConfig {
  name: string;
  width: number;
  length: number;
  height: number;
}

export interface GridSettings {
  size: number;
  snap: boolean;
  snapSize: number;
  showGrid: boolean;
  showWalls: boolean;
  showMeasurements: boolean;
  showAccessZones: boolean;
  minimumAisleWidth: number;
}

export interface LocationCodeSettings {
  format: LocationFormat;
  shelfPrefix: string;
  binPrefix: string;
  separator: string;
  qrPrefix: 'LOC' | 'DSDST';
}

export interface BaseObject {
  id: string;
  type: ObjectType;
  name: string;
  x: number;
  z: number;
  rotation: number;
  width: number;
  depth: number;
  height: number;
  color: string;
  note: string;
  locked: boolean;
  visible: boolean;
}

export interface Rack extends BaseObject {
  type: 'rack';
  rackGroup: string;
  rackNumber: number;
  rackCode: string;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  shelfCount: number;
  binsPerShelf: number;
  positionsPerShelf: number;
  defaultLocationCapacity: number;
  depthSlots: number;
  stackLevels: number;
  orientation: 'horizontal' | 'vertical';
  productGroup: ProductGroup;
  productCategory: ProductGroup;
  showDimensions: boolean;
}

export interface Column extends BaseObject {
  type: 'column';
}

export interface PackingArea extends BaseObject {
  type: 'packing';
  tableHeight: number;
}

export interface Path extends BaseObject {
  type: 'path';
  striped: boolean;
}

export interface Door extends BaseObject {
  type: 'door';
  wall: 'north' | 'south' | 'east' | 'west';
  direction: 'in' | 'out' | 'both';
}

export interface ShippingArea extends BaseObject {
  type: 'shipping';
}

export interface ReceivingArea extends BaseObject {
  type: 'receiving';
}

export interface SafetyArea extends BaseObject {
  type: 'safety';
}

export interface NoteObject extends BaseObject {
  type: 'note';
  text: string;
}

export type WarehouseObject =
  | Rack
  | Column
  | PackingArea
  | Path
  | Door
  | ShippingArea
  | ReceivingArea
  | SafetyArea
  | NoteObject;

export type WarehouseObjectNoId =
  | Omit<Rack, 'id'>
  | Omit<Column, 'id'>
  | Omit<PackingArea, 'id'>
  | Omit<Path, 'id'>
  | Omit<Door, 'id'>
  | Omit<ShippingArea, 'id'>
  | Omit<ReceivingArea, 'id'>
  | Omit<SafetyArea, 'id'>
  | Omit<NoteObject, 'id'>;

export interface LocationCode {
  locationCode: string;
  rackGroup: string;
  rackNumber: number;
  rackCode: string;
  shelfCode: string;
  binCode: string;
  shelfNumber: number;
  binNumber: number;
  positionNumber: number;
  rackName: string;
  productGroup: ProductGroup;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  note: string;
  capacityPackages: number;
  currentPackages: number;
  sku: string;
  productName: string;
  category: ProductGroup;
  supplierCode: string;
  packageQuantity: number;
  totalItemQuantity: number;
  packageIds: string;
  boxWidthCm: number;
  boxDepthCm: number;
  boxHeightCm: number;
  weightKg: number;
  packages: PackageRecord[];
  qrContent: string;
  productQrContent: string;
}

export interface PackageRecord {
  packageId: string;
  sku: string;
  productName: string;
  supplierCode: string;
  category: ProductGroup;
  packageIndex: number;
  totalPackages: number;
  quantityInsidePackage: number;
  boxWidthCm: number;
  boxDepthCm: number;
  boxHeightCm: number;
  weightKg: number;
  locationCode: string;
  status: string;
  createdAt: string;
}

export interface PackagePlacement {
  locationCode: string;
  rackCode: string;
  placedAt: string;
}

export interface WarehouseImportedPackage {
  packageId: string;
  labelIndex: number;
  status: 'unplaced' | 'placed';
  placement: PackagePlacement | null;
  sku: string;
  productCode: string;
  productName: string;
  material: string;
  type: string;
  dimensionsLabel: string;
  lot: string;
  packageNo: string;
  totalPackages: string;
  quantityPerPackage: string;
  productWeight: string;
  boxWeight: string;
  stockCount: string;
  locationHint: string;
  note: string;
  printQty: number;
  sourceProductId: string;
  searchText: string;
  importedAt: string;
  category: ProductGroup;
  boxWidthCm: number;
  boxDepthCm: number;
  boxHeightCm: number;
  weightKg: number;
  quantityInsidePackage: number;
}

export interface WarehousePackagesExport {
  schemaVersion: 'label-printer.packages.v1';
  exportedAt: string;
  exportMode: 'all' | 'selected' | 'filtered' | string;
  source: {
    app: string;
    fileName: string;
  };
  summary: {
    packageCount: number;
    productCount: number;
    skuCount: number;
  };
  packages: Array<Partial<WarehouseImportedPackage> & Record<string, unknown>>;
}

export interface PackageImportResult {
  success: boolean;
  added: number;
  skipped: number;
  updated: number;
  message: string;
  error?: string;
}

export interface ProductItem {
  id: string;
  sku: string;
  productName: string;
  supplierCode: string;
  category: ProductGroup;
  packageCount: number;
  quantityInsidePackage: number;
  boxWidthCm: number;
  boxDepthCm: number;
  boxHeightCm: number;
  weightKg: number;
  note: string;
  packages?: PackageRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface LocationCapacityOverride {
  locationCode: string;
  capacityPackages: number;
  note?: string;
}

export interface LocationStock {
  locationCode: string;
  rackCode: string;
  shelfNumber: number;
  positionNumber: number;
  capacityPackages: number;
  currentPackages: number;
  sku: string;
  productName: string;
  category: ProductGroup;
  supplierCode: string;
  lot: string;
  note: string;
  quantityInsidePackage: number;
  boxWidthCm: number;
  boxDepthCm: number;
  boxHeightCm: number;
  weightKg: number;
  packages?: PackageRecord[];
}

export interface LayoutWarning {
  id: string;
  severity: 'info' | 'warning' | 'error';
  objectIds: string[];
  message: string;
}

export interface AreaUsage {
  totalWarehouseArea: number;
  usedArea: number;
  rackArea: number;
  packingArea: number;
  pathArea: number;
  freeArea: number;
  utilizationPercent: number;
  rackCount: number;
  totalLocationCount: number;
  packingAreaCount: number;
  columnCount: number;
  totalPackageCapacity: number;
  filledPackageCount: number;
  freePackageCapacity: number;
  packageUtilizationPercent: number;
  totalSkuCount: number;
  categoryPackageCounts: Record<string, number>;
}

export interface WarehousePlan {
  version: number;
  id: string;
  name: string;
  warehouseConfig: WarehouseConfig;
  unitPreference: UnitPreference;
  gridSettings: GridSettings;
  objects: WarehouseObject[];
  products: ProductItem[];
  locationStocks: LocationStock[];
  importedPackages: WarehouseImportedPackage[];
  locationCapacityOverrides: LocationCapacityOverride[];
  locationCodeSettings: LocationCodeSettings;
  createdAt: string;
  updatedAt: string;
}

export interface PlanSummary {
  id: string;
  name: string;
  updatedAt: string;
}
