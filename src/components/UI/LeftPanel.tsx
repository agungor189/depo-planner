import { useStore } from '../../store/useStore';
import { Package, Maximize, Route, PlusSquare } from 'lucide-react';

export function LeftPanel() {
  const addObject = useStore((state) => state.addObject);
  const objects = useStore((state) => state.objects);

  const handleAddRack = () => {
    // Generate code A, B, C... depending on how many racks exist
    const rackCount = objects.filter(o => o.type === 'rack').length;
    const nextCodeCharCode = rackCount + 65;
    const code = String.fromCharCode(nextCodeCharCode > 90 ? 90 : nextCodeCharCode);

    addObject({
      type: 'rack',
      x: 0,
      z: 0,
      rotation: 0,
      width: 2,
      depth: 0.6,
      height: 1.8,
      code,
      shelves: 4,
      binsPerShelf: 7
    });
  };

  const handleAddColumn = () => {
    addObject({ type: 'column', x: 0, z: 0, rotation: 0, width: 0.5, depth: 0.5, height: 5 });
  };

  const handleAddPacking = () => {
    addObject({ type: 'packing', x: 0, z: 0, rotation: 0, width: 4, depth: 2, height: 0.1 });
  };

  const handleAddPath = () => {
    addObject({ type: 'path', x: 0, z: 0, rotation: 0, width: 5, depth: 2, height: 0.05 });
  };

  const viewMode = useStore((state) => state.viewMode);
  const setViewMode = useStore((state) => state.setViewMode);
  const setSelectedId = useStore((state) => state.setSelectedId);
  const selectedId = useStore((state) => state.selectedId);

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900/50 p-4 flex flex-col gap-6 shrink-0 z-10 overflow-y-auto">
      <section>
        <h3 className="text-[10px] font-bold text-slate-500 uppercase mb-3 tracking-widest">Nesne Ekle</h3>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleAddRack} className="p-3 bg-slate-800 rounded border border-slate-700 hover:border-blue-500 flex flex-col items-center gap-2 group transition-all">
            <div className="w-8 h-4 border-2 border-blue-500 opacity-60 group-hover:opacity-100"></div>
            <span className="text-[11px] uppercase text-slate-300 font-medium">Raf</span>
          </button>
          <button onClick={handleAddColumn} className="p-3 bg-slate-800 rounded border border-slate-700 hover:border-blue-500 flex flex-col items-center gap-2 group transition-all">
            <div className="w-6 h-6 border-2 border-slate-500 opacity-60 group-hover:opacity-100"></div>
            <span className="text-[11px] uppercase text-slate-400 font-medium">Kolon</span>
          </button>
          <button onClick={handleAddPacking} className="p-3 bg-slate-800 rounded border border-slate-700 hover:border-blue-500 flex flex-col items-center gap-2 group transition-all">
            <div className="w-10 h-6 bg-orange-900/20 border-2 border-orange-700 opacity-60 group-hover:opacity-100"></div>
            <span className="text-[11px] uppercase text-slate-400 font-medium truncate w-full text-center">Paketleme</span>
          </button>
          <button onClick={handleAddPath} className="p-3 bg-slate-800 rounded border border-slate-700 hover:border-blue-500 flex flex-col items-center gap-2 group transition-all">
            <div className="w-10 h-2 bg-slate-700 border-2 border-slate-600 opacity-60 group-hover:opacity-100"></div>
            <span className="text-[11px] uppercase text-slate-400 font-medium truncate w-full text-center">Yol</span>
          </button>
        </div>
      </section>

      <section className="flex-1 overflow-y-auto pr-1">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase mb-3 tracking-widest">Depo Katmanı</h3>
        <div className="space-y-1 text-xs">
          {objects.map((obj) => (
            <div 
              key={obj.id} 
              onClick={() => setSelectedId(obj.id)}
              className={`p-2 flex justify-between cursor-pointer transition-colors ${selectedId === obj.id ? 'bg-blue-900/20 border-l-2 border-blue-500' : 'hover:bg-slate-800 border-l-2 border-transparent'}`}
            >
              <span className={selectedId === obj.id ? 'text-blue-300 font-medium' : 'text-slate-300'}>
                {obj.type === 'rack' ? `Raf ${(obj as any).code}` : 
                 obj.type === 'column' ? 'Kolon' : 
                 obj.type === 'packing' ? 'Paketleme' : 'Yol'}
              </span>
              <span className="text-slate-500">
                {obj.width}m, {obj.depth}m
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-auto pt-4 shrink-0">
        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] uppercase font-bold text-slate-500">Görünüm Modu</span>
          </div>
          <div className="grid grid-cols-2 bg-slate-900 rounded-md p-1">
            <button 
              onClick={() => setViewMode('3D')} 
              className={`py-1 text-[10px] uppercase rounded transition-colors font-bold ${viewMode === '3D' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              3D Serbest
            </button>
            <button 
              onClick={() => setViewMode('Top')}
              className={`py-1 text-[10px] uppercase rounded transition-colors font-bold ${viewMode === 'Top' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              2D Üstten
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
