import { ChangeEvent, useRef, useState } from 'react';
import { FileJson, PackageOpen, Upload, Warehouse } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { UnitPreference } from '../../types';
import { toMeters } from '../../utils/warehouse';

export function StartScreen() {
  const createEmptyPlan = useStore((state) => state.createEmptyPlan);
  const loadSamplePlan = useStore((state) => state.loadSamplePlan);
  const importJSON = useStore((state) => state.importJSON);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [unit, setUnit] = useState<UnitPreference>('m');
  const [form, setForm] = useState({
    name: 'DSDST Depo',
    width: '5',
    length: '8',
    height: '3',
  });
  const [error, setError] = useState('');

  const updateField = (field: keyof typeof form, value: string) => {
    setError('');
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleCreate = () => {
    const width = toMeters(Number(form.width), unit);
    const length = toMeters(Number(form.length), unit);
    const height = toMeters(Number(form.height), unit);

    if (!form.name.trim()) {
      setError('Depo adı zorunlu.');
      return;
    }

    if (width <= 0 || length <= 0 || height <= 0) {
      setError('Genişlik, uzunluk ve yükseklik 0’dan büyük olmalı.');
      return;
    }

    createEmptyPlan({ name: form.name.trim(), width, length, height }, unit);
  };

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const result = readerEvent.target?.result;
      if (typeof result === 'string' && !importJSON(result)) {
        setError('JSON dosyası okunamadı veya plan formatı geçersiz.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-6 text-slate-100">
      <div className="w-full max-w-5xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-800 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center bg-blue-600 font-black tracking-tight text-white">
              DS
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wide">DSDST Depo Planlayıcı</h1>
              <p className="text-sm text-slate-400">Gerçek ölçülü 2D/3D depo yerleşim MVP’si</p>
            </div>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="border-b border-slate-800 p-6 lg:border-b-0 lg:border-r">
            <div className="mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-400">
              <Warehouse className="h-4 w-4 text-blue-400" />
              Boş Depo Oluştur
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-500">Depo adı</span>
                <input
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  className="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-500">Birim</span>
                <select
                  value={unit}
                  onChange={(event) => setUnit(event.target.value as UnitPreference)}
                  className="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
                >
                  <option value="m">metre</option>
                  <option value="cm">santimetre</option>
                </select>
              </label>

              <div className="hidden sm:block" />

              {(['width', 'length', 'height'] as const).map((field) => (
                <label key={field}>
                  <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-500">
                    {field === 'width' ? 'Genişlik' : field === 'length' ? 'Uzunluk' : 'Yükseklik'} ({unit})
                  </span>
                  <input
                    type="number"
                    min="0"
                    step={unit === 'cm' ? '1' : '0.1'}
                    value={form[field]}
                    onChange={(event) => updateField(field, event.target.value)}
                    className="w-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
                  />
                </label>
              ))}
            </div>

            {error && (
              <div className="mt-4 border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</div>
            )}

            <button
              onClick={handleCreate}
              className="mt-5 flex w-full items-center justify-center gap-2 bg-blue-600 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-blue-500"
            >
              <PackageOpen className="h-4 w-4" />
              Boş Depo ile Başla
            </button>
          </section>

          <section className="p-6">
            <div className="mb-5 text-sm font-semibold uppercase tracking-widest text-slate-400">Hızlı Başlangıç</div>
            <div className="space-y-3">
              <button
                onClick={loadSamplePlan}
                className="flex w-full items-start gap-3 border border-slate-700 bg-slate-950 p-4 text-left hover:border-blue-500"
              >
                <Warehouse className="mt-0.5 h-5 w-5 text-blue-400" />
                <span>
                  <span className="block text-sm font-bold text-slate-100">Örnek DSDST depo planı yükle</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">
                    5 m x 8 m x 3 m depo, 5 raf, 2 kolon, paketleme ve sevkiyat alanı.
                  </span>
                </span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-start gap-3 border border-slate-700 bg-slate-950 p-4 text-left hover:border-blue-500"
              >
                <Upload className="mt-0.5 h-5 w-5 text-emerald-400" />
                <span>
                  <span className="block text-sm font-bold text-slate-100">JSON içe aktar</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">
                    V2 plan dosyası veya eski depo-planner JSON çıktısı desteklenir.
                  </span>
                </span>
              </button>
              <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />

              <div className="border border-slate-800 bg-slate-950/50 p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <FileJson className="h-4 w-4" />
                  Veri standardı
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Tüm ölçüler içeride metre olarak tutulur. cm/m tercihi sadece giriş ve gösterim formatını değiştirir.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
