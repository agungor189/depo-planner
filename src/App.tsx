import { TopBar } from './components/UI/TopBar';
import { LeftPanel } from './components/UI/LeftPanel';
import { RightPanel } from './components/UI/RightPanel';
import { BottomBar } from './components/UI/BottomBar';
import { Scene } from './components/3D/Scene';
import { useStore } from './store/useStore';
import { StartScreen } from './components/UI/StartScreen';

export default function App() {
  const hasActivePlan = useStore((state) => state.hasActivePlan);

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
      {!hasActivePlan && <StartScreen />}
    </div>
  );
}
