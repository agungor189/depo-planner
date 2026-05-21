import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Clock3,
  Filter,
  Gauge,
  LayoutDashboard,
  MapPinned,
  PackageCheck,
  Play,
  UploadCloud,
  Warehouse,
} from 'lucide-react';
import { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { LocationCode, WarehouseImportedPackage } from '../../types';
import { calculateAreaUsage, trimNumber } from '../../utils/warehouse';
import { VirtualList } from '../../ui/components/VirtualList';

interface SuggestionRow {
  packageItem: WarehouseImportedPackage;
  location: LocationCode | null;
  score: number;
  reason: string;
}

function buildSuggestionRows(packages: WarehouseImportedPackage[], locations: LocationCode[]): SuggestionRow[] {
  const availableLocations = locations.filter((location) => location.currentPackages < location.capacityPackages);

  return packages
    .filter((item) => item.status === 'unplaced')
    .slice(0, 500)
    .map((item) => {
      const sameCategory = availableLocations.find((location) => location.productGroup === item.category && !location.sku);
      const partialSameSku = availableLocations.find((location) => location.sku === item.sku);
      const location = partialSameSku || sameCategory || availableLocations.find((entry) => !entry.sku) || availableLocations[0] || null;
      const score = partialSameSku ? 94 : sameCategory ? 88 : location ? 72 : 0;
      const reason = partialSameSku
        ? 'Aynı SKU lokasyonda, kapasite uygun.'
        : sameCategory
          ? 'Kategori uyumlu, boş lokasyon bulundu.'
          : location
            ? 'Boş kapasite bulundu, SKU yakınlığı orta.'
            : 'Uygun boş lokasyon bulunamadı.';

      return { packageItem: item, location, score, reason };
    });
}

function MetricCard({
  title,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  helper: string;
  icon: typeof Boxes;
  tone: 'blue' | 'green' | 'purple' | 'cyan' | 'amber';
}) {
  const tones = {
    blue: 'border-blue-900/70 bg-blue-950/20 text-blue-200',
    green: 'border-emerald-900/70 bg-emerald-950/20 text-emerald-200',
    purple: 'border-violet-900/70 bg-violet-950/20 text-violet-200',
    cyan: 'border-cyan-900/70 bg-cyan-950/20 text-cyan-200',
    amber: 'border-amber-900/70 bg-amber-950/20 text-amber-200',
  };

  return (
    <div className={`border p-4 ${tones[tone]}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-slate-950/50">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[11px] font-bold text-slate-400">{title}</div>
          <div className="mt-1 font-mono text-2xl font-black text-slate-100">{value}</div>
          <div className="mt-1 text-xs">{helper}</div>
        </div>
      </div>
    </div>
  );
}

export function WmsOperationCenter() {
  const closeOperationCenter = useStore((state) => state.closeOperationCenter);
  const objects = useStore((state) => state.objects);
  const warehouseConfig = useStore((state) => state.warehouseConfig);
  const locationStocks = useStore((state) => state.locationStocks);
  const locationCapacityOverrides = useStore((state) => state.locationCapacityOverrides);
  const importedPackages = useStore((state) => state.importedPackages);
  const generateLocationCodes = useStore((state) => state.generateLocationCodes);
  const placeImportedPackage = useStore((state) => state.placeImportedPackage);
  const packagePlacementStatus = useStore((state) => state.packagePlacementStatus);

  const locations = generateLocationCodes();
  const usage = calculateAreaUsage(objects, warehouseConfig, locationStocks, locationCapacityOverrides);
  const suggestions = useMemo(() => buildSuggestionRows(importedPackages, locations), [importedPackages, locations]);
  const validSuggestions = suggestions.filter((row) => row.location);
  const warningCount = suggestions.filter((row) => row.score > 0 && row.score < 80).length;
  const averageScore = validSuggestions.length
    ? Math.round(validSuggestions.reduce((sum, row) => sum + row.score, 0) / validSuggestions.length)
    : 0;

  const approveSuggestion = (row: SuggestionRow) => {
    if (!row.location) return;
    placeImportedPackage(row.packageItem.packageId, row.location.locationCode);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#03101f] text-slate-100">
      <aside className="flex w-20 shrink-0 flex-col items-center border-r border-blue-950/80 bg-[#071a36] py-4">
        <div className="mb-8 flex h-11 w-11 items-center justify-center rounded border border-cyan-500/40 text-cyan-300">
          <Warehouse className="h-6 w-6" />
        </div>
        {[LayoutDashboard, Boxes, PackageCheck, MapPinned, Gauge].map((Icon, index) => (
          <button
            key={index}
            className={`mb-3 flex h-11 w-11 items-center justify-center rounded border ${
              index === 2 ? 'border-blue-500 bg-blue-600/30 text-blue-100' : 'border-transparent text-slate-400 hover:border-blue-900 hover:text-white'
            }`}
          >
            <Icon className="h-5 w-5" />
          </button>
        ))}
        <div className="mt-auto rounded-full border border-slate-700 px-2 py-2 text-xs font-black">AK</div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-6">
        <header className="mb-5 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Depo</span>
              <span>›</span>
              <span>Kabul</span>
              <span>›</span>
              <span>Toplu Yerleştirme</span>
            </div>
            <h1 className="mt-1 text-2xl font-black">Toplu Kabul ve Yerleştirme Merkezi</h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex h-11 items-center gap-2 rounded border border-slate-700 bg-slate-950/70 px-5 text-sm font-black hover:border-blue-500">
              <Gauge className="h-4 w-4" />
              Otomatik Yerleştir
            </button>
            <button className="flex h-11 items-center gap-2 rounded border border-slate-700 bg-slate-950/70 px-5 text-sm font-black hover:border-blue-500">
              <CheckCircle2 className="h-4 w-4" />
              Toplu Onay
            </button>
            <button className="flex h-11 items-center gap-2 rounded bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-500">
              <Play className="h-4 w-4" />
              Yerleştirmeyi Başlat
            </button>
            <button onClick={closeOperationCenter} className="flex h-11 items-center gap-2 rounded border border-slate-700 px-4 text-sm font-black hover:border-blue-500">
              <ArrowLeft className="h-4 w-4" />
              Plana Dön
            </button>
          </div>
        </header>

        <section className="mb-4 grid grid-cols-6 gap-4">
          <MetricCard title="Gelen paket" value={`${importedPackages.length}`} helper="Toplam havuz" icon={Boxes} tone="blue" />
          <MetricCard title="Doğrulanan" value={`${importedPackages.filter((item) => item.packageId).length}`} helper="Kimlik geçerli" icon={PackageCheck} tone="green" />
          <MetricCard title="Otomatik öneri" value={`${validSuggestions.length}`} helper={`${averageScore}% ortalama skor`} icon={Gauge} tone="purple" />
          <MetricCard title="Boş lokasyon" value={`${usage.freePackageCapacity}`} helper="Paket kapasitesi" icon={Warehouse} tone="blue" />
          <MetricCard title="Doluluk" value={`${trimNumber(usage.packageUtilizationPercent, 1)}%`} helper={`${usage.filledPackageCount}/${usage.totalPackageCapacity}`} icon={MapPinned} tone="cyan" />
          <MetricCard title="Tahmini işlem" value={`${Math.max(1, Math.ceil(validSuggestions.length / 10))} dk`} helper={`${validSuggestions.length} öneri`} icon={Clock3} tone="amber" />
        </section>

        <section className="grid grid-cols-[300px_minmax(0,1fr)_380px] gap-4">
          <aside className="rounded border border-blue-950/80 bg-slate-950/45 p-4">
            <div className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">1. Dosya Yükle</div>
            <div className="mb-4 flex h-40 flex-col items-center justify-center rounded border border-dashed border-slate-700 bg-slate-900/40 text-center">
              <UploadCloud className="mb-3 h-9 w-9 text-slate-300" />
              <div className="text-sm font-bold">Dosyayı buraya sürükleyip bırakın</div>
              <div className="mt-1 text-xs text-slate-500">CSV, XLSX, JSON · 50.000 satır hedefi</div>
            </div>
            {['Dosya', 'Eşleştirme', 'Doğrulama', 'Yerleştirme'].map((step, index) => (
              <div key={step} className={`mb-2 rounded border px-3 py-3 text-sm ${index < 3 ? 'border-blue-700 bg-blue-600/30' : 'border-slate-800 bg-slate-900/50'}`}>
                <div className="font-black">{index + 1}. {step}</div>
                <div className="text-xs text-slate-400">{index < 3 ? 'hazır' : 'bekliyor'}</div>
              </div>
            ))}
            <div className="mt-4 rounded border border-slate-800 bg-slate-950 p-3">
              <div className="text-xs font-black uppercase tracking-widest text-slate-500">Doğrulama Özeti</div>
              <div className="mt-2 font-mono text-lg font-black">{averageScore || 0}%</div>
              <div className="text-xs text-slate-400">{warningCount} uyarı, {suggestions.length - validSuggestions.length} eksik öneri</div>
            </div>
          </aside>

          <section className="rounded border border-blue-950/80 bg-slate-950/45">
            <div className="flex items-center justify-between border-b border-blue-950/70 px-4 py-3">
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-slate-500">Akıllı Yerleştirme Önerileri</div>
                <div className="text-sm text-slate-400">{suggestions.length} satır · service layer skorlamasına hazır</div>
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-400">
                  <Filter className="h-4 w-4" />
                  Filtreler
                </div>
              </div>
            </div>
            <div className="grid grid-cols-[32px_120px_minmax(140px,1fr)_100px_90px_90px_92px] border-b border-slate-800 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-500">
              <div />
              <div>SKU</div>
              <div>Ürün</div>
              <div>Paket</div>
              <div>Öneri</div>
              <div>Skor</div>
              <div>İşlem</div>
            </div>
            <VirtualList
              items={suggestions}
              height={430}
              rowHeight={54}
              renderRow={(row) => (
                <div className="grid h-full grid-cols-[32px_120px_minmax(140px,1fr)_100px_90px_90px_92px] items-center border-b border-slate-900 px-4 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-blue-600" />
                  <div className="font-mono font-black">{row.packageItem.sku}</div>
                  <div className="truncate text-slate-300">{row.packageItem.productName || row.packageItem.productCode}</div>
                  <div className="truncate font-mono text-xs text-slate-400">{row.packageItem.packageId}</div>
                  <div className="font-mono text-blue-200">{row.location?.locationCode || '-'}</div>
                  <div className={row.score >= 85 ? 'text-emerald-300' : row.score >= 70 ? 'text-amber-300' : 'text-red-300'}>
                    %{row.score}
                  </div>
                  <button
                    disabled={!row.location}
                    onClick={() => approveSuggestion(row)}
                    className="rounded border border-emerald-800 bg-emerald-950/40 px-2 py-1 text-xs font-black text-emerald-100 disabled:opacity-40"
                  >
                    Onayla
                  </button>
                </div>
              )}
            />
            <div className="border-t border-slate-800 px-4 py-3 text-xs text-slate-400">{packagePlacementStatus || 'Öneri seçip tekil onay verebilirsin.'}</div>
          </section>

          <aside className="space-y-4">
            <div className="rounded border border-blue-950/80 bg-slate-950/45 p-4">
              <div className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">Depo 3D Görünüm</div>
              <div className="flex h-64 items-end justify-center gap-2 overflow-hidden rounded border border-slate-800 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.25),transparent_60%)] p-6">
                {Array.from({ length: Math.min(7, usage.rackCount || 5) }, (_, rackIndex) => (
                  <div key={rackIndex} className="grid grid-cols-2 gap-1">
                    {Array.from({ length: 16 }, (_, index) => (
                      <div
                        key={index}
                        className={`h-4 w-5 rounded-sm border ${rackIndex === 2 ? 'border-cyan-300 bg-cyan-500/70' : 'border-blue-500 bg-blue-700/70'}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded border border-blue-950/80 bg-slate-950/45 p-4">
              <div className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Raf Kapasite Haritası</div>
              <div className="grid grid-cols-10 gap-1">
                {locations.slice(0, 50).map((location) => (
                  <div
                    key={location.locationCode}
                    title={location.locationCode}
                    className={`h-6 rounded-sm ${
                      location.currentPackages === 0
                        ? 'bg-emerald-500/70'
                        : location.currentPackages >= location.capacityPackages
                          ? 'bg-red-500/80'
                          : 'bg-amber-400/80'
                    }`}
                  />
                ))}
              </div>
              <div className="mt-3 flex gap-4 text-xs text-slate-400">
                <span>Yeşil: boş</span>
                <span>Sarı: kısmi</span>
                <span>Kırmızı: dolu</span>
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
