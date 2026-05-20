import { useStore } from '../../store/useStore';
import { Download, Upload, Monitor, BoxSelect, Settings, Image as ImageIcon } from 'lucide-react';
import { useRef, useState } from 'react';

export function TopBar() {
  const viewMode = useStore((state) => state.viewMode);
  const setViewMode = useStore((state) => state.setViewMode);
  const loadInitialData = useStore((state) => state.loadInitialData);
  const clearAll = useStore((state) => state.clearAll);
  const setWarehouseSize = useStore((state) => state.setWarehouseSize);
  const warehouse = useStore((state) => state.warehouse);
  
  const [showSettings, setShowSettings] = useState(false);

  const handleExport = () => {
    // Generate JSON
    const stateStr = localStorage.getItem('dsdst-warehouse-data');
    if (!stateStr) return;
    const blob = new Blob([stateStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `depo-plani-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === 'string') {
         useStore.getState().importData(result);
      }
    };
    reader.readAsText(file);
  };

  const handleScreenshot = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `depo-goruntusu-${new Date().toISOString().split('T')[0]}.png`;
      a.click();
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const objects = useStore((state) => state.objects);
  const racks = objects.filter((o: any) => o.type === 'rack');
  const totalRacks = racks.length;
  let totalLocations = 0;
  racks.forEach((r: any) => {
    totalLocations += Math.floor(r.shelves) * Math.floor(r.binsPerShelf);
  });
  const usedArea = objects.reduce((acc: any, obj: any) => acc + (obj.width * obj.depth), 0);

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-6 shrink-0 z-10">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center font-bold text-white">DS</div>
        <div>
          <h1 className="text-lg font-bold leading-tight text-slate-100 uppercase tracking-wider">DSDST Depo Planlayıcı</h1>
          <p className="text-xs text-slate-500 uppercase">3D Yerleşim ve Lokasyon Yönetimi</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Settings Panel Toggle */}
        <div className="flex items-center gap-2">
          {showSettings && (
            <div className="flex items-center gap-2 text-xs absolute top-16 right-6 bg-slate-900 border border-slate-700 p-2 rounded shadow-xl z-50">
              <input type="number" placeholder="En" value={warehouse.width} onChange={e => setWarehouseSize(parseFloat(e.target.value) || 10, warehouse.length, warehouse.height)} className="w-16 bg-slate-800 border border-slate-700 text-slate-200 px-2 py-1 rounded" />
              <span className="text-slate-500 text-xs">x</span>
              <input type="number" placeholder="Boy" value={warehouse.length} onChange={e => setWarehouseSize(warehouse.width, parseFloat(e.target.value) || 10, warehouse.height)} className="w-16 bg-slate-800 border border-slate-700 text-slate-200 px-2 py-1 rounded" />
               <span className="text-slate-500 text-xs">x</span>
              <input type="number" placeholder="Yükseklik" value={warehouse.height} onChange={e => setWarehouseSize(warehouse.width, warehouse.length, parseFloat(e.target.value) || 5)} className="w-16 bg-slate-800 border border-slate-700 text-slate-200 px-2 py-1 rounded" />
              <span className="text-slate-400">m</span>
            </div>
          )}
          <button onClick={() => setShowSettings(!showSettings)} className="text-slate-400 hover:text-slate-200 p-1" title="Depo Ölçüleri">
            <Settings className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-4">
          <div className="flex flex-col items-end hidden sm:flex">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Toplam Raf</span>
            <span className="text-sm font-mono text-blue-400">{totalRacks}</span>
          </div>
          <div className="flex flex-col items-end hidden md:flex">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Lokasyon</span>
            <span className="text-sm font-mono text-blue-400">{totalLocations}</span>
          </div>
          <div className="flex flex-col items-end hidden lg:flex">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Kullanılan Alan</span>
            <span className="text-sm font-mono text-blue-400">{usedArea.toFixed(1)} m²</span>
          </div>
        </div>

        <div className="hidden sm:block h-8 w-px bg-slate-800"></div>

        <div className="flex gap-2">
           <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />
           <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded transition-colors uppercase font-medium flex items-center gap-1.5 border border-slate-700 max-w-[120px] truncate" title="İçe Aktar">
             <Upload className="w-3.5 h-3.5 shrink-0" />
             <span className="hidden xl:inline">İçe Aktar</span>
           </button>
           <button onClick={handleExport} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded transition-colors uppercase font-medium flex items-center gap-1.5 border border-slate-700 max-w-[120px] truncate" title="JSON İndir">
             <Download className="w-3.5 h-3.5 shrink-0" />
             <span className="hidden xl:inline">JSON</span>
           </button>
           <button onClick={handleScreenshot} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs text-white rounded transition-colors uppercase font-medium flex items-center gap-1.5 max-w-[120px] truncate" title="Ekran Görüntüsü">
             <ImageIcon className="w-3.5 h-3.5 shrink-0" />
             <span className="hidden xl:inline">PNG</span>
           </button>
           <button onClick={clearAll} className="px-3 py-1.5 bg-red-900/20 border border-red-800 hover:bg-red-900/40 text-[10px] text-red-500 rounded transition-colors uppercase font-bold">
             Temizle
           </button>
        </div>
      </div>
    </header>
  );
}
