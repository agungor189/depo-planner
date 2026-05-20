import { useStore } from '../../store/useStore';
import { Rack } from '../../types';

export function BottomBar() {
  const objects = useStore((state) => state.objects);
  const warehouse = useStore((state) => state.warehouse);

  const racks = objects.filter((o) => o.type === 'rack') as Rack[];
  const totalRacks = racks.length;
  
  let totalLocations = 0;
  racks.forEach(r => {
    totalLocations += Math.floor(r.shelves) * Math.floor(r.binsPerShelf);
  });

  const usedArea = objects.reduce((acc, obj) => {
    return acc + (obj.width * obj.depth);
  }, 0);

  const totalArea = warehouse.width * warehouse.length;
  const utilizedPercent = ((usedArea / totalArea) * 100).toFixed(1);

  const selectedObjName = useStore((state) => {
    const sId = state.selectedId;
    if (!sId) return 'YOK';
    const obj = state.objects.find(o => o.id === sId);
    if (!obj) return 'YOK';
    if (obj.type === 'rack') return `RAF ${(obj as Rack).code}`;
    if (obj.type === 'column') return 'KOLON';
    if (obj.type === 'packing') return 'PAKETLEME';
    return 'YOL';
  });

  return (
    <footer className="h-8 bg-blue-600 text-white flex items-center px-4 justify-between text-[10px] font-bold uppercase shrink-0 z-10">
      <div className="flex items-center gap-4">
        <span>Sistem Hazır</span>
        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
      </div>
      <div className="flex gap-6">
        <span>Depo Boyutu: {warehouse.width}m x {warehouse.length}m</span>
        <span>Seçili Nesne: {selectedObjName}</span>
        <span>DSDST WMS INTEGRATED</span>
      </div>
    </footer>
  );
}
