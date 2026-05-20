import { useStore } from '../../store/useStore';
import { Rack } from '../../types';
import { Trash2, Copy, RotateCw } from 'lucide-react';

export function RightPanel() {
  const selectedId = useStore((state) => state.selectedId);
  const objects = useStore((state) => state.objects);
  const updateObject = useStore((state) => state.updateObject);
  const removeObject = useStore((state) => state.removeObject);
  const duplicateObject = useStore((state) => state.duplicateObject);

  const obj = objects.find((o) => o.id === selectedId);

  if (!obj) {
    return (
      <div className="w-80 bg-slate-900 border-l border-slate-800 p-6 flex flex-col text-slate-400 items-center justify-center">
        Düzenlemek için bir nesne seçin
      </div>
    );
  }

  const handleChange = (field: string, value: any) => {
    updateObject(obj.id, { [field]: value });
  };

  const handleRotate = () => {
    // Rotate 90 degrees
    handleChange('rotation', obj.rotation === undefined ? Math.PI / 2 : obj.rotation + Math.PI / 2);
    // Swap width and depth visually by adjusting x/z if needed, but rotating does this naturally in 3D.
  };

  const renderLocationCodes = (rack: Rack) => {
    const codes = [];
    for (let shelf = 1; shelf <= rack.shelves; shelf++) {
      for (let bin = 1; bin <= rack.binsPerShelf; bin++) {
        codes.push(`${rack.code}-${shelf}-P${bin}`);
      }
    }
    return (
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">{rack.code} Lokasyon Listesi ({codes.length})</h3>
        <div className="bg-slate-900 border border-slate-800 rounded flex-1 overflow-y-auto font-mono text-[11px] max-h-48">
          {codes.map((c, i) => (
            <div key={c} className={`p-2 border-b border-slate-800 flex justify-between ${i % 2 === 0 ? 'bg-slate-900/50' : 'bg-slate-800/20'}`}>
              <span className="text-blue-400">{c}</span>
              <span className="text-slate-600">Müsait</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const checkCollision = () => {
    if (!obj) return false;
    return objects.some((other) => {
      if (other.id === obj.id) return false;
      
      // Simple AABB collision
      // Since object might be rotated 90 degrees, we adjust width/depth
      const isObjRotated = Math.abs(Math.sin(obj.rotation)) > 0.5;
      const objW = isObjRotated ? obj.depth : obj.width;
      const objD = isObjRotated ? obj.width : obj.depth;
      
      const isOtherRotated = Math.abs(Math.sin(other.rotation)) > 0.5;
      const otherW = isOtherRotated ? other.depth : other.width;
      const otherD = isOtherRotated ? other.width : other.depth;
      
      return (
        Math.abs(obj.x - other.x) * 2 < (objW + otherW) &&
        Math.abs(obj.z - other.z) * 2 < (objD + otherD)
      );
    });
  };

  const isColliding = checkCollision();

  return (
    <aside className="w-72 border-l border-slate-800 bg-slate-900/50 p-5 flex flex-col gap-6 shrink-0 h-full overflow-y-auto z-10">
      {isColliding && (
        <div className="bg-amber-900/20 border border-amber-800 text-amber-200 text-xs p-3 rounded">
          <span className="font-bold">Uyarı:</span> Bu nesne çakışıyor!
        </div>
      )}

      <div className="flex justify-between items-start">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          {obj.type === 'rack' ? 'Raf' : obj.type === 'column' ? 'Kolon' : obj.type === 'packing' ? 'Paketleme' : 'Yol'} Özellikleri
        </h3>
        <span className="bg-blue-900/30 border border-blue-800/50 text-blue-300 text-[10px] px-2 py-0.5 rounded font-mono uppercase">
          ID: {obj.id.slice(0, 6)}
        </span>
      </div>

      <div className="space-y-4">
        {obj.type === 'rack' && (
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-500">Raf Kodu</label>
            <input
              type="text"
              value={(obj as Rack).code}
              onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
           <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-500">Genişlik (m)</label>
            <input
              type="number" step="0.1"
              value={obj.width}
              onChange={(e) => handleChange('width', parseFloat(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-500">Derinlik (m)</label>
            <input
              type="number" step="0.1"
              value={obj.depth}
              onChange={(e) => handleChange('depth', parseFloat(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-slate-500">Yükseklik (m)</label>
          <input
            type="number" step="0.1"
            value={obj.height}
            onChange={(e) => handleChange('height', parseFloat(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {obj.type === 'rack' && (
          <div className="grid grid-cols-2 gap-3">
             <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-500">Kat Sayısı</label>
              <input
                type="number"
                value={(obj as Rack).shelves}
                onChange={(e) => handleChange('shelves', parseInt(e.target.value, 10))}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-500">Göz/Kat</label>
              <input
                type="number"
                value={(obj as Rack).binsPerShelf}
                onChange={(e) => handleChange('binsPerShelf', parseInt(e.target.value, 10))}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={handleRotate} className="flex-1 py-2 bg-slate-800 border border-slate-700 text-slate-300 text-[11px] uppercase font-bold rounded hover:bg-slate-700 hover:text-white transition-colors flex justify-center items-center gap-1">
           <RotateCw className="w-3.5 h-3.5" /> Döndür
        </button>
        <button onClick={() => duplicateObject(obj.id)} className="flex-1 py-2 bg-slate-800 border border-slate-700 text-slate-300 text-[11px] uppercase font-bold rounded hover:bg-slate-700 hover:text-white transition-colors flex justify-center items-center gap-1">
           <Copy className="w-3.5 h-3.5" /> Kopyala
        </button>
      </div>

      {obj.type === 'rack' && renderLocationCodes(obj as Rack)}

      <div className="mt-auto pt-4 flex gap-2">
         <button onClick={() => removeObject(obj.id)} className="w-full py-2 bg-red-900/20 border border-red-800 text-red-500 text-[11px] uppercase font-bold rounded hover:bg-red-900/40 hover:text-red-400 transition-colors flex justify-center items-center gap-1">
           <Trash2 className="w-3.5 h-3.5" /> Nesneyi Sil
        </button>
      </div>
    </aside>
  );
}
