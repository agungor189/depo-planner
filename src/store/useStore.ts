import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  GridSettings,
  LayoutWarning,
  LocationCapacityOverride,
  LocationCode,
  LocationCodeSettings,
  LocationStock,
  PackageRecord,
  PackageImportResult,
  PackagePlacement,
  PlanSummary,
  ProductItem,
  ProductGroup,
  Rack,
  UnitPreference,
  ViewMode,
  WarehouseConfig,
  WarehouseImportedPackage,
  WarehouseObject,
  WarehouseObjectNoId,
  WarehousePackagesExport,
  WarehousePlan,
} from '../types';
import {
  APP_VERSION,
  DEFAULT_GRID_SETTINGS,
  DEFAULT_LOCATION_SETTINGS,
  DEFAULT_WAREHOUSE_CONFIG,
  DEFAULT_LOCATION_CAPACITY,
  calculateAreaUsage,
  buildRackCode,
  clampObjectToWarehouse,
  ensureUniqueRackIdentity,
  generateAllLocationCodes,
  generateLocationCodes as generateRackLocationCodes,
  getLocationCapacity,
  getRackDefaultLocationCapacity,
  getNextRackIdentity,
  getNextRackNumber,
  getRackPositionCount,
  locationsToCsv,
  normalizeRackGroup,
  parseRackCode,
  racksToCsv,
  roundMeters,
  summaryToCsv,
  validateLayout as validateObjects,
} from '../utils/warehouse';

const STORAGE_KEY = 'dsdst-warehouse-planner-v2';
const LEGACY_STORAGE_KEY = 'dsdst-warehouse-data';
const SHARED_STATE_ENDPOINT = '/api/warehouse-state';

interface PersistedData {
  activePlanId: string | null;
  plans: WarehousePlan[];
}

interface StoreState {
  version: number;
  warehouseConfig: WarehouseConfig;
  warehouse: WarehouseConfig;
  unitPreference: UnitPreference;
  gridSettings: GridSettings;
  locationCodeSettings: LocationCodeSettings;
  objects: WarehouseObject[];
  products: ProductItem[];
  locationStocks: LocationStock[];
  importedPackages: WarehouseImportedPackage[];
  locationCapacityOverrides: LocationCapacityOverride[];
  selectedLocationCode: string | null;
  selectedPackageId: string | null;
  packageSearchQuery: string;
  highlightedPackageIds: string[];
  focusedLocationCode: string | null;
  activeRackWorkspaceId: string | null;
  selectedId: string | null;
  viewMode: ViewMode;
  plans: PlanSummary[];
  activePlanId: string | null;
  hasActivePlan: boolean;
  warnings: LayoutWarning[];
  saveStatus: string;
  sharedSyncStatus: string;
  placementStatus: string;
  packagePlacementStatus: string | null;

  loadSharedState: () => Promise<void>;
  createEmptyPlan: (config: WarehouseConfig, unitPreference: UnitPreference) => void;
  loadSamplePlan: () => void;
  resetPlan: () => void;
  duplicatePlan: () => void;
  deletePlan: (planId: string) => void;
  setActivePlan: (planId: string) => void;
  updateWarehouseConfig: (updates: Partial<WarehouseConfig>, scaleObjects?: boolean) => void;
  setWarehouseSize: (width: number, length: number, height: number) => void;
  setUnitPreference: (unit: UnitPreference) => void;
  setGridSize: (size: number) => void;
  updateGridSettings: (updates: Partial<GridSettings>) => void;
  updateLocationCodeSettings: (updates: Partial<LocationCodeSettings>) => void;
  addProduct: (product: Omit<ProductItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProduct: (id: string, updates: Partial<ProductItem>) => void;
  deleteProduct: (id: string) => void;
  autoPlaceProduct: (productId: string, packageCount?: number) => void;
  placeProductInLocation: (productId: string, locationCode: string, packageCount: number) => void;
  adjustLocationPackages: (locationCode: string, delta: number) => void;
  clearLocation: (locationCode: string) => void;
  moveLocationStock: (fromLocationCode: string, toLocationCode: string) => void;
  setLocationCapacity: (locationCode: string, capacityPackages: number) => void;
  applyRackCapacity: (rackId: string, mode: 'all' | 'empty' | 'preserve') => void;
  importPackageManifest: (csvString: string) => boolean;
  importPackagesExport: (jsonText: string) => PackageImportResult;
  addManualPackage: (packageData: Partial<WarehouseImportedPackage>) => void;
  selectPackage: (packageId: string | null) => void;
  setPackageSearchQuery: (query: string) => void;
  placeImportedPackage: (packageId: string, locationCode: string) => void;
  unplaceImportedPackage: (packageId: string) => void;
  unplaceImportedPackages: (packageIds: string[]) => void;
  deleteImportedPackages: (packageIds: string[]) => void;
  focusPackage: (packageId: string) => void;
  clearPackageHighlights: () => void;
  selectLocation: (locationCode: string | null) => void;
  openRackWorkspace: (rackId: string) => void;
  closeRackWorkspace: () => void;
  addObject: (obj: WarehouseObjectNoId) => void;
  addRackGroup: (options: {
    rackGroup: string;
    count: number;
    shelfCount: number;
    positionsPerShelf: number;
    defaultLocationCapacity: number;
    depthSlots: number;
    stackLevels: number;
    width: number;
    depth: number;
    height: number;
    productGroup: ProductGroup;
    note: string;
  }) => void;
  updateObject: (id: string, updates: Partial<WarehouseObject>) => void;
  deleteObject: (id: string) => void;
  removeObject: (id: string) => void;
  duplicateObject: (id: string) => void;
  selectObject: (id: string | null) => void;
  setSelectedId: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  exportJSON: () => string;
  importJSON: (jsonString: string) => boolean;
  importData: (jsonString: string) => void;
  exportLocationsCSV: () => string;
  exportRacksCSV: () => string;
  exportSummaryCSV: () => string;
  generateLocationCodes: (rackId?: string) => LocationCode[];
  validateLayout: () => LayoutWarning[];
  loadInitialData: () => void;
  clearAll: () => void;
}

const generateId = () => uuidv4();
const now = () => new Date().toISOString();

const objectColors: Record<WarehouseObject['type'], string> = {
  rack: '#2563eb',
  column: '#64748b',
  packing: '#f97316',
  path: '#94a3b8',
  door: '#38bdf8',
  shipping: '#f59e0b',
  receiving: '#10b981',
  safety: '#ef4444',
  note: '#eab308',
};

function planSummaries(plans: WarehousePlan[]): PlanSummary[] {
  return plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    updatedAt: plan.updatedAt,
  }));
}

let sharedSaveTimer: number | undefined;
let pendingSharedData: PersistedData | null = null;
let sharedStatusListener: ((status: string) => void) | null = null;

function safeLocalStorageGet(key: string) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn('Yerel kayıt yazılamadı', error);
  }
}

