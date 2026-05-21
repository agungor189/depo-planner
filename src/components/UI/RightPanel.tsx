import { DragEvent, ReactNode, useMemo, useState } from 'react';
import {
  Copy,
  Eye,
  EyeOff,
  Lock,
  PackageOpen,
  RotateCw,
  Trash2,
  Unlock,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { LocationCode, ProductGroup, ProductItem, WarehouseImportedPackage, WarehouseObject } from '../../types';
import {
  buildRackCode,
  displayMeasure,
  fromMeters,
  getFootprint,
  getObjectLabel,
  normalizeRackGroup,
  toMeters,
} from '../../utils/warehouse';

const productGroups: ProductGroup[] = ['Alüminyum', 'Döküm', 'Karbon Çelik', 'PPR', 'Diğer', 'Karışık'];

const labelSizes = ['40x10 mm', '50x20 mm', '80x30 mm', '100x100 mm'];

const categoryColors: Record<ProductGroup, string> = {
  Alüminyum: 'border-sky-600 bg-sky-950/60 text-sky-100',
  Döküm: 'border-violet-600 bg-violet-950/60 text-violet-100',
  'Karbon Çelik': 'border-zinc-500 bg-zinc-900 text-zinc-100',
  PPR: 'border-emerald-600 bg-emerald-950/60 text-emerald-100',
  Diğer: 'border-slate-600 bg-slate-800 text-slate-100',
  Karışık: 'border-amber-600 bg-amber-950/60 text-amber-100',
};

function locationCellClass(location: LocationCode) {
  if (location.currentPackages <= 0) return 'border-slate-800 bg-slate-900 text-slate-500';
  if (location.currentPackages >= location.capacityPackages) return categoryColors[location.category] || categoryColors.Diğer;
  return 'border-amber-600 bg-amber-950/60 text-amber-100';
}

export function RightPanel() {
  const selectedId = useStore((state) => state.selectedId);
  const selectedLocationCode = useStore((state) => state.selectedLocationCode);
  const objects = useStore((state) => state.objects);
  const products = useStore((state) => state.products);
  const importedPackages = useStore((state) => state.importedPackages);
  const selectedPackageId = useStore((state) => state.selectedPackageId);
  const unitPreference = useStore((state) => state.unitPreference);
  const warehouseConfig = useStore((state) => state.warehouseConfig);
  const warnings = useStore((state) => state.warnings);
  const updateObject = useStore((state) => state.updateObject);
  const deleteObject = useStore((state) => state.deleteObject);
  const duplicateObject = useStore((state) => state.duplicateObject);
  const generateLocationCodes = useStore((state) => state.generateLocationCodes);
  const selectObject = useStore((state) => state.selectObject);
  const selectPackage = useStore((state) => state.selectPackage);
  const selectLocation = useStore((state) => state.selectLocation);
  const placeProductInLocation = useStore((state) => state.placeProductInLocation);
  const adjustLocationPackages = useStore((state) => state.adjustLocationPackages);
  const clearLocation = useStore((state) => state.clearLocation);
  const moveLocationStock = useStore((state) => state.moveLocationStock);
  const setLocationCapacity = useStore((state) => state.setLocationCapacity);
  const applyRackCapacity = useStore((state) => state.applyRackCapacity);
  const placeImportedPackage = useStore((state) => state.placeImportedPackage);
  const unplaceImportedPackage = useStore((state) => state.unplaceImportedPackage);
  const focusPackage = useStore((state) => state.focusPackage);
  const openRackWorkspace = useStore((state) => state.openRackWorkspace);
  const placementStatus = useStore((state) => state.placementStatus);
  const packagePlacementStatus = useStore((state) => state.packagePlacementStatus);
  const [labelMode, setLabelMode] = useState<'rack' | 'all' | 'single'>('rack');
  const [labelSize, setLabelSize] = useState(labelSizes[1]);
  const [dropRequest, setDropRequest] = useState<{ product: ProductItem; location: LocationCode; count: string } | null>(null);

  const obj = objects.find((object) => object.id === selectedId);
  const selectedPackage = selectedPackageId
    ? importedPackages.find((item) => item.packageId === selectedPackageId) || null
    : null;
  const importedPackageIds = new Set(importedPackages.map((item) => item.packageId));

  const selectedWarnings = useMemo(
    () => warnings.filter((warning) => obj && warning.objectIds.includes(obj.id)),
    [obj, warnings],
  );

  if (!obj) {
    return (
      <aside className="z-10 flex w-96 shrink-0 flex-col overflow-y-auto border-l border-slate-800 bg-slate-900/95 p-4 text-slate-200">
        {selectedPackage ? (
          <PackageDetail
            item={selectedPackage}
            selectedLocation={null}
            status={packagePlacementStatus}
            onFocus={() => focusPackage(selectedPackage.packageId)}
            onUnplace={() => unplaceImportedPackage(selectedPackage.packageId)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-500">
            Düzenlemek için 2D/3D sahneden veya katman listesinden bir obje seçin.
          </div>
        )}
      </aside>
    );
  }

  const locations = obj.type === 'rack' ? generateLocationCodes(obj.id) : [];
  const selectedLocation = locations.find((location) => location.locationCode === selectedLocationCode)
    || (selectedLocationCode ? generateLocationCodes().find((location) => location.locationCode === selectedLocationCode) : null);
  const previewLocations =
    labelMode === 'all'
      ? generateLocationCodes().slice(0, 24)
      : labelMode === 'single'
        ? (selectedLocation ? [selectedLocation] : locations.slice(0, 1))
        : locations.slice(0, 24);
  const faceRows =
    obj.type === 'rack'
      ? Array.from({ length: obj.shelfCount }, (_, index) => obj.shelfCount - index).map((shelfNumber) =>
          locations.filter((location) => location.shelfNumber === shelfNumber),
        )
      : [];
  const packageAction =
    selectedPackage && selectedLocation && selectedPackage.placement?.locationCode !== selectedLocation.locationCode
      ? () => placeImportedPackage(selectedPackage.packageId, selectedLocation.locationCode)
      : undefined;
  const packageActionLabel = selectedPackage?.status === 'placed' ? 'Bu Lokasyona Taşı' : 'Bu Lokasyona Yerleştir';

  const handleChange = (updates: Record<string, unknown>) => {
    updateObject(obj.id, updates as Partial<WarehouseObject>);
  };

  const setNumber = (field: string, rawValue: string, dimension = true) => {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) return;
    handleChange({ [field]: dimension ? toMeters(numeric, unitPreference) : numeric });
  };

  const handleRotate = () => {
    handleChange({ rotation: obj.rotation + Math.PI / 2 });
  };

  const align = (side: 'left' | 'right' | 'top' | 'bottom') => {
    const footprint = getFootprint(obj);
    if (side === 'left') handleChange({ x: 0 });
    if (side === 'right') handleChange({ x: warehouseConfig.width - footprint.width });
    if (side === 'bottom') handleChange({ z: 0 });
    if (side === 'top') handleChange({ z: warehouseConfig.length - footprint.depth });
  };

  const handleDropOnLocation = (event: DragEvent<HTMLButtonElement>, location: LocationCode) => {
    event.preventDefault();
    const productId = event.dataTransfer.getData('application/dsdst-product-id');
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    setDropRequest({
      product,
      location,
      count: String(Math.min(location.capacityPackages - location.currentPackages, product.packageCount || 1) || 1),
    });
  };

  const confirmDrop = () => {
    if (!dropRequest) return;
    placeProductInLocation(dropRequest.product.id, dropRequest.location.locationCode, Number(dropRequest.count));
    setDropRequest(null);
  };

  const objectTypeLabel = getObjectLabel(obj);

  return (
    <aside className="z-10 flex w-96 shrink-0 flex-col overflow-y-auto border-l border-slate-800 bg-slate-900/95 p-4 text-slate-200">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Seçili Raf / Alan</div>
          <h2 className="mt-1 text-lg font-bold text-slate-100">{objectTypeLabel}</h2>
          <div className="mt-1 font-mono text-[11px] text-slate-500">{obj.id.slice(0, 8)}</div>
        </div>
        <div className="flex gap-1">
          <IconButton title={obj.locked ? 'Kilidi aç' : 'Kilitle'} onClick={() => handleChange({ locked: !obj.locked })}>
            {obj.locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          </IconButton>
          <IconButton title={obj.visible ? 'Gizle' : 'Göster'} onClick={() => handleChange({ visible: !obj.visible })}>
            {obj.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </IconButton>
        </div>
      </div>

      {selectedWarnings.length > 0 && (
        <div className="mb-4 space-y-2">
          {selectedWarnings.map((warning) => (
            <div
              key={warning.id}
              className={`border px-3 py-2 text-xs ${
                warning.severity === 'error'
                  ? 'border-red-900 bg-red-950/40 text-red-200'
                  : 'border-amber-900 bg-amber-950/40 text-amber-200'
              }`}
            >
              {warning.message}
            </div>
          ))}
        </div>
      )}

      {selectedPackage && (
        <PackageDetail
          item={selectedPackage}
          selectedLocation={selectedLocation}
          status={packagePlacementStatus}
          onFocus={() => focusPackage(selectedPackage.packageId)}
          onUnplace={() => unplaceImportedPackage(selectedPackage.packageId)}
          onPlace={packageAction}
          placeLabel={packageActionLabel}
        />
      )}

      {obj.type === 'rack' && (
        <>
          <button
            type="button"
            onClick={() => openRackWorkspace(obj.id)}
            className="mb-4 flex w-full items-center justify-center gap-2 border border-blue-800 bg-blue-950/40 px-3 py-3 text-sm font-black text-blue-100 hover:bg-blue-900/50"
          >
            <PackageOpen className="h-4 w-4" />
            Raf İçini Büyük Ekranda Düzenle
          </button>
          <RackInventoryPanel
            rackCode={obj.rackCode}
            locations={locations}
            selectedLocationCode={selectedLocationCode}
            selectedPackageId={selectedPackageId}
            onSelectLocation={selectLocation}
            onSelectPackage={selectPackage}
            onFocusPackage={focusPackage}
          />
        </>
      )}

      <section className="space-y-3 border-b border-slate-800 pb-4">
        <TextInput label="Ad" value={obj.name} onChange={(value) => handleChange({ name: value })} />
        <div className="grid grid-cols-2 gap-2">
          <NumberInput label={`X (${unitPreference})`} value={fromMeters(obj.x, unitPreference)} onChange={(value) => setNumber('x', value)} />
          <NumberInput label={`Z (${unitPreference})`} value={fromMeters(obj.z, unitPreference)} onChange={(value) => setNumber('z', value)} />
          <NumberInput label={`Genişlik (${unitPreference})`} value={fromMeters(obj.width, unitPreference)} onChange={(value) => setNumber('width', value)} />
          <NumberInput label={`Derinlik (${unitPreference})`} value={fromMeters(obj.depth, unitPreference)} onChange={(value) => setNumber('depth', value)} />
          <NumberInput label={`Yükseklik (${unitPreference})`} value={fromMeters(obj.height, unitPreference)} onChange={(value) => setNumber('height', value)} />
          <NumberInput
            label="Dönüş (°)"
            value={Math.round((obj.rotation * 180) / Math.PI)}
            onChange={(value) => {
              const degree = Number(value);
              if (Number.isFinite(degree)) handleChange({ rotation: (degree * Math.PI) / 180 });
            }}
          />
        </div>
        <div className="grid grid-cols-[1fr_48px] gap-2">
          <TextInput label="Renk" value={obj.color} onChange={(value) => handleChange({ color: value })} />
          <label>
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Seç</span>
            <input
              type="color"
              value={obj.color}
              onChange={(event) => handleChange({ color: event.target.value })}
              className="h-10 w-full border border-slate-700 bg-slate-950"
            />
          </label>
        </div>
        <label>
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Açıklama</span>
          <textarea
            value={obj.note}
            onChange={(event) => handleChange({ note: event.target.value })}
            className="min-h-20 w-full resize-y border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
          />
        </label>
      </section>

      {obj.type === 'rack' && (
        <section className="space-y-3 border-b border-slate-800 py-4">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Raf Sistemi</div>
          <div className="grid grid-cols-2 gap-2">
            <TextInput
              label="Raf grubu"
              value={obj.rackGroup}
              onChange={(value) => {
                const rackGroup = normalizeRackGroup(value);
                handleChange({
                  rackGroup,
                  rackCode: buildRackCode(rackGroup, obj.rackNumber),
                });
              }}
            />
            <NumberInput
              label="Grup içi raf no"
              value={obj.rackNumber}
              onChange={(value) => {
                const rackNumber = Math.max(1, Math.floor(Number(value) || 1));
                handleChange({
                  rackNumber,
                  rackCode: buildRackCode(obj.rackGroup, rackNumber),
                });
              }}
            />
            <div className="col-span-2 border border-blue-900 bg-blue-950/30 p-3 text-xs text-blue-100">
              Otomatik raf kodu: <strong>{obj.rackCode}</strong>
            </div>
            <SelectInput
              label="Ürün kategorisi"
              value={obj.productCategory || obj.productGroup}
              options={productGroups}
              onChange={(value) => handleChange({ productGroup: value as ProductGroup, productCategory: value as ProductGroup })}
            />
            <NumberInput label="Kat sayısı" value={obj.shelfCount} onChange={(value) => setNumber('shelfCount', value, false)} />
            <NumberInput
              label="Her katta göz"
              value={obj.positionsPerShelf || obj.binsPerShelf}
              onChange={(value) => {
                const positionsPerShelf = Math.max(1, Math.floor(Number(value) || 1));
                handleChange({ positionsPerShelf, binsPerShelf: positionsPerShelf });
              }}
            />
            <NumberInput label="Genişlik cm" value={obj.widthCm || obj.width * 100} onChange={(value) => handleChange({ widthCm: Math.max(1, Number(value) || 1) })} />
            <NumberInput label="Derinlik cm" value={obj.depthCm || obj.depth * 100} onChange={(value) => handleChange({ depthCm: Math.max(1, Number(value) || 1) })} />
            <NumberInput label="Yükseklik cm" value={obj.heightCm || obj.height * 100} onChange={(value) => handleChange({ heightCm: Math.max(1, Number(value) || 1) })} />
            <NumberInput
              label="Lokasyon kapasitesi"
              value={obj.defaultLocationCapacity}
              onChange={(value) => handleChange({ defaultLocationCapacity: Math.max(1, Math.floor(Number(value) || 1)) })}
            />
            <NumberInput
              label="Ön/arka sıra"
              value={obj.depthSlots}
              onChange={(value) => {
                const depthSlots = Math.max(1, Math.floor(Number(value) || 1));
                handleChange({ depthSlots, defaultLocationCapacity: depthSlots * Math.max(1, obj.stackLevels || 1) });
              }}
            />
            <NumberInput
              label="Üst üste seviye"
              value={obj.stackLevels}
              onChange={(value) => {
                const stackLevels = Math.max(1, Math.floor(Number(value) || 1));
                handleChange({ stackLevels, defaultLocationCapacity: Math.max(1, obj.depthSlots || 1) * stackLevels });
              }}
            />
            <SelectInput
              label="Başlangıç yönü"
              value={obj.orientation}
              options={['horizontal', 'vertical']}
              onChange={(value) => handleChange({ orientation: value })}
            />
            <SelectInput
              label="Ölçü etiketi"
              value={obj.showDimensions ? 'show' : 'hide'}
              options={['show', 'hide']}
              onChange={(value) => handleChange({ showDimensions: value === 'show' })}
            />
          </div>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => applyRackCapacity(obj.id, 'all')}
              className="border border-blue-800 bg-blue-950/30 px-2 py-2 text-xs font-bold text-blue-100 hover:bg-blue-900/40"
            >
              Kapasiteyi tüm lokasyonlara uygula
            </button>
            <button
              onClick={() => applyRackCapacity(obj.id, 'empty')}
              className="border border-slate-700 bg-slate-800 px-2 py-2 text-xs font-bold hover:border-blue-500"
            >
              Boş lokasyonların kapasitesini güncelle
            </button>
            <button
              onClick={() => applyRackCapacity(obj.id, 'preserve')}
              className="border border-slate-700 bg-slate-800 px-2 py-2 text-xs font-bold hover:border-blue-500"
            >
              Dolu lokasyonları koru
            </button>
          </div>
          <div className="border border-blue-900 bg-blue-950/30 p-3 text-xs text-blue-100">
            <div>
              Toplam ana lokasyon: <strong>{locations.length}</strong> · Paket kapasitesi:{' '}
              <strong>{locations.reduce((sum, location) => sum + location.capacityPackages, 0)}</strong>
            </div>
            <div>
              Dolu paket: <strong>{locations.reduce((sum, location) => sum + location.currentPackages, 0)}</strong> · Boş kapasite:{' '}
              <strong>{locations.reduce((sum, location) => sum + (location.capacityPackages - location.currentPackages), 0)}</strong>
            </div>
            <div>
              Raf ölçüsü: {displayMeasure(obj.width, unitPreference)} x {displayMeasure(obj.depth, unitPreference)} x{' '}
              {displayMeasure(obj.height, unitPreference)}
            </div>
          </div>
        </section>
      )}

      {obj.type === 'rack' && (
        <section className="space-y-3 border-b border-slate-800 py-4">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">
            {obj.rackCode} - Raf Cephe Görünümü
          </div>
          <div className="overflow-x-auto border border-slate-800 bg-slate-950 p-2">
            <div className="min-w-max space-y-1">
              {faceRows.map((row, rowIndex) => (
                <div
                  key={rowIndex}
                  className="grid gap-1"
                  style={{ gridTemplateColumns: `42px repeat(${Math.max(row.length, 1)}, minmax(104px, 1fr))` }}
                >
                  <div className="flex items-center justify-center border border-slate-800 bg-slate-900 font-mono text-[11px] font-black text-slate-400">
                    K{row[0]?.shelfNumber || obj.shelfCount - rowIndex}
                  </div>
                  {row.map((location) => (
                    <button
                      key={location.locationCode}
                      onClick={() => {
                        selectLocation(location.locationCode);
                        if (selectedPackage && selectedPackage.placement?.locationCode !== location.locationCode) {
                          placeImportedPackage(selectedPackage.packageId, location.locationCode);
                        }
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleDropOnLocation(event, location)}
                      className={`min-h-16 border px-2 py-2 text-left font-mono text-[10px] transition-colors hover:border-blue-400 ${
                        selectedLocationCode === location.locationCode ? 'ring-2 ring-blue-400' : ''
                      } ${locationCellClass(location)}`}
                    >
                      <div className="font-black text-blue-100">{location.locationCode}</div>
                      <div className="mt-1 truncate">{location.sku || 'Boş'}</div>
                      <div className="mt-1 font-black">
                        {location.currentPackages}/{location.capacityPackages} paket
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {selectedLocation && (
        <section className="space-y-3 border-b border-slate-800 py-4">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Seçili Lokasyon</div>
          <div className={`border p-3 text-xs ${locationCellClass(selectedLocation)}`}>
            <div className="font-mono text-base font-black text-blue-100">{selectedLocation.locationCode}</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <span>Raf: {selectedLocation.rackCode}</span>
              <span>Kat: K{selectedLocation.shelfNumber}</span>
              <span>Pozisyon: P{selectedLocation.positionNumber}</span>
              <span>Kapasite: {selectedLocation.capacityPackages} paket</span>
              <span>Doluluk: {selectedLocation.currentPackages}/{selectedLocation.capacityPackages}</span>
              <span>SKU: {selectedLocation.sku || 'Boş'}</span>
              <span className="col-span-2">Ürün: {selectedLocation.productName || 'Boş'}</span>
              <span>Kategori: {selectedLocation.currentPackages ? selectedLocation.category : '-'}</span>
              <span>İç adet: {selectedLocation.packageQuantity}</span>
              <span className="col-span-2">Toplam ürün adedi: {selectedLocation.totalItemQuantity}</span>
            </div>
          </div>
          {selectedLocation.packages.length > 0 && (
            <div className="border border-slate-800 bg-slate-950 p-3 text-xs">
              <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Lokasyondaki Paketler</div>
              <div className="flex flex-wrap gap-2">
                {selectedLocation.packages.map((item) => {
                  const isImported = importedPackageIds.has(item.packageId);
                  return (
                    <button
                      key={item.packageId}
                      disabled={!isImported}
                      onClick={() => isImported && selectPackage(item.packageId)}
                      className={`border px-2 py-1 font-mono text-[10px] ${
                        isImported
                          ? 'border-blue-800 bg-blue-950/30 text-blue-200 hover:bg-blue-900/40'
                          : 'border-slate-800 bg-slate-900 text-slate-500'
                      }`}
                    >
                      {item.packageId}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {placementStatus && <div className="border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">{placementStatus}</div>}
          {selectedPackage && packageAction && (
            <button
              onClick={packageAction}
              className="w-full border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-xs font-black uppercase tracking-wider text-emerald-100 hover:bg-emerald-900/40"
            >
              {selectedPackage.packageId} → {selectedLocation.locationCode}
            </button>
          )}
          <NumberInput
            label="Lokasyon kapasitesi"
            value={selectedLocation.capacityPackages}
            onChange={(value) => setLocationCapacity(selectedLocation.locationCode, Math.max(1, Math.floor(Number(value) || 1)))}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                const sku = selectedLocation.sku;
                const product = sku ? products.find((item) => item.sku === sku) : null;
                if (!product) return;
                placeProductInLocation(product.id, selectedLocation.locationCode, 1);
              }}
              className="border border-slate-700 bg-slate-800 px-2 py-2 text-xs font-bold hover:border-blue-500"
            >
              Paket Ekle
            </button>
            <button
              onClick={() => adjustLocationPackages(selectedLocation.locationCode, -1)}
              className="border border-slate-700 bg-slate-800 px-2 py-2 text-xs font-bold hover:border-blue-500"
            >
              Paket Azalt
            </button>
            <button
              onClick={() => clearLocation(selectedLocation.locationCode)}
              className="border border-red-900 bg-red-950/40 px-2 py-2 text-xs font-bold text-red-200 hover:bg-red-900/50"
            >
              Lokasyonu Boşalt
            </button>
            <button
              onClick={() => {
                const target = window.prompt('Hedef lokasyon kodu', selectedLocation.locationCode);
                if (target) moveLocationStock(selectedLocation.locationCode, target.trim().toUpperCase());
              }}
              className="border border-slate-700 bg-slate-800 px-2 py-2 text-xs font-bold hover:border-blue-500"
            >
              Başka Lokasyona Taşı
            </button>
            <button
              onClick={() => {
                const matches = generateLocationCodes()
                  .filter((location) => selectedLocation.sku && location.sku === selectedLocation.sku)
                  .map((location) => `${location.locationCode} ${location.currentPackages}/${location.capacityPackages}`)
                  .join('\n');
                window.alert(matches || 'Bu SKU için başka lokasyon bulunamadı.');
              }}
              className="border border-slate-700 bg-slate-800 px-2 py-2 text-xs font-bold hover:border-blue-500"
            >
              Aynı SKU’yu Bul
            </button>
            <button
              onClick={() => setLabelMode('single')}
              className="border border-slate-700 bg-slate-800 px-2 py-2 text-xs font-bold hover:border-blue-500"
            >
              Etiket Önizle
            </button>
          </div>
        </section>
      )}

      {obj.type === 'door' && (
        <section className="space-y-3 border-b border-slate-800 py-4">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Kapı</div>
          <div className="grid grid-cols-2 gap-2">
            <SelectInput label="Duvar" value={obj.wall} options={['south', 'north', 'west', 'east']} onChange={(value) => handleChange({ wall: value })} />
            <SelectInput label="Yön" value={obj.direction} options={['in', 'out', 'both']} onChange={(value) => handleChange({ direction: value })} />
          </div>
        </section>
      )}

      {obj.type === 'path' && (
        <section className="border-b border-slate-800 py-4">
          <label className="flex items-center justify-between border border-slate-800 bg-slate-950 px-2 py-2 text-xs text-slate-300">
            Çizgili görünüm
            <input type="checkbox" checked={obj.striped} onChange={(event) => handleChange({ striped: event.target.checked })} className="h-4 w-4 accent-blue-600" />
          </label>
        </section>
      )}

      {obj.type === 'note' && (
        <section className="border-b border-slate-800 py-4">
          <TextInput label="Not metni" value={obj.text} onChange={(value) => handleChange({ text: value })} />
        </section>
      )}

      <section className="space-y-3 border-b border-slate-800 py-4">
        <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Taşıma ve Hizalama</div>
        <div className="grid grid-cols-3 gap-2">
          <ActionButton onClick={handleRotate} label="90°" icon={<RotateCw className="h-4 w-4" />} />
          <ActionButton onClick={() => duplicateObject(obj.id)} label="Kopyala" icon={<Copy className="h-4 w-4" />} />
          <ActionButton onClick={() => deleteObject(obj.id)} label="Sil" danger icon={<Trash2 className="h-4 w-4" />} />
        </div>
        <div className="grid grid-cols-4 gap-2">
          <button onClick={() => align('left')} className="border border-slate-700 bg-slate-800 py-2 text-xs font-bold hover:border-blue-500">Sol</button>
          <button onClick={() => align('right')} className="border border-slate-700 bg-slate-800 py-2 text-xs font-bold hover:border-blue-500">Sağ</button>
          <button onClick={() => align('bottom')} className="border border-slate-700 bg-slate-800 py-2 text-xs font-bold hover:border-blue-500">Alt</button>
          <button onClick={() => align('top')} className="border border-slate-700 bg-slate-800 py-2 text-xs font-bold hover:border-blue-500">Üst</button>
        </div>
      </section>

      {obj.type === 'rack' && (
        <section className="space-y-3 border-b border-slate-800 py-4">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Ana Lokasyon Listesi</div>
          <div className="border border-blue-900 bg-blue-950/30 p-3 text-xs text-blue-100">
            Standart lokasyon kodu sabit: <strong>{obj.rackCode}-K2-P3</strong>. Kapasite lokasyon/raf bazlıdır; alt slot kodları UI’da gösterilmez.
          </div>
          <div className="max-h-44 overflow-y-auto border border-slate-800 bg-slate-950 font-mono text-[11px]">
            {locations.map((location) => (
              <div key={location.locationCode} className="flex justify-between border-b border-slate-900 px-2 py-1.5">
                <span className="text-blue-300">{location.locationCode}</span>
                <span className="text-slate-500">{location.sku || 'Boş'} · {location.currentPackages}/{location.capacityPackages} paket</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3 py-4">
        <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Etiket Önizleme</div>
        <div className="grid grid-cols-2 gap-2">
          <SelectInput label="Kapsam" value={labelMode} options={['rack', 'all', 'single']} labels={{ rack: 'Seçili raf', all: 'Tüm depo', single: 'Tek lokasyon' }} onChange={(value) => setLabelMode(value as typeof labelMode)} />
          <SelectInput label="Etiket ölçüsü" value={labelSize} options={labelSizes} onChange={setLabelSize} />
        </div>
        <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto border border-slate-800 bg-slate-950 p-2">
          {previewLocations.length === 0 && <div className="col-span-2 text-xs text-slate-500">Raf seçildiğinde etiketler burada görünür.</div>}
          {previewLocations.map((location) => (
            <div key={location.locationCode} className="border border-slate-700 bg-white px-2 py-1 text-slate-950">
              <div className="text-[10px] font-black">{location.locationCode}</div>
              {location.sku && <div className="text-[8px] font-bold">SKU: {location.sku}</div>}
              <div className="text-[8px] font-bold">Paket: {location.currentPackages}/{location.capacityPackages}</div>
              <div className="mt-1 text-[8px] font-mono">{location.sku ? location.productQrContent : location.qrContent}</div>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-slate-500">
          Seçili ölçü: {labelSize}. HTML/CSS önizleme hazır; baskı çıktısı sonraki aşamada PDF/ZPL’ye taşınabilir.
        </div>
      </section>

      {dropRequest && (
        <div className="sticky bottom-3 z-20 border border-blue-700 bg-slate-950 p-3 shadow-2xl">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Lokasyona Paket Bırak</div>
          <div className="mt-2 text-sm font-bold text-slate-100">{dropRequest.location.locationCode}</div>
          <div className="text-xs text-slate-400">
            {dropRequest.product.sku} · Lokasyon kapasitesi: {dropRequest.location.capacityPackages} · Mevcut:{' '}
            {dropRequest.location.currentPackages}/{dropRequest.location.capacityPackages}
          </div>
          <div className="text-xs text-slate-400">
            Boş kapasite: {Math.max(dropRequest.location.capacityPackages - dropRequest.location.currentPackages, 0)} · Bekleyen paket:{' '}
            {dropRequest.product.packageCount}
          </div>
          {dropRequest.location.sku && dropRequest.location.sku !== dropRequest.product.sku && (
            <div className="mt-2 border border-red-900 bg-red-950/40 px-2 py-2 text-xs text-red-200">
              Bu lokasyonda farklı SKU var. Varsayılan olarak karışık SKU’ya izin verilmez.
            </div>
          )}
          <NumberInput
            label="Paket sayısı"
            value={Number(dropRequest.count)}
            onChange={(value) => setDropRequest((current) => current ? { ...current, count: value } : current)}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {Array.from({
              length: Math.min(4, Math.max(dropRequest.location.capacityPackages - dropRequest.location.currentPackages, 0)),
            }, (_, index) => index + 1).map((count) => (
              <button
                key={count}
                onClick={() => setDropRequest((current) => current ? { ...current, count: String(count) } : current)}
                className="border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-bold hover:border-blue-500"
              >
                {count} paket koy
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => setDropRequest(null)} className="border border-slate-700 bg-slate-800 px-2 py-2 text-xs font-bold">
              Vazgeç
            </button>
            <button
              onClick={confirmDrop}
              className="bg-blue-600 px-2 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-blue-500"
            >
              Yerleştir
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => selectObject(null)}
        className="mt-auto border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:border-blue-500 hover:text-white"
      >
        Seçimi Temizle
      </button>
    </aside>
  );
}

function PackageDetail({
  item,
  selectedLocation,
  status,
  onFocus,
  onPlace,
  placeLabel = 'Bu Lokasyona Yerleştir',
  onUnplace,
}: {
  item: WarehouseImportedPackage;
  selectedLocation: LocationCode | null;
  status: string | null;
  onFocus: () => void;
  onPlace?: () => void;
  placeLabel?: string;
  onUnplace: () => void;
}) {
  return (
    <section className="mb-4 space-y-3 border-b border-slate-800 pb-4">
      <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Seçili Paket</div>
      <div className="border border-blue-900 bg-blue-950/30 p-3 text-xs text-blue-100">
        <div className="font-mono text-sm font-black text-blue-100">{item.packageId}</div>
        <div className="mt-1 font-semibold text-slate-100">{item.productName || item.sku}</div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-slate-300">
          <span>SKU: {item.sku}</span>
          <span>Kod: {item.productCode || '-'}</span>
          <span>Durum: {item.status === 'placed' ? 'Yerleşmiş' : 'Yerleşmemiş'}</span>
          <span>Lot: {item.lot || '-'}</span>
          <span>Paket no: {item.packageNo || item.labelIndex}</span>
          <span>İç adet: {item.quantityPerPackage || '-'}</span>
          <span className="col-span-2">Ölçü: {item.dimensionsLabel || `${item.boxWidthCm} x ${item.boxDepthCm} x ${item.boxHeightCm} cm`}</span>
          <span className="col-span-2">Lokasyon: {item.placement?.locationCode || 'Henüz yok'}</span>
        </div>
      </div>
      {selectedLocation && item.status === 'unplaced' && (
        <div className="border border-slate-800 bg-slate-950 p-2 text-xs text-slate-300">
          Seçili lokasyon: <strong className="font-mono text-blue-200">{selectedLocation.locationCode}</strong> · Doluluk:{' '}
          {selectedLocation.currentPackages}/{selectedLocation.capacityPackages}
        </div>
      )}
      {status && <div className="border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">{status}</div>}
      <div className="grid grid-cols-2 gap-2">
        {onPlace && (
          <button
            onClick={onPlace}
            className="border border-emerald-800 bg-emerald-950/40 px-2 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-900/40"
          >
            {placeLabel}
          </button>
        )}
        <button onClick={onFocus} className="border border-blue-800 bg-slate-800 px-2 py-2 text-xs font-bold text-blue-100 hover:bg-blue-950">
          Paketi Bul
        </button>
        {item.status === 'placed' && (
          <button
            onClick={onUnplace}
            className="border border-red-900 bg-red-950/40 px-2 py-2 text-xs font-bold text-red-200 hover:bg-red-900/50"
          >
            Yerleşimi Kaldır
          </button>
        )}
      </div>
    </section>
  );
}

function RackInventoryPanel({
  rackCode,
  locations,
  selectedLocationCode,
  selectedPackageId,
  onSelectLocation,
  onSelectPackage,
  onFocusPackage,
}: {
  rackCode: string;
  locations: LocationCode[];
  selectedLocationCode: string | null;
  selectedPackageId: string | null;
  onSelectLocation: (locationCode: string) => void;
  onSelectPackage: (packageId: string) => void;
  onFocusPackage: (packageId: string) => void;
}) {
  const filledLocations = locations.filter((location) => location.currentPackages > 0);
  const totalCapacity = locations.reduce((sum, location) => sum + location.capacityPackages, 0);
  const filledPackages = locations.reduce((sum, location) => sum + location.currentPackages, 0);
  const occupancyPercent = totalCapacity > 0 ? Math.round((filledPackages / totalCapacity) * 100) : 0;
  const packageRows = filledLocations.flatMap((location) =>
    location.packages.map((item) => ({ item, location })),
  );
  const skuMap = new Map<string, {
    sku: string;
    productName: string;
    category: ProductGroup;
    packageCount: number;
    locationCodes: string[];
    firstPackageId?: string;
  }>();

  filledLocations.forEach((location) => {
    const key = location.sku || 'BOS';
    const current = skuMap.get(key) || {
      sku: key,
      productName: location.productName || location.sku || 'Ürün',
      category: location.category,
      packageCount: 0,
      locationCodes: [],
      firstPackageId: location.packages[0]?.packageId,
    };
    current.packageCount += location.currentPackages;
    current.locationCodes = Array.from(new Set([...current.locationCodes, location.locationCode]));
    current.firstPackageId = current.firstPackageId || location.packages[0]?.packageId;
    skuMap.set(key, current);
  });

  const skuSummaries = Array.from(skuMap.values()).sort((a, b) => b.packageCount - a.packageCount);

  return (
    <section className="mb-4 space-y-3 border-b border-slate-800 pb-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Raf İçeriği</div>
          <div className="font-mono text-lg font-black text-blue-100">{rackCode}</div>
        </div>
        <div className="border border-blue-900 bg-blue-950/30 px-3 py-2 text-right">
          <div className="text-[10px] font-black uppercase tracking-widest text-blue-300">Doluluk</div>
          <div className="font-mono text-lg font-black text-blue-100">{occupancyPercent}%</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div className="border border-slate-800 bg-slate-950 p-2">
          <div className="font-mono text-sm text-blue-200">{filledLocations.length}</div>
          <div className="text-[10px] text-slate-500">dolu göz</div>
        </div>
        <div className="border border-slate-800 bg-slate-950 p-2">
          <div className="font-mono text-sm text-blue-200">{locations.length - filledLocations.length}</div>
          <div className="text-[10px] text-slate-500">boş göz</div>
        </div>
        <div className="border border-slate-800 bg-slate-950 p-2">
          <div className="font-mono text-sm text-blue-200">{filledPackages}/{totalCapacity}</div>
          <div className="text-[10px] text-slate-500">paket</div>
        </div>
        <div className="border border-slate-800 bg-slate-950 p-2">
          <div className="font-mono text-sm text-blue-200">{skuSummaries.length}</div>
          <div className="text-[10px] text-slate-500">SKU</div>
        </div>
      </div>

      {filledLocations.length === 0 ? (
        <div className="border border-slate-800 bg-slate-950 p-3 text-xs text-slate-500">
          Bu rafta kayıtlı paket yok. Paket seçip raf gözüne tıklayarak yerleştirebilirsin.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">SKU Dağılımı</div>
            <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
              {skuSummaries.map((summary) => (
                <div key={summary.sku} className={`border p-2 text-xs ${categoryColors[summary.category] || categoryColors.Diğer}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-black">{summary.sku}</div>
                      <div className="truncate text-[11px]">{summary.productName}</div>
                    </div>
                    <div className="shrink-0 font-mono font-black">{summary.packageCount} paket</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {summary.locationCodes.map((locationCode) => (
                      <button
                        key={locationCode}
                        onClick={() => onSelectLocation(locationCode)}
                        className="border border-slate-600/70 bg-slate-950/40 px-1.5 py-0.5 font-mono text-[10px] hover:border-blue-300"
                      >
                        {locationCode}
                      </button>
                    ))}
                    {summary.firstPackageId && (
                      <button
                        onClick={() => onFocusPackage(summary.firstPackageId || '')}
                        className="ml-auto border border-blue-700 bg-blue-950/40 px-1.5 py-0.5 text-[10px] font-black text-blue-100 hover:bg-blue-900/40"
                      >
                        İlk paketi bul
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Dolu Lokasyonlar</div>
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {filledLocations.map((location) => (
                <div
                  key={location.locationCode}
                  className={`border bg-slate-950 p-2 text-xs ${
                    selectedLocationCode === location.locationCode ? 'border-blue-500' : 'border-slate-800'
                  }`}
                >
                  <button
                    onClick={() => onSelectLocation(location.locationCode)}
                    className="flex w-full items-start justify-between gap-2 text-left"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-black text-blue-200">{location.locationCode}</div>
                      <div className="truncate text-slate-300">{location.sku} · {location.productName || 'Ürün'}</div>
                    </div>
                    <div className="shrink-0 font-mono font-black text-slate-100">
                      {location.currentPackages}/{location.capacityPackages}
                    </div>
                  </button>
                  {location.packages.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {location.packages.map((item) => (
                        <button
                          key={item.packageId}
                          onClick={() => onSelectPackage(item.packageId)}
                          className={`border px-1.5 py-0.5 font-mono text-[10px] ${
                            selectedPackageId === item.packageId
                              ? 'border-amber-400 bg-amber-950/50 text-amber-100'
                              : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-blue-500'
                          }`}
                        >
                          {item.packageId}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {packageRows.length === 0 && (
            <div className="border border-amber-900 bg-amber-950/30 p-2 text-xs text-amber-200">
              Bu rafta doluluk var ama paket ID detayı yok. Yeni Label Printer importları gerçek paket ID ile görünür.
            </div>
          )}
        </>
      )}
    </section>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
      />
    </label>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? Number(value.toFixed(3)) : 0}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  labels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm outline-none focus:border-blue-500"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {labels?.[option] || option}
          </option>
        ))}
      </select>
    </label>
  );
}

function IconButton({ title, children, onClick }: { title: string; children: ReactNode; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center border border-slate-700 bg-slate-800 text-slate-300 hover:border-blue-500 hover:text-white"
    >
      {children}
    </button>
  );
}

function ActionButton({
  label,
  icon,
  danger,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1 border px-2 py-2 text-xs font-bold ${
        danger
          ? 'border-red-900 bg-red-950/40 text-red-200 hover:bg-red-900/50'
          : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-blue-500 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
