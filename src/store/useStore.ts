import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  GridSettings,
  LayoutWarning,
  LocationCode,
  LocationCodeSettings,
  PlanSummary,
  ProductGroup,
  Rack,
  UnitPreference,
  ViewMode,
  WarehouseConfig,
  WarehouseObject,
  WarehouseObjectNoId,
  WarehousePlan,
} from '../types';
import {
  APP_VERSION,
  DEFAULT_GRID_SETTINGS,
  DEFAULT_LOCATION_SETTINGS,
  DEFAULT_WAREHOUSE_CONFIG,
  calculateAreaUsage,
  buildRackCode,
  clampObjectToWarehouse,
  ensureUniqueRackIdentity,
  generateAllLocationCodes,
  generateLocationCodes as generateRackLocationCodes,
  getNextRackIdentity,
  getNextRackNumber,
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
  selectedId: string | null;
  viewMode: ViewMode;
  plans: PlanSummary[];
  activePlanId: string | null;
  hasActivePlan: boolean;
  warnings: LayoutWarning[];
  saveStatus: string;
  sharedSyncStatus: string;

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
  addObject: (obj: WarehouseObjectNoId) => void;
  addRackGroup: (options: {
    rackGroup: string;
    count: number;
    shelfCount: number;
    binsPerShelf: number;
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
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string) {
  try {
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
    ...(raw || {}),
    shelfPrefix: raw?.shelfPrefix || DEFAULT_LOCATION_SETTINGS.shelfPrefix,
    binPrefix: raw?.binPrefix || DEFAULT_LOCATION_SETTINGS.binPrefix,
    separator: raw?.separator || DEFAULT_LOCATION_SETTINGS.separator,
  };
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
      rackGroup: identity.rackGroup,
      rackNumber: identity.rackNumber,
      rackCode: identity.rackCode,
      shelfCount: 4,
      binsPerShelf: 7,
      orientation: 'horizontal',
      productGroup: 'Karışık' as ProductGroup,
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
    normalized.shelfCount = Math.max(1, Math.floor(Number(rawRack.shelfCount ?? rawRack.shelves ?? 4)));
    normalized.binsPerShelf = Math.max(1, Math.floor(Number(normalized.binsPerShelf || 7)));
    normalized.orientation = normalized.orientation || 'horizontal';
    normalized.productGroup = normalized.productGroup || 'Karışık';
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
    ['A', 1, 0.35, 0.45, 'Alüminyum'],
    ['A', 2, 3.0, 0.45, 'Alüminyum'],
    ['B', 1, 0.35, 2.15, 'Döküm'],
    ['C', 1, 3.0, 2.15, 'Karbon Çelik'],
    ['C', 2, 0.35, 3.85, 'PPR'],
  ].forEach(([rackGroup, rackNumber, x, z, productGroup]) => {
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
      shelfCount: 4,
      binsPerShelf: 7,
      orientation: 'horizontal',
      productGroup: productGroup as ProductGroup,
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

function migratePlan(raw: any): WarehousePlan | null {
  if (!raw) return null;

  if (raw.warehouseConfig && Array.isArray(raw.objects)) {
    const warehouseConfig = normalizeWarehouseConfig(raw.warehouseConfig);
    const objects = raw.objects.reduce((list: WarehouseObject[], object: any) => {
      if (!object?.type) return list;
      list.push(normalizeObject(object, warehouseConfig, list));
      return list;
    }, []);
    return {
      version: APP_VERSION,
      id: raw.id || generateId(),
      name: raw.name || warehouseConfig.name,
      warehouseConfig,
      unitPreference: raw.unitPreference === 'cm' ? 'cm' : 'm',
      gridSettings: { ...DEFAULT_GRID_SETTINGS, ...(raw.gridSettings || {}) },
      objects,
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
      selectedId: null,
      plans: planSummaries(plans),
      activePlanId: null,
      hasActivePlan: false,
      warnings: [],
      saveStatus,
      sharedSyncStatus,
    };
  }

  return {
    warehouseConfig: plan.warehouseConfig,
    warehouse: plan.warehouseConfig,
    unitPreference: plan.unitPreference,
    gridSettings: plan.gridSettings,
    locationCodeSettings: normalizeLocationCodeSettings(plan.locationCodeSettings),
    objects: plan.objects,
    selectedId: null,
    plans: planSummaries(plans),
    activePlanId: plan.id,
    hasActivePlan: true,
    warnings: validateObjects(plan.objects, plan.warehouseConfig, plan.gridSettings),
    saveStatus,
    sharedSyncStatus,
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
    selectedId: null,
    viewMode: '2D',
    plans: planSummaries(persistedData.plans),
    activePlanId: activePlan?.id || null,
    hasActivePlan: Boolean(activePlan),
    warnings: initialWarnings,
    saveStatus: activePlan ? 'Kaydedildi' : 'Plan bekleniyor',
    sharedSyncStatus: activePlan ? 'Yerel kayıt yüklendi' : 'Ortak kayıt bekleniyor',

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
      const plan = makePlan(warehouseConfig.name, warehouseConfig, objects, 'm');
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
            color: objectColors.rack,
            note: options.note,
            locked: false,
            visible: true,
            rackGroup,
            rackNumber,
            rackCode,
            shelfCount: options.shelfCount,
            binsPerShelf: options.binsPerShelf,
            orientation: 'horizontal',
            productGroup: options.productGroup,
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
          updated.shelfCount = Math.max(1, Math.floor(Number(updated.shelfCount || 1)));
          updated.binsPerShelf = Math.max(1, Math.floor(Number(updated.binsPerShelf || 1)));
        }
        return clampObjectToWarehouse(updated, state.warehouseConfig, state.gridSettings);
      });
      return savePlanInState(state, { objects: nextObjects });
    }),

    deleteObject: (id) => set((state) => savePlanInState(state, {
      objects: state.objects.filter((object) => object.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    })),

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

    exportSummaryCSV: () => summaryToCsv(calculateAreaUsage(get().objects, get().warehouseConfig)),

    generateLocationCodes: (rackId) => {
      const state = get();
      if (!rackId) return generateAllLocationCodes(state.objects, state.locationCodeSettings);
      const rack = state.objects.find((object) => object.id === rackId && object.type === 'rack');
      return rack?.type === 'rack' ? generateRackLocationCodes(rack, state.locationCodeSettings) : [];
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
