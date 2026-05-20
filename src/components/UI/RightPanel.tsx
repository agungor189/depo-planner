import { ReactNode, useMemo, useState } from 'react';
import {
  Copy,
  Eye,
  EyeOff,
  Lock,
  RotateCw,
  Trash2,
  Unlock,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { LocationFormat, ProductGroup, WarehouseObject } from '../../types';
import {
  buildRackCode,
  displayMeasure,
  fromMeters,
  getFootprint,
  getObjectLabel,
  normalizeRackGroup,
  toMeters,
} from '../../utils/warehouse';

const productGroups: ProductGroup[] = ['Alüminyum', 'Döküm', 'Karbon Çelik', 'PPR', 'Karışık'];

const locationFormats: Array<{ value: LocationFormat; label: string }> = [
  { value: 'standard', label: 'A1-K1-P1' },
  { value: 'padded', label: 'A1-K01-P01' },
  { value: 'verbose', label: 'RAF-A1-KAT-1-P1' },
  { value: 'slash', label: 'A1/K1/P01' },
];

const labelSizes = ['40x10 mm', '50x20 mm', '80x30 mm', '100x100 mm'];

export function RightPanel() {
  const selectedId = useStore((state) => state.selectedId);
  const objects = useStore((state) => state.objects);
  const unitPreference = useStore((state) => state.unitPreference);
  const warehouseConfig = useStore((state) => state.warehouseConfig);
  const warnings = useStore((state) => state.warnings);
  const locationCodeSettings = useStore((state) => state.locationCodeSettings);
  const updateObject = useStore((state) => state.updateObject);
  const deleteObject = useStore((state) => state.deleteObject);
  const duplicateObject = useStore((state) => state.duplicateObject);
  const updateLocationCodeSettings = useStore((state) => state.updateLocationCodeSettings);
  const generateLocationCodes = useStore((state) => state.generateLocationCodes);
  const selectObject = useStore((state) => state.selectObject);
  const [labelMode, setLabelMode] = useState<'rack' | 'all' | 'single'>('rack');
  const [labelSize, setLabelSize] = useState(labelSizes[1]);

  const obj = objects.find((object) => object.id === selectedId);

  const selectedWarnings = useMemo(
    () => warnings.filter((warning) => obj && warning.objectIds.includes(obj.id)),
    [obj, warnings],
  );

  if (!obj) {
    return (
      <aside className="z-10 flex w-96 shrink-0 items-center justify-center border-l border-slate-800 bg-slate-900/95 p-6 text-center text-sm text-slate-500">
        Düzenlemek için 2D/3D sahneden veya katman listesinden bir obje seçin.
      </aside>
    );
  }

  const locations = obj.type === 'rack' ? generateLocationCodes(obj.id) : [];
  const previewLocations =
    labelMode === 'all'
      ? generateLocationCodes().slice(0, 24)
      : labelMode === 'single'
        ? locations.slice(0, 1)
        : locations.slice(0, 24);
  const faceRows =
    obj.type === 'rack'
      ? Array.from({ length: obj.shelfCount }, (_, index) => obj.shelfCount - index).map((shelfNumber) =>
          locations.filter((location) => location.shelfNumber === shelfNumber),
        )
      : [];

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

  const objectTypeLabel = getObjectLabel(obj);

  return (
    <aside className="z-10 flex w-96 shrink-0 flex-col overflow-y-auto border-l border-slate-800 bg-slate-900/95 p-4 text-slate-200">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Seçili Obje</div>
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
              label="Ürün grubu"
              value={obj.productGroup}
              options={productGroups}
              onChange={(value) => handleChange({ productGroup: value as ProductGroup })}
            />
            <NumberInput label="Kat sayısı" value={obj.shelfCount} onChange={(value) => setNumber('shelfCount', value, false)} />
            <NumberInput label="Göz / kat" value={obj.binsPerShelf} onChange={(value) => setNumber('binsPerShelf', value, false)} />
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
          <div className="border border-blue-900 bg-blue-950/30 p-3 text-xs text-blue-100">
            Toplam lokasyon: <strong>{locations.length}</strong> · Raf ölçüsü:{' '}
            {displayMeasure(obj.width, unitPreference)} x {displayMeasure(obj.depth, unitPreference)} x{' '}
            {displayMeasure(obj.height, unitPreference)}
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
                <div key={rowIndex} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(row.length, 1)}, minmax(86px, 1fr))` }}>
                  {row.map((location) => (
                    <div
                      key={location.locationCode}
                      className="border border-slate-700 bg-slate-900 px-2 py-2 text-center font-mono text-[10px] text-blue-200"
                    >
                      {location.locationCode}
                    </div>
                  ))}
                </div>
              ))}
            </div>
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
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Lokasyon Kod Sistemi</div>
          <div className="grid grid-cols-2 gap-2">
            <SelectInput
              label="Format"
              value={locationCodeSettings.format}
              options={locationFormats.map((format) => format.value)}
              labels={Object.fromEntries(locationFormats.map((format) => [format.value, format.label]))}
              onChange={(value) => updateLocationCodeSettings({ format: value as LocationFormat })}
            />
            <TextInput label="Ayırıcı" value={locationCodeSettings.separator} onChange={(value) => updateLocationCodeSettings({ separator: value || '-' })} />
            <TextInput label="Kat prefix" value={locationCodeSettings.shelfPrefix} onChange={(value) => updateLocationCodeSettings({ shelfPrefix: value })} />
            <TextInput label="Göz prefix" value={locationCodeSettings.binPrefix} onChange={(value) => updateLocationCodeSettings({ binPrefix: value })} />
          </div>
          <div className="max-h-44 overflow-y-auto border border-slate-800 bg-slate-950 font-mono text-[11px]">
            {locations.map((location) => (
              <div key={location.locationCode} className="flex justify-between border-b border-slate-900 px-2 py-1.5">
                <span className="text-blue-300">{location.locationCode}</span>
                <span className="text-slate-500">{location.qrContent}</span>
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
              <div className="mt-1 text-[8px] font-mono">{location.qrContent}</div>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-slate-500">
          Seçili ölçü: {labelSize}. HTML/CSS önizleme hazır; baskı çıktısı sonraki aşamada PDF/ZPL’ye taşınabilir.
        </div>
      </section>

      <button
        onClick={() => selectObject(null)}
        className="mt-auto border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:border-blue-500 hover:text-white"
      >
        Seçimi Temizle
      </button>
    </aside>
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
