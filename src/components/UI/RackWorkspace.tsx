import { ChangeEvent, DragEvent, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Box,
  FileUp,
  LocateFixed,
  PackageCheck,
  PackageOpen,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { LocationCode, PackageColorMode, ProductGroup, Rack, WarehouseImportedPackage } from '../../types';

type PackageFilter = 'unplaced' | 'rack' | 'placed' | 'all';
type RackFaceSide = 'front' | 'back';

const categoryClasses: Record<ProductGroup, string> = {
  Alüminyum: 'border-cyan-700 bg-cyan-950/40 text-cyan-100',
  Döküm: 'border-violet-700 bg-violet-950/40 text-violet-100',
  'Karbon Çelik': 'border-zinc-600 bg-zinc-900/70 text-zinc-100',
  PPR: 'border-emerald-700 bg-emerald-950/40 text-emerald-100',
  Karışık: 'border-amber-700 bg-amber-950/40 text-amber-100',
  Diğer: 'border-slate-700 bg-slate-900 text-slate-100',
};

const packageColorModes: Array<{ value: PackageColorMode; label: string }> = [
  { value: 'category', label: 'Kategori' },
  { value: 'material', label: 'Malzeme' },
  { value: 'type', label: 'Tip' },
  { value: 'dimension', label: 'Ölçü' },
  { value: 'sku', label: 'SKU' },
];

function packageHaystack(item: WarehouseImportedPackage) {
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
  ].join(' ').toLocaleLowerCase('tr-TR');
}

function packageMatches(item: WarehouseImportedPackage, query: string) {
  const normalized = query.trim().toLocaleLowerCase('tr-TR');
  return !normalized || packageHaystack(item).includes(normalized);
}

function getSideUsage(location: LocationCode, side: RackFaceSide, rack: Rack) {
  const depthSlots = Math.max(1, Math.floor(Number(rack.depthSlots || 1)));
  const faceCount = depthSlots > 1 ? 2 : 1;
  const frontCapacity = faceCount === 1 ? location.capacityPackages : Math.ceil(location.capacityPackages / 2);
  const backCapacity = faceCount === 1 ? 0 : Math.max(0, location.capacityPackages - frontCapacity);
  const capacity = side === 'front' ? frontCapacity : backCapacity;
  const current = side === 'front'
    ? Math.min(location.currentPackages, frontCapacity)
    : Math.max(0, Math.min(location.currentPackages - frontCapacity, backCapacity));
  const packages = side === 'front'
    ? location.packages.slice(0, frontCapacity)
    : location.packages.slice(frontCapacity, frontCapacity + backCapacity);

  return { capacity, current, packages };
}

function cellClass(location: LocationCode, selected: boolean, highlighted: boolean) {
  if (highlighted) return 'border-amber-300 bg-amber-950/60 text-amber-50 shadow-[0_0_0_1px_rgba(251,191,36,0.6)]';
  if (selected) return 'border-blue-300 bg-blue-950/60 text-blue-50 shadow-[0_0_0_1px_rgba(96,165,250,0.55)]';
  if (location.currentPackages <= 0) return 'border-slate-800 bg-slate-950 text-slate-300 hover:border-blue-600';
  if (location.currentPackages >= location.capacityPackages) return `${categoryClasses[location.category] || categoryClasses.Diğer} hover:border-emerald-300`;
  return 'border-amber-700 bg-amber-950/35 text-amber-100 hover:border-amber-300';
}

function formatPackageTitle(item: WarehouseImportedPackage) {
  return item.productName || item.productCode || item.sku || item.packageId;
}

