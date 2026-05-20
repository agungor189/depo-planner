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
  Plus,
  Route,
  Shield,
  Square,
  Trash2,
  Truck,
  Upload,
  Warehouse,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { UnitPreference, ViewMode, WarehouseObjectNoId } from '../../types';
import {
  AISLE_OPTIONS,
  GRID_OPTIONS,
  displayMeasure,
  fromMeters,
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

function nextRackCode(objects: ReturnType<typeof useStore.getState>['objects']) {
  const count = objects.filter((object) => object.type === 'rack').length;
  return count < 26 ? String.fromCharCode(65 + count) : `R${count + 1}`;
}

const viewOptions: Array<{ value: ViewMode; label: string }> = [
  { value: '2D', label: '2D Plan' },
  { value: '3D', label: '3D Görünüm' },
  { value: 'ISO', label: 'İzometrik' },
  { value: 'TOP', label: 'Üstten' },
];

export function LeftPanel() {
  const warehouseConfig = useStore((state) => state.warehouseConfig);
  const unitPreference = useStore((state) => state.unitPreference);
  const gridSettings = useStore((state) => state.gridSettings);
  const objects = useStore((state) => state.objects);
  const plans = useStore((state) => state.plans);
  const activePlanId = useStore((state) => state.activePlanId);
  const viewMode = useStore((state) => state.viewMode);
  const selectedId = useStore((state) => state.selectedId);
  const addObject = useStore((state) => state.addObject);
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
  const exportLocationsCSV = useStore((state) => state.exportLocationsCSV);
  const exportRacksCSV = useStore((state) => state.exportRacksCSV);
  const exportSummaryCSV = useStore((state) => state.exportSummaryCSV);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: warehouseConfig.name,
    width: String(fromMeters(warehouseConfig.width, unitPreference)),
    length: String(fromMeters(warehouseConfig.length, unitPreference)),
    height: String(fromMeters(warehouseConfig.height, unitPreference)),
  });

  useEffect(() => {
    setForm({
      name: warehouseConfig.name,
      width: String(Number(fromMeters(warehouseConfig.width, unitPreference).toFixed(unitPreference === 'cm' ? 0 : 2))),
      length: String(Number(fromMeters(warehouseConfig.length, unitPreference).toFixed(unitPreference === 'cm' ? 0 : 2))),
      height: String(Number(fromMeters(warehouseConfig.height, unitPreference).toFixed(unitPreference === 'cm' ? 0 : 2))),
    });
  }, [warehouseConfig, unitPreference]);

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

  const add = (type: WarehouseObjectNoId['type']) => {
    const code = nextRackCode(objects);
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
      addObject({
        ...base,
        type,
        name: `${code} Rafı`,
        width: 1.8,
        depth: 0.6,
        height: 1.8,
        code,
        shelves: 4,
        binsPerShelf: 7,
        orientation: 'horizontal',
        productGroup: 'Karışık',
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
    { type: 'rack', label: 'Raf', icon: Package },
    { type: 'column', label: 'Kolon', icon: Columns3 },
    { type: 'packing', label: 'Paketleme', icon: Square },
    { type: 'path', label: 'Yürüme Yolu', icon: Route },
    { type: 'door', label: 'Kapı', icon: DoorOpen },
    { type: 'shipping', label: 'Sevkiyat', icon: Truck },
    { type: 'receiving', label: 'Mal Kabul', icon: PackageCheck },
    { type: 'safety', label: 'Güvenlik', icon: Shield },
  ] as const;

  return (
    <aside className="z-10 flex w-80 shrink-0 flex-col overflow-y-auto border-r border-slate-800 bg-slate-900/95 p-4 text-slate-200">
      <section className="border-b border-slate-800 pb-4">
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

      <section className="border-b border-slate-800 py-4">
        <div className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Obje Ekle</div>
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

      <section className="border-b border-slate-800 py-4">
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

      <section className="border-b border-slate-800 py-4">
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

      <section className="border-b border-slate-800 py-4">
        <div className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Dışa Aktar / İçe Aktar</div>
        <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />
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
            className="col-span-2 flex items-center justify-center gap-2 border border-slate-700 bg-slate-800 px-2 py-2 text-xs font-bold hover:border-blue-500"
          >
            <Upload className="h-4 w-4 rotate-180" />
            Depo Özet CSV
          </button>
        </div>
      </section>

      <section className="min-h-48 flex-1 py-4">
        <div className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Depo Katmanları</div>
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
                {object.type === 'rack' ? `Raf ${object.code}` : object.name}
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
