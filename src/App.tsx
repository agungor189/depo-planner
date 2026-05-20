import { TopBar } from './components/UI/TopBar';
import { LeftPanel } from './components/UI/LeftPanel';
import { RightPanel } from './components/UI/RightPanel';
import { BottomBar } from './components/UI/BottomBar';
import { Scene } from './components/3D/Scene';
import { useStore } from './store/useStore';
import { useEffect } from 'react';

export default function App() {
  const loadInitialData = useStore((state) => state.loadInitialData);
  const objects = useStore((state) => state.objects);

  useEffect(() => {
    // If no objects and nothing in localstorage, maybe load initial data
    if (objects.length === 0) {
      // It might be empty because of clear check if it was truly first load
      const saved = localStorage.getItem('dsdst-warehouse-data');
      if (!saved) {
         loadInitialData();
      }
    }
  }, [loadInitialData, objects.length]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950 font-sans text-slate-200">
      <TopBar />
      <div className="flex flex-1 overflow-hidden relative">
        <LeftPanel />
        
        <main className="flex-1 relative cursor-crosshair bg-[#020617]">
          <Scene />
        </main>
        
        <RightPanel />
      </div>
      <BottomBar />
    </div>
  );
}
