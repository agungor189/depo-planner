import {
  AreaUsage,
  GridSettings,
  LayoutWarning,
  LocationCapacityOverride,
  LocationCode,
  LocationCodeSettings,
  LocationStock,
  Rack,
  UnitPreference,
  WarehouseConfig,
  WarehouseObject,
} from '../types';

export const APP_VERSION = 5;
export const DEFAULT_LOCATION_CAPACITY = 2;

export const DEFAULT_WAREHOUSE_CONFIG: WarehouseConfig = {
  name: 'DSDST Depo',
  width: 5,
  length: 8,
  height: 3,
};

export const DEFAULT_GRID_SETTINGS: GridSettings = {
  size: 0.5,
  snap: true,
  snapSize: 0.25,
  showGrid: true,
  showWalls: true,
  showMeasurements: true,
  showAccessZones: true,
  minimumAisleWidth: 0.8,
  showPackages3D: true,
  packageColorMode: 'category',
};

export const DEFAULT_LOCATION_SETTINGS: LocationCodeSettings = {
  format: 'standard',
  shelfPrefix: 'K',
  binPrefix: 'P',
  separator: '-',
  qrPrefix: 'LOC',
};

export const GRID_OPTIONS = [
  { label: '10 cm', value: 0.1 },
  { label: '25 cm', value: 0.25 },
  { label: '50 cm', value: 0.5 },
  { label: '1 m', value: 1 },
];

export const AISLE_OPTIONS = [
  { label: '60 cm', value: 0.6 },
  { label: '80 cm', value: 0.8 },
  { label: '100 cm', value: 1 },
  { label: '120 cm', value: 1.2 },
];

export function toMeters(value: number, unit: UnitPreference): number {
  if (!Number.isFinite(value)) return 0;
  return unit === 'cm' ? value / 100 : value;
}

export function fromMeters(value: number, unit: UnitPreference): number {
  if (!Number.isFinite(value)) return 0;
  return unit === 'cm' ? value * 100 : value;
}

export function displayMeasure(value: number, unit: UnitPreference, digits = 2): string {
  const converted = fromMeters(value, unit);
  return `${trimNumber(converted, digits)} ${unit}`;
}

export function trimNumber(value: number, digits = 2): string {
  return Number(value.toFixed(digits)).toLocaleString('tr-TR', {
    maximumFractionDigits: digits,
  });
}

export function normalizeRotation(rotation: number): number {
  if (!Number.isFinite(rotation)) return 0;
  const full = Math.PI * 2;
  return ((rotation % full) + full) % full;
}

export function getFootprint(obj: Pick<WarehouseObject, 'width' | 'depth' | 'rotation'>) {
  const rotation = normalizeRotation(obj.rotation);
  const cos = Math.abs(Math.cos(rotation));
  const sin = Math.abs(Math.sin(rotation));

  return {
    width: obj.width * cos + obj.depth * sin,
    depth: obj.width * sin + obj.depth * cos,
  };
}

export function snapValue(value: number, snapSize: number): number {
  if (!snapSize || snapSize <= 0) return value;
  return Math.round(value / snapSize) * snapSize;
}

export function clampObjectToWarehouse<T extends WarehouseObject>(
  object: T,
  warehouseConfig: WarehouseConfig,
  gridSettings?: GridSettings,
): T {
  const footprint = getFootprint(object);
  const snapSize = gridSettings?.snap ? gridSettings.snapSize : 0;
  const snappedX = snapSize ? snapValue(object.x, snapSize) : object.x;
  const snappedZ = snapSize ? snapValue(object.z, snapSize) : object.z;
  const maxX = Math.max(0, warehouseConfig.width - footprint.width);
  const maxZ = Math.max(0, warehouseConfig.length - footprint.depth);

  return {
    ...object,
    x: roundMeters(Math.min(Math.max(snappedX, 0), maxX)),
    z: roundMeters(Math.min(Math.max(snappedZ, 0), maxZ)),
    width: Math.max(0.01, object.width),
    depth: Math.max(0.01, object.depth),
    height: Math.max(0.01, object.height),
  };
}

