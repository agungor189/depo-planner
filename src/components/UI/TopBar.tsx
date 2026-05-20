import { ChangeEvent, useRef } from 'react';
import {
  Box,
  Download,
  FileJson,
  Focus,
  Grid3X3,
  Image as ImageIcon,
  Map,
  Maximize2,
  Rotate3D,
  Upload,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { ViewMode } from '../../types';
import { calculateAreaUsage, trimNumber } from '../../utils/warehouse';

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const viewButtons: Array<{ mode: ViewMode; label: string; icon: typeof Map }> = [
  { mode: '2D', label: '2D Plan', icon: Map },
  { mode: '3D', label: '3D Görünüm', icon: Box },
  { mode: 'ISO', label: 'İzometrik', icon: Rotate3D },
  { mode: 'TOP', label: 'Üstten', icon: Grid3X3 },
];

export function TopBar() {
  const viewMode = useStore((state) => state.viewMode);
  const setViewMode = useStore((state) => state.setViewMode);
  const warehouseConfig = useStore((state) => state.warehouseConfig);
  const objects = useStore((state) => state.objects);
  const locationStocks = useStore((state) => state.locationStocks);
  const selectedId = useStore((state) => state.selectedId);
  const exportJSON = useStore((state) => state.exportJSON);
  const importJSON = useStore((state) => state.importJSON);
  const saveStatus = useStore((state) => state.saveStatus);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const usage = calculateAreaUsage(objects, warehouseConfig, locationStocks);

  const handleExport = () => {
    downloadText(
      `depo-plani-${new Date().toISOString().slice(0, 10)}.json`,
      exportJSON(),
      'application/json;charset=utf-8',
    );
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

  const handleScreenshot = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = `depo-goruntusu-${new Date().toISOString().slice(0, 10)}.png`;
    anchor.click();
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-5 text-slate-100">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-blue-600 font-black tracking-tight text-white">
          DS
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-black uppercase tracking-wide">DSDST Depo Planlayıcı</h1>
          <p className="truncate text-xs text-slate-500">
            {warehouseConfig.name} · {trimNumber(warehouseConfig.width)} x {trimNumber(warehouseConfig.length)} x{' '}
            {trimNumber(warehouseConfig.height)} m · {saveStatus}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 rounded bg-slate-950 p-1 lg:flex">
          {viewButtons.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              title={label}
              className={`flex h-9 items-center gap-2 px-3 text-xs font-bold uppercase tracking-wide transition-colors ${
                viewMode === mode
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="hidden gap-5 xl:flex">
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Raf</div>
            <div className="font-mono text-sm text-blue-300">{usage.rackCount}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Lokasyon</div>
            <div className="font-mono text-sm text-blue-300">{usage.totalLocationCount}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Paket</div>
            <div className="font-mono text-sm text-blue-300">
              {usage.filledPackageCount}/{usage.totalPackageCapacity}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Kullanım</div>
            <div className="font-mono text-sm text-blue-300">{trimNumber(usage.utilizationPercent, 1)}%</div>
          </div>
        </div>

        <div className="h-8 w-px bg-slate-800" />

        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" className="hidden" accept=".json,application/json" onChange={handleImport} />
          <button
            title="JSON içe aktar"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-9 w-9 items-center justify-center border border-slate-700 bg-slate-800 text-slate-300 hover:border-blue-500 hover:text-white"
          >
            <Upload className="h-4 w-4" />
          </button>
          <button
            title="JSON dışa aktar"
            onClick={handleExport}
            className="flex h-9 w-9 items-center justify-center border border-slate-700 bg-slate-800 text-slate-300 hover:border-blue-500 hover:text-white"
          >
            <FileJson className="h-4 w-4" />
          </button>
          <button
            title="Ekran görüntüsü indir"
            onClick={handleScreenshot}
            className="flex h-9 w-9 items-center justify-center border border-slate-700 bg-slate-800 text-slate-300 hover:border-blue-500 hover:text-white"
          >
            <ImageIcon className="h-4 w-4" />
          </button>
          <button
            title={selectedId ? 'Seçili objeye odaklan' : 'Tüm depoyu ekrana sığdır'}
            onClick={() => window.dispatchEvent(new CustomEvent(selectedId ? 'focus-selected-object' : 'fit-warehouse'))}
            className="flex h-9 w-9 items-center justify-center bg-blue-600 text-white hover:bg-blue-500"
          >
            {selectedId ? <Focus className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            title="Plan JSON indir"
            onClick={handleExport}
            className="hidden h-9 items-center gap-2 bg-slate-800 px-3 text-xs font-bold uppercase tracking-wide text-slate-200 hover:bg-slate-700 2xl:flex"
          >
            <Download className="h-4 w-4" />
            Dışa Aktar
          </button>
        </div>
      </div>
    </header>
  );
}
