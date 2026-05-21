import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { MapControls, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { WarehouseFloor } from './WarehouseFloor';
import { useStore } from '../../store/useStore';
import { ObjectRenderer } from './Objects/ObjectRenderer';

function CameraController() {
  const camera = useThree((state) => state.camera);
  const viewMode = useStore((state) => state.viewMode);
  const warehouseConfig = useStore((state) => state.warehouseConfig);
  const selectedId = useStore((state) => state.selectedId);
  const objects = useStore((state) => state.objects);
  const focusedLocationCode = useStore((state) => state.focusedLocationCode);
  const generateLocationCodes = useStore((state) => state.generateLocationCodes);

  useEffect(() => {
    const maxDimension = Math.max(warehouseConfig.width, warehouseConfig.length, warehouseConfig.height);
    const target = new THREE.Vector3(0, 0, 0);

    if (viewMode === '2D' || viewMode === 'TOP') {
      camera.position.set(0, maxDimension * 1.7, 0.001);
    } else if (viewMode === 'ISO') {
      camera.position.set(maxDimension * 0.9, maxDimension * 0.8, maxDimension * 0.9);
    } else {
      camera.position.set(maxDimension * 0.65, maxDimension * 0.55, maxDimension * 1.05);
    }

    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, viewMode, warehouseConfig]);

  useEffect(() => {
    const fit = () => {
      const maxDimension = Math.max(warehouseConfig.width, warehouseConfig.length, warehouseConfig.height);
      camera.position.set(maxDimension * 0.8, maxDimension * 0.7, maxDimension * 1.05);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    };

    const focusSelected = () => {
      const selected = objects.find((object) => object.id === selectedId);
      if (!selected) {
        fit();
        return;
      }
      const x = selected.x + selected.width / 2 - warehouseConfig.width / 2;
      const z = selected.z + selected.depth / 2 - warehouseConfig.length / 2;
      const distance = Math.max(selected.width, selected.depth, selected.height, 1) * 4;
      camera.position.set(x + distance, selected.height + distance * 0.6, z + distance);
      camera.lookAt(x, selected.height / 2, z);
      camera.updateProjectionMatrix();
    };

    window.addEventListener('fit-warehouse', fit);
    window.addEventListener('focus-selected-object', focusSelected);
    return () => {
      window.removeEventListener('fit-warehouse', fit);
      window.removeEventListener('focus-selected-object', focusSelected);
    };
  }, [camera, objects, selectedId, warehouseConfig]);

  useEffect(() => {
    if (!focusedLocationCode) return;
    const location = generateLocationCodes().find((item) => item.locationCode === focusedLocationCode);
    if (!location) return;
    const rack = objects.find((object) => object.type === 'rack' && object.rackCode === location.rackCode);
    if (!rack) return;

    const x = rack.x + rack.width / 2 - warehouseConfig.width / 2;
    const z = rack.z + rack.depth / 2 - warehouseConfig.length / 2;
    const distance = Math.max(rack.width, rack.depth, rack.height, 1) * 2.7;
    camera.position.set(x + distance, rack.height + distance * 0.45, z + distance * 0.85);
    camera.lookAt(x, rack.height * 0.55, z);
    camera.updateProjectionMatrix();
  }, [camera, focusedLocationCode, generateLocationCodes, objects, warehouseConfig]);

  return null;
}

export function Scene() {
  const objects = useStore((state) => state.objects);
  const viewMode = useStore((state) => state.viewMode);
  const setSelectedId = useStore((state) => state.setSelectedId);
  const warehouseConfig = useStore((state) => state.warehouseConfig);
  const maxDimension = Math.max(warehouseConfig.width, warehouseConfig.length, warehouseConfig.height);
  const topLike = viewMode === '2D' || viewMode === 'TOP';

  return (
    <div className="h-full w-full">
      <Canvas
        shadows
        key={topLike ? 'top-camera' : 'perspective-camera'}
        orthographic={topLike}
        camera={
          topLike
            ? { position: [0, maxDimension * 1.7, 0.001], zoom: Math.max(28, 180 / maxDimension), near: 0.1, far: 1000 }
            : { position: [maxDimension * 0.65, maxDimension * 0.55, maxDimension * 1.05], fov: 45, near: 0.1, far: 1000 }
        }
        onPointerMissed={() => setSelectedId(null)}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <color attach="background" args={['#020617']} />
        <ambientLight intensity={0.62} />
        <directionalLight
          castShadow
          position={[warehouseConfig.width, warehouseConfig.height * 2.2, warehouseConfig.length]}
          intensity={1.1}
          shadow-mapSize={[2048, 2048]}
        >
          <orthographicCamera attach="shadow-camera" args={[-20, 20, 20, -20]} />
        </directionalLight>

        <CameraController />
        <WarehouseFloor />

        {objects.map((obj) => (
          <ObjectRenderer key={obj.id} obj={obj} />
        ))}

        {topLike ? (
          <MapControls makeDefault enableRotate={false} screenSpacePanning />
        ) : (
          <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.03} target={[0, 0, 0]} />
        )}
      </Canvas>
    </div>
  );
}
