import { create } from 'zustand';
import { WarehouseObject, WarehouseConfig, Rack, WarehouseObjectNoId } from '../types';
import { v4 as uuidv4 } from 'uuid';

export type ViewMode = '3D' | 'Top';

interface StoreState {
  warehouse: WarehouseConfig;
  objects: WarehouseObject[];
  selectedId: string | null;
  viewMode: ViewMode;

  setWarehouseSize: (width: number, length: number, height: number) => void;
  addObject: (obj: WarehouseObjectNoId) => void;
  updateObject: (id: string, updates: Partial<WarehouseObject>) => void;
  removeObject: (id: string) => void;
  duplicateObject: (id: string) => void;
  setSelectedId: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  importData: (data: string) => void;
  loadInitialData: () => void;
  clearAll: () => void;
}

const STORAGE_KEY = 'dsdst-warehouse-data';

const getInitialData = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved data', e);
    }
  }
  return null;
};

const DEFAULT_WAREHOUSE: WarehouseConfig = {
  width: 20,
  length: 20,
  height: 5,
};

const INITIAL_OBJECTS: WarehouseObjectNoId[] = [
  // 5 Racks
  { type: 'rack', x: -6, z: -4, rotation: 0, width: 2, depth: 0.6, height: 1.8, code: 'A', shelves: 4, binsPerShelf: 7 },
  { type: 'rack', x: -3, z: -4, rotation: 0, width: 2, depth: 0.6, height: 1.8, code: 'B', shelves: 4, binsPerShelf: 7 },
  { type: 'rack', x: 0, z: -4, rotation: 0, width: 2, depth: 0.6, height: 1.8, code: 'C', shelves: 4, binsPerShelf: 7 },
  { type: 'rack', x: 3, z: -4, rotation: 0, width: 2, depth: 0.6, height: 1.8, code: 'D', shelves: 4, binsPerShelf: 7 },
  { type: 'rack', x: 6, z: -4, rotation: 0, width: 2, depth: 0.6, height: 1.8, code: 'E', shelves: 4, binsPerShelf: 7 },
  
  // Packing area
  { type: 'packing', x: 0, z: 6, rotation: 0, width: 6, depth: 3, height: 0.1 },
  
  // Columns
  { type: 'column', x: -5, z: 1, rotation: 0, width: 0.5, depth: 0.5, height: 5 },
  { type: 'column', x: 5, z: 1, rotation: 0, width: 0.5, depth: 0.5, height: 5 },

  // Path
  { type: 'path', x: 0, z: -1, rotation: 0, width: 16, depth: 2, height: 0.05 },
];

const generateId = () => uuidv4();

const saveToLocalStorage = (data: any) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const useStore = create<StoreState>((set, get) => {
  const savedData = getInitialData();

  function saveState(state: StoreState) {
    saveToLocalStorage({
      warehouse: state.warehouse,
      objects: state.objects,
    });
  }

  let defObjects = INITIAL_OBJECTS.map(o => ({ ...o, id: generateId() })) as WarehouseObject[];

  const initialState = {
    warehouse: savedData?.warehouse || DEFAULT_WAREHOUSE,
    objects: savedData?.objects || defObjects,
    selectedId: null,
    viewMode: '3D' as ViewMode,
  };

  return {
    ...initialState,

    setWarehouseSize: (width, length, height) => set((state) => {
      const next = { warehouse: { width, length, height } };
      saveState({ ...state, ...next });
      return next;
    }),

    addObject: (obj) => set((state) => {
      const newObj = { ...obj, id: generateId() } as WarehouseObject;
      const next = { objects: [...state.objects, newObj], selectedId: newObj.id };
      saveState({ ...state, ...next });
      return next;
    }),

    updateObject: (id, updates) => set((state) => {
      const next = {
        objects: state.objects.map((obj) => (obj.id === id ? { ...obj, ...updates } : obj)) as WarehouseObject[],
      };
      saveState({ ...state, ...next });
      return next;
    }),

    removeObject: (id) => set((state) => {
      const next = {
        objects: state.objects.filter((obj) => obj.id !== id),
        selectedId: state.selectedId === id ? null : state.selectedId,
      };
      saveState({ ...state, ...next });
      return next;
    }),

    duplicateObject: (id) => set((state) => {
      const obj = state.objects.find((o) => o.id === id);
      if (!obj) return state;
      const newObj = { ...obj, id: generateId(), x: obj.x + 1, z: obj.z + 1 } as WarehouseObject;
      if (newObj.type === 'rack') {
        const nextCodeCharCode = (state.objects.filter(o => o.type === 'rack').length + 65);
        (newObj as Rack).code = String.fromCharCode(nextCodeCharCode > 90 ? 90 : nextCodeCharCode);
      }
      const next = { objects: [...state.objects, newObj], selectedId: newObj.id };
      saveState({ ...state, ...next });
      return next;
    }),

    setSelectedId: (id) => set({ selectedId: id }),

    setViewMode: (mode) => set({ viewMode: mode }),

    importData: (jsonString) => set((state) => {
      try {
        const data = JSON.parse(jsonString);
        if (data && data.warehouse && data.objects) {
          saveToLocalStorage(data);
          return { warehouse: data.warehouse, objects: data.objects, selectedId: null };
        }
      } catch (e) {
        console.error('Import failed', e);
      }
      return state;
    }),

    loadInitialData: () => set((state) => {
      const defObjects = INITIAL_OBJECTS.map(o => ({ ...o, id: generateId() })) as WarehouseObject[];
      const next = { warehouse: DEFAULT_WAREHOUSE, objects: defObjects, selectedId: null };
      saveState({ ...state, ...next });
      return next;
    }),

    clearAll: () => set((state) => {
      const next = { objects: [], selectedId: null };
      saveState({ ...state, ...next });
      return next;
    })
  };
});