function RackFaceGrid({
  rack,
  side,
  title,
  locations,
  selectedLocationCode,
  highlightedPackageIds,
  selectedPackageId,
  onSelectLocation,
  onDropPackage,
}: {
  rack: Rack;
  side: RackFaceSide;
  title: string;
  locations: LocationCode[];
  selectedLocationCode: string | null;
  highlightedPackageIds: string[];
  selectedPackageId: string | null;
  onSelectLocation: (location: LocationCode) => void;
  onDropPackage: (packageId: string, location: LocationCode) => void;
}) {
  const positionCount = Math.max(1, rack.positionsPerShelf || rack.binsPerShelf || 1);
  const shelves = Array.from({ length: Math.max(1, rack.shelfCount) }, (_, index) => rack.shelfCount - index);
  const locationsByKey = useMemo(() => {
    return new Map(locations.map((location) => [`${location.shelfNumber}-${location.positionNumber}`, location]));
  }, [locations]);

  const handleDrop = (event: DragEvent<HTMLButtonElement>, location: LocationCode) => {
    event.preventDefault();
    const packageId = event.dataTransfer.getData('text/plain');
    if (packageId) onDropPackage(packageId, location);
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col border border-slate-800 bg-slate-900/40">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            {side === 'front' ? 'Paket dizilimi önden başlar' : 'Aynı rafın arka kapasitesi'}
          </div>
          <h2 className="text-base font-black text-slate-100">{title}</h2>
        </div>
        <div className="font-mono text-xs text-slate-500">{rack.rackCode}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-2">
        <div className="space-y-1.5">
          {shelves.map((shelfNumber) => (
            <div key={`${side}-${shelfNumber}`} className="grid gap-1" style={{ gridTemplateColumns: `42px repeat(${positionCount}, minmax(0, 1fr))` }}>
              <div className="flex min-w-0 items-center justify-center border border-slate-800 bg-slate-950 font-mono text-xs font-black text-blue-200">
                K{shelfNumber}
              </div>
              {Array.from({ length: positionCount }, (_, index) => {
                const positionNumber = index + 1;
                const location = locationsByKey.get(`${shelfNumber}-${positionNumber}`);
                if (!location) return null;
                const usage = getSideUsage(location, side, rack);
                const selected = selectedLocationCode === location.locationCode;
                const highlighted = location.packages.some((item) => highlightedPackageIds.includes(item.packageId));
                const selectedPackageInside = location.packages.some((item) => item.packageId === selectedPackageId);
                const muted = usage.capacity === 0;

                return (
                  <button
                    key={`${side}-${location.locationCode}`}
                    type="button"
                    onClick={() => onSelectLocation(location)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleDrop(event, location)}
                    className={`min-h-20 min-w-0 border p-1.5 text-left transition-colors ${cellClass(location, selected, highlighted || selectedPackageInside)} ${
                      muted ? 'opacity-45' : ''
                    }`}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-1">
                      <div className="min-w-0 truncate font-mono text-[10px] font-black">{location.locationCode}</div>
                      <div className="shrink-0 font-mono text-[10px] font-black">
                        {usage.current}/{usage.capacity || 0}
                      </div>
                    </div>
                    <div className="mt-1 truncate text-[10px] font-bold">
                      {usage.capacity === 0 ? 'Arka slot yok' : location.sku || 'Boş'}
                    </div>
                    <div className="truncate text-[10px] text-slate-400">{location.productName || '0 paket'}</div>
                    <div className="mt-1 flex min-h-5 flex-wrap gap-1">
                      {usage.packages.slice(0, 2).map((item) => (
                        <span
                          key={item.packageId}
                          className={`max-w-full truncate border px-1 py-0.5 font-mono text-[9px] ${
                            item.packageId === selectedPackageId || highlightedPackageIds.includes(item.packageId)
                              ? 'border-amber-300 bg-amber-900/60 text-amber-50'
                              : 'border-slate-700 bg-slate-950/70 text-slate-300'
                          }`}
                        >
                          {item.packageId}
                        </span>
                      ))}
                      {usage.packages.length > 2 && <span className="text-[9px] text-slate-400">+{usage.packages.length - 2}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PackageCard({
  item,
  selected,
  highlighted,
  bulkSelected,
  onToggleBulk,
  onSelect,
  onFocus,
}: {
  item: WarehouseImportedPackage;
  selected: boolean;
  highlighted: boolean;
  bulkSelected: boolean;
  onToggleBulk: (checked: boolean) => void;
  onSelect: () => void;
  onFocus: () => void;
}) {
  const statusClass = item.status === 'placed'
    ? 'border-emerald-700 bg-emerald-950/25'
    : highlighted
      ? 'border-amber-400 bg-amber-950/40'
      : 'border-slate-800 bg-slate-950';

  return (
    <article
      draggable
      onDragStart={(event) => event.dataTransfer.setData('text/plain', item.packageId)}
      className={`border p-3 text-xs ${selected ? 'ring-2 ring-blue-400' : ''} ${statusClass}`}
    >
      <label className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
        <input
          type="checkbox"
          checked={bulkSelected}
          onChange={(event) => onToggleBulk(event.target.checked)}
          className="h-4 w-4 accent-blue-600"
        />
        Toplu işlem
      </label>
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-sm font-black text-blue-100">{item.packageId}</div>
            <div className="truncate font-bold text-slate-100">{item.sku}</div>
          </div>
          <span className={`shrink-0 border px-2 py-1 font-mono text-[10px] ${item.status === 'placed' ? 'border-emerald-600 text-emerald-100' : 'border-slate-700 text-slate-300'}`}>
            {item.status === 'placed' ? item.placement?.locationCode : 'Yerleşmemiş'}
          </span>
        </div>
        <div className="mt-2 line-clamp-2 text-slate-300">{formatPackageTitle(item)}</div>
        <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-slate-500">
          <span>Koli: {item.packageNo || '-'}</span>
          <span>Lot: {item.lot || '-'}</span>
          <span>Adet: {item.quantityPerPackage || item.quantityInsidePackage || '-'}</span>
          <span>Kod: {item.productCode || '-'}</span>
        </div>
      </button>
      <button
        type="button"
        onClick={onFocus}
        className="mt-3 flex w-full items-center justify-center gap-2 border border-blue-800 bg-blue-950/40 px-2 py-2 text-[11px] font-black text-blue-100 hover:bg-blue-900/50"
      >
        <LocateFixed className="h-3.5 w-3.5" />
        Paketi Bul
      </button>
    </article>
  );
}

export function RackWorkspace() {
  const activeRackWorkspaceId = useStore((state) => state.activeRackWorkspaceId);
  const closeRackWorkspace = useStore((state) => state.closeRackWorkspace);
  const gridSettings = useStore((state) => state.gridSettings);
  const updateGridSettings = useStore((state) => state.updateGridSettings);
  const objects = useStore((state) => state.objects);
  const generateLocationCodes = useStore((state) => state.generateLocationCodes);
  const selectedLocationCode = useStore((state) => state.selectedLocationCode);
  const selectLocation = useStore((state) => state.selectLocation);
  const importedPackages = useStore((state) => state.importedPackages);
  const selectedPackageId = useStore((state) => state.selectedPackageId);
  const selectPackage = useStore((state) => state.selectPackage);
  const packageSearchQuery = useStore((state) => state.packageSearchQuery);
  const setPackageSearchQuery = useStore((state) => state.setPackageSearchQuery);
  const highlightedPackageIds = useStore((state) => state.highlightedPackageIds);
  const placeImportedPackage = useStore((state) => state.placeImportedPackage);
  const unplaceImportedPackage = useStore((state) => state.unplaceImportedPackage);
  const unplaceImportedPackages = useStore((state) => state.unplaceImportedPackages);
  const deleteImportedPackages = useStore((state) => state.deleteImportedPackages);
  const clearLocation = useStore((state) => state.clearLocation);
  const importPackagesExport = useStore((state) => state.importPackagesExport);
  const addManualPackage = useStore((state) => state.addManualPackage);
  const focusPackage = useStore((state) => state.focusPackage);
  const packagePlacementStatus = useStore((state) => state.packagePlacementStatus);
  const packageInputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<PackageFilter>('unplaced');
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);
  const [manualDraft, setManualDraft] = useState({
    sku: '',
    productName: '',
    productCode: '',
    lot: '',
    packageNo: '',
    quantityPerPackage: '1',
    dimensionsLabel: '36 x 25 x 25 cm',
    material: 'Diğer' as ProductGroup,
  });

  const rack = objects.find((object): object is Rack => object.id === activeRackWorkspaceId && object.type === 'rack') || null;
  const locations = rack ? generateLocationCodes(rack.id) : [];
  const selectedLocation = locations.find((location) => location.locationCode === selectedLocationCode) || null;
  const selectedPackage = selectedPackageId
    ? importedPackages.find((item) => item.packageId === selectedPackageId) || null
    : null;

  const rackPackageIds = useMemo(() => {
    return new Set(locations.flatMap((location) => location.packages.map((item) => item.packageId)));
  }, [locations]);

  const rackPackages = useMemo(() => {
    return importedPackages.filter((item) => rackPackageIds.has(item.packageId) || item.placement?.rackCode === rack?.rackCode);
  }, [importedPackages, rack?.rackCode, rackPackageIds]);

  const visiblePackages = useMemo(() => {
    return importedPackages
      .filter((item) => {
        if (filter === 'unplaced') return item.status === 'unplaced';
        if (filter === 'placed') return item.status === 'placed';
        if (filter === 'rack') return rackPackageIds.has(item.packageId) || item.placement?.rackCode === rack?.rackCode;
        return true;
      })
      .filter((item) => packageMatches(item, packageSearchQuery))
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'unplaced' ? -1 : 1;
        return a.packageId.localeCompare(b.packageId, 'tr');
      });
  }, [filter, importedPackages, packageSearchQuery, rack?.rackCode, rackPackageIds]);

  const visiblePackageIds = useMemo(() => visiblePackages.map((item) => item.packageId), [visiblePackages]);
  const rackPackageIdList = useMemo(() => rackPackages.map((item) => item.packageId), [rackPackages]);
  const allPackageIds = useMemo(() => importedPackages.map((item) => item.packageId), [importedPackages]);
  const selectedBulkSet = useMemo(() => new Set(selectedBulkIds), [selectedBulkIds]);

  const totals = useMemo(() => {
    const capacity = locations.reduce((sum, location) => sum + location.capacityPackages, 0);
    const filled = locations.reduce((sum, location) => sum + location.currentPackages, 0);
    const skuCount = new Set(locations.filter((location) => location.sku).map((location) => location.sku)).size;
    return {
      capacity,
      filled,
      free: Math.max(0, capacity - filled),
      locationCount: locations.length,
      skuCount,
      percent: capacity > 0 ? Math.round((filled / capacity) * 100) : 0,
    };
  }, [locations]);

  const handlePackageImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const text = readerEvent.target?.result;
      if (typeof text === 'string') importPackagesExport(text);
    };
    reader.readAsText(file, 'utf-8');
    event.target.value = '';
  };

  const placePackage = (packageId: string, location: LocationCode) => {
    selectLocation(location.locationCode);
    selectPackage(packageId);
    placeImportedPackage(packageId, location.locationCode);
  };

  const toggleBulkPackage = (packageId: string, checked: boolean) => {
    setSelectedBulkIds((current) => {
      const next = new Set(current);
      if (checked) next.add(packageId);
      else next.delete(packageId);
      return Array.from(next);
    });
  };

  const selectPackageIds = (packageIds: string[]) => {
    setSelectedBulkIds(Array.from(new Set(packageIds)));
  };

  const handleBulkUnplace = () => {
    unplaceImportedPackages(selectedBulkIds);
    setSelectedBulkIds([]);
  };

  const handleBulkDelete = () => {
    if (selectedBulkIds.length === 0) return;
    const confirmed = window.confirm(`${selectedBulkIds.length} paket listeden tamamen silinsin mi?`);
    if (!confirmed) return;
    deleteImportedPackages(selectedBulkIds);
    setSelectedBulkIds([]);
  };

  const handleLocationClick = (location: LocationCode) => {
    selectLocation(location.locationCode);
    if (selectedPackage && selectedPackage.placement?.locationCode !== location.locationCode) {
      placeImportedPackage(selectedPackage.packageId, location.locationCode);
    }
  };

  const handleManualAdd = () => {
    if (!manualDraft.sku.trim()) return;
    addManualPackage({
      sku: manualDraft.sku,
      productCode: manualDraft.productCode || manualDraft.sku,
      productName: manualDraft.productName || manualDraft.sku,
      material: manualDraft.material,
      lot: manualDraft.lot,
      packageNo: manualDraft.packageNo,
      quantityPerPackage: manualDraft.quantityPerPackage,
      dimensionsLabel: manualDraft.dimensionsLabel,
      searchText: `${manualDraft.sku} ${manualDraft.productName} ${manualDraft.productCode} ${manualDraft.lot}`,
    });
    setManualDraft((current) => ({
      ...current,
      packageNo: '',
      lot: '',
    }));
  };

  if (!rack) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-950 text-slate-200">
        <div className="border border-slate-800 bg-slate-900 p-6 text-center">
          <div className="text-lg font-black">Raf bulunamadı</div>
          <button
            type="button"
            onClick={closeRackWorkspace}
            className="mt-4 border border-blue-800 bg-blue-950/40 px-4 py-2 text-sm font-black text-blue-100"
          >
            Depoya dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-800 bg-slate-950 px-5 py-4">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={closeRackWorkspace}
            className="flex items-center gap-2 border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-black text-slate-200 hover:border-blue-500 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Depoya Dön
          </button>
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Raf Çalışma Sayfası</div>
            <h1 className="truncate text-2xl font-black text-blue-100">
              {rack.rackCode} - {rack.name}
            </h1>
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-5 gap-2 text-center text-xs">
          <div className="border border-slate-800 bg-slate-900 px-3 py-2">
            <div className="font-mono text-base font-black text-blue-200">{totals.locationCount}</div>
            <div className="text-[10px] text-slate-500">lokasyon</div>
          </div>
          <div className="border border-slate-800 bg-slate-900 px-3 py-2">
            <div className="font-mono text-base font-black text-blue-200">{totals.filled}/{totals.capacity}</div>
            <div className="text-[10px] text-slate-500">paket</div>
          </div>
          <div className="border border-slate-800 bg-slate-900 px-3 py-2">
            <div className="font-mono text-base font-black text-blue-200">{totals.free}</div>
            <div className="text-[10px] text-slate-500">boş</div>
          </div>
          <div className="border border-slate-800 bg-slate-900 px-3 py-2">
            <div className="font-mono text-base font-black text-blue-200">{totals.skuCount}</div>
            <div className="text-[10px] text-slate-500">SKU</div>
          </div>
          <div className="border border-blue-900 bg-blue-950/40 px-3 py-2">
            <div className="font-mono text-base font-black text-blue-100">{totals.percent}%</div>
            <div className="text-[10px] text-blue-300">doluluk</div>
          </div>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)_320px] gap-3 overflow-hidden p-3">
        <aside className="flex min-h-0 flex-col border border-slate-800 bg-slate-900/40">
          <div className="border-b border-slate-800 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Paket Havuzu</div>
                <div className="text-sm font-black text-slate-100">{importedPackages.length} paket</div>
              </div>
              <input ref={packageInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handlePackageImport} />
              <button
                type="button"
                onClick={() => packageInputRef.current?.click()}
                className="flex items-center gap-2 border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-xs font-black text-emerald-100 hover:bg-emerald-900/40"
              >
                <FileUp className="h-4 w-4" />
                packages-export.json Al
              </button>
            </div>
            <label className="flex items-center gap-2 border border-slate-700 bg-slate-950 px-3 py-2">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                value={packageSearchQuery}
                onChange={(event) => setPackageSearchQuery(event.target.value)}
                placeholder="SKU, paket ID, ürün, lokasyon ara"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-600"
              />
              {packageSearchQuery && (
                <button type="button" onClick={() => setPackageSearchQuery('')} className="text-slate-500 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
            <div className="mt-3 grid grid-cols-4 gap-1 text-[11px] font-black">
              {([
                ['unplaced', 'Yerleşmemiş'],
                ['rack', 'Bu Raf'],
                ['placed', 'Yerleşmiş'],
                ['all', 'Tümü'],
              ] as Array<[PackageFilter, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`border px-2 py-2 ${filter === value ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <label className="flex items-center justify-between gap-2 border border-slate-800 bg-slate-950 px-2 py-2 font-bold text-slate-300">
                <span>3D paketler</span>
                <input
                  type="checkbox"
                  checked={gridSettings.showPackages3D !== false}
                  onChange={(event) => updateGridSettings({ showPackages3D: event.target.checked })}
                  className="h-4 w-4 accent-blue-600"
                />
              </label>
              <label>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Renk kodu</span>
                <select
                  value={gridSettings.packageColorMode || 'category'}
                  onChange={(event) => updateGridSettings({ packageColorMode: event.target.value as PackageColorMode })}
                  className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-xs outline-none focus:border-blue-500"
                >
                  {packageColorModes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-black">
              <button
                type="button"
                onClick={() => selectPackageIds(allPackageIds)}
                className="border border-slate-700 bg-slate-900 px-2 py-2 text-slate-200 hover:border-blue-500"
              >
                Tüm Paketleri Seç
              </button>
              <button
                type="button"
                onClick={() => selectPackageIds(visiblePackageIds)}
                className="border border-slate-700 bg-slate-900 px-2 py-2 text-slate-200 hover:border-blue-500"
              >
                Görünenleri Seç
              </button>
              <button
                type="button"
                onClick={() => selectPackageIds(rackPackageIdList)}
                className="border border-slate-700 bg-slate-900 px-2 py-2 text-slate-200 hover:border-blue-500"
              >
                Bu Rafı Seç
              </button>
              <button
                type="button"
                onClick={() => setSelectedBulkIds([])}
                className="border border-slate-700 bg-slate-900 px-2 py-2 text-slate-400 hover:border-blue-500 hover:text-white"
              >
                Seçimi Temizle
              </button>
              <button
                type="button"
                disabled={selectedBulkIds.length === 0}
                onClick={handleBulkUnplace}
                className="border border-amber-800 bg-amber-950/35 px-2 py-2 text-amber-100 hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Raftan Çıkar ({selectedBulkIds.length})
              </button>
              <button
                type="button"
                disabled={selectedBulkIds.length === 0}
                onClick={handleBulkDelete}
                className="border border-red-900 bg-red-950/40 px-2 py-2 text-red-100 hover:bg-red-900/50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Toplu Sil ({selectedBulkIds.length})
              </button>
            </div>
          </div>

          <div className="border-b border-slate-800 p-4">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <Plus className="h-3.5 w-3.5" />
              Hızlı Paket Ekle
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={manualDraft.sku}
                onChange={(event) => setManualDraft((current) => ({ ...current, sku: event.target.value.toUpperCase() }))}
                placeholder="SKU"
                className="border border-slate-700 bg-slate-950 px-2 py-2 text-xs outline-none focus:border-blue-500"
              />
              <select
                value={manualDraft.material}
                onChange={(event) => setManualDraft((current) => ({ ...current, material: event.target.value as ProductGroup }))}
                className="border border-slate-700 bg-slate-950 px-2 py-2 text-xs outline-none focus:border-blue-500"
              >
                {Object.keys(categoryClasses).map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <input
                value={manualDraft.productName}
                onChange={(event) => setManualDraft((current) => ({ ...current, productName: event.target.value }))}
                placeholder="Ürün adı"
                className="col-span-2 border border-slate-700 bg-slate-950 px-2 py-2 text-xs outline-none focus:border-blue-500"
              />
              <input
                value={manualDraft.quantityPerPackage}
                onChange={(event) => setManualDraft((current) => ({ ...current, quantityPerPackage: event.target.value }))}
                placeholder="Paket içi adet"
                className="border border-slate-700 bg-slate-950 px-2 py-2 text-xs outline-none focus:border-blue-500"
              />
              <input
                value={manualDraft.dimensionsLabel}
                onChange={(event) => setManualDraft((current) => ({ ...current, dimensionsLabel: event.target.value }))}
                placeholder="36 x 25 x 25 cm"
                className="border border-slate-700 bg-slate-950 px-2 py-2 text-xs outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleManualAdd}
                disabled={!manualDraft.sku.trim()}
                className="col-span-2 flex items-center justify-center gap-2 border border-blue-800 bg-blue-950/40 px-2 py-2 text-xs font-black text-blue-100 hover:bg-blue-900/50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <PackageOpen className="h-4 w-4" />
                Paketi Havuzda Oluştur
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {visiblePackages.map((item) => (
                <PackageCard
                  key={item.packageId}
                  item={item}
                  selected={selectedPackageId === item.packageId}
                  highlighted={highlightedPackageIds.includes(item.packageId)}
                  bulkSelected={selectedBulkSet.has(item.packageId)}
                  onToggleBulk={(checked) => toggleBulkPackage(item.packageId, checked)}
                  onSelect={() => selectPackage(item.packageId)}
                  onFocus={() => focusPackage(item.packageId)}
                />
              ))}
            </div>
            {visiblePackages.length === 0 && (
              <div className="border border-slate-800 bg-slate-950 p-4 text-sm text-slate-500">
                Bu filtrede paket yok. Label Printer JSON import et veya hızlı paket oluştur.
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="grid shrink-0 grid-cols-4 gap-2 text-[11px]">
            <div className="border border-slate-800 bg-slate-900 p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Raf Tipi</div>
              <div className="font-mono text-blue-100">{rack.shelfCount} kat x {rack.positionsPerShelf} göz</div>
            </div>
            <div className="border border-slate-800 bg-slate-900 p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Kapasite</div>
              <div className="font-mono text-blue-100">{rack.defaultLocationCapacity} paket / lokasyon</div>
            </div>
            <div className="border border-slate-800 bg-slate-900 p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ön/Arka</div>
              <div className="font-mono text-blue-100">{rack.depthSlots} sıra x {rack.stackLevels} seviye</div>
            </div>
            <div className="border border-slate-800 bg-slate-900 p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Bu Rafta</div>
              <div className="font-mono text-blue-100">{rackPackages.length} gerçek paket</div>
            </div>
          </div>
          <div className="grid min-h-0 min-w-0 flex-1 grid-cols-2 gap-3">
            <RackFaceGrid
              rack={rack}
              side="front"
              title="Ön Yüz"
              locations={locations}
              selectedLocationCode={selectedLocationCode}
              highlightedPackageIds={highlightedPackageIds}
              selectedPackageId={selectedPackageId}
              onSelectLocation={handleLocationClick}
              onDropPackage={placePackage}
            />
            <RackFaceGrid
              rack={rack}
              side="back"
              title="Arka Yüz"
              locations={locations}
              selectedLocationCode={selectedLocationCode}
              highlightedPackageIds={highlightedPackageIds}
              selectedPackageId={selectedPackageId}
              onSelectLocation={handleLocationClick}
              onDropPackage={placePackage}
            />
          </div>
        </section>

        <aside className="flex min-h-0 flex-col border border-slate-800 bg-slate-900/40">
          <div className="border-b border-slate-800 p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">İşlem Durumu</div>
            <div className="mt-2 min-h-12 border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
              {packagePlacementStatus || 'Paket seç, lokasyona tıkla veya paketi hücreye sürükle.'}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <section className="space-y-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <Box className="h-3.5 w-3.5" />
                Seçili Lokasyon
              </div>
              {selectedLocation ? (
                <div className={`border p-4 ${cellClass(selectedLocation, true, false)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-2xl font-black">{selectedLocation.locationCode}</div>
                      <div className="mt-1 text-sm">{selectedLocation.sku || 'Boş lokasyon'}</div>
                    </div>
                    <div className="border border-slate-700 bg-slate-950/60 px-3 py-2 text-center font-mono text-lg font-black">
                      {selectedLocation.currentPackages}/{selectedLocation.capacityPackages}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div>Kat: K{selectedLocation.shelfNumber}</div>
                    <div>Pozisyon: P{selectedLocation.positionNumber}</div>
                    <div>Kategori: {selectedLocation.currentPackages ? selectedLocation.category : rack.productCategory}</div>
                    <div>Boş kapasite: {Math.max(0, selectedLocation.capacityPackages - selectedLocation.currentPackages)}</div>
                    <div className="col-span-2">Ürün: {selectedLocation.productName || '-'}</div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!selectedPackage || selectedPackage.placement?.locationCode === selectedLocation.locationCode}
                      onClick={() => selectedPackage && placeImportedPackage(selectedPackage.packageId, selectedLocation.locationCode)}
                      className="flex items-center justify-center gap-2 border border-blue-800 bg-blue-950/50 px-2 py-2 text-xs font-black text-blue-100 hover:bg-blue-900/50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <PackageCheck className="h-4 w-4" />
                      Buraya Yerleştir
                    </button>
                    <button
                      type="button"
                      onClick={() => clearLocation(selectedLocation.locationCode)}
                      disabled={selectedLocation.currentPackages === 0}
                      className="flex items-center justify-center gap-2 border border-red-900 bg-red-950/40 px-2 py-2 text-xs font-black text-red-100 hover:bg-red-900/50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                      Lokasyonu Boşalt
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border border-slate-800 bg-slate-950 p-4 text-sm text-slate-500">
                  Raf yüzünden bir göz seç. Seçili paket varsa tek tıkla buraya taşınır.
                </div>
              )}
            </section>

            <section className="mt-4 space-y-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <PackageOpen className="h-3.5 w-3.5" />
                Lokasyondaki Paketler
              </div>
              {selectedLocation && selectedLocation.packages.length > 0 ? (
                <div className="space-y-2">
                  {selectedLocation.packages.map((item) => (
                    <div
                      key={item.packageId}
                      className={`border p-3 text-xs ${
                        selectedPackageId === item.packageId
                          ? 'border-amber-400 bg-amber-950/40'
                          : 'border-slate-800 bg-slate-950'
                      }`}
                    >
                      <button type="button" onClick={() => selectPackage(item.packageId)} className="block w-full text-left">
                        <div className="font-mono text-sm font-black text-blue-100">{item.packageId}</div>
                        <div className="truncate font-bold text-slate-100">{item.sku}</div>
                        <div className="truncate text-slate-400">{item.productName}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => unplaceImportedPackage(item.packageId)}
                        className="mt-3 w-full border border-slate-700 bg-slate-900 px-2 py-2 text-[11px] font-black text-slate-200 hover:border-red-500 hover:text-red-100"
                      >
                        Paketi raftan çıkar
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-slate-800 bg-slate-950 p-4 text-sm text-slate-500">Bu lokasyon boş.</div>
              )}
            </section>

            <section className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <PackageOpen className="h-3.5 w-3.5" />
                Seçili Paket
              </div>
              {selectedPackage ? (
                <div className={`border p-4 text-sm ${selectedPackage.status === 'placed' ? 'border-emerald-800 bg-emerald-950/25' : 'border-slate-800 bg-slate-950'}`}>
                  <div className="font-mono text-lg font-black text-blue-100">{selectedPackage.packageId}</div>
                  <div className="mt-2 font-bold text-slate-100">{selectedPackage.sku}</div>
                  <div className="text-slate-300">{formatPackageTitle(selectedPackage)}</div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <span>Durum: {selectedPackage.status === 'placed' ? 'Yerleşmiş' : 'Yerleşmemiş'}</span>
                    <span>Lokasyon: {selectedPackage.placement?.locationCode || '-'}</span>
                    <span>Lot: {selectedPackage.lot || '-'}</span>
                    <span>Koli: {selectedPackage.packageNo || '-'}</span>
                    <span>Adet: {selectedPackage.quantityPerPackage || selectedPackage.quantityInsidePackage || '-'}</span>
                    <span>Ölçü: {selectedPackage.dimensionsLabel || `${selectedPackage.boxWidthCm} x ${selectedPackage.boxDepthCm} x ${selectedPackage.boxHeightCm} cm`}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => focusPackage(selectedPackage.packageId)}
                      className="flex items-center justify-center gap-2 border border-blue-800 bg-blue-950/40 px-2 py-2 text-xs font-black text-blue-100 hover:bg-blue-900/50"
                    >
                      <LocateFixed className="h-4 w-4" />
                      Paketi Bul
                    </button>
                    <button
                      type="button"
                      disabled={selectedPackage.status !== 'placed'}
                      onClick={() => unplaceImportedPackage(selectedPackage.packageId)}
                      className="flex items-center justify-center gap-2 border border-slate-700 bg-slate-900 px-2 py-2 text-xs font-black text-slate-200 hover:border-red-500 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                      Çıkar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border border-slate-800 bg-slate-950 p-4 text-sm text-slate-500">
                  Paket kartına tıkla veya soldaki listeden sürükle.
                </div>
              )}
            </section>
          </div>
        </aside>
      </main>
    </div>
  );
}