async function writeSharedData(data: PersistedData) {
  const response = await fetch(SHARED_STATE_ENDPOINT, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Ortak kayıt başarısız: ${response.status}`);
  }
}

function scheduleSharedPersist(data: PersistedData) {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  pendingSharedData = data;
  window.clearTimeout(sharedSaveTimer);
  sharedSaveTimer = window.setTimeout(() => {
    const current = pendingSharedData;
    pendingSharedData = null;
    if (!current) return;
    writeSharedData(current)
      .then(() => sharedStatusListener?.('Ortak kayıt güncel'))
      .catch((error) => {
        console.warn('Ortak depo planı kaydedilemedi', error);
        sharedStatusListener?.('Ortak kayıt hatası');
      });
  }, 300);
}

function persist(data: PersistedData, syncShared = true) {
  safeLocalStorageSet(STORAGE_KEY, JSON.stringify(data));
  if (syncShared) scheduleSharedPersist(data);
}

function normalizeWarehouseConfig(raw?: Partial<WarehouseConfig>): WarehouseConfig {
  return {
    name: raw?.name || DEFAULT_WAREHOUSE_CONFIG.name,
    width: Math.max(0.1, Number(raw?.width ?? DEFAULT_WAREHOUSE_CONFIG.width)),
    length: Math.max(0.1, Number(raw?.length ?? DEFAULT_WAREHOUSE_CONFIG.length)),
    height: Math.max(0.1, Number(raw?.height ?? DEFAULT_WAREHOUSE_CONFIG.height)),
  };
}

function normalizeLocationCodeSettings(raw?: Partial<LocationCodeSettings>): LocationCodeSettings {
  return {
    ...DEFAULT_LOCATION_SETTINGS,
    format: 'standard',
    shelfPrefix: 'K',
    binPrefix: 'P',
    separator: '-',
    qrPrefix: raw?.qrPrefix || DEFAULT_LOCATION_SETTINGS.qrPrefix,
  };
}

const validProductGroups: ProductGroup[] = ['Alüminyum', 'Döküm', 'Karbon Çelik', 'PPR', 'Karışık', 'Diğer'];

function normalizeProductGroup(value?: string): ProductGroup {
  if (validProductGroups.includes(value as ProductGroup)) return value as ProductGroup;
  const text = String(value || '').toLocaleLowerCase('tr-TR');
  if (text.includes('alüminyum') || text.includes('aluminyum') || text.includes('aluminum')) return 'Alüminyum';
  if (text.includes('döküm') || text.includes('dokum')) return 'Döküm';
  if (text.includes('karbon') || text.includes('çelik') || text.includes('celik')) return 'Karbon Çelik';
  if (text.includes('ppr')) return 'PPR';
  if (text.includes('karışık') || text.includes('karisik')) return 'Karışık';
  return 'Diğer';
}

function normalizeSku(value?: string): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-');
}

function parseLocationCode(value: string) {
  const match = String(value || '').trim().toUpperCase().match(/^([A-Z0-9]+)-K(\d+)-P(\d+)$/);
  if (!match) return null;
  return {
    rackCode: match[1],
    shelfNumber: Math.max(1, Number(match[2])),
    positionNumber: Math.max(1, Number(match[3])),
  };
}

function looseNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const cleaned = String(value ?? '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDimensionsLabel(value: unknown) {
  const numbers = String(value || '')
    .replace(',', '.')
    .match(/\d+(?:\.\d+)?/g)
    ?.map(Number)
    .filter((item) => Number.isFinite(item)) || [];

  return {
    boxWidthCm: Math.max(0, numbers[0] || 36),
    boxDepthCm: Math.max(0, numbers[1] || 25),
    boxHeightCm: Math.max(0, numbers[2] || 25),
  };
}

function packageSearchHaystack(item: WarehouseImportedPackage): string {
  return [
    item.packageId,
    item.sku,
    item.productCode,
    item.productName,
    item.material,
    item.type,
    item.dimensionsLabel,
    item.lot,
    item.packageNo,
    item.placement?.locationCode || '',
    item.locationHint,
    item.searchText,
  ]
    .join(' ')
    .toLocaleLowerCase('tr-TR');
}

function packageMatchesQuery(item: WarehouseImportedPackage, query: string): boolean {
  const normalized = query.trim().toLocaleLowerCase('tr-TR');
  if (!normalized) return true;
  return packageSearchHaystack(item).includes(normalized);
}

function normalizeImportedPackage(
  raw: Partial<WarehouseImportedPackage> & Record<string, unknown>,
  importedAt = now(),
  forceUnplaced = false,
): WarehouseImportedPackage | null {
  const packageId = String(raw.packageId || '').trim();
  if (!packageId) return null;
  const dimensions = parseDimensionsLabel(raw.dimensionsLabel);
  const category = normalizeProductGroup(String(raw.material || raw.category || raw.type || ''));
  const sku = normalizeSku(String(raw.sku || raw.productCode || packageId));
  const locationCode = String(raw.placement && typeof raw.placement === 'object'
    ? (raw.placement as PackagePlacement).locationCode || ''
    : '').trim().toUpperCase();
  const placement = !forceUnplaced && raw.status === 'placed' && parseLocationCode(locationCode)
    ? {
        locationCode,
        rackCode: parseLocationCode(locationCode)?.rackCode || '',
        placedAt: (raw.placement as PackagePlacement | null)?.placedAt || importedAt,
      }
    : null;
  const status: WarehouseImportedPackage['status'] = placement ? 'placed' : 'unplaced';
  const quantityInsidePackage = Math.max(0, Math.floor(looseNumber(raw.quantityPerPackage, looseNumber(raw.quantityInsidePackage, 0))));
  const boxWidthCm = Math.max(0, looseNumber(raw.boxWidthCm, dimensions.boxWidthCm));
  const boxDepthCm = Math.max(0, looseNumber(raw.boxDepthCm, dimensions.boxDepthCm));
  const boxHeightCm = Math.max(0, looseNumber(raw.boxHeightCm, dimensions.boxHeightCm));
  const weightKg = Math.max(0, looseNumber(raw.boxWeight, looseNumber(raw.productWeight, looseNumber(raw.weightKg, 0))));

  const normalized: WarehouseImportedPackage = {
    packageId,
    labelIndex: Math.max(1, Math.floor(looseNumber(raw.labelIndex, 1))),
    status,
    placement,
    sku,
    productCode: String(raw.productCode || sku || ''),
    productName: String(raw.productName || sku || packageId),
    material: String(raw.material || ''),
    type: String(raw.type || ''),
    dimensionsLabel: String(raw.dimensionsLabel || `${boxWidthCm} x ${boxDepthCm} x ${boxHeightCm} cm`),
    lot: String(raw.lot || ''),
    packageNo: String(raw.packageNo || raw.packageIndex || ''),
    totalPackages: String(raw.totalPackages || ''),
    quantityPerPackage: String(raw.quantityPerPackage || quantityInsidePackage || ''),
    productWeight: String(raw.productWeight || ''),
    boxWeight: String(raw.boxWeight || weightKg || ''),
    stockCount: String(raw.stockCount || ''),
    locationHint: String(raw.locationHint || ''),
    note: String(raw.note || ''),
    printQty: Math.max(1, Math.floor(looseNumber(raw.printQty, 1))),
    sourceProductId: String(raw.sourceProductId || ''),
    searchText: String(raw.searchText || ''),
    importedAt: String(raw.importedAt || importedAt),
    category,
    boxWidthCm,
    boxDepthCm,
    boxHeightCm,
    weightKg,
    quantityInsidePackage,
  };

  normalized.searchText = normalized.searchText || packageSearchHaystack(normalized);
  return normalized;
}

function packageRecordFromImported(item: WarehouseImportedPackage, locationCode: string): PackageRecord {
  return {
    packageId: item.packageId,
    sku: item.sku,
    productName: item.productName,
    supplierCode: item.productCode || item.sku,
    category: item.category,
    packageIndex: Math.max(1, Math.floor(looseNumber(item.packageNo, item.labelIndex || 1))),
    totalPackages: Math.max(1, Math.floor(looseNumber(item.totalPackages, item.labelIndex || 1))),
    quantityInsidePackage: item.quantityInsidePackage,
    boxWidthCm: item.boxWidthCm,
    boxDepthCm: item.boxDepthCm,
    boxHeightCm: item.boxHeightCm,
    weightKg: item.weightKg,
    material: item.material,
    type: item.type,
    dimensionsLabel: item.dimensionsLabel || `${item.boxWidthCm} x ${item.boxDepthCm} x ${item.boxHeightCm} cm`,
    locationCode,
    status: 'placed',
    createdAt: now(),
  };
}

function normalizeProduct(raw: Partial<ProductItem>): ProductItem {
  const timestamp = now();
  const sku = normalizeSku(raw.sku);
  const legacy = raw as Partial<ProductItem> & {
    packageWidthCm?: number;
    packageDepthCm?: number;
    packageHeightCm?: number;
  };
  const packages = Array.isArray(raw.packages)
    ? raw.packages.map((item) => normalizePackageRecord(item, sku || normalizeSku(item.sku))).filter(Boolean) as PackageRecord[]
    : undefined;
  return {
    id: raw.id || generateId(),
    sku: sku || 'SKU-YENI',
    productName: raw.productName || raw.sku || 'Yeni Ürün',
    supplierCode: raw.supplierCode || sku || '',
    category: normalizeProductGroup(raw.category),
    packageCount: Math.max(0, Math.floor(Number(raw.packageCount ?? packages?.length ?? 1))),
    quantityInsidePackage: Math.max(0, Math.floor(Number(raw.quantityInsidePackage ?? 1))),
    boxWidthCm: Math.max(0, Number(raw.boxWidthCm ?? legacy.packageWidthCm ?? 36)),
    boxDepthCm: Math.max(0, Number(raw.boxDepthCm ?? legacy.packageDepthCm ?? 25)),
    boxHeightCm: Math.max(0, Number(raw.boxHeightCm ?? legacy.packageHeightCm ?? 25)),
    weightKg: Math.max(0, Number(raw.weightKg ?? 0)),
    note: raw.note || '',
    packages,
    createdAt: raw.createdAt || timestamp,
    updatedAt: raw.updatedAt || timestamp,
  };
}

function normalizePackageRecord(raw: Partial<PackageRecord>, fallbackSku?: string): PackageRecord | null {
  const sku = normalizeSku(raw.sku || fallbackSku);
  if (!sku) return null;
  return {
    packageId: raw.packageId || `PKG-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${sku}-${generateId().slice(0, 8)}`,
    sku,
    productName: raw.productName || '',
    supplierCode: raw.supplierCode || sku,
    category: normalizeProductGroup(raw.category),
    packageIndex: Math.max(1, Math.floor(Number(raw.packageIndex || 1))),
    totalPackages: Math.max(1, Math.floor(Number(raw.totalPackages || 1))),
    quantityInsidePackage: Math.max(0, Math.floor(Number(raw.quantityInsidePackage || 0))),
    boxWidthCm: Math.max(0, Number(raw.boxWidthCm || 36)),
    boxDepthCm: Math.max(0, Number(raw.boxDepthCm || 25)),
    boxHeightCm: Math.max(0, Number(raw.boxHeightCm || 25)),
    weightKg: Math.max(0, Number(raw.weightKg || 0)),
    material: raw.material || '',
    type: raw.type || '',
    dimensionsLabel: raw.dimensionsLabel || '',
    locationCode: raw.locationCode || '',
    status: raw.status || 'pending',
    createdAt: raw.createdAt || now(),
  };
}

function createPackageRecords(product: ProductItem, count: number, locationCode: string, startIndex = 0): PackageRecord[] {
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  return Array.from({ length: safeCount }, (_, index) => {
    const packageIndex = startIndex + index + 1;
    return {
      packageId: `PKG-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${product.sku.replace(/[^A-Z0-9]/g, '')}-${String(packageIndex).padStart(3, '0')}`,
      sku: product.sku,
      productName: product.productName,
      supplierCode: product.supplierCode,
      category: product.category,
      packageIndex,
      totalPackages: Math.max(product.packageCount, packageIndex),
      quantityInsidePackage: product.quantityInsidePackage,
      boxWidthCm: product.boxWidthCm,
      boxDepthCm: product.boxDepthCm,
      boxHeightCm: product.boxHeightCm,
      weightKg: product.weightKg,
      material: product.category,
      type: product.category,
      dimensionsLabel: `${product.boxWidthCm} x ${product.boxDepthCm} x ${product.boxHeightCm} cm`,
      locationCode,
      status: 'placed',
      createdAt: now(),
    };
  });
}

function normalizeLocationStock(raw: Partial<LocationStock>): LocationStock | null {
  const parsed = parseLocationCode(String(raw.locationCode || ''));
  if (!parsed) return null;
  const packages = Array.isArray(raw.packages)
    ? raw.packages.map((item) => normalizePackageRecord(item, raw.sku)).filter(Boolean) as PackageRecord[]
    : [];
  const capacityPackages = Math.max(1, Math.floor(Number(raw.capacityPackages || DEFAULT_LOCATION_CAPACITY)));
  const currentPackages = Math.min(
    Math.max(0, Math.floor(Number(raw.currentPackages ?? packages.length ?? 0))),
    capacityPackages,
  );
  if (currentPackages <= 0) return null;

  return {
    locationCode: String(raw.locationCode).trim().toUpperCase(),
    rackCode: raw.rackCode || parsed.rackCode,
    shelfNumber: Number(raw.shelfNumber || parsed.shelfNumber),
    positionNumber: Number(raw.positionNumber || parsed.positionNumber),
    capacityPackages,
    currentPackages,
    sku: normalizeSku(raw.sku),
    productName: raw.productName || '',
    category: normalizeProductGroup(raw.category),
    supplierCode: raw.supplierCode || normalizeSku(raw.sku),
    lot: raw.lot || '',
    note: raw.note || '',
    quantityInsidePackage: Math.max(0, Math.floor(Number(raw.quantityInsidePackage || 0))),
    boxWidthCm: Math.max(0, Number(raw.boxWidthCm ?? packages[0]?.boxWidthCm ?? 36)),
    boxDepthCm: Math.max(0, Number(raw.boxDepthCm ?? packages[0]?.boxDepthCm ?? 25)),
    boxHeightCm: Math.max(0, Number(raw.boxHeightCm ?? packages[0]?.boxHeightCm ?? 25)),
    weightKg: Math.max(0, Number(raw.weightKg ?? packages[0]?.weightKg ?? 0)),
    packages: packages.length ? packages : undefined,
  };
}

function makeLocationStock(product: ProductItem, location: LocationCode, packageCount: number): LocationStock {
  return {
    locationCode: location.locationCode,
    rackCode: location.rackCode,
    shelfNumber: location.shelfNumber,
    positionNumber: location.positionNumber,
    capacityPackages: location.capacityPackages,
    currentPackages: Math.min(Math.max(0, Math.floor(packageCount)), location.capacityPackages),
    sku: product.sku,
    productName: product.productName,
    category: product.category,
    supplierCode: product.supplierCode,
    lot: '',
    note: '',
    quantityInsidePackage: product.quantityInsidePackage,
    boxWidthCm: product.boxWidthCm,
    boxDepthCm: product.boxDepthCm,
    boxHeightCm: product.boxHeightCm,
    weightKg: product.weightKg,
    packages: createPackageRecords(product, Math.min(Math.max(0, Math.floor(packageCount)), location.capacityPackages), location.locationCode),
  };
}

function makeLocationStockFromImported(item: WarehouseImportedPackage, location: LocationCode): LocationStock {
  const record = packageRecordFromImported(item, location.locationCode);
  return {
    locationCode: location.locationCode,
    rackCode: location.rackCode,
    shelfNumber: location.shelfNumber,
    positionNumber: location.positionNumber,
    capacityPackages: location.capacityPackages,
    currentPackages: 1,
    sku: item.sku,
    productName: item.productName,
    category: item.category,
    supplierCode: item.productCode || item.sku,
    lot: item.lot,
    note: item.note,
    quantityInsidePackage: item.quantityInsidePackage,
    boxWidthCm: item.boxWidthCm,
    boxDepthCm: item.boxDepthCm,
    boxHeightCm: item.boxHeightCm,
    weightKg: item.weightKg,
    packages: [record],
  };
}

function addImportedPackageToStock(stock: LocationStock, item: WarehouseImportedPackage, locationCode: string): LocationStock {
  const packages = stock.packages || [];
  if (packages.some((entry) => entry.packageId === item.packageId)) return stock;
  const nextPackages = [...packages, packageRecordFromImported(item, locationCode)].slice(0, stock.capacityPackages);
  return {
    ...stock,
    sku: item.sku,
    productName: item.productName,
    category: item.category,
    supplierCode: item.productCode || item.sku,
    lot: item.lot || stock.lot,
    note: item.note || stock.note,
    quantityInsidePackage: item.quantityInsidePackage,
    boxWidthCm: item.boxWidthCm,
    boxDepthCm: item.boxDepthCm,
    boxHeightCm: item.boxHeightCm,
    weightKg: item.weightKg,
    currentPackages: Math.min(stock.capacityPackages, Math.max(stock.currentPackages + 1, nextPackages.length)),
    packages: nextPackages,
  };
}

function mergeStockWithProduct(stock: LocationStock, product: ProductItem, packageCount: number): LocationStock {
  const amount = Math.min(stock.capacityPackages - stock.currentPackages, Math.max(0, Math.floor(packageCount)));
  const existingPackages = stock.packages || [];
  return {
    ...stock,
    currentPackages: Math.min(stock.capacityPackages, stock.currentPackages + amount),
    sku: product.sku,
    productName: product.productName,
    category: product.category,
    supplierCode: product.supplierCode,
    quantityInsidePackage: product.quantityInsidePackage,
    boxWidthCm: product.boxWidthCm,
    boxDepthCm: product.boxDepthCm,
    boxHeightCm: product.boxHeightCm,
    weightKg: product.weightKg,
    packages: [
      ...existingPackages,
      ...createPackageRecords(product, amount, stock.locationCode, existingPackages.length),
    ],
  };
}

function parseDelimitedRows(input: string): Record<string, string>[] {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  const parseLine = (line: string) => {
    const cells: string[] = [];
    let current = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const headers = parseLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
  });
}

function packageFromManifestRow(row: Record<string, string>): PackageRecord | null {
  return normalizePackageRecord({
    packageId: row.packageId,
    sku: row.sku,
    productName: row.productName,
    supplierCode: row.supplierCode,
    category: row.category as ProductGroup,
    packageIndex: Number(row.packageIndex || 1),
    totalPackages: Number(row.totalPackages || 1),
    quantityInsidePackage: Number(row.quantityInsidePackage || 0),
    boxWidthCm: Number(row.boxWidthCm || 36),
    boxDepthCm: Number(row.boxDepthCm || 25),
    boxHeightCm: Number(row.boxHeightCm || 25),
    weightKg: Number(row.weightKg || 0),
    locationCode: row.locationCode,
    status: row.status || 'pending',
  });
}

function productsFromPackages(packages: PackageRecord[]): ProductItem[] {
  const bySku = new Map<string, PackageRecord[]>();
  packages.forEach((item) => {
    bySku.set(item.sku, [...(bySku.get(item.sku) || []), item]);
  });

  return Array.from(bySku.entries()).map(([sku, items]) => {
    const first = items[0];
    return normalizeProduct({
      sku,
      productName: first.productName || sku,
      supplierCode: first.supplierCode || sku,
      category: first.category,
      packageCount: items.length,
      quantityInsidePackage: first.quantityInsidePackage,
      boxWidthCm: first.boxWidthCm,
      boxDepthCm: first.boxDepthCm,
      boxHeightCm: first.boxHeightCm,
      weightKg: first.weightKg,
      packages: items,
    });
  });
}

function objectDefaults(type: WarehouseObject['type'], objects: WarehouseObject[]): WarehouseObjectNoId {
  const base = {
    name: '',
    x: 0.25,
    z: 0.25,
    rotation: 0,
    width: 1,
    depth: 1,
    height: 1,
    color: objectColors[type],
    note: '',
    locked: false,
    visible: true,
  };

  if (type === 'rack') {
    const identity = getNextRackIdentity(objects, 'A');
    return {
      ...base,
      type,
      name: `${identity.rackCode} Rafı`,
      width: 1.8,
      depth: 0.6,
      height: 1.8,
      widthCm: 180,
      depthCm: 60,
      heightCm: 180,
      rackGroup: identity.rackGroup,
      rackNumber: identity.rackNumber,
      rackCode: identity.rackCode,
      shelfCount: 4,
      binsPerShelf: 7,
      positionsPerShelf: 7,
      defaultLocationCapacity: DEFAULT_LOCATION_CAPACITY,
      depthSlots: 2,
      stackLevels: 1,
      orientation: 'horizontal',
      productGroup: 'Karışık' as ProductGroup,
      productCategory: 'Karışık' as ProductGroup,
      showDimensions: true,
    };
  }

  if (type === 'column') {
    return { ...base, type, name: 'Kolon', width: 0.35, depth: 0.35, height: 3, color: '#64748b' };
  }

  if (type === 'packing') {
    return {
      ...base,
      type,
      name: 'Paketleme',
      width: 2.4,
      depth: 1.2,
      height: 0.9,
      tableHeight: 0.9,
      color: '#f97316',
    };
  }

  if (type === 'path') {
    return {
      ...base,
      type,
      name: 'Yürüme Yolu',
      width: 3,
      depth: 0.8,
      height: 0.04,
      striped: true,
      color: '#94a3b8',
    };
  }

  if (type === 'door') {
    return {
      ...base,
      type,
      name: 'Kapı',
      x: 1,
      z: 0,
      width: 1.2,
      depth: 0.12,
      height: 2.2,
      wall: 'south',
      direction: 'both',
      color: '#38bdf8',
    };
  }

  if (type === 'shipping') {
    return { ...base, type, name: 'Sevkiyat', width: 1.4, depth: 1.2, height: 0.08, color: '#f59e0b' };
  }

  if (type === 'receiving') {
    return { ...base, type, name: 'Mal Kabul', width: 1.4, depth: 1.2, height: 0.08, color: '#10b981' };
  }

  if (type === 'safety') {
    return { ...base, type, name: 'Boş Güvenlik Alanı', width: 1.2, depth: 1.2, height: 0.05, color: '#ef4444' };
  }

  return {
    ...base,
    type: 'note',
    name: 'Not',
    width: 1.2,
    depth: 0.6,
    height: 0.05,
    text: 'Not',
    color: '#eab308',
  };
}

function normalizeObject(
  raw: Partial<WarehouseObject> & { type: WarehouseObject['type'] },
  warehouseConfig: WarehouseConfig,
  objects: WarehouseObject[],
  legacyCentered = false,
): WarehouseObject {
  const defaults = objectDefaults(raw.type, objects) as WarehouseObjectNoId;
  const id = raw.id || generateId();
  const width = Math.max(0.01, Number(raw.width ?? defaults.width));
  const depth = Math.max(0.01, Number(raw.depth ?? defaults.depth));
  const height = Math.max(0.01, Number(raw.height ?? defaults.height));
  const x = Number(raw.x ?? defaults.x);
  const z = Number(raw.z ?? defaults.z);
  const normalized = {
    ...defaults,
    ...raw,
    id,
    width,
    depth,
    height,
    x: legacyCentered ? x + warehouseConfig.width / 2 - width / 2 : x,
    z: legacyCentered ? z + warehouseConfig.length / 2 - depth / 2 : z,
    rotation: Number(raw.rotation ?? defaults.rotation),
    color: raw.color || defaults.color,
    note: raw.note ?? defaults.note,
    locked: raw.locked ?? defaults.locked,
    visible: raw.visible ?? defaults.visible,
    name: raw.name || defaults.name,
  } as WarehouseObject;

  if (normalized.type === 'rack') {
    const rawRack = raw as Partial<Rack> & { code?: string; shelves?: number };
    const parsed = parseRackCode(rawRack.rackCode || rawRack.code);
    const rackGroup = normalizeRackGroup(rawRack.rackGroup || parsed.rackGroup);
    const rackNumber = Math.max(1, Math.floor(Number(rawRack.rackNumber ?? parsed.rackNumber) || 1));
    const identity = ensureUniqueRackIdentity(
      { id, rackGroup, rackNumber },
      objects,
    );
    normalized.rackGroup = identity.rackGroup;
    normalized.rackNumber = identity.rackNumber;
    normalized.rackCode = identity.rackCode;
    normalized.widthCm = Math.max(1, Number(rawRack.widthCm ?? normalized.width * 100));
    normalized.depthCm = Math.max(1, Number(rawRack.depthCm ?? normalized.depth * 100));
    normalized.heightCm = Math.max(1, Number(rawRack.heightCm ?? normalized.height * 100));
    normalized.width = normalized.widthCm / 100;
    normalized.depth = normalized.depthCm / 100;
    normalized.height = normalized.heightCm / 100;
    normalized.shelfCount = Math.max(1, Math.floor(Number(rawRack.shelfCount ?? rawRack.shelves ?? 4)));
    normalized.positionsPerShelf = Math.max(1, Math.floor(Number(rawRack.positionsPerShelf ?? rawRack.binsPerShelf ?? 7)));
    normalized.binsPerShelf = normalized.positionsPerShelf;
    normalized.depthSlots = Math.max(1, Math.floor(Number(rawRack.depthSlots ?? 2)));
    normalized.stackLevels = Math.max(1, Math.floor(Number(rawRack.stackLevels ?? 1)));
    normalized.defaultLocationCapacity = Math.max(
      1,
      Math.floor(Number(rawRack.defaultLocationCapacity ?? normalized.depthSlots * normalized.stackLevels ?? DEFAULT_LOCATION_CAPACITY)),
    );
    normalized.orientation = normalized.orientation || 'horizontal';
    normalized.productGroup = normalizeProductGroup(normalized.productGroup);
    normalized.productCategory = normalizeProductGroup(rawRack.productCategory || normalized.productGroup);
    normalized.showDimensions = normalized.showDimensions ?? true;
    if (!raw.name) normalized.name = `${normalized.rackCode} Rafı`;
    delete (normalized as Rack & { code?: string }).code;
    delete (normalized as Rack & { shelves?: number }).shelves;
  }

  if (normalized.type === 'packing') {
    normalized.tableHeight = normalized.tableHeight || normalized.height;
  }

  if (normalized.type === 'path') {
    normalized.striped = normalized.striped ?? true;
  }

  if (normalized.type === 'door') {
    normalized.wall = normalized.wall || 'south';
    normalized.direction = normalized.direction || 'both';
  }

  if (normalized.type === 'note') {
    normalized.text = normalized.text || normalized.note || 'Not';
  }

  return clampObjectToWarehouse(normalized, warehouseConfig, DEFAULT_GRID_SETTINGS);
}

function makePlan(
  name: string,
  warehouseConfig: WarehouseConfig,
  objects: WarehouseObject[],
  unitPreference: UnitPreference,
  products: ProductItem[] = [],
  locationStocks: LocationStock[] = [],
  importedPackages: WarehouseImportedPackage[] = [],
  locationCapacityOverrides: LocationCapacityOverride[] = [],
): WarehousePlan {
  const timestamp = now();
  return {
    version: APP_VERSION,
    id: generateId(),
    name,
    warehouseConfig,
    unitPreference,
    gridSettings: { ...DEFAULT_GRID_SETTINGS },
    objects,
    products,
    locationStocks,
    importedPackages,
    locationCapacityOverrides,
    locationCodeSettings: normalizeLocationCodeSettings(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createSampleObjects(): WarehouseObject[] {
  const warehouseConfig = { ...DEFAULT_WAREHOUSE_CONFIG };
  const objects: WarehouseObject[] = [];
  const push = (object: WarehouseObjectNoId) => {
    objects.push(normalizeObject({ ...object, id: generateId() } as WarehouseObject, warehouseConfig, objects));
  };

  [
    ['A', 1, 0.35, 0.45, 'Alüminyum', 2, 2, 1, 7, 4],
    ['A', 2, 3.0, 0.45, 'Alüminyum', 2, 2, 1, 7, 4],
    ['B', 1, 0.35, 2.15, 'Döküm', 1, 1, 1, 5, 3],
    ['C', 1, 3.0, 2.15, 'Karbon Çelik', 4, 2, 2, 7, 4],
    ['C', 2, 0.35, 3.85, 'PPR', 2, 2, 1, 7, 4],
  ].forEach(([rackGroup, rackNumber, x, z, productGroup, capacity, depthSlots, stackLevels, positionsPerShelf, shelfCount]) => {
    const rackCode = buildRackCode(String(rackGroup), Number(rackNumber));
    push({
      ...(objectDefaults('rack', objects) as Omit<WarehouseObject, 'id'>),
      type: 'rack',
      rackGroup: String(rackGroup),
      rackNumber: Number(rackNumber),
      rackCode,
      name: `${rackCode} Rafı`,
      x: Number(x),
      z: Number(z),
      width: 1.8,
      depth: 0.6,
      height: 1.8,
      widthCm: 180,
      depthCm: 60,
      heightCm: 180,
      shelfCount: Number(shelfCount),
      binsPerShelf: Number(positionsPerShelf),
      positionsPerShelf: Number(positionsPerShelf),
      defaultLocationCapacity: Number(capacity),
      depthSlots: Number(depthSlots),
      stackLevels: Number(stackLevels),
      orientation: 'horizontal',
      productGroup: productGroup as ProductGroup,
      productCategory: productGroup as ProductGroup,
      showDimensions: true,
      color: '#2563eb',
    });
  });

  push({
    ...(objectDefaults('column', objects) as Omit<WarehouseObject, 'id'>),
    type: 'column',
    name: 'Kolon 1',
    x: 0.1,
    z: 3.1,
    width: 0.3,
    depth: 0.3,
    height: 3,
  });
  push({
    ...(objectDefaults('column', objects) as Omit<WarehouseObject, 'id'>),
    type: 'column',
    name: 'Kolon 2',
    x: 4.6,
    z: 3.1,
    width: 0.3,
    depth: 0.3,
    height: 3,
  });
  push({
    ...(objectDefaults('packing', objects) as Omit<WarehouseObject, 'id'>),
    type: 'packing',
    x: 0.55,
    z: 6.35,
    width: 2.4,
    depth: 1.1,
    height: 0.9,
    tableHeight: 0.9,
  });
  push({
    ...(objectDefaults('shipping', objects) as Omit<WarehouseObject, 'id'>),
    type: 'shipping',
    x: 3.25,
    z: 6.25,
    width: 1.35,
    depth: 1.25,
  });
  push({
    ...(objectDefaults('path', objects) as Omit<WarehouseObject, 'id'>),
    type: 'path',
    name: 'Ana Koridor',
    x: 0.25,
    z: 1.25,
    width: 4.5,
    depth: 0.8,
    height: 0.04,
    striped: true,
  });
  push({
    ...(objectDefaults('path', objects) as Omit<WarehouseObject, 'id'>),
    type: 'path',
    name: 'Paketleme Yolu',
    x: 2.1,
    z: 2.85,
    width: 0.8,
    depth: 3.3,
    height: 0.04,
    striped: true,
  });
  push({
    ...(objectDefaults('door', objects) as Omit<WarehouseObject, 'id'>),
    type: 'door',
    name: 'Sevkiyat Kapısı',
    wall: 'south',
    direction: 'both',
    x: 3.35,
    z: 0,
    width: 1.2,
    depth: 0.12,
    height: 2.2,
  });

  return objects;
}

function createSampleProducts(): ProductItem[] {
  return [
    normalizeProduct({
      sku: 'AL-125-B',
      productName: '1 İnç 90° Dirsek',
      supplierCode: 'AL-125-B',
      category: 'Alüminyum',
      packageCount: 10,
      quantityInsidePackage: 75,
      boxWidthCm: 36,
      boxDepthCm: 25,
      boxHeightCm: 25,
      weightKg: 8,
    }),
    normalizeProduct({
      sku: 'DK-220-A',
      productName: 'Döküm Flanş',
      supplierCode: 'DK-220-A',
      category: 'Döküm',
      packageCount: 5,
      quantityInsidePackage: 20,
      boxWidthCm: 36,
      boxDepthCm: 25,
      boxHeightCm: 25,
      weightKg: 12,
    }),
  ];
}

function createSampleLocationStocks(objects: WarehouseObject[], products: ProductItem[]): LocationStock[] {
  const locations = generateAllLocationCodes(objects, normalizeLocationCodeSettings());
  const byCode = new Map(locations.map((location) => [location.locationCode, location]));
  const al = products.find((product) => product.sku === 'AL-125-B');
  const dk = products.find((product) => product.sku === 'DK-220-A');
  const stocks: LocationStock[] = [];
  if (al) {
    [['A1-K1-P1', 2], ['A1-K1-P2', 2], ['A1-K1-P3', 2], ['A1-K1-P4', 2], ['A1-K1-P5', 2]].forEach(([code, count]) => {
      const location = byCode.get(String(code));
      if (location) stocks.push(makeLocationStock(al, location, Number(count)));
    });
  }
  if (dk) {
    [['B1-K1-P1', 1], ['B1-K1-P2', 1], ['B1-K1-P3', 1], ['B1-K1-P4', 1], ['B1-K1-P5', 1]].forEach(([code, count]) => {
      const location = byCode.get(String(code));
      if (location) stocks.push(makeLocationStock(dk, location, Number(count)));
    });
  }
  return stocks;
}

function migratePlan(raw: any): WarehousePlan | null {
  if (!raw) return null;

  if (raw.warehouseConfig && Array.isArray(raw.objects)) {
    const warehouseConfig = normalizeWarehouseConfig(raw.warehouseConfig);
    const objects = raw.objects.reduce((list: WarehouseObject[], object: any) => {
      if (!object?.type) return list;
      list.push(normalizeObject(object, warehouseConfig, list));
      return list;
    }, []);
    const products = Array.isArray(raw.products)
      ? raw.products.map(normalizeProduct)
      : [];
    const locationStocks = Array.isArray(raw.locationStocks)
      ? raw.locationStocks.map(normalizeLocationStock).filter(Boolean) as LocationStock[]
      : [];
    const importedPackages = Array.isArray(raw.importedPackages)
      ? raw.importedPackages
          .map((item: Partial<WarehouseImportedPackage> & Record<string, unknown>) => normalizeImportedPackage(item))
          .filter(Boolean) as WarehouseImportedPackage[]
      : [];
    const locationCapacityOverrides = Array.isArray(raw.locationCapacityOverrides)
      ? raw.locationCapacityOverrides
          .map((override: Partial<LocationCapacityOverride>) => ({
            locationCode: String(override.locationCode || '').trim().toUpperCase(),
            capacityPackages: Math.max(1, Math.floor(Number(override.capacityPackages || DEFAULT_LOCATION_CAPACITY))),
            note: override.note || '',
          }))
          .filter((override: LocationCapacityOverride) => Boolean(parseLocationCode(override.locationCode)))
      : [];
    return {
      version: APP_VERSION,
      id: raw.id || generateId(),
      name: raw.name || warehouseConfig.name,
      warehouseConfig,
      unitPreference: raw.unitPreference === 'cm' ? 'cm' : 'm',
      gridSettings: { ...DEFAULT_GRID_SETTINGS, ...(raw.gridSettings || {}) },
      objects,
      products,
      locationStocks,
      importedPackages,
      locationCapacityOverrides,
      locationCodeSettings: normalizeLocationCodeSettings(raw.locationCodeSettings),
      createdAt: raw.createdAt || now(),
      updatedAt: raw.updatedAt || now(),
    };
  }

  if (raw.warehouse && Array.isArray(raw.objects)) {
    const warehouseConfig = normalizeWarehouseConfig({
      name: 'Aktarılan Depo',
      width: raw.warehouse.width,
      length: raw.warehouse.length,
      height: raw.warehouse.height,
    });
    const objects = raw.objects.reduce((list: WarehouseObject[], object: any) => {
      if (!object?.type) return list;
      list.push(normalizeObject(object, warehouseConfig, list, true));
      return list;
    }, []);
    return makePlan('Aktarılan Depo', warehouseConfig, objects, 'm');
  }

  return null;
}

function loadPersistedData(): PersistedData {
  const saved = safeLocalStorageGet(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const plans = Array.isArray(parsed.plans)
        ? parsed.plans.map(migratePlan).filter(Boolean) as WarehousePlan[]
        : [];
      return {
        activePlanId: parsed.activePlanId || plans[0]?.id || null,
        plans,
      };
    } catch (error) {
      console.error('Plan verisi okunamadı', error);
    }
  }

  const legacy = safeLocalStorageGet(LEGACY_STORAGE_KEY);
  if (legacy) {
    try {
      const migrated = migratePlan(JSON.parse(legacy));
      if (migrated) return { activePlanId: migrated.id, plans: [migrated] };
    } catch (error) {
      console.error('Eski plan verisi okunamadı', error);
    }
  }

  return { activePlanId: null, plans: [] };
}

async function fetchSharedData(): Promise<PersistedData | null> {
  if (typeof fetch === 'undefined') return null;

  const response = await fetch(SHARED_STATE_ENDPOINT, { cache: 'no-store' });
  if (!response.ok) return null;

  const parsed = await response.json();
  const plans = Array.isArray(parsed.plans)
    ? parsed.plans.map(migratePlan).filter(Boolean) as WarehousePlan[]
    : [];

  return {
    activePlanId: parsed.activePlanId || plans[0]?.id || null,
    plans,
  };
}

function getActivePlan(data: PersistedData): WarehousePlan | null {
  return data.plans.find((plan) => plan.id === data.activePlanId) || data.plans[0] || null;
}

function stateFromPlan(
  plan: WarehousePlan | null,
  plans: WarehousePlan[],
  saveStatus: string,
  sharedSyncStatus: string,
): Partial<StoreState> {
  if (!plan) {
    return {
      warehouseConfig: DEFAULT_WAREHOUSE_CONFIG,
      warehouse: DEFAULT_WAREHOUSE_CONFIG,
      unitPreference: 'm',
      gridSettings: DEFAULT_GRID_SETTINGS,
      locationCodeSettings: normalizeLocationCodeSettings(),
      objects: [],
      products: [],
      locationStocks: [],
      importedPackages: [],
      locationCapacityOverrides: [],
      selectedLocationCode: null,
      selectedPackageId: null,
      packageSearchQuery: '',
      highlightedPackageIds: [],
      focusedLocationCode: null,
      activeRackWorkspaceId: null,
      selectedId: null,
      plans: planSummaries(plans),
      activePlanId: null,
      hasActivePlan: false,
      warnings: [],
      saveStatus,
      sharedSyncStatus,
      placementStatus: '',
      packagePlacementStatus: null,
    };
  }

  return {
    warehouseConfig: plan.warehouseConfig,
    warehouse: plan.warehouseConfig,
    unitPreference: plan.unitPreference,
    gridSettings: plan.gridSettings,
    locationCodeSettings: normalizeLocationCodeSettings(plan.locationCodeSettings),
    objects: plan.objects,
    products: plan.products,
    locationStocks: plan.locationStocks,
    importedPackages: plan.importedPackages || [],
    locationCapacityOverrides: plan.locationCapacityOverrides,
    selectedLocationCode: null,
    selectedPackageId: null,
    packageSearchQuery: '',
    highlightedPackageIds: [],
    focusedLocationCode: null,
    activeRackWorkspaceId: null,
    selectedId: null,
    plans: planSummaries(plans),
    activePlanId: plan.id,
    hasActivePlan: true,
    warnings: validateObjects(plan.objects, plan.warehouseConfig, plan.gridSettings),
    saveStatus,
    sharedSyncStatus,
    placementStatus: '',
    packagePlacementStatus: null,
  };
}

function savePlanInState(state: StoreState, patch: Partial<StoreState>): Partial<StoreState> {
  const activePlanId = patch.activePlanId ?? state.activePlanId;
  const currentPlan = activePlanId ? state.plans.find((plan) => plan.id === activePlanId) : null;
  const plans = getFullPlans();
  const existing = activePlanId ? plans.find((plan) => plan.id === activePlanId) : null;

  if (!activePlanId || !existing) {
    return patch;
  }

  const updatedPlan: WarehousePlan = {
    ...existing,
    name: patch.warehouseConfig?.name || patch.warehouse?.name || state.warehouseConfig.name,
    warehouseConfig: patch.warehouseConfig || patch.warehouse || state.warehouseConfig,
    unitPreference: patch.unitPreference || state.unitPreference,
    gridSettings: patch.gridSettings || state.gridSettings,
    objects: patch.objects || state.objects,
    products: patch.products || state.products,
    locationStocks: patch.locationStocks || state.locationStocks,
    importedPackages: patch.importedPackages || state.importedPackages,
    locationCapacityOverrides: patch.locationCapacityOverrides || state.locationCapacityOverrides,
    locationCodeSettings: patch.locationCodeSettings || state.locationCodeSettings,
    updatedAt: now(),
  };
  const nextFullPlans = plans.map((plan) => (plan.id === activePlanId ? updatedPlan : plan));
  persist({ activePlanId, plans: nextFullPlans });
  cacheFullPlans(nextFullPlans);

  const warnings = validateObjects(
    updatedPlan.objects,
    updatedPlan.warehouseConfig,
    updatedPlan.gridSettings,
  );

  return {
    ...patch,
    warehouseConfig: updatedPlan.warehouseConfig,
    warehouse: updatedPlan.warehouseConfig,
    unitPreference: updatedPlan.unitPreference,
    gridSettings: updatedPlan.gridSettings,
    objects: updatedPlan.objects,
    products: updatedPlan.products,
    locationStocks: updatedPlan.locationStocks,
    importedPackages: updatedPlan.importedPackages,
    locationCapacityOverrides: updatedPlan.locationCapacityOverrides,
    locationCodeSettings: updatedPlan.locationCodeSettings,
    warnings,
    plans: planSummaries(nextFullPlans),
    saveStatus: `Kaydedildi ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`,
    sharedSyncStatus: 'Ortak kayda yazılıyor',
    hasActivePlan: true,
    activePlanId,
  };
}

let fullPlanCache: WarehousePlan[] = [];

function cacheFullPlans(plans: WarehousePlan[]) {
  fullPlanCache = plans;
}

function getFullPlans() {
  return fullPlanCache;
}

const persistedData = loadPersistedData();
cacheFullPlans(persistedData.plans);
const activePlan = getActivePlan(persistedData);

export const useStore = create<StoreState>((set, get) => {
  sharedStatusListener = (sharedSyncStatus) => set({ sharedSyncStatus });

  const initialWarehouseConfig = activePlan?.warehouseConfig || DEFAULT_WAREHOUSE_CONFIG;
  const initialGridSettings = activePlan?.gridSettings || DEFAULT_GRID_SETTINGS;
  const initialWarnings = activePlan
    ? validateObjects(activePlan.objects, initialWarehouseConfig, initialGridSettings)
    : [];

  return {
    version: APP_VERSION,
    warehouseConfig: initialWarehouseConfig,
    warehouse: initialWarehouseConfig,
    unitPreference: activePlan?.unitPreference || 'm',
    gridSettings: initialGridSettings,
    locationCodeSettings: normalizeLocationCodeSettings(activePlan?.locationCodeSettings),
    objects: activePlan?.objects || [],
    products: activePlan?.products || [],
    locationStocks: activePlan?.locationStocks || [],
    importedPackages: activePlan?.importedPackages || [],
    locationCapacityOverrides: activePlan?.locationCapacityOverrides || [],
    selectedLocationCode: null,
    selectedPackageId: null,
    packageSearchQuery: '',
    highlightedPackageIds: [],
    focusedLocationCode: null,
    activeRackWorkspaceId: null,
    selectedId: null,
    viewMode: '2D',
    plans: planSummaries(persistedData.plans),
    activePlanId: activePlan?.id || null,
    hasActivePlan: Boolean(activePlan),
    warnings: initialWarnings,
    saveStatus: activePlan ? 'Kaydedildi' : 'Plan bekleniyor',
    sharedSyncStatus: activePlan ? 'Yerel kayıt yüklendi' : 'Ortak kayıt bekleniyor',
    placementStatus: '',
    packagePlacementStatus: null,

    loadSharedState: async () => {
      set({ sharedSyncStatus: 'Ortak kayıt okunuyor...' });
      try {
        const sharedData = await fetchSharedData();
        if (sharedData?.plans.length) {
          const plan = getActivePlan(sharedData);
          cacheFullPlans(sharedData.plans);
          persist(sharedData, false);
          set(stateFromPlan(plan, sharedData.plans, 'Ortak kayıt yüklendi', 'Ortak kayıt aktif'));
          return;
        }

        const localPlans = getFullPlans();
        if (localPlans.length) {
          const activePlanId = get().activePlanId || localPlans[0].id;
          await writeSharedData({ activePlanId, plans: localPlans });
          set({ sharedSyncStatus: 'Yerel plan ortak kayda aktarıldı' });
          return;
        }

        set({ sharedSyncStatus: 'Ortak kayıt boş' });
      } catch (error) {
        console.warn('Ortak depo planı okunamadı', error);
        set({ sharedSyncStatus: 'Ortak kayıt yok, yerel kayıt kullanılıyor' });
      }
    },

    createEmptyPlan: (config, unitPreference) => set(() => {
      const warehouseConfig = normalizeWarehouseConfig(config);
      const plan = makePlan(warehouseConfig.name, warehouseConfig, [], unitPreference);
      const plans = [...getFullPlans(), plan];
      cacheFullPlans(plans);
      persist({ activePlanId: plan.id, plans });
      return {
        warehouseConfig,
        warehouse: warehouseConfig,
        unitPreference,
        gridSettings: plan.gridSettings,
        locationCodeSettings: plan.locationCodeSettings,
        objects: [],
        products: [],
        locationStocks: [],
        importedPackages: [],
        locationCapacityOverrides: [],
        selectedLocationCode: null,
        selectedPackageId: null,
        packageSearchQuery: '',
        highlightedPackageIds: [],
        focusedLocationCode: null,
        activeRackWorkspaceId: null,
        selectedId: null,
        plans: planSummaries(plans),
        activePlanId: plan.id,
        hasActivePlan: true,
        warnings: [],
        saveStatus: 'Boş depo oluşturuldu',
        sharedSyncStatus: 'Ortak kayda yazılıyor',
      };
    }),

    loadSamplePlan: () => set(() => {
      const warehouseConfig = { ...DEFAULT_WAREHOUSE_CONFIG, name: 'DSDST Örnek Depo' };
      const objects = createSampleObjects();
      const products = createSampleProducts();
      const locationStocks = createSampleLocationStocks(objects, products);
      const plan = makePlan(warehouseConfig.name, warehouseConfig, objects, 'm', products, locationStocks);
      const plans = [...getFullPlans(), plan];
      cacheFullPlans(plans);
      persist({ activePlanId: plan.id, plans });
      return {
        warehouseConfig,
        warehouse: warehouseConfig,
        unitPreference: 'm',
        gridSettings: plan.gridSettings,
        locationCodeSettings: plan.locationCodeSettings,
        objects,
        products,
        locationStocks,
        importedPackages: [],
        locationCapacityOverrides: [],
        selectedLocationCode: null,
        selectedPackageId: null,
        packageSearchQuery: '',
        highlightedPackageIds: [],
        focusedLocationCode: null,
        activeRackWorkspaceId: null,
        selectedId: null,
        plans: planSummaries(plans),
        activePlanId: plan.id,
        hasActivePlan: true,
        warnings: validateObjects(objects, warehouseConfig, plan.gridSettings),
        saveStatus: 'Örnek plan yüklendi',
        sharedSyncStatus: 'Ortak kayda yazılıyor',
      };
    }),

    resetPlan: () => set((state) => {
      if (!state.hasActivePlan) return state;
      const next = savePlanInState(state, {
        objects: [],
        locationStocks: [],
        importedPackages: [],
        locationCapacityOverrides: [],
        selectedLocationCode: null,
        selectedPackageId: null,
        packageSearchQuery: '',
        highlightedPackageIds: [],
        focusedLocationCode: null,
        activeRackWorkspaceId: null,
        selectedId: null,
      });
      return { ...next, saveStatus: 'Plan sıfırlandı', sharedSyncStatus: 'Ortak kayda yazılıyor' };
    }),

    duplicatePlan: () => set((state) => {
      if (!state.activePlanId) return state;
      const source = getFullPlans().find((plan) => plan.id === state.activePlanId);
      if (!source) return state;
      const timestamp = now();
      const copy: WarehousePlan = {
        ...source,
        id: generateId(),
        name: `${source.name} Kopya`,
        objects: source.objects.map((object) => ({ ...object, id: generateId() })) as WarehouseObject[],
        products: source.products.map((product) => ({ ...product, id: generateId() })),
        locationStocks: source.locationStocks.map((stock) => ({ ...stock })),
        importedPackages: (source.importedPackages || []).map((item) => ({ ...item, placement: item.placement ? { ...item.placement } : null })),
        locationCapacityOverrides: source.locationCapacityOverrides.map((override) => ({ ...override })),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const plans = [...getFullPlans(), copy];
      cacheFullPlans(plans);
      persist({ activePlanId: copy.id, plans });
      return {
        warehouseConfig: copy.warehouseConfig,
        warehouse: copy.warehouseConfig,
        unitPreference: copy.unitPreference,
        gridSettings: copy.gridSettings,
        locationCodeSettings: copy.locationCodeSettings,
        objects: copy.objects,
        products: copy.products,
        locationStocks: copy.locationStocks,
        importedPackages: copy.importedPackages,
        locationCapacityOverrides: copy.locationCapacityOverrides,
        selectedLocationCode: null,
        selectedPackageId: null,
        packageSearchQuery: '',
        highlightedPackageIds: [],
        focusedLocationCode: null,
        activeRackWorkspaceId: null,
        selectedId: null,
        plans: planSummaries(plans),
        activePlanId: copy.id,
        hasActivePlan: true,
        warnings: validateObjects(copy.objects, copy.warehouseConfig, copy.gridSettings),
        saveStatus: 'Plan kopyalandı',
        sharedSyncStatus: 'Ortak kayda yazılıyor',
      };
    }),

    deletePlan: (planId) => set((state) => {
      const plans = getFullPlans().filter((plan) => plan.id !== planId);
      const nextActive = state.activePlanId === planId ? plans[0] || null : getFullPlans().find((plan) => plan.id === state.activePlanId) || null;
      cacheFullPlans(plans);
      persist({ activePlanId: nextActive?.id || null, plans });
      if (!nextActive) {
        return {
          warehouseConfig: DEFAULT_WAREHOUSE_CONFIG,
          warehouse: DEFAULT_WAREHOUSE_CONFIG,
          unitPreference: 'm',
          gridSettings: DEFAULT_GRID_SETTINGS,
          locationCodeSettings: normalizeLocationCodeSettings(),
          objects: [],
          products: [],
          locationStocks: [],
          importedPackages: [],
          locationCapacityOverrides: [],
          selectedLocationCode: null,
          selectedPackageId: null,
          packageSearchQuery: '',
          highlightedPackageIds: [],
          focusedLocationCode: null,
          activeRackWorkspaceId: null,
          selectedId: null,
          plans: [],
          activePlanId: null,
          hasActivePlan: false,
          warnings: [],
          saveStatus: 'Plan silindi',
          sharedSyncStatus: 'Ortak kayda yazılıyor',
        };
      }
      return {
        warehouseConfig: nextActive.warehouseConfig,
        warehouse: nextActive.warehouseConfig,
        unitPreference: nextActive.unitPreference,
        gridSettings: nextActive.gridSettings,
        locationCodeSettings: nextActive.locationCodeSettings,
        objects: nextActive.objects,
        products: nextActive.products,
        locationStocks: nextActive.locationStocks,
        importedPackages: nextActive.importedPackages || [],
        locationCapacityOverrides: nextActive.locationCapacityOverrides,
        selectedLocationCode: null,
        selectedPackageId: null,
        packageSearchQuery: '',
        highlightedPackageIds: [],
        focusedLocationCode: null,
        activeRackWorkspaceId: null,
        selectedId: null,
        plans: planSummaries(plans),
        activePlanId: nextActive.id,
        hasActivePlan: true,
        warnings: validateObjects(nextActive.objects, nextActive.warehouseConfig, nextActive.gridSettings),
        saveStatus: 'Plan silindi',
        sharedSyncStatus: 'Ortak kayda yazılıyor',
      };
    }),

    setActivePlan: (planId) => set((state) => {
      const plan = getFullPlans().find((item) => item.id === planId);
      if (!plan) return state;
      persist({ activePlanId: plan.id, plans: getFullPlans() });
      return {
        warehouseConfig: plan.warehouseConfig,
        warehouse: plan.warehouseConfig,
        unitPreference: plan.unitPreference,
        gridSettings: plan.gridSettings,
        locationCodeSettings: plan.locationCodeSettings,
        objects: plan.objects,
        products: plan.products,
        locationStocks: plan.locationStocks,
        importedPackages: plan.importedPackages || [],
        locationCapacityOverrides: plan.locationCapacityOverrides,
        selectedLocationCode: null,
        selectedPackageId: null,
        packageSearchQuery: '',
        highlightedPackageIds: [],
        focusedLocationCode: null,
        activeRackWorkspaceId: null,
        selectedId: null,
        activePlanId: plan.id,
        hasActivePlan: true,
        warnings: validateObjects(plan.objects, plan.warehouseConfig, plan.gridSettings),
        saveStatus: 'Plan değiştirildi',
        sharedSyncStatus: 'Ortak kayıt aktif',
      };
    }),

    updateWarehouseConfig: (updates, scaleObjects = false) => set((state) => {
      const nextConfig = normalizeWarehouseConfig({ ...state.warehouseConfig, ...updates });
      const scaleX = nextConfig.width / state.warehouseConfig.width;
      const scaleZ = nextConfig.length / state.warehouseConfig.length;
      const scaleY = nextConfig.height / state.warehouseConfig.height;
      const nextObjects = state.objects.map((object) => {
        const changed = scaleObjects
          ? {
              ...object,
              x: roundMeters(object.x * scaleX),
              z: roundMeters(object.z * scaleZ),
              width: roundMeters(object.width * scaleX),
              depth: roundMeters(object.depth * scaleZ),
              height: roundMeters(object.height * scaleY),
            }
          : object;
        return clampObjectToWarehouse(changed as WarehouseObject, nextConfig, state.gridSettings);
      });
      return savePlanInState(state, {
        warehouseConfig: nextConfig,
        warehouse: nextConfig,
        objects: nextObjects,
      });
    }),

    setWarehouseSize: (width, length, height) => get().updateWarehouseConfig({ width, length, height }),

    setUnitPreference: (unit) => set((state) => savePlanInState(state, { unitPreference: unit })),

    setGridSize: (size) => set((state) => savePlanInState(state, {
      gridSettings: { ...state.gridSettings, size },
    })),

    updateGridSettings: (updates) => set((state) => savePlanInState(state, {
      gridSettings: { ...state.gridSettings, ...updates },
    })),

    updateLocationCodeSettings: (updates) => set((state) => savePlanInState(state, {
      locationCodeSettings: normalizeLocationCodeSettings({ ...state.locationCodeSettings, ...updates }),
    })),

    addProduct: (product) => set((state) => {
      if (!state.hasActivePlan) return state;
      const normalized = normalizeProduct(product);
      const existing = state.products.find((item) => item.sku === normalized.sku);
      const products = existing
        ? state.products.map((item) =>
            item.id === existing.id
              ? { ...item, ...normalized, id: item.id, createdAt: item.createdAt, updatedAt: now() }
              : item,
          )
        : [...state.products, normalized];

      return savePlanInState(state, {
        products,
        placementStatus: existing ? `${normalized.sku} ürünü güncellendi.` : `${normalized.sku} ürün listesine eklendi.`,
      });
    }),

    updateProduct: (id, updates) => set((state) => {
      const products = state.products.map((product) =>
        product.id === id ? normalizeProduct({ ...product, ...updates, id, createdAt: product.createdAt, updatedAt: now() }) : product,
      );
      return savePlanInState(state, { products });
    }),

    deleteProduct: (id) => set((state) => {
      const product = state.products.find((item) => item.id === id);
      if (!product) return state;
      return savePlanInState(state, {
        products: state.products.filter((item) => item.id !== id),
        placementStatus: `${product.sku} ürün kartı silindi. Raflardaki yerleşim korunur.`,
      });
    }),

    autoPlaceProduct: (productId, packageCount) => set((state) => {
      const product = state.products.find((item) => item.id === productId);
      if (!product) return state;
      let remaining = Math.max(0, Math.floor(Number(packageCount ?? product.packageCount) || 0));
      if (remaining <= 0) return { placementStatus: 'Yerleştirilecek paket sayısı 0’dan büyük olmalı.' };

      let locationStocks = [...state.locationStocks];
      const buildLocations = () =>
        generateAllLocationCodes(state.objects, state.locationCodeSettings, locationStocks, state.locationCapacityOverrides);
      const placeInto = (location: LocationCode) => {
        if (remaining <= 0) return;
        const existingIndex = locationStocks.findIndex((stock) => stock.locationCode === location.locationCode);
        const existing = existingIndex >= 0 ? locationStocks[existingIndex] : null;
        if (existing && existing.sku !== product.sku && existing.currentPackages > 0) return;

        const currentPackages = existing?.currentPackages || 0;
        const free = location.capacityPackages - currentPackages;
        const amount = Math.min(free, remaining);
        if (amount <= 0) return;

        if (existing) {
          locationStocks = locationStocks.map((stock, index) =>
            index === existingIndex ? mergeStockWithProduct(stock, product, amount) : stock,
          );
        } else {
          locationStocks.push(makeLocationStock(product, location, amount));
        }
        remaining -= amount;
      };

      buildLocations()
        .filter((location) => location.sku === product.sku && location.currentPackages > 0 && location.currentPackages < location.capacityPackages)
        .forEach(placeInto);
      buildLocations()
        .filter((location) => location.currentPackages === 0 && location.productGroup === product.category)
        .forEach(placeInto);
      buildLocations()
        .filter((location) => location.currentPackages === 0)
        .forEach(placeInto);

      const placed = Math.max(0, Math.floor(Number(packageCount ?? product.packageCount) || 0)) - remaining;
      return savePlanInState(state, {
        locationStocks,
        placementStatus:
          remaining > 0
            ? `${product.sku}: ${placed} paket yerleştirildi, ${remaining} paket için boş yer yok.`
            : `${product.sku}: ${placed} paket otomatik yerleştirildi.`,
      });
    }),

    placeProductInLocation: (productId, locationCode, packageCount) => set((state) => {
      const product = state.products.find((item) => item.id === productId);
      const location = generateAllLocationCodes(
        state.objects,
        state.locationCodeSettings,
        state.locationStocks,
        state.locationCapacityOverrides,
      )
        .find((item) => item.locationCode === locationCode);
      if (!product || !location) return state;
      const amount = Math.max(0, Math.floor(Number(packageCount) || 0));
      if (amount <= 0) return { placementStatus: 'Paket sayısı 0’dan büyük olmalı.' };

      const existing = state.locationStocks.find((stock) => stock.locationCode === locationCode);
      if (existing && existing.currentPackages > 0 && existing.sku !== product.sku) {
        return { placementStatus: 'Bu lokasyonda farklı SKU var. Karışık SKU’ya izin verilmez.' };
      }
      const currentPackages = existing?.currentPackages || 0;
      const free = location.capacityPackages - currentPackages;
      const placed = Math.min(free, amount);
      if (placed <= 0) return { placementStatus: `${locationCode} dolu.` };

      const locationStocks = existing
        ? state.locationStocks.map((stock) =>
            stock.locationCode === locationCode ? mergeStockWithProduct(stock, product, placed) : stock,
          )
        : [...state.locationStocks, makeLocationStock(product, location, placed)];

      return savePlanInState(state, {
        locationStocks,
        selectedLocationCode: locationCode,
        placementStatus: `${locationCode}: ${product.sku} için ${placed}/${amount} paket eklendi.`,
      });
    }),

    adjustLocationPackages: (locationCode, delta) => set((state) => {
      const stock = state.locationStocks.find((item) => item.locationCode === locationCode);
      if (!stock) return { placementStatus: `${locationCode} zaten boş.` };
      const nextCount = Math.min(stock.capacityPackages, Math.max(0, stock.currentPackages + delta));
      const locationStocks = nextCount <= 0
        ? state.locationStocks.filter((item) => item.locationCode !== locationCode)
        : state.locationStocks.map((item) => item.locationCode === locationCode ? { ...item, currentPackages: nextCount } : item);
      return savePlanInState(state, {
        locationStocks,
        placementStatus: `${locationCode}: doluluk ${nextCount}/${stock.capacityPackages}.`,
      });
    }),

    clearLocation: (locationCode) => set((state) => {
      const stock = state.locationStocks.find((item) => item.locationCode === locationCode);
      const packageIds = new Set((stock?.packages || []).map((item) => item.packageId));
      const importedPackages = packageIds.size
        ? state.importedPackages.map((item) =>
            packageIds.has(item.packageId) ? { ...item, status: 'unplaced' as const, placement: null } : item,
          )
        : state.importedPackages;
      return savePlanInState(state, {
        locationStocks: state.locationStocks.filter((item) => item.locationCode !== locationCode),
        importedPackages,
        placementStatus: `${locationCode} boşaltıldı.`,
        packagePlacementStatus: `${locationCode} içindeki import paketleri yerleşmemiş listeye alındı.`,
      });
    }),

    moveLocationStock: (fromLocationCode, toLocationCode) => set((state) => {
      if (fromLocationCode === toLocationCode) return state;
      const source = state.locationStocks.find((stock) => stock.locationCode === fromLocationCode);
      const targetLocation = generateAllLocationCodes(
        state.objects,
        state.locationCodeSettings,
        state.locationStocks,
        state.locationCapacityOverrides,
      )
        .find((location) => location.locationCode === toLocationCode);
      if (!source || !targetLocation) return { placementStatus: 'Taşınacak kaynak veya hedef lokasyon bulunamadı.' };
      const target = state.locationStocks.find((stock) => stock.locationCode === toLocationCode);
      if (target && target.currentPackages > 0 && target.sku !== source.sku) {
        return { placementStatus: 'Hedef lokasyonda farklı SKU var. Karışık SKU’ya izin verilmez.' };
      }

      const free = targetLocation.capacityPackages - (target?.currentPackages || 0);
      const moved = Math.min(free, source.currentPackages);
      if (moved <= 0) return { placementStatus: `${toLocationCode} dolu.` };

      const product = normalizeProduct({
        sku: source.sku,
        productName: source.productName,
        supplierCode: source.supplierCode,
        category: source.category,
        quantityInsidePackage: source.quantityInsidePackage,
        boxWidthCm: source.boxWidthCm,
        boxDepthCm: source.boxDepthCm,
        boxHeightCm: source.boxHeightCm,
        weightKg: source.weightKg,
      });
      let locationStocks = state.locationStocks
        .map((stock) =>
          stock.locationCode === fromLocationCode
            ? { ...stock, currentPackages: stock.currentPackages - moved }
            : stock,
        )
        .filter((stock) => stock.currentPackages > 0);

      if (target) {
        locationStocks = locationStocks.map((stock) =>
          stock.locationCode === toLocationCode ? mergeStockWithProduct(stock, product, moved) : stock,
        );
      } else {
        locationStocks.push(makeLocationStock(product, targetLocation, moved));
      }

      return savePlanInState(state, {
        locationStocks,
        selectedLocationCode: toLocationCode,
        placementStatus: `${fromLocationCode} → ${toLocationCode}: ${moved} paket taşındı.`,
      });
    }),

    setLocationCapacity: (locationCode, capacityPackages) => set((state) => {
      const parsed = parseLocationCode(locationCode);
      if (!parsed) return { placementStatus: 'Lokasyon kodu geçersiz.' };
      const capacity = Math.max(1, Math.floor(Number(capacityPackages) || 1));
      const existingStock = state.locationStocks.find((stock) => stock.locationCode === locationCode);
      const locationStocks = existingStock
        ? state.locationStocks.map((stock) =>
            stock.locationCode === locationCode
              ? {
                  ...stock,
                  capacityPackages: capacity,
                  currentPackages: Math.min(stock.currentPackages, capacity),
                  packages: stock.packages?.slice(0, capacity),
                }
              : stock,
          )
        : state.locationStocks;
      const locationCapacityOverrides = [
        ...state.locationCapacityOverrides.filter((override) => override.locationCode !== locationCode),
        { locationCode, capacityPackages: capacity },
      ];

      return savePlanInState(state, {
        locationStocks,
        locationCapacityOverrides,
        selectedLocationCode: locationCode,
        placementStatus: `${locationCode}: kapasite ${capacity} paket olarak ayarlandı.`,
      });
    }),

    applyRackCapacity: (rackId, mode) => set((state) => {
      const rack = state.objects.find((object): object is Rack => object.id === rackId && object.type === 'rack');
      if (!rack) return state;
      const rackLocations = generateRackLocationCodes(
        rack,
        state.locationCodeSettings,
        state.locationStocks,
        state.locationCapacityOverrides,
      );
      const rackCodes = new Set(rackLocations.map((location) => location.locationCode));
      const capacity = getRackDefaultLocationCapacity(rack);
      let locationStocks = state.locationStocks;

      if (mode === 'all') {
        locationStocks = state.locationStocks.map((stock) =>
          rackCodes.has(stock.locationCode)
            ? {
                ...stock,
                capacityPackages: capacity,
                currentPackages: Math.min(stock.currentPackages, capacity),
                packages: stock.packages?.slice(0, capacity),
              }
            : stock,
        );
      }

      const filledCodes = new Set(locationStocks.filter((stock) => stock.currentPackages > 0).map((stock) => stock.locationCode));
      const locationCapacityOverrides = state.locationCapacityOverrides.filter((override) => {
        if (!rackCodes.has(override.locationCode)) return true;
        if (mode === 'preserve' && filledCodes.has(override.locationCode)) return true;
        return false;
      });

      return savePlanInState(state, {
        locationStocks,
        locationCapacityOverrides,
        placementStatus:
          mode === 'all'
            ? `${rack.rackCode}: kapasite tüm lokasyonlara uygulandı.`
            : mode === 'empty'
              ? `${rack.rackCode}: boş lokasyonlar raf varsayılan kapasitesine döndü.`
              : `${rack.rackCode}: dolu lokasyonlar korunarak kapasite yeniden hesaplandı.`,
      });
    }),

    importPackageManifest: (csvString) => {
      try {
        const packages = parseDelimitedRows(csvString).map(packageFromManifestRow).filter(Boolean) as PackageRecord[];
        if (!packages.length) return false;
        set((state) => {
          const importedProducts = productsFromPackages(packages);
          const products = [...state.products];
          importedProducts.forEach((incoming) => {
            const index = products.findIndex((product) => product.sku === incoming.sku);
            if (index >= 0) {
              products[index] = normalizeProduct({
                ...products[index],
                ...incoming,
                id: products[index].id,
                packageCount: incoming.packageCount,
                packages: [...(products[index].packages || []), ...(incoming.packages || [])],
                updatedAt: now(),
              });
            } else {
              products.push(incoming);
            }
          });

          let locationStocks = [...state.locationStocks];
          packages
            .filter((item) => item.locationCode && item.status !== 'pending')
            .forEach((item) => {
              const product = products.find((entry) => entry.sku === item.sku);
              const location = generateAllLocationCodes(
                state.objects,
                state.locationCodeSettings,
                locationStocks,
                state.locationCapacityOverrides,
              ).find((entry) => entry.locationCode === item.locationCode);
              if (!product || !location) return;
              const existing = locationStocks.find((stock) => stock.locationCode === item.locationCode);
              if (existing && existing.sku !== item.sku && existing.currentPackages > 0) return;
              if (existing) {
                locationStocks = locationStocks.map((stock) =>
                  stock.locationCode === item.locationCode
                    ? {
                        ...mergeStockWithProduct(stock, product, 1),
                        packages: [...(stock.packages || []), { ...item, status: 'placed' }].slice(0, stock.capacityPackages),
                      }
                    : stock,
                );
              } else {
                locationStocks.push({
                  ...makeLocationStock(product, location, 1),
                  packages: [{ ...item, status: 'placed' }],
                });
              }
            });

          return savePlanInState(state, {
            products,
            locationStocks,
            placementStatus: `Label-Printer manifestinden ${packages.length} paket içe aktarıldı.`,
          });
        });
        return true;
      } catch (error) {
        console.error('Manifest içe aktarma başarısız', error);
        return false;
      }
    },

    importPackagesExport: (jsonText) => {
      let result: PackageImportResult = {
        success: false,
        added: 0,
        skipped: 0,
        updated: 0,
        message: 'Paket import edilemedi.',
      };

      try {
        const parsed = JSON.parse(jsonText) as WarehousePackagesExport;
        if (parsed.schemaVersion !== 'label-printer.packages.v1') {
          result = {
            ...result,
            error: 'Sadece label-printer.packages.v1 şeması desteklenir.',
            message: 'Geçersiz Label Printer paket dosyası.',
          };
          set({ packagePlacementStatus: result.message });
          return result;
        }

        if (!Array.isArray(parsed.packages)) {
          result = {
            ...result,
            error: 'packages array bulunamadı.',
            message: 'Dosyada packages listesi yok.',
          };
          set({ packagePlacementStatus: result.message });
          return result;
        }

        const importedAt = now();
        set((state) => {
          if (!state.hasActivePlan) {
            result = {
              ...result,
              message: 'Önce bir depo planı oluşturun veya örnek plan yükleyin.',
              error: 'Aktif plan yok.',
            };
            return state;
          }

          const existingIds = new Set(state.importedPackages.map((item) => item.packageId));
          const incoming: WarehouseImportedPackage[] = [];
          let skipped = 0;

          parsed.packages.forEach((raw) => {
            const normalized = normalizeImportedPackage(raw, importedAt, true);
            if (!normalized || existingIds.has(normalized.packageId)) {
              skipped += 1;
              return;
            }
            existingIds.add(normalized.packageId);
            incoming.push(normalized);
          });

          result = {
            success: incoming.length > 0,
            added: incoming.length,
            skipped,
            updated: 0,
            message: `${incoming.length} paket içe aktarıldı, ${skipped} duplicate/eksik paket atlandı.`,
          };

          return savePlanInState(state, {
            importedPackages: [...state.importedPackages, ...incoming],
            packagePlacementStatus: result.message,
          });
        });

        return result;
      } catch (error) {
        result = {
          ...result,
          error: error instanceof Error ? error.message : 'JSON okunamadı.',
          message: 'packages-export.json okunamadı.',
        };
        set({ packagePlacementStatus: result.message });
        return result;
      }
    },

    addManualPackage: (packageData) => set((state) => {
      if (!state.hasActivePlan) return { packagePlacementStatus: 'Önce bir depo planı oluşturun veya örnek plan yükleyin.' };

      const generatedId = `MAN-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${Math.floor(Math.random() * 900 + 100)}`;
      const normalized = normalizeImportedPackage(
        {
          ...packageData,
          packageId: packageData.packageId || generatedId,
          status: 'unplaced',
          placement: null,
        },
        now(),
        true,
      );

      if (!normalized) return { packagePlacementStatus: 'Paket ID oluşturulamadı.' };
      if (state.importedPackages.some((item) => item.packageId === normalized.packageId)) {
        return { packagePlacementStatus: `${normalized.packageId} zaten listede var.` };
      }

      return savePlanInState(state, {
        importedPackages: [normalized, ...state.importedPackages],
        selectedPackageId: normalized.packageId,
        highlightedPackageIds: [normalized.packageId],
        packagePlacementStatus: `${normalized.packageId} paket listesine eklendi.`,
      });
    }),

    selectPackage: (packageId) => set((state) => ({
      selectedPackageId: packageId,
      highlightedPackageIds: packageId ? [packageId] : state.highlightedPackageIds,
    })),

    setPackageSearchQuery: (query) => set((state) => {
      const highlightedPackageIds = query.trim()
        ? state.importedPackages.filter((item) => packageMatchesQuery(item, query)).map((item) => item.packageId)
        : [];
      return {
        packageSearchQuery: query,
        highlightedPackageIds,
      };
    }),

    placeImportedPackage: (packageId, locationCode) => set((state) => {
      const item = state.importedPackages.find((entry) => entry.packageId === packageId);
      if (!item) return { packagePlacementStatus: 'Paket bulunamadı.' };
      const location = generateAllLocationCodes(
        state.objects,
        state.locationCodeSettings,
        state.locationStocks,
        state.locationCapacityOverrides,
      ).find((entry) => entry.locationCode === locationCode);
      if (!location) return { packagePlacementStatus: 'Lokasyon bulunamadı.' };

      const existing = state.locationStocks.find((stock) => stock.locationCode === locationCode);
      if (existing && existing.currentPackages > 0 && existing.sku !== item.sku) {
        return { packagePlacementStatus: 'Bu lokasyonda farklı SKU var. Karışık SKU’ya izin verilmez.' };
      }
      if ((existing?.currentPackages || 0) >= location.capacityPackages) {
        return { packagePlacementStatus: `${locationCode} dolu.` };
      }

      let locationStocks = state.locationStocks;
      let importedPackages = state.importedPackages;

      if (item.placement?.locationCode) {
        const previousLocationCode = item.placement.locationCode;
        locationStocks = locationStocks
          .map((stock) => {
            if (stock.locationCode !== previousLocationCode) return stock;
            const packages = (stock.packages || []).filter((entry) => entry.packageId !== item.packageId);
            return {
              ...stock,
              packages,
              currentPackages: packages.length ? Math.min(stock.capacityPackages, packages.length) : Math.max(0, stock.currentPackages - 1),
            };
          })
          .filter((stock) => stock.currentPackages > 0);
      }

      const existingAfterMove = locationStocks.find((stock) => stock.locationCode === locationCode);
      locationStocks = existingAfterMove
        ? locationStocks.map((stock) =>
            stock.locationCode === locationCode ? addImportedPackageToStock(stock, item, locationCode) : stock,
          )
        : [...locationStocks, makeLocationStockFromImported(item, location)];

      const placement: PackagePlacement = {
        locationCode,
        rackCode: location.rackCode,
        placedAt: now(),
      };
      importedPackages = importedPackages.map((entry) =>
        entry.packageId === packageId
          ? { ...entry, status: 'placed', placement }
          : entry,
      );

      return savePlanInState(state, {
        locationStocks,
        importedPackages,
        selectedPackageId: packageId,
        selectedLocationCode: locationCode,
        focusedLocationCode: locationCode,
        highlightedPackageIds: [packageId],
        packagePlacementStatus: `${item.packageId} paketi ${locationCode} lokasyonuna yerleştirildi.`,
      });
    }),

    unplaceImportedPackage: (packageId) => set((state) => {
      const item = state.importedPackages.find((entry) => entry.packageId === packageId);
      if (!item) return { packagePlacementStatus: 'Paket bulunamadı.' };
      const locationCode = item.placement?.locationCode;
      const locationStocks = locationCode
        ? state.locationStocks
            .map((stock) => {
              if (stock.locationCode !== locationCode) return stock;
              const packages = (stock.packages || []).filter((entry) => entry.packageId !== packageId);
              return {
                ...stock,
                packages,
                currentPackages: packages.length ? Math.min(stock.capacityPackages, packages.length) : Math.max(0, stock.currentPackages - 1),
              };
            })
            .filter((stock) => stock.currentPackages > 0)
        : state.locationStocks;
      const importedPackages = state.importedPackages.map((entry) =>
        entry.packageId === packageId
          ? { ...entry, status: 'unplaced' as const, placement: null }
          : entry,
      );

      return savePlanInState(state, {
        locationStocks,
        importedPackages,
        selectedPackageId: packageId,
        highlightedPackageIds: [packageId],
        focusedLocationCode: null,
        packagePlacementStatus: `${item.packageId} yerleşimi kaldırıldı.`,
      });
    }),

    unplaceImportedPackages: (packageIds) => set((state) => {
      const targetIds = new Set(packageIds);
      if (targetIds.size === 0) return { packagePlacementStatus: 'Paket seçilmedi.' };
      const affectedCount = state.importedPackages.filter((item) => targetIds.has(item.packageId)).length;
      if (affectedCount === 0) return { packagePlacementStatus: 'Seçili paketler bulunamadı.' };

      const locationStocks = state.locationStocks
        .map((stock) => {
          const packages = stock.packages || [];
          if (!packages.some((item) => targetIds.has(item.packageId))) return stock;
          const nextPackages = packages.filter((item) => !targetIds.has(item.packageId));
          return nextPackages.length > 0
            ? {
                ...stock,
                packages: nextPackages,
                currentPackages: Math.min(stock.capacityPackages, nextPackages.length),
              }
            : null;
        })
        .filter(Boolean) as LocationStock[];

      const importedPackages = state.importedPackages.map((item) =>
        targetIds.has(item.packageId) ? { ...item, status: 'unplaced' as const, placement: null } : item,
      );

      return savePlanInState(state, {
        locationStocks,
        importedPackages,
        selectedPackageId: state.selectedPackageId && targetIds.has(state.selectedPackageId) ? null : state.selectedPackageId,
        highlightedPackageIds: state.highlightedPackageIds.filter((packageId) => !targetIds.has(packageId)),
        packagePlacementStatus: `${affectedCount} paket raftan çıkarıldı.`,
      });
    }),

    deleteImportedPackages: (packageIds) => set((state) => {
      const targetIds = new Set(packageIds);
      if (targetIds.size === 0) return { packagePlacementStatus: 'Paket seçilmedi.' };
      const deletedCount = state.importedPackages.filter((item) => targetIds.has(item.packageId)).length;
      if (deletedCount === 0) return { packagePlacementStatus: 'Seçili paketler bulunamadı.' };

      const locationStocks = state.locationStocks
        .map((stock) => {
          const packages = stock.packages || [];
          if (!packages.some((item) => targetIds.has(item.packageId))) return stock;
          const nextPackages = packages.filter((item) => !targetIds.has(item.packageId));
          return nextPackages.length > 0
            ? {
                ...stock,
                packages: nextPackages,
                currentPackages: Math.min(stock.capacityPackages, nextPackages.length),
              }
            : null;
        })
        .filter(Boolean) as LocationStock[];

      return savePlanInState(state, {
        locationStocks,
        importedPackages: state.importedPackages.filter((item) => !targetIds.has(item.packageId)),
        selectedPackageId: state.selectedPackageId && targetIds.has(state.selectedPackageId) ? null : state.selectedPackageId,
        highlightedPackageIds: state.highlightedPackageIds.filter((packageId) => !targetIds.has(packageId)),
        packagePlacementStatus: `${deletedCount} paket listeden silindi.`,
      });
    }),

    focusPackage: (packageId) => set((state) => {
      const item = state.importedPackages.find((entry) => entry.packageId === packageId);
      if (!item) return { packagePlacementStatus: 'Paket bulunamadı.' };
      const locationCode = item.placement?.locationCode || null;
      const rackCode = item.placement?.rackCode || (locationCode ? parseLocationCode(locationCode)?.rackCode : null);
      const rack = rackCode
        ? state.objects.find((object) => object.type === 'rack' && object.rackCode === rackCode)
        : null;

      return {
        selectedPackageId: packageId,
        highlightedPackageIds: [packageId],
        focusedLocationCode: locationCode,
        selectedLocationCode: locationCode,
        selectedId: rack?.id || state.selectedId,
        activeRackWorkspaceId: rack?.id || state.activeRackWorkspaceId,
        viewMode: locationCode ? '3D' : state.viewMode,
        packagePlacementStatus: locationCode
          ? `${item.packageId} için ${locationCode} lokasyonuna odaklanıldı.`
          : `${item.packageId} henüz yerleşmemiş.`,
      };
    }),

    clearPackageHighlights: () => set({
      highlightedPackageIds: [],
      focusedLocationCode: null,
      packageSearchQuery: '',
    }),

    selectLocation: (locationCode) => set({ selectedLocationCode: locationCode }),

    openRackWorkspace: (rackId) => set((state) => {
      const rack = state.objects.find((object) => object.id === rackId && object.type === 'rack');
      if (!rack) return state;
      return {
        activeRackWorkspaceId: rackId,
        selectedId: rackId,
      };
    }),

    closeRackWorkspace: () => set({ activeRackWorkspaceId: null }),

    addObject: (obj) => set((state) => {
      if (!state.hasActivePlan) return state;
      const nextObject = clampObjectToWarehouse(
        normalizeObject({ ...obj, id: generateId() } as WarehouseObject, state.warehouseConfig, state.objects),
        state.warehouseConfig,
        state.gridSettings,
      );
      return savePlanInState(state, {
        objects: [...state.objects, nextObject],
        selectedId: nextObject.id,
      });
    }),

    addRackGroup: (options) => set((state) => {
      if (!state.hasActivePlan) return state;
      const count = Math.max(1, Math.floor(Number(options.count) || 1));
      const rackGroup = normalizeRackGroup(options.rackGroup);
      const created: WarehouseObject[] = [];
      let workingObjects = [...state.objects];
      const baseX = 0.25;
      const baseZ = 0.25;
      const spacing = Math.max(options.depth + state.gridSettings.minimumAisleWidth, 1);

      for (let index = 0; index < count; index += 1) {
        const rackNumber = getNextRackNumber(workingObjects, rackGroup);
        const rackCode = buildRackCode(rackGroup, rackNumber);
        const rack = normalizeObject(
          {
            type: 'rack',
            id: generateId(),
            name: `${rackCode} Rafı`,
            x: baseX,
            z: baseZ + index * spacing,
            rotation: 0,
            width: options.width,
            depth: options.depth,
            height: options.height,
            widthCm: options.width * 100,
            depthCm: options.depth * 100,
            heightCm: options.height * 100,
            color: objectColors.rack,
            note: options.note,
            locked: false,
            visible: true,
            rackGroup,
            rackNumber,
            rackCode,
            shelfCount: options.shelfCount,
            binsPerShelf: options.positionsPerShelf,
            positionsPerShelf: options.positionsPerShelf,
            defaultLocationCapacity: options.defaultLocationCapacity,
            depthSlots: options.depthSlots,
            stackLevels: options.stackLevels,
            orientation: 'horizontal',
            productGroup: options.productGroup,
            productCategory: options.productGroup,
            showDimensions: true,
          } as Rack,
          state.warehouseConfig,
          workingObjects,
        );
        workingObjects = [...workingObjects, rack];
        created.push(rack);
      }

      return savePlanInState(state, {
        objects: [...state.objects, ...created],
        selectedId: created[0]?.id || state.selectedId,
      });
    }),

    updateObject: (id, updates) => set((state) => {
      const nextObjects = state.objects.map((object) => {
        if (object.id !== id) return object;
        if (object.locked && updates.locked !== false && updates.visible === undefined) return object;
        const updated = { ...object, ...updates } as WarehouseObject;
        if (updated.type === 'rack') {
          const identity = ensureUniqueRackIdentity(updated, state.objects);
          updated.rackGroup = identity.rackGroup;
          updated.rackNumber = identity.rackNumber;
          updated.rackCode = identity.rackCode;
          updated.widthCm = Math.max(1, Number(updated.widthCm || updated.width * 100));
          updated.depthCm = Math.max(1, Number(updated.depthCm || updated.depth * 100));
          updated.heightCm = Math.max(1, Number(updated.heightCm || updated.height * 100));
          updated.width = updated.widthCm / 100;
          updated.depth = updated.depthCm / 100;
          updated.height = updated.heightCm / 100;
          updated.shelfCount = Math.max(1, Math.floor(Number(updated.shelfCount || 1)));
          updated.positionsPerShelf = Math.max(1, Math.floor(Number(updated.positionsPerShelf || updated.binsPerShelf || 1)));
          updated.binsPerShelf = updated.positionsPerShelf;
          updated.depthSlots = Math.max(1, Math.floor(Number(updated.depthSlots || 1)));
          updated.stackLevels = Math.max(1, Math.floor(Number(updated.stackLevels || 1)));
          updated.defaultLocationCapacity = Math.max(1, Math.floor(Number(updated.defaultLocationCapacity || updated.depthSlots * updated.stackLevels || DEFAULT_LOCATION_CAPACITY)));
          updated.productGroup = normalizeProductGroup(updated.productGroup);
          updated.productCategory = normalizeProductGroup(updated.productCategory || updated.productGroup);
        }
        return clampObjectToWarehouse(updated, state.warehouseConfig, state.gridSettings);
      });
      return savePlanInState(state, { objects: nextObjects });
    }),

    deleteObject: (id) => set((state) => {
      const deleted = state.objects.find((object) => object.id === id);
      const deletedCodes = deleted?.type === 'rack'
        ? new Set(generateRackLocationCodes(deleted, state.locationCodeSettings).map((location) => location.locationCode))
        : new Set<string>();
      const deletedPackageIds = new Set(
        state.locationStocks
          .filter((stock) => deletedCodes.has(stock.locationCode))
          .flatMap((stock) => (stock.packages || []).map((item) => item.packageId)),
      );
      return savePlanInState(state, {
        objects: state.objects.filter((object) => object.id !== id),
        locationStocks: deletedCodes.size
          ? state.locationStocks.filter((stock) => !deletedCodes.has(stock.locationCode))
          : state.locationStocks,
        importedPackages: deletedPackageIds.size
          ? state.importedPackages.map((item) =>
              deletedPackageIds.has(item.packageId) ? { ...item, status: 'unplaced' as const, placement: null } : item,
            )
          : state.importedPackages,
        locationCapacityOverrides: deletedCodes.size
          ? state.locationCapacityOverrides.filter((override) => !deletedCodes.has(override.locationCode))
          : state.locationCapacityOverrides,
        selectedLocationCode: state.selectedLocationCode && deletedCodes.has(state.selectedLocationCode) ? null : state.selectedLocationCode,
        selectedId: state.selectedId === id ? null : state.selectedId,
        activeRackWorkspaceId: state.activeRackWorkspaceId === id ? null : state.activeRackWorkspaceId,
      });
    }),

    removeObject: (id) => get().deleteObject(id),

    duplicateObject: (id) => set((state) => {
      const source = state.objects.find((object) => object.id === id);
      if (!source) return state;
      const copy = {
        ...source,
        id: generateId(),
        x: source.x + state.gridSettings.snapSize,
        z: source.z + state.gridSettings.snapSize,
        locked: false,
      } as WarehouseObject;
      if (copy.type === 'rack') {
        const nextNumber = getNextRackNumber(state.objects, copy.rackGroup);
        copy.rackNumber = nextNumber;
        copy.rackCode = buildRackCode(copy.rackGroup, nextNumber);
        copy.name = `${copy.rackCode} Rafı`;
      }
      const clamped = clampObjectToWarehouse(copy, state.warehouseConfig, state.gridSettings);
      return savePlanInState(state, {
        objects: [...state.objects, clamped],
        selectedId: clamped.id,
      });
    }),

    selectObject: (id) => set({ selectedId: id }),

    setSelectedId: (id) => set({ selectedId: id }),

    setViewMode: (mode) => set({ viewMode: mode }),

    exportJSON: () => {
      const state = get();
      const plan: WarehousePlan = {
        version: APP_VERSION,
        id: state.activePlanId || generateId(),
        name: state.warehouseConfig.name,
        warehouseConfig: state.warehouseConfig,
        unitPreference: state.unitPreference,
        gridSettings: state.gridSettings,
        objects: state.objects,
        products: state.products,
        locationStocks: state.locationStocks,
        importedPackages: state.importedPackages,
        locationCapacityOverrides: state.locationCapacityOverrides,
        locationCodeSettings: state.locationCodeSettings,
        createdAt: getFullPlans().find((item) => item.id === state.activePlanId)?.createdAt || now(),
        updatedAt: now(),
      };
      return JSON.stringify(plan, null, 2);
    },

    importJSON: (jsonString) => {
      try {
        const raw = JSON.parse(jsonString);
        const plan = migratePlan(raw);
        if (!plan) return false;
        const plans = [...getFullPlans().filter((item) => item.id !== plan.id), plan];
        cacheFullPlans(plans);
        persist({ activePlanId: plan.id, plans });
        set({
          warehouseConfig: plan.warehouseConfig,
          warehouse: plan.warehouseConfig,
          unitPreference: plan.unitPreference,
          gridSettings: plan.gridSettings,
          locationCodeSettings: plan.locationCodeSettings,
          objects: plan.objects,
          products: plan.products,
          locationStocks: plan.locationStocks,
          importedPackages: plan.importedPackages || [],
          locationCapacityOverrides: plan.locationCapacityOverrides,
          selectedLocationCode: null,
          selectedPackageId: null,
          packageSearchQuery: '',
          highlightedPackageIds: [],
          focusedLocationCode: null,
          activeRackWorkspaceId: null,
          selectedId: null,
          plans: planSummaries(plans),
          activePlanId: plan.id,
          hasActivePlan: true,
          warnings: validateObjects(plan.objects, plan.warehouseConfig, plan.gridSettings),
          saveStatus: 'JSON içe aktarıldı',
          sharedSyncStatus: 'Ortak kayda yazılıyor',
        });
        return true;
      } catch (error) {
        console.error('JSON içe aktarma başarısız', error);
        return false;
      }
    },

    importData: (jsonString) => {
      get().importJSON(jsonString);
    },

    exportLocationsCSV: () => locationsToCsv(get().generateLocationCodes()),

    exportRacksCSV: () => racksToCsv(get().objects),

    exportSummaryCSV: () => summaryToCsv(calculateAreaUsage(
      get().objects,
      get().warehouseConfig,
      get().locationStocks,
      get().locationCapacityOverrides,
    )),

    generateLocationCodes: (rackId) => {
      const state = get();
      if (!rackId) {
        return generateAllLocationCodes(
          state.objects,
          state.locationCodeSettings,
          state.locationStocks,
          state.locationCapacityOverrides,
        );
      }
      const rack = state.objects.find((object) => object.id === rackId && object.type === 'rack');
      return rack?.type === 'rack'
        ? generateRackLocationCodes(rack, state.locationCodeSettings, state.locationStocks, state.locationCapacityOverrides)
        : [];
    },

    validateLayout: () => {
      const state = get();
      const warnings = validateObjects(state.objects, state.warehouseConfig, state.gridSettings);
      set({ warnings });
      return warnings;
    },

    loadInitialData: () => get().loadSamplePlan(),

    clearAll: () => get().resetPlan(),
  };
});
