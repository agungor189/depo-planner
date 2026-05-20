import { AlertTriangle, CheckCircle2, Save } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { calculateAreaUsage, trimNumber } from '../../utils/warehouse';

export function BottomBar() {
  const objects = useStore((state) => state.objects);
  const warehouseConfig = useStore((state) => state.warehouseConfig);
  const warnings = useStore((state) => state.warnings);
  const saveStatus = useStore((state) => state.saveStatus);
  const selectedId = useStore((state) => state.selectedId);
  const usage = calculateAreaUsage(objects, warehouseConfig);
  const selected = objects.find((object) => object.id === selectedId);
  const errorCount = warnings.filter((warning) => warning.severity === 'error').length;

  return (
    <footer className="flex h-9 shrink-0 items-center justify-between border-t border-slate-800 bg-slate-950 px-4 text-[11px] font-bold uppercase tracking-wide text-slate-300">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-emerald-300">
          <Save className="h-3.5 w-3.5" />
          {saveStatus}
        </span>
        <span className="hidden sm:inline">
          Depo: {trimNumber(warehouseConfig.width)} m x {trimNumber(warehouseConfig.length)} m x {trimNumber(warehouseConfig.height)} m
        </span>
        <span className="hidden md:inline">Alan: {trimNumber(usage.totalWarehouseArea)} m²</span>
        <span className="hidden lg:inline">Raf: {usage.rackCount}</span>
        <span className="hidden lg:inline">Lokasyon: {usage.totalLocationCount}</span>
      </div>

      <div className="flex items-center gap-4">
        <span className="hidden md:inline">Kullanım: {trimNumber(usage.utilizationPercent, 1)}%</span>
        <span className="hidden lg:inline">Boş alan: {trimNumber(usage.freeArea)} m²</span>
        <span>Seçili: {selected ? (selected.type === 'rack' ? `Raf ${selected.code}` : selected.name) : 'Yok'}</span>
        <span className={`flex items-center gap-1.5 ${errorCount ? 'text-red-300' : 'text-emerald-300'}`}>
          {errorCount ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {warnings.length} uyarı
        </span>
      </div>
    </footer>
  );
}
