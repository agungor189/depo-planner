import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArchiveRestore,
  Columns3,
  DoorOpen,
  Download,
  FileDown,
  FileUp,
  Map,
  Package,
  PackageCheck,
  PackageOpen,
  Plus,
  Route,
  Search,
  Shield,
  Square,
  Trash2,
  Truck,
  Upload,
  Warehouse,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { ProductGroup, UnitPreference, ViewMode, WarehouseObjectNoId } from '../../types';
import {
  AISLE_OPTIONS,
  GRID_OPTIONS,
  buildRackCode,
  calculateAreaUsage,
  displayMeasure,
  fromMeters,
  getNextRackNumber,
  normalizeRackGroup,
  trimNumber,
  toMeters,
} from '../../utils/warehouse';

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const viewOptions: Array<{ value: ViewMode; label: string }> = [
  { value: '2D', label: '2D Plan' },
  { value: '3D', label: '3D Görünüm' },
  { value: 'ISO', label: 'İzometrik' },
  { value: 'TOP', label: 'Üstten' },
];

const productGroups: ProductGroup[] = ['Alüminyum', 'Döküm', 'Karbon Çelik', 'PPR', 'Diğer', 'Karışık'];

export function LeftPanel() {
  const warehouseConfig = useStore((state) => state.warehouseConfig);
  const unitPreference = useStore((state) => state.unitPreference);
  const gridSettings = useStore((state) => state.gridSettings);
  const objects = useStore((state) => state.objects);
  const products = useStore((state) => state.products);
  const importedPackages = useStore((state) => state.importedPackages);
  const selectedPackageId = useStore((state) => state.selectedPackageId);
  const packageSearchQuery = useStore((state) => state.packageSearchQuery);
  const locationStocks = useStore((state) => state.locationStocks);
  const locationCapacityOverrides = useStore((state) => state.locationCapacityOverrides);
  const placementStatus = useStore((state) => state.placementStatus);
  const packagePlacementStatus = useStore((state) => state.packagePlacementStatus);
  const plans = useStore((state) => state.plans);
  const activePlanId = useStore((state) => state.activePlanId);
  const viewMode = useStore((state) => state.viewMode);
  const selectedId = useStore((state) => state.selectedId);
  const addObject = useStore((state) => state.addObject);
  const addRackGroup = useStore((state) => state.addRackGroup);
  const addProduct = useStore((state) => state.addProduct);
  const deleteProduct = useStore((state) => state.deleteProduct);
  const autoPlaceProduct = useStore((state) => state.autoPlaceProduct);
  const selectObject = useStore((state) => state.selectObject);
  const setUnitPreference = useStore((state) => state.setUnitPreference);
  const updateWarehouseConfig = useStore((state) => state.updateWarehouseConfig);
  const setGridSize = useStore((state) => state.setGridSize);
  const updateGridSettings = useStore((state) => state.updateGridSettings);
  const setViewMode = useStore((state) => state.setViewMode);
  const loadSamplePlan = useStore((state) => state.loadSamplePlan);
  const resetPlan = useStore((state) => state.resetPlan);
  const duplicatePlan = useStore((state) => state.duplicatePlan);
  const deletePlan = useStore((state) => state.deletePlan);
  const setActivePlan = useStore((state) => state.setActivePlan);
  const exportJSON = useStore((state) => state.exportJSON);
  const importJSON = useStore((state) => state.importJSON);
  const importPackagesExport = useStore((state) => state.importPackagesExport);
  const importPackageManifest = useStore((state) => state.importPackageManifest);
  const selectPackage = useStore((state) => state.selectPackage);
  const setPackageSearchQuery = useStore((state) => state.setPackageSearchQuery);
  const focusPackage = useStore((state) => state.focusPackage);
  const exportLocationsCSV = useStore((state) => state.exportLocationsCSV);
  const exportRacksCSV = useStore((state) => state.exportRacksCSV);
  const exportSummaryCSV = useStore((state) => state.exportSummaryCSV);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const manifestInputRef = useRef<HTMLInputElement>(null);
  const packagesInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: warehouseConfig.name,
    width: String(fromMeters(warehouseConfig.width, unitPreference)),
    length: String(fromMeters(warehouseConfig.length, unitPreference)),
    height: String(fromMeters(warehouseConfig.height, unitPreference)),
  });
  const [rackDraft, setRackDraft] = useState({
    rackGroup: 'A',
    rackNumber: '1',
    count: '1',
    shelfCount: '4',
    positionsPerShelf: '7',
    defaultLocationCapacity: '2',
    depthSlots: '2',
    stackLevels: '1',
    width: '1.8',
    depth: '0.6',
    height: '1.8',
    productGroup: 'Karışık' as ProductGroup,
    note: '',
  });
  const [productDraft, setProductDraft] = useState({
    sku: 'AL-125-B',
    productName: '1 İnç 90° Dirsek',
    supplierCode: 'AL-125-B',
    category: 'Alüminyum' as ProductGroup,
    packageCount: '10',
    quantityInsidePackage: '75',
    boxWidthCm: '36',
    boxDepthCm: '25',
    boxHeightCm: '25',
    weightKg: '0',
    note: '',
  });
  const [packageFilter, setPackageFilter] = useState<'all' | 'unplaced' | 'placed'>('unplaced');

  useEffect(() => {
    setForm({
      name: warehouseConfig.name,
      width: String(Number(fromMeters(warehouseConfig.width, unitPreference).toFixed(unitPreference === 'cm' ? 0 : 2))),
      length: String(Number(fromMeters(warehouseConfig.length, unitPreference).toFixed(unitPreference === 'cm' ? 0 : 2))),
      height: String(Number(fromMeters(warehouseConfig.height, unitPreference).toFixed(unitPreference === 'cm' ? 0 : 2))),
    });
  }, [warehouseConfig, unitPreference]);

  const normalizedRackGroup = normalizeRackGroup(rackDraft.rackGroup);
  const suggestedRackNumber = getNextRackNumber(objects, normalizedRackGroup);
  const rackPreview = buildRackCode(normalizedRackGroup, Number(rackDraft.rackNumber) || suggestedRackNumber);

  useEffect(() => {
    setRackDraft((current) => ({
      ...current,
      rackGroup: normalizedRackGroup,
      rackNumber: String(suggestedRackNumber),
    }));
  }, [normalizedRackGroup, suggestedRackNumber]);

  const layers = useMemo(() => objects.filter((object) => object.visible), [objects]);

  const handleApplyWarehouse = () => {
    const width = toMeters(Number(form.width), unitPreference);
    const length = toMeters(Number(form.length), unitPreference);
    const height = toMeters(Number(form.height), unitPreference);
    if (!form.name.trim() || width <= 0 || length <= 0 || height <= 0) return;

    const shouldScale = window.confirm(
      'Mevcut objeleri orantılı olarak ölçeklendirmek ister misiniz?\n\nTamam: Objeleri ölçeklendir\nİptal: Objelerin gerçek ölçülerini koru',
    );
    updateWarehouseConfig({ name: form.name.trim(), width, length, height }, shouldScale);
  };

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const result = readerEvent.target?.result;
      if (typeof result === 'string') importJSON(result);
    };
    reader.readAsText(file);
    event.currentTarget.value = '';
  };

  const handleManifestImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const result = readerEvent.target?.result;
      if (typeof result === 'string') importPackageManifest(result);
    };
    reader.readAsText(file);
    event.currentTarget.value = '';
  };

  const handlePackagesExportImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const result = readerEvent.target?.result;
      if (typeof result === 'string') importPackagesExport(result);
    };
    reader.readAsText(file);
    event.currentTarget.value = '';
  };

  const add = (type: WarehouseObjectNoId['type']) => {
    const rackGroup = normalizeRackGroup(rackDraft.rackGroup);
    const rackNumber = Number(rackDraft.rackNumber) || getNextRackNumber(objects, rackGroup);
    const rackCode = buildRackCode(rackGroup, rackNumber);
    const base = {
      name: '',
      x: 0.25,
      z: 0.25,
      rotation: 0,
      width: 1,
      depth: 1,
      height: 1,
      color: '#2563eb',
      note: '',
      locked: false,
      visible: true,
    };

    if (type === 'rack') {
      const widthMeters = toMeters(Number(rackDraft.width), unitPreference);
      const depthMeters = toMeters(Number(rackDraft.depth), unitPreference);
      const heightMeters = toMeters(Number(rackDraft.height), unitPreference);
      addObject({
        ...base,
        type,
        name: `${rackCode} Rafı`,
        width: widthMeters,
        depth: depthMeters,
        height: heightMeters,
        widthCm: Math.max(1, widthMeters * 100),
        depthCm: Math.max(1, depthMeters * 100),
        heightCm: Math.max(1, heightMeters * 100),
        rackGroup,
        rackNumber,
        rackCode,
        shelfCount: Math.max(1, Math.floor(Number(rackDraft.shelfCount) || 4)),
        binsPerShelf: Math.max(1, Math.floor(Number(rackDraft.positionsPerShelf) || 7)),
        positionsPerShelf: Math.max(1, Math.floor(Number(rackDraft.positionsPerShelf) || 7)),
        defaultLocationCapacity: Math.max(1, Math.floor(Number(rackDraft.defaultLocationCapacity) || 2)),
        depthSlots: Math.max(1, Math.floor(Number(rackDraft.depthSlots) || 1)),
        stackLevels: Math.max(1, Math.floor(Number(rackDraft.stackLevels) || 1)),
        orientation: 'horizontal',
        productGroup: rackDraft.productGroup,
        productCategory: rackDraft.productGroup,
        note: rackDraft.note,
        showDimensions: true,
      });
      return;
    }

    if (type === 'column') {
      addObject({ ...base, type, name: 'Kolon', width: 0.35, depth: 0.35, height: warehouseConfig.height, color: '#64748b' });
      return;
    }

    if (type === 'packing') {
      addObject({ ...base, type, name: 'Paketleme', width: 2.4, depth: 1.2, height: 0.9, tableHeight: 0.9, color: '#f97316' });
      return;
    }

    if (type === 'path') {
      addObject({ ...base, type, name: 'Yürüme Yolu', width: 3, depth: gridSettings.minimumAisleWidth, height: 0.04, striped: true, color: '#94a3b8' });
      return;
    }

    if (type === 'door') {
      addObject({ ...base, type, name: 'Kapı', x: 1, z: 0, width: 1.2, depth: 0.12, height: 2.2, wall: 'south', direction: 'both', color: '#38bdf8' });
      return;
    }

    if (type === 'shipping') {
      addObject({ ...base, type, name: 'Sevkiyat', width: 1.4, depth: 1.2, height: 0.08, color: '#f59e0b' });
      return;
    }

    if (type === 'receiving') {
      addObject({ ...base, type, name: 'Mal Kabul', width: 1.4, depth: 1.2, height: 0.08, color: '#10b981' });
      return;
    }

    if (type === 'safety') {
      addObject({ ...base, type, name: 'Boş Güvenlik Alanı', width: 1.2, depth: 1.2, height: 0.05, color: '#ef4444' });
      return;
    }

    addObject({ ...base, type: 'note', name: 'Not', width: 1.2, depth: 0.6, height: 0.05, text: 'Not', color: '#eab308' });
  };

  const objectButtons = [
    { type: 'column', label: 'Kolon', icon: Columns3 },
    { type: 'packing', label: 'Paketleme', icon: Square },
    { type: 'path', label: 'Yürüme Yolu', icon: Route },
    { type: 'door', label: 'Kapı', icon: DoorOpen },
    { type: 'shipping', label: 'Sevkiyat', icon: Truck },
    { type: 'receiving', label: 'Mal Kabul', icon: PackageCheck },
    { type: 'safety', label: 'Güvenlik', icon: Shield },
  ] as const;

  const handleCreateRackGroup = () => {
    addRackGroup({
      rackGroup: normalizedRackGroup,
      count: Math.max(1, Math.floor(Number(rackDraft.count) || 1)),
      shelfCount: Math.max(1, Math.floor(Number(rackDraft.shelfCount) || 4)),
      positionsPerShelf: Math.max(1, Math.floor(Number(rackDraft.positionsPerShelf) || 7)),
      defaultLocationCapacity: Math.max(1, Math.floor(Number(rackDraft.defaultLocationCapacity) || 2)),
      depthSlots: Math.max(1, Math.floor(Number(rackDraft.depthSlots) || 1)),
      stackLevels: Math.max(1, Math.floor(Number(rackDraft.stackLevels) || 1)),
      width: toMeters(Number(rackDraft.width), unitPreference),
      depth: toMeters(Number(rackDraft.depth), unitPreference),
      height: toMeters(Number(rackDraft.height), unitPreference),
      productGroup: rackDraft.productGroup,
      note: rackDraft.note,
    });
  };

  const handleAddProduct = () => {
    const packageCount = Math.max(1, Math.floor(Number(productDraft.packageCount) || 1));
    addProduct({
      sku: productDraft.sku,
      productName: productDraft.productName,
      supplierCode: productDraft.supplierCode,
      category: productDraft.category,
      packageCount,
      quantityInsidePackage: Math.max(0, Math.floor(Number(productDraft.quantityInsidePackage) || 0)),
      boxWidthCm: Math.max(0, Number(productDraft.boxWidthCm) || 0),
      boxDepthCm: Math.max(0, Number(productDraft.boxDepthCm) || 0),
      boxHeightCm: Math.max(0, Number(productDraft.boxHeightCm) || 0),
      weightKg: Math.max(0, Number(productDraft.weightKg) || 0),
      note: productDraft.note,
    });
  };

  const handleAddAndAutoPlaceProduct = () => {
    const sku = productDraft.sku.trim().toUpperCase();
    const packageCount = Math.max(1, Math.floor(Number(productDraft.packageCount) || 1));
    handleAddProduct();
    window.setTimeout(() => {
      const product = useStore.getState().products.find((item) => item.sku === sku);
      if (product) useStore.getState().autoPlaceProduct(product.id, packageCount);
    }, 0);
  };

  const packagesBySku = useMemo(
    () =>
      locationStocks.reduce<Record<string, number>>((totals, stock) => {
        totals[stock.sku] = (totals[stock.sku] || 0) + stock.currentPackages;
        return totals;
      }, {}),
    [locationStocks],
  );
  const visibleImportedPackages = useMemo(() => {
    const query = packageSearchQuery.trim().toLocaleLowerCase('tr-TR');
    return importedPackages.filter((item) => {
      if (packageFilter !== 'all' && item.status !== packageFilter) return false;
      if (!query) return true;
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
      ].join(' ').toLocaleLowerCase('tr-TR').includes(query);
    });
  }, [importedPackages, packageFilter, packageSearchQuery]);
  const importedPackageCounts = useMemo(
    () => ({
      all: importedPackages.length,
      unplaced: importedPackages.filter((item) => item.status === 'unplaced').length,
      placed: importedPackages.filter((item) => item.status === 'placed').length,
    }),
    [importedPackages],
  );
  const packageUsage = useMemo(
    () => calculateAreaUsage(objects, warehouseConfig, locationStocks, locationCapacityOverrides),
    [objects, warehouseConfig, locationStocks, locationCapacityOverrides],
  );

  return (
    <aside className="z-10 flex w-80 shrink-0 flex-col overflow-y-auto border-r border-slate-800 bg-slate-900/95 p-4 text-slate-200">
      <section className="border-b border-slate-800 pb-4" style={{ order: 0 }}>
        <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
          <Warehouse className="h-4 w-4 text-blue-400" />
          Depo Ayarları
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Depo adı</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Birim</span>
              <select
                value={unitPreference}
                onChange={(event) => setUnitPreference(event.target.value as UnitPreference)}
                className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="m">metre</option>
                <option value="cm">cm</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Grid</span>
              <select
                value={gridSettings.size}
                onChange={(event) => setGridSize(Number(event.target.value))}
                className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
              >
                {GRID_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['width', 'length', 'height'] as const).map((field) => (
              <label key={field}>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {field === 'width' ? 'Genişlik' : field === 'length' ? 'Uzunluk' : 'Yükseklik'}
                </span>
                <input
                  type="number"
                  step={unitPreference === 'cm' ? '1' : '0.1'}
                  value={form[field]}
                  onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
                  className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
                />
              </label>
            ))}
          </div>

          <button
            onClick={handleApplyWarehouse}
            className="flex w-full items-center justify-center gap-2 bg-blue-600 px-3 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-blue-500"
          >
            <ArchiveRestore className="h-4 w-4" />
            Depo Ölçüsünü Uygula
          </button>
        </div>
      </section>

      <section className="border-b border-slate-800 py-4" style={{ order: 30 }}>
        <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
          <Package className="h-4 w-4 text-blue-400" />
          Raf Ekle / Grup Oluştur
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Raf grubu</span>
              <input
                value={rackDraft.rackGroup}
                onChange={(event) => setRackDraft((current) => ({ ...current, rackGroup: event.target.value.toUpperCase() }))}
                className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Raf no</span>
              <input
                type="number"
                min="1"
                value={rackDraft.rackNumber}
                onChange={(event) => setRackDraft((current) => ({ ...current, rackNumber: event.target.value }))}
                className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Adet</span>
              <input
                type="number"
                min="1"
                value={rackDraft.count}
                onChange={(event) => setRackDraft((current) => ({ ...current, count: event.target.value }))}
                className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
          </div>

          <div className="border border-blue-900 bg-blue-950/30 px-3 py-2 text-xs text-blue-100">
            Önerilen sıradaki kod: <strong>{buildRackCode(normalizedRackGroup, suggestedRackNumber)}</strong> · Önizleme:{' '}
            <strong>{rackPreview}</strong>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Kat sayısı</span>
              <input
                type="number"
                min="1"
                value={rackDraft.shelfCount}
                onChange={(event) => setRackDraft((current) => ({ ...current, shelfCount: event.target.value }))}
                className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Göz / kat</span>
              <input
                type="number"
                min="1"
                value={rackDraft.positionsPerShelf}
                onChange={(event) => setRackDraft((current) => ({ ...current, positionsPerShelf: event.target.value }))}
                className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Lok. kapasite</span>
              <input
                type="number"
                min="1"
                value={rackDraft.defaultLocationCapacity}
                onChange={(event) => setRackDraft((current) => ({ ...current, defaultLocationCapacity: event.target.value }))}
                className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Ön/arka</span>
              <input
                type="number"
                min="1"
                value={rackDraft.depthSlots}
                onChange={(event) => {
                  const depthSlots = Math.max(1, Math.floor(Number(event.target.value) || 1));
                  setRackDraft((current) => ({
                    ...current,
                    depthSlots: String(depthSlots),
                    defaultLocationCapacity: String(depthSlots * Math.max(1, Math.floor(Number(current.stackLevels) || 1))),
                  }));
                }}
                className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Üst üste</span>
              <input
                type="number"
                min="1"
                value={rackDraft.stackLevels}
                onChange={(event) => {
                  const stackLevels = Math.max(1, Math.floor(Number(event.target.value) || 1));
                  setRackDraft((current) => ({
                    ...current,
                    stackLevels: String(stackLevels),
                    defaultLocationCapacity: String(Math.max(1, Math.floor(Number(current.depthSlots) || 1)) * stackLevels),
                  }));
                }}
                className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['width', 'depth', 'height'] as const).map((field) => (
              <label key={field}>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {field === 'width' ? 'Genişlik' : field === 'depth' ? 'Derinlik' : 'Yükseklik'} ({unitPreference})
                </span>
                <input
                  type="number"
                  min="0"
                  step={unitPreference === 'cm' ? '1' : '0.1'}
                  value={rackDraft[field]}
                  onChange={(event) => setRackDraft((current) => ({ ...current, [field]: event.target.value }))}
                  className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
                />
              </label>
            ))}
          </div>

          <label>
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Ürün grubu</span>
            <select
              value={rackDraft.productGroup}
              onChange={(event) => setRackDraft((current) => ({ ...current, productGroup: event.target.value as ProductGroup }))}
              className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
            >
              {productGroups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Açıklama</span>
            <input
              value={rackDraft.note}
              onChange={(event) => setRackDraft((current) => ({ ...current, note: event.target.value }))}
              className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => add('rack')}
              className="bg-blue-600 px-3 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-blue-500"
            >
              Tek Raf Ekle
            </button>
            <button
              onClick={handleCreateRackGroup}
              className="border border-blue-700 bg-slate-800 px-3 py-2 text-xs font-black uppercase tracking-wider text-blue-100 hover:bg-slate-700"
            >
              Grup Oluştur
            </button>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-800 py-4" style={{ order: 10 }}>
        <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
          <PackageOpen className="h-4 w-4 text-blue-400" />
          Paket Kabul / Yerleştirme
        </div>
        <input
          ref={packagesInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handlePackagesExportImport}
        />
        <div className="space-y-3">
          <button
            onClick={() => packagesInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-xs font-black uppercase tracking-wider text-emerald-100 hover:bg-emerald-900/40"
          >
            <FileUp className="h-4 w-4" />
            packages-export.json Al
          </button>

          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Paket ara</span>
            <div className="flex items-center border border-slate-700 bg-slate-950 px-2 focus-within:border-blue-500">
              <Search className="h-4 w-4 shrink-0 text-slate-500" />
              <input
                value={packageSearchQuery}
                onChange={(event) => setPackageSearchQuery(event.target.value)}
                placeholder="SKU, paket no, lot, lokasyon..."
                className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none"
              />
            </div>
          </label>

          <div className="grid grid-cols-3 gap-1">
            {([
              ['all', `Tümü ${importedPackageCounts.all}`],
              ['unplaced', `Yerleşmemiş ${importedPackageCounts.unplaced}`],
              ['placed', `Yerleşmiş ${importedPackageCounts.placed}`],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setPackageFilter(value)}
                className={`px-2 py-2 text-[10px] font-black uppercase ${
                  packageFilter === value ? 'bg-blue-600 text-white' : 'border border-slate-700 bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {packagePlacementStatus && (
            <div className="border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">{packagePlacementStatus}</div>
          )}

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {visibleImportedPackages.map((item) => (
              <button
                key={item.packageId}
                onClick={() => selectPackage(item.packageId)}
                className={`w-full border p-3 text-left text-xs transition-colors ${
                  selectedPackageId === item.packageId
                    ? 'border-blue-500 bg-blue-950/40 text-blue-100'
                    : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-blue-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-sm font-black text-blue-200">{item.packageId}</div>
                    <div className="truncate font-semibold text-slate-100">{item.productName || item.sku}</div>
                  </div>
                  <span className={`shrink-0 border px-1.5 py-0.5 text-[9px] font-black uppercase ${
                    item.status === 'placed'
                      ? 'border-emerald-700 bg-emerald-950/40 text-emerald-200'
                      : 'border-amber-700 bg-amber-950/40 text-amber-200'
                  }`}
                  >
                    {item.status === 'placed' ? 'Yerleşmiş' : 'Bekliyor'}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-[10px] text-slate-400">
                  <span>SKU: {item.sku}</span>
                  <span>Kod: {item.productCode || '-'}</span>
                  <span>Paket: {item.packageNo || item.labelIndex}</span>
                  <span>İç adet: {item.quantityPerPackage || '-'}</span>
                  <span>Lot: {item.lot || '-'}</span>
                  <span>{item.material || item.category}</span>
                </div>
                {item.placement?.locationCode && (
                  <div className="mt-2 font-mono text-[11px] text-emerald-300">Lokasyon: {item.placement.locationCode}</div>
                )}
                <div className="mt-2 flex justify-end">
                  <span
                    onClick={(event) => {
                      event.stopPropagation();
                      focusPackage(item.packageId);
                    }}
                    className="border border-blue-800 px-2 py-1 text-[10px] font-black uppercase text-blue-200 hover:bg-blue-950"
                  >
                    Paketi Bul
                  </span>
                </div>
              </button>
            ))}
            {visibleImportedPackages.length === 0 && (
              <div className="border border-slate-800 bg-slate-950 p-3 text-xs text-slate-500">
                packages-export.json import edildiğinde paketler burada listelenir.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-800 py-4" style={{ order: 20 }}>
        <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
          <PackageCheck className="h-4 w-4 text-blue-400" />
          SKU ve Otomatik Yerleştirme
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">SKU</span>
              <input
                value={productDraft.sku}
                onChange={(event) => setProductDraft((current) => ({ ...current, sku: event.target.value.toUpperCase() }))}
                className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Tedarikçi kodu</span>
              <input
                value={productDraft.supplierCode}
                onChange={(event) => setProductDraft((current) => ({ ...current, supplierCode: event.target.value.toUpperCase() }))}
                className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
          </div>
          <label>
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Ürün adı</span>
            <input
              value={productDraft.productName}
              onChange={(event) => setProductDraft((current) => ({ ...current, productName: event.target.value }))}
              className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Kategori</span>
              <select
                value={productDraft.category}
                onChange={(event) => setProductDraft((current) => ({ ...current, category: event.target.value as ProductGroup }))}
                className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
              >
                {productGroups.filter((group) => group !== 'Karışık').map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Paket</span>
              <input
                type="number"
                min="1"
                value={productDraft.packageCount}
                onChange={(event) => setProductDraft((current) => ({ ...current, packageCount: event.target.value }))}
                className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
            <label>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">İç adet</span>
              <input
                type="number"
                min="0"
                value={productDraft.quantityInsidePackage}
                onChange={(event) => setProductDraft((current) => ({ ...current, quantityInsidePackage: event.target.value }))}
                className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
              />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['boxWidthCm', 'boxDepthCm', 'boxHeightCm'] as const).map((field) => (
              <label key={field}>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {field === 'boxWidthCm' ? 'En' : field === 'boxDepthCm' ? 'Boy' : 'Yük.'} cm
                </span>
                <input
                  type="number"
                  min="0"
                  value={productDraft[field]}
                  onChange={(event) => setProductDraft((current) => ({ ...current, [field]: event.target.value }))}
                  className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
                />
              </label>
            ))}
          </div>
          <label>
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Paket ağırlığı kg</span>
            <input
              type="number"
              min="0"
              value={productDraft.weightKg}
              onChange={(event) => setProductDraft((current) => ({ ...current, weightKg: event.target.value }))}
              className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleAddProduct}
              className="flex items-center justify-center gap-2 bg-blue-600 px-3 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-blue-500"
            >
              <Plus className="h-4 w-4" />
              SKU Ekle
            </button>
            <button
              onClick={handleAddAndAutoPlaceProduct}
              className="border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-xs font-black uppercase tracking-wider text-emerald-100 hover:bg-emerald-900/40"
            >
              Otomatik Yerleştir
            </button>
          </div>
          {placementStatus && <div className="border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">{placementStatus}</div>}
          <div className="border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
            <div className="grid grid-cols-2 gap-2 font-mono">
              <span>Ana lokasyon: {packageUsage.totalLocationCount}</span>
              <span>Kapasite: {packageUsage.totalPackageCapacity}</span>
              <span>Dolu paket: {packageUsage.filledPackageCount}</span>
              <span>Boş kapasite: {packageUsage.freePackageCapacity}</span>
              <span>Doluluk: {trimNumber(packageUsage.packageUtilizationPercent, 1)}%</span>
              <span>SKU: {packageUsage.totalSkuCount}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(packageUsage.categoryPackageCounts).map(([category, count]) => (
                <span key={category} className="border border-slate-700 px-2 py-1 text-[10px] text-slate-400">
                  {category}: {count}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {products.map((product) => (
              <div
                key={product.id}
                draggable
                onDragStart={(event) => event.dataTransfer.setData('application/dsdst-product-id', product.id)}
                className="border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-black text-blue-200">{product.sku}</div>
                    <div className="truncate font-semibold text-slate-100">{product.productName}</div>
                    <div className="mt-1 text-slate-500">{product.category} · {product.supplierCode}</div>
                  </div>
                  <button
                    title="Ürün kartını sil"
                    onClick={() => deleteProduct(product.id)}
                    className="shrink-0 border border-red-900 bg-red-950/30 p-1 text-red-200 hover:bg-red-900/50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px] text-slate-400">
                  <span>Paket: {product.packageCount}</span>
                  <span>Yerleşen: {packagesBySku[product.sku] || 0}</span>
                  <span>İç adet: {product.quantityInsidePackage}</span>
                  <span>Toplam: {(packagesBySku[product.sku] || 0) * product.quantityInsidePackage}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-500">
                    {product.boxWidthCm} x {product.boxDepthCm} x {product.boxHeightCm} cm · {product.weightKg} kg
                  </span>
                  <button
                    onClick={() => autoPlaceProduct(product.id, product.packageCount)}
                    className="border border-emerald-800 px-2 py-1 text-[10px] font-black uppercase text-emerald-200 hover:bg-emerald-950"
                  >
                    Otomatik Yerleştir
                  </button>
                </div>
              </div>
            ))}
            {products.length === 0 && <div className="border border-slate-800 bg-slate-950 p-3 text-xs text-slate-500">Henüz SKU eklenmedi.</div>}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-800 py-4" style={{ order: 40 }}>
        <div className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Diğer Objeler</div>
        <div className="grid grid-cols-2 gap-2">
          {objectButtons.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => add(type)}
              className="flex min-h-14 items-center gap-2 border border-slate-700 bg-slate-800 px-2 py-2 text-left text-xs font-bold text-slate-300 hover:border-blue-500 hover:text-white"
            >
              <Icon className="h-4 w-4 shrink-0 text-blue-300" />
              <span className="leading-4">{label}</span>
            </button>
          ))}
          <button
            onClick={() => add('note')}
            className="col-span-2 flex items-center justify-center gap-2 border border-slate-700 bg-slate-800 px-2 py-2 text-xs font-bold text-slate-300 hover:border-blue-500 hover:text-white"
          >
            <Plus className="h-4 w-4 text-blue-300" />
            Not / Etiket Ekle
          </button>
        </div>
      </section>

      <section className="border-b border-slate-800 py-4" style={{ order: 50 }}>
        <div className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Görünüm Ayarları</div>
        <div className="grid grid-cols-2 gap-2">
          {viewOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setViewMode(option.value)}
              className={`px-2 py-2 text-xs font-bold uppercase ${
                viewMode === option.value ? 'bg-blue-600 text-white' : 'border border-slate-700 bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <Toggle label="Grid snap" checked={gridSettings.snap} onChange={(checked) => updateGridSettings({ snap: checked })} />
          <Toggle label="Duvarlar" checked={gridSettings.showWalls} onChange={(checked) => updateGridSettings({ showWalls: checked })} />
          <Toggle label="Ölçüler" checked={gridSettings.showMeasurements} onChange={(checked) => updateGridSettings({ showMeasurements: checked })} />
          <Toggle label="Erişim alanı" checked={gridSettings.showAccessZones} onChange={(checked) => updateGridSettings({ showAccessZones: checked })} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label>
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Snap</span>
            <select
              value={gridSettings.snapSize}
              onChange={(event) => updateGridSettings({ snapSize: Number(event.target.value) })}
              className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
            >
              {GRID_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Min. koridor</span>
            <select
              value={gridSettings.minimumAisleWidth}
              onChange={(event) => updateGridSettings({ minimumAisleWidth: Number(event.target.value) })}
              className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
            >
              {AISLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="border-b border-slate-800 py-4" style={{ order: 60 }}>
        <div className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Planlar</div>
        <div className="space-y-2">
          <select
            value={activePlanId || ''}
            onChange={(event) => setActivePlan(event.target.value)}
            className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
          >
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={duplicatePlan} className="border border-slate-700 bg-slate-800 px-2 py-2 text-xs font-bold hover:border-blue-500">
              Kopyala
            </button>
            <button
              onClick={() => activePlanId && window.confirm('Bu plan silinsin mi?') && deletePlan(activePlanId)}
              className="border border-red-900 bg-red-950/40 px-2 py-2 text-xs font-bold text-red-200 hover:bg-red-900/50"
            >
              Sil
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => window.confirm('Plan içindeki tüm objeler silinsin mi?') && resetPlan()}
              className="border border-slate-700 bg-slate-800 px-2 py-2 text-xs font-bold hover:border-blue-500"
            >
              Boş Depo
            </button>
            <button onClick={loadSamplePlan} className="border border-slate-700 bg-slate-800 px-2 py-2 text-xs font-bold hover:border-blue-500">
              Örnek Plan
            </button>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-800 py-4" style={{ order: 70 }}>
        <div className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Dışa Aktar / İçe Aktar</div>
        <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />
        <input ref={manifestInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleManifestImport} />
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 border border-slate-700 bg-slate-800 px-2 py-2 text-xs font-bold hover:border-blue-500"
          >
            <FileUp className="h-4 w-4" />
            JSON Al
          </button>
          <button
            onClick={() => downloadText('depo-plani.json', exportJSON(), 'application/json;charset=utf-8')}
            className="flex items-center justify-center gap-2 border border-slate-700 bg-slate-800 px-2 py-2 text-xs font-bold hover:border-blue-500"
          >
            <FileDown className="h-4 w-4" />
            JSON Ver
          </button>
          <button
            onClick={() => downloadText('lokasyonlar.csv', exportLocationsCSV(), 'text/csv;charset=utf-8')}
            className="flex items-center justify-center gap-2 border border-slate-700 bg-slate-800 px-2 py-2 text-xs font-bold hover:border-blue-500"
          >
            <Download className="h-4 w-4" />
            Lokasyon CSV
          </button>
          <button
            onClick={() => downloadText('raf-listesi.csv', exportRacksCSV(), 'text/csv;charset=utf-8')}
            className="flex items-center justify-center gap-2 border border-slate-700 bg-slate-800 px-2 py-2 text-xs font-bold hover:border-blue-500"
          >
            <Download className="h-4 w-4" />
            Raf CSV
          </button>
          <button
            onClick={() => downloadText('depo-ozet.csv', exportSummaryCSV(), 'text/csv;charset=utf-8')}
            className="flex items-center justify-center gap-2 border border-slate-700 bg-slate-800 px-2 py-2 text-xs font-bold hover:border-blue-500"
          >
            <Upload className="h-4 w-4 rotate-180" />
            Depo Özet CSV
          </button>
          <button
            onClick={() => manifestInputRef.current?.click()}
            className="flex items-center justify-center gap-2 border border-emerald-800 bg-emerald-950/30 px-2 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-900/40"
          >
            <FileUp className="h-4 w-4" />
            Manifest CSV Al
          </button>
        </div>
      </section>

      <section className="min-h-48 flex-1 py-4" style={{ order: 80 }}>
        <div className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Raflar ve Alanlar</div>
        <div className="space-y-1">
          {layers.map((object) => (
            <button
              key={object.id}
              onClick={() => selectObject(object.id)}
              className={`flex w-full items-center justify-between border-l-2 px-2 py-2 text-left text-xs transition-colors ${
                selectedId === object.id
                  ? 'border-blue-500 bg-blue-950/40 text-blue-100'
                  : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <span className="truncate font-semibold">
                {object.type === 'rack' ? `Raf ${object.rackCode}` : object.name}
              </span>
              <span className="ml-2 shrink-0 font-mono text-[10px] text-slate-500">
                {displayMeasure(object.width, 'm', 2)} x {displayMeasure(object.depth, 'm', 2)}
              </span>
            </button>
          ))}
        </div>
        {objects.length === 0 && <div className="border border-slate-800 bg-slate-950 p-3 text-xs text-slate-500">Depo boş.</div>}
      </section>
    </aside>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 border border-slate-800 bg-slate-950 px-2 py-2 text-slate-400">
      <span className="truncate text-[11px] font-bold">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-blue-600" />
    </label>
  );
}