export function roundMeters(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function normalizeRackGroup(group?: string): string {
  const cleaned = String(group || 'A')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return cleaned || 'A';
}

export function buildRackCode(rackGroup: string, rackNumber: number): string {
  return `${normalizeRackGroup(rackGroup)}${Math.max(1, Math.floor(Number(rackNumber) || 1))}`;
}

export function parseRackCode(value?: string): { rackGroup: string; rackNumber: number } {
  const text = String(value || 'A1').trim().toUpperCase();
  const match = text.match(/^([A-Z]+)(\d+)$/);
  if (match) {
    return {
      rackGroup: normalizeRackGroup(match[1]),
      rackNumber: Math.max(1, Number(match[2])),
    };
  }

  const legacyLetter = text.match(/^([A-Z]+)$/);
  if (legacyLetter) {
    return { rackGroup: normalizeRackGroup(legacyLetter[1]), rackNumber: 1 };
  }

  return { rackGroup: 'A', rackNumber: 1 };
}

export function getNextRackNumber(objects: WarehouseObject[], rackGroup: string): number {
  const group = normalizeRackGroup(rackGroup);
  const usedNumbers = objects
    .filter((object): object is Rack => object.type === 'rack' && normalizeRackGroup(object.rackGroup) === group)
    .map((rack) => Math.max(1, Math.floor(Number(rack.rackNumber) || 1)));

  for (let number = 1; number <= usedNumbers.length + 1; number += 1) {
    if (!usedNumbers.includes(number)) return number;
  }

  return usedNumbers.length + 1;
}

export function getNextRackIdentity(objects: WarehouseObject[], preferredGroup = 'A') {
  const rackGroup = normalizeRackGroup(preferredGroup);
  const rackNumber = getNextRackNumber(objects, rackGroup);
  return { rackGroup, rackNumber, rackCode: buildRackCode(rackGroup, rackNumber) };
}

export function ensureUniqueRackIdentity(
  rack: Pick<Rack, 'rackGroup' | 'rackNumber' | 'id'>,
  objects: WarehouseObject[],
) {
  const rackGroup = normalizeRackGroup(rack.rackGroup);
  let rackNumber = Math.max(1, Math.floor(Number(rack.rackNumber) || 1));
  const exists = (number: number) =>
    objects.some(
      (object) =>
        object.type === 'rack' &&
        object.id !== rack.id &&
        normalizeRackGroup(object.rackGroup) === rackGroup &&
        Math.max(1, Math.floor(Number(object.rackNumber) || 1)) === number,
    );

  if (exists(rackNumber)) {
    rackNumber = getNextRackNumber(objects.filter((object) => object.id !== rack.id), rackGroup);
  }

  return { rackGroup, rackNumber, rackCode: buildRackCode(rackGroup, rackNumber) };
}

export function isSolidObject(object: WarehouseObject): boolean {
  return ['rack', 'column', 'packing', 'shipping', 'receiving'].includes(object.type) && object.visible;
}

export function getObjectLabel(object: WarehouseObject): string {
  if (object.type === 'rack') return `Raf ${object.rackCode}`;
  if (object.type === 'column') return object.name || 'Kolon';
  if (object.type === 'packing') return object.name || 'Paketleme';
  if (object.type === 'path') return object.name || 'Yürüme Yolu';
  if (object.type === 'door') return object.name || 'Kapı';
  if (object.type === 'shipping') return object.name || 'Sevkiyat';
  if (object.type === 'receiving') return object.name || 'Mal Kabul';
  if (object.type === 'safety') return object.name || 'Güvenlik Alanı';
  return object.text || object.name || 'Not';
}

export function objectsOverlap(a: WarehouseObject, b: WarehouseObject): boolean {
  const aFootprint = getFootprint(a);
  const bFootprint = getFootprint(b);
  return (
    a.x < b.x + bFootprint.width &&
    a.x + aFootprint.width > b.x &&
    a.z < b.z + bFootprint.depth &&
    a.z + aFootprint.depth > b.z
  );
}

export function validateLayout(
  objects: WarehouseObject[],
  warehouseConfig: WarehouseConfig,
  gridSettings: GridSettings,
): LayoutWarning[] {
  const warnings: LayoutWarning[] = [];

  if (warehouseConfig.width <= 0 || warehouseConfig.length <= 0 || warehouseConfig.height <= 0) {
    warnings.push({
      id: 'warehouse-invalid-size',
      severity: 'error',
      objectIds: [],
      message: 'Depo genişliği, uzunluğu ve yüksekliği 0’dan büyük olmalı.',
    });
  }

  objects.forEach((object) => {
    if (!object.visible) return;
    const footprint = getFootprint(object);
    const label = getObjectLabel(object);

    if (object.width <= 0 || object.depth <= 0 || object.height <= 0) {
      warnings.push({
        id: `${object.id}-invalid-size`,
        severity: 'error',
        objectIds: [object.id],
        message: `${label} ölçüleri 0’dan büyük olmalı.`,
      });
    }

    if (
      object.x < 0 ||
      object.z < 0 ||
      object.x + footprint.width > warehouseConfig.width ||
      object.z + footprint.depth > warehouseConfig.length
    ) {
      warnings.push({
        id: `${object.id}-out-of-bounds`,
        severity: 'error',
        objectIds: [object.id],
        message: `${label} depo sınırının dışına taşıyor.`,
      });
    }

    if (object.height > warehouseConfig.height && object.type !== 'path' && object.type !== 'door') {
      warnings.push({
        id: `${object.id}-too-high`,
        severity: 'warning',
        objectIds: [object.id],
        message: `${label} depo yüksekliğinden büyük.`,
      });
    }

    if (object.type === 'path') {
      const narrowSide = Math.min(object.width, object.depth);
      if (narrowSide < gridSettings.minimumAisleWidth) {
        warnings.push({
          id: `${object.id}-narrow-path`,
          severity: 'warning',
          objectIds: [object.id],
          message: `${label} minimum koridor genişliğinin altında.`,
        });
      }
    }
  });

  objects.forEach((object, index) => {
    if (!isSolidObject(object)) return;
    objects.slice(index + 1).forEach((other) => {
      if (!isSolidObject(other)) return;
      if (!objectsOverlap(object, other)) return;

      warnings.push({
        id: `${object.id}-${other.id}-collision`,
        severity: 'error',
        objectIds: [object.id, other.id],
        message: `${getObjectLabel(object)} ile ${getObjectLabel(other)} çakışıyor.`,
      });
    });
  });

  const racks = objects.filter((object): object is Rack => object.type === 'rack' && object.visible);
  const seenRackCodes = new Map<string, string>();
  racks.forEach((rack, index) => {
    const rackCode = rack.rackCode || buildRackCode(rack.rackGroup, rack.rackNumber);
    const existingId = seenRackCodes.get(rackCode);
    if (existingId) {
      warnings.push({
        id: `${rack.id}-${existingId}-duplicate-rack-code`,
        severity: 'error',
        objectIds: [rack.id, existingId],
        message: `${rackCode} raf kodu birden fazla kullanılıyor.`,
      });
    }
    seenRackCodes.set(rackCode, rack.id);

    const rackFootprint = getFootprint(rack);
    racks.slice(index + 1).forEach((other) => {
      const otherFootprint = getFootprint(other);
      const overlapX = rack.x < other.x + otherFootprint.width && rack.x + rackFootprint.width > other.x;
      const overlapZ = rack.z < other.z + otherFootprint.depth && rack.z + rackFootprint.depth > other.z;

      if (overlapX) {
        const gap = Math.max(other.z - (rack.z + rackFootprint.depth), rack.z - (other.z + otherFootprint.depth));
        if (gap > 0 && gap < gridSettings.minimumAisleWidth) {
          warnings.push({
            id: `${rack.id}-${other.id}-narrow-aisle-z`,
            severity: 'warning',
            objectIds: [rack.id, other.id],
            message: `${rack.rackCode} ve ${other.rackCode} rafları arasındaki koridor çok dar.`,
          });
        }
      }

      if (overlapZ) {
        const gap = Math.max(other.x - (rack.x + rackFootprint.width), rack.x - (other.x + otherFootprint.width));
        if (gap > 0 && gap < gridSettings.minimumAisleWidth) {
          warnings.push({
            id: `${rack.id}-${other.id}-narrow-aisle-x`,
            severity: 'warning',
            objectIds: [rack.id, other.id],
            message: `${rack.rackCode} ve ${other.rackCode} rafları arasındaki koridor çok dar.`,
          });
        }
      }
    });
  });

  return warnings;
}

export function formatLocationCode(
  rack: Rack,
  shelf: number,
  bin: number,
  _settings: LocationCodeSettings,
): string {
  return `${rack.rackCode}-K${shelf}-P${bin}`;
}

export function getQrContent(locationCode: string, settings: LocationCodeSettings): string {
  return settings.qrPrefix === 'DSDST' ? `DSDST|LOC|${locationCode}` : `LOC:${locationCode}`;
}

export function getProductQrContent(
  location: Pick<LocationCode, 'locationCode' | 'sku' | 'currentPackages' | 'capacityPackages'>,
): string {
  if (!location.sku || location.currentPackages <= 0) return `LOC:${location.locationCode}`;
  return `DSDST|LOC|${location.locationCode}|SKU|${location.sku}|PKG|${location.currentPackages}/${location.capacityPackages}`;
}

export function getRackPositionCount(rack: Rack): number {
  return Math.max(1, Math.floor(Number(rack.positionsPerShelf || rack.binsPerShelf || 7)));
}

export function getRackDefaultLocationCapacity(rack: Rack): number {
  const derived = Math.max(1, Math.floor(Number(rack.depthSlots || 1))) * Math.max(1, Math.floor(Number(rack.stackLevels || 1)));
  return Math.max(1, Math.floor(Number(rack.defaultLocationCapacity || derived || DEFAULT_LOCATION_CAPACITY)));
}

export function getLocationCapacity(
  rack: Rack,
  locationCode: string,
  locationStocks: LocationStock[] = [],
  locationCapacityOverrides: LocationCapacityOverride[] = [],
): number {
  const override = locationCapacityOverrides.find((item) => item.locationCode === locationCode);
  if (override) return Math.max(1, Math.floor(Number(override.capacityPackages) || 1));
  const stock = locationStocks.find((item) => item.locationCode === locationCode);
  if (stock?.capacityPackages) return Math.max(1, Math.floor(Number(stock.capacityPackages) || 1));
  return getRackDefaultLocationCapacity(rack);
}

export function estimateLocationCapacity(
  rack: Rack,
  packageProfile: { boxDepthCm: number; boxHeightCm: number },
) {
  const rackDepthCm = Math.max(1, Number(rack.depthCm || rack.depth * 100 || 60));
  const shelfClearHeightCm = Math.max(1, Number(rack.heightCm || rack.height * 100 || 180) / Math.max(1, rack.shelfCount));
  const boxDepthCm = Math.max(1, Number(packageProfile.boxDepthCm || 25));
  const boxHeightCm = Math.max(1, Number(packageProfile.boxHeightCm || 25));
  const depthSlots = Math.max(1, Math.floor(rackDepthCm / boxDepthCm));
  const stackLevels = Math.max(1, Math.floor(shelfClearHeightCm / boxHeightCm));
  return {
    depthSlots: Math.min(depthSlots, 4),
    stackLevels: Math.min(stackLevels, 4),
    capacityPackages: Math.min(Math.max(1, depthSlots * stackLevels), 99),
  };
}

export function generateLocationCodes(
  rack: Rack,
  settings: LocationCodeSettings,
  locationStocks: LocationStock[] = [],
  locationCapacityOverrides: LocationCapacityOverride[] = [],
): LocationCode[] {
  const codes: LocationCode[] = [];
  const shelves = Math.max(0, Math.floor(rack.shelfCount));
  const bins = getRackPositionCount(rack);
  const stockByLocation = new Map(locationStocks.map((stock) => [stock.locationCode, stock]));

  for (let shelf = 1; shelf <= shelves; shelf += 1) {
    for (let bin = 1; bin <= bins; bin += 1) {
      const locationCode = formatLocationCode(rack, shelf, bin, settings);
      const shelfCode = `K${shelf}`;
      const binCode = `P${bin}`;
      const stock = stockByLocation.get(locationCode);
      const capacityPackages = getLocationCapacity(rack, locationCode, locationStocks, locationCapacityOverrides);
      const currentPackages = Math.min(
        Math.max(0, Math.floor(Number(stock?.currentPackages || 0))),
        capacityPackages,
      );
      const quantityInsidePackage = Math.max(0, Number(stock?.quantityInsidePackage || 0));
      const packages = Array.isArray(stock?.packages) ? stock.packages : [];
      const location: LocationCode = {
        locationCode,
        rackGroup: rack.rackGroup,
        rackNumber: rack.rackNumber,
        rackCode: rack.rackCode,
        shelfCode,
        binCode,
        shelfNumber: shelf,
        binNumber: bin,
        positionNumber: bin,
        rackName: rack.name,
        productGroup: rack.productGroup,
        x: rack.x,
        z: rack.z,
        width: rack.width,
        depth: rack.depth,
        height: rack.height,
        note: stock?.note || rack.note,
        capacityPackages,
        currentPackages,
        sku: stock?.sku || '',
        productName: stock?.productName || '',
        category: stock?.category || rack.productCategory || rack.productGroup,
        supplierCode: stock?.supplierCode || '',
        packageQuantity: quantityInsidePackage,
        totalItemQuantity: currentPackages * quantityInsidePackage,
        packageIds: packages.map((item) => item.packageId).join('|'),
        boxWidthCm: stock?.boxWidthCm || packages[0]?.boxWidthCm || 36,
        boxDepthCm: stock?.boxDepthCm || packages[0]?.boxDepthCm || 25,
        boxHeightCm: stock?.boxHeightCm || packages[0]?.boxHeightCm || 25,
        weightKg: stock?.weightKg || packages[0]?.weightKg || 0,
        packages,
        qrContent: getQrContent(locationCode, settings),
        productQrContent: '',
      };
      location.productQrContent = getProductQrContent(location);
      codes.push({
        ...location,
      });
    }
  }

  return codes;
}

export function generateAllLocationCodes(
  objects: WarehouseObject[],
  settings: LocationCodeSettings,
  locationStocks: LocationStock[] = [],
  locationCapacityOverrides: LocationCapacityOverride[] = [],
): LocationCode[] {
  return objects
    .filter((object): object is Rack => object.type === 'rack')
    .flatMap((rack) => generateLocationCodes(rack, settings, locationStocks, locationCapacityOverrides));
}

export function calculateAreaUsage(
  objects: WarehouseObject[],
  warehouseConfig: WarehouseConfig,
  locationStocks: LocationStock[] = [],
  locationCapacityOverrides: LocationCapacityOverride[] = [],
): AreaUsage {
  const totalWarehouseArea = warehouseConfig.width * warehouseConfig.length;
  const visibleObjects = objects.filter((object) => object.visible);
  const rackArea = visibleObjects
    .filter((object) => object.type === 'rack')
    .reduce((sum, object) => sum + object.width * object.depth, 0);
  const packingArea = visibleObjects
    .filter((object) => object.type === 'packing')
    .reduce((sum, object) => sum + object.width * object.depth, 0);
  const pathArea = visibleObjects
    .filter((object) => object.type === 'path')
    .reduce((sum, object) => sum + object.width * object.depth, 0);
  const usedArea = visibleObjects
    .filter((object) => ['rack', 'packing', 'shipping', 'receiving', 'column'].includes(object.type))
    .reduce((sum, object) => sum + object.width * object.depth, 0);
  const freeArea = Math.max(totalWarehouseArea - usedArea, 0);
  const racks = visibleObjects.filter((object): object is Rack => object.type === 'rack');
  const allLocations = generateAllLocationCodes(racks, DEFAULT_LOCATION_SETTINGS, locationStocks, locationCapacityOverrides);
  const totalLocationCount = allLocations.length;
  const totalPackageCapacity = allLocations.reduce((sum, location) => sum + location.capacityPackages, 0);
  const filledPackageCount = locationStocks.reduce((sum, stock) => sum + Math.min(stock.currentPackages, stock.capacityPackages), 0);
  const categoryPackageCounts = locationStocks.reduce<Record<string, number>>((totals, stock) => {
    totals[stock.category] = (totals[stock.category] || 0) + Math.min(stock.currentPackages, stock.capacityPackages);
    return totals;
  }, {});
  const totalSkuCount = new Set(locationStocks.filter((stock) => stock.currentPackages > 0).map((stock) => stock.sku)).size;

  return {
    totalWarehouseArea,
    usedArea,
    rackArea,
    packingArea,
    pathArea,
    freeArea,
    utilizationPercent: totalWarehouseArea > 0 ? (usedArea / totalWarehouseArea) * 100 : 0,
    rackCount: racks.length,
    totalLocationCount,
    packingAreaCount: visibleObjects.filter((object) => object.type === 'packing').length,
    columnCount: visibleObjects.filter((object) => object.type === 'column').length,
    totalPackageCapacity,
    filledPackageCount,
    freePackageCapacity: Math.max(totalPackageCapacity - filledPackageCount, 0),
    packageUtilizationPercent: totalPackageCapacity > 0 ? (filledPackageCount / totalPackageCapacity) * 100 : 0,
    totalSkuCount,
    categoryPackageCounts,
  };
}

function csvEscape(value: string | number): string {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: Array<Record<string, string | number>>, columns: string[]): string {
  const header = columns.join(',');
  const body = rows.map((row) => columns.map((column) => csvEscape(row[column] ?? '')).join(','));
  return [header, ...body].join('\n');
}

export function locationsToCsv(locations: LocationCode[]): string {
  const columns = [
    'locationCode',
    'rackCode',
    'shelfNumber',
    'positionNumber',
    'capacityPackages',
    'currentPackages',
    'sku',
    'productName',
    'category',
    'packageIds',
    'boxWidthCm',
    'boxDepthCm',
    'boxHeightCm',
    'note',
  ];
  return toCsv(
    locations.map((location) => ({
      locationCode: location.locationCode,
      rackCode: location.rackCode,
      shelfNumber: location.shelfNumber,
      positionNumber: location.positionNumber,
      capacityPackages: location.capacityPackages,
      currentPackages: location.currentPackages,
      sku: location.sku,
      productName: location.productName,
      category: location.category,
      packageIds: location.packageIds,
      boxWidthCm: location.boxWidthCm,
      boxDepthCm: location.boxDepthCm,
      boxHeightCm: location.boxHeightCm,
      note: location.note,
    })),
    columns,
  );
}

export function racksToCsv(objects: WarehouseObject[]): string {
  const columns = [
    'rackGroup',
    'rackNumber',
    'rackCode',
    'rackName',
    'shelfCount',
    'positionsPerShelf',
    'defaultLocationCapacity',
    'depthSlots',
    'stackLevels',
    'totalLocations',
    'totalPackageCapacity',
    'widthCm',
    'depthCm',
    'heightCm',
    'x',
    'z',
    'rotation',
  ];
  const rows = objects
    .filter((object): object is Rack => object.type === 'rack')
    .map((rack) => ({
      rackGroup: rack.rackGroup,
      rackNumber: rack.rackNumber,
      rackCode: rack.rackCode,
      rackName: rack.name,
      shelfCount: rack.shelfCount,
      positionsPerShelf: getRackPositionCount(rack),
      defaultLocationCapacity: getRackDefaultLocationCapacity(rack),
      depthSlots: rack.depthSlots || 1,
      stackLevels: rack.stackLevels || 1,
      totalLocations: rack.shelfCount * getRackPositionCount(rack),
      totalPackageCapacity: rack.shelfCount * getRackPositionCount(rack) * getRackDefaultLocationCapacity(rack),
      widthCm: rack.widthCm || rack.width * 100,
      depthCm: rack.depthCm || rack.depth * 100,
      heightCm: rack.heightCm || rack.height * 100,
      x: rack.x,
      z: rack.z,
      rotation: Math.round((rack.rotation * 180) / Math.PI),
    }));

  return toCsv(rows, columns);
}

export function summaryToCsv(areaUsage: AreaUsage): string {
  const columns = [
    'totalWarehouseArea',
    'usedArea',
    'freeArea',
    'rackCount',
    'totalLocationCount',
    'packingAreaCount',
    'columnCount',
    'totalPackageCapacity',
    'filledPackageCount',
    'freePackageCapacity',
    'packageUtilizationPercent',
    'totalSkuCount',
  ];

  return toCsv(
    [
      {
        totalWarehouseArea: roundMeters(areaUsage.totalWarehouseArea),
        usedArea: roundMeters(areaUsage.usedArea),
        freeArea: roundMeters(areaUsage.freeArea),
        rackCount: areaUsage.rackCount,
        totalLocationCount: areaUsage.totalLocationCount,
        packingAreaCount: areaUsage.packingAreaCount,
        columnCount: areaUsage.columnCount,
        totalPackageCapacity: areaUsage.totalPackageCapacity,
        filledPackageCount: areaUsage.filledPackageCount,
        freePackageCapacity: areaUsage.freePackageCapacity,
        packageUtilizationPercent: roundMeters(areaUsage.packageUtilizationPercent),
        totalSkuCount: areaUsage.totalSkuCount,
      },
    ],
    columns,
  );
}
