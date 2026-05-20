import {
  AreaUsage,
  GridSettings,
  LayoutWarning,
  LocationCode,
  LocationCodeSettings,
  Rack,
  UnitPreference,
  WarehouseConfig,
  WarehouseObject,
} from '../types';

export const APP_VERSION = 2;

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
};

export const DEFAULT_LOCATION_SETTINGS: LocationCodeSettings = {
  format: 'standard',
  shelfPrefix: '',
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

export function isSolidObject(object: WarehouseObject): boolean {
  return ['rack', 'column', 'packing', 'shipping', 'receiving'].includes(object.type) && object.visible;
}

export function getObjectLabel(object: WarehouseObject): string {
  if (object.type === 'rack') return `Raf ${object.code}`;
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
  racks.forEach((rack, index) => {
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
            message: `${rack.code} ve ${other.code} rafları arasındaki koridor çok dar.`,
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
            message: `${rack.code} ve ${other.code} rafları arasındaki koridor çok dar.`,
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
  settings: LocationCodeSettings,
): string {
  const separator = settings.separator || '-';
  const shelfValue = settings.format === 'padded' ? String(shelf).padStart(2, '0') : String(shelf);
  const binValue = settings.format === 'padded' ? String(bin).padStart(2, '0') : String(bin);
  const binCode = `${settings.binPrefix || ''}${binValue}`;

  if (settings.format === 'verbose') return `RAF-${rack.code}-KAT-${shelf}-${binCode}`;
  if (settings.format === 'slash') return `${rack.code}/L${shelf}/B${String(bin).padStart(2, '0')}`;

  const shelfCode = settings.shelfPrefix ? `${settings.shelfPrefix}${shelfValue}` : shelfValue;
  return [rack.code, shelfCode, binCode].join(separator);
}

export function getQrContent(locationCode: string, settings: LocationCodeSettings): string {
  return settings.qrPrefix === 'DSDST' ? `DSDST|LOC|${locationCode}` : `LOC:${locationCode}`;
}

export function generateLocationCodes(rack: Rack, settings: LocationCodeSettings): LocationCode[] {
  const codes: LocationCode[] = [];
  const shelves = Math.max(0, Math.floor(rack.shelves));
  const bins = Math.max(0, Math.floor(rack.binsPerShelf));

  for (let shelf = 1; shelf <= shelves; shelf += 1) {
    for (let bin = 1; bin <= bins; bin += 1) {
      const locationCode = formatLocationCode(rack, shelf, bin, settings);
      codes.push({
        locationCode,
        rackCode: rack.code,
        shelf,
        bin,
        rackName: rack.name,
        productGroup: rack.productGroup,
        x: rack.x,
        z: rack.z,
        width: rack.width,
        depth: rack.depth,
        height: rack.height,
        note: rack.note,
        qrContent: getQrContent(locationCode, settings),
      });
    }
  }

  return codes;
}

export function generateAllLocationCodes(
  objects: WarehouseObject[],
  settings: LocationCodeSettings,
): LocationCode[] {
  return objects
    .filter((object): object is Rack => object.type === 'rack')
    .flatMap((rack) => generateLocationCodes(rack, settings));
}

export function calculateAreaUsage(objects: WarehouseObject[], warehouseConfig: WarehouseConfig): AreaUsage {
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

  return {
    totalWarehouseArea,
    usedArea,
    rackArea,
    packingArea,
    pathArea,
    freeArea,
    utilizationPercent: totalWarehouseArea > 0 ? (usedArea / totalWarehouseArea) * 100 : 0,
    rackCount: racks.length,
    totalLocationCount: racks.reduce((sum, rack) => sum + rack.shelves * rack.binsPerShelf, 0),
    packingAreaCount: visibleObjects.filter((object) => object.type === 'packing').length,
    columnCount: visibleObjects.filter((object) => object.type === 'column').length,
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
    'shelf',
    'bin',
    'rackName',
    'productGroup',
    'x',
    'z',
    'width',
    'depth',
    'height',
    'note',
  ];
  return toCsv(
    locations.map((location) => ({
      locationCode: location.locationCode,
      rackCode: location.rackCode,
      shelf: location.shelf,
      bin: location.bin,
      rackName: location.rackName,
      productGroup: location.productGroup,
      x: location.x,
      z: location.z,
      width: location.width,
      depth: location.depth,
      height: location.height,
      note: location.note,
    })),
    columns,
  );
}

export function racksToCsv(objects: WarehouseObject[]): string {
  const columns = [
    'rackCode',
    'rackName',
    'shelves',
    'binsPerShelf',
    'totalLocations',
    'width',
    'depth',
    'height',
    'x',
    'z',
    'rotation',
  ];
  const rows = objects
    .filter((object): object is Rack => object.type === 'rack')
    .map((rack) => ({
      rackCode: rack.code,
      rackName: rack.name,
      shelves: rack.shelves,
      binsPerShelf: rack.binsPerShelf,
      totalLocations: rack.shelves * rack.binsPerShelf,
      width: rack.width,
      depth: rack.depth,
      height: rack.height,
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
      },
    ],
    columns,
  );
}
