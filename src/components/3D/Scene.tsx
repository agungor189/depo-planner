import { Canvas } from '@react-three/fiber';
import { OrbitControls, MapControls } from '@react-three/drei';
import { WarehouseFloor } from './WarehouseFloor';
import { useStore } from '../../store/useStore';
import { ObjectRenderer } from './Objects/ObjectRenderer';

export function Scene() {
  const objects = useStore((state) => state.objects);
  const viewMode = useStore((state) => state.viewMode);
  const setSelectedId = useStore((state) => state.setSelectedId);

  return (
    <div className="w-full h-full">
      <Canvas 
        shadows 
        camera={viewMode === 'Top' ? { position: [0, 20, 0], fov: 50, near: 0.1, far: 1000 } : { position: [0, 10, 15], fov: 50 }}
        onPointerMissed={() => setSelectedId(null)}
        gl={{ preserveDrawingBuffer: true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight
          castShadow
          position={[10, 20, 10]}
          intensity={1}
          shadow-mapSize={[1024, 1024]}
        >
          <orthographicCamera attach="shadow-camera" args={[-20, 20, 20, -20]} />
        </directionalLight>

        <WarehouseFloor />

        {objects.map((obj) => (
          <ObjectRenderer key={obj.id} obj={obj} />
        ))}

        {viewMode === 'Top' ? (
          <MapControls makeDefault enableRotate={false} />
        ) : (
          <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.05} />
        )}
      </Canvas>
    </div>
  );
}
