import { ReactNode, useMemo, useRef } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { Text, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../../store/useStore';
import { Rack, WarehouseObject } from '../../../types';
import { clampObjectToWarehouse, displayMeasure, getFootprint, getObjectLabel } from '../../../utils/warehouse';

function planToScene(
  obj: WarehouseObject,
  warehouseWidth: number,
  warehouseLength: number,
): [number, number, number] {
  const footprint = getFootprint(obj);
  return [obj.x + footprint.width / 2 - warehouseWidth / 2, 0, obj.z + footprint.depth / 2 - warehouseLength / 2];
}

function sceneToPlan(
  obj: WarehouseObject,
  warehouseWidth: number,
  warehouseLength: number,
  position: THREE.Vector3,
) {
  const footprint = getFootprint(obj);
  return {
    x: position.x + warehouseWidth / 2 - footprint.width / 2,
    z: position.z + warehouseLength / 2 - footprint.depth / 2,
  };
}

function labelRotation(topLike: boolean): [number, number, number] {
  return topLike ? [-Math.PI / 2, 0, 0] : [0, 0, 0];
}

function ObjectWrapper({
  obj,
  label,
  children,
}: {
  obj: WarehouseObject;
  label: string;
  children: ReactNode;
}) {
  const selectedId = useStore((state) => state.selectedId);
  const updateObject = useStore((state) => state.updateObject);
  const setSelectedId = useStore((state) => state.setSelectedId);
  const viewMode = useStore((state) => state.viewMode);
  const warehouseConfig = useStore((state) => state.warehouseConfig);
  const gridSettings = useStore((state) => state.gridSettings);
  const groupRef = useRef<THREE.Group>(null);
  const topLike = viewMode === '2D' || viewMode === 'TOP';
  const isSelected = selectedId === obj.id;
  const position = planToScene(obj, warehouseConfig.width, warehouseConfig.length);

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setSelectedId(obj.id);
  };

  const commitTransform = () => {
    if (!groupRef.current) return;
    constrainTransform();
    const next = sceneToPlan(obj, warehouseConfig.width, warehouseConfig.length, groupRef.current.position);
    updateObject(obj.id, next);
  };

  const constrainTransform = () => {
    if (!groupRef.current) return;
    const next = sceneToPlan(obj, warehouseConfig.width, warehouseConfig.length, groupRef.current.position);
    const clamped = clampObjectToWarehouse({ ...obj, ...next }, warehouseConfig, gridSettings);
    const [x, y, z] = planToScene(clamped, warehouseConfig.width, warehouseConfig.length);
    groupRef.current.position.set(x, y, z);
  };

  return (
    <>
      {isSelected && !obj.locked && (
        <TransformControls
          object={groupRef}
          mode="translate"
          showY={false}
          translationSnap={gridSettings.snap ? gridSettings.snapSize : undefined}
          onObjectChange={constrainTransform}
          onMouseUp={commitTransform}
        />
      )}

      <group
        ref={groupRef}
        position={position}
        rotation={[0, obj.rotation, 0]}
        onPointerDown={handlePointerDown}
      >
        {children}
        <Text
          position={[0, topLike ? 0.12 : Math.max(obj.height, 0.08) + 0.24, 0]}
          rotation={labelRotation(topLike)}
          color="#f8fafc"
          fontSize={topLike ? 0.18 : 0.28}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.012}
          outlineColor="#020617"
        >
          {label}
        </Text>
      </group>
    </>
  );
}

function BasicBlock({ obj, selected }: { obj: WarehouseObject; selected: boolean }) {
  const viewMode = useStore((state) => state.viewMode);
  const topLike = viewMode === '2D' || viewMode === 'TOP';
  const visualHeight = topLike ? Math.max(0.04, Math.min(obj.height, 0.12)) : obj.height;
  const opacity = obj.type === 'path' || obj.type === 'safety' || obj.type === 'door' ? 0.45 : 0.9;

  return (
    <mesh position={[0, visualHeight / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[obj.width, visualHeight, obj.depth]} />
      <meshStandardMaterial
        color={selected ? '#60a5fa' : obj.color}
        transparent
        opacity={opacity}
        roughness={0.72}
        metalness={0.08}
      />
    </mesh>
  );
}

function RackVisual({ rack, selected }: { rack: Rack; selected: boolean }) {
  const viewMode = useStore((state) => state.viewMode);
  const gridSettings = useStore((state) => state.gridSettings);
  const unitPreference = useStore((state) => state.unitPreference);
  const topLike = viewMode === '2D' || viewMode === 'TOP';
  const shelfLines = Array.from({ length: Math.max(rack.shelfCount - 1, 0) }, (_, index) => index + 1);
  const binLines = Array.from({ length: Math.max(rack.binsPerShelf - 1, 0) }, (_, index) => index + 1);

  return (
    <group>
      <mesh position={[0, (topLike ? 0.09 : rack.height) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[rack.width, topLike ? 0.09 : rack.height, rack.depth]} />
        <meshStandardMaterial
          color={selected ? '#60a5fa' : rack.color}
          transparent
          opacity={topLike ? 0.78 : 0.86}
          roughness={0.65}
          metalness={0.12}
        />
      </mesh>
      <mesh position={[0, (topLike ? 0.09 : rack.height) / 2 + 0.002, 0]}>
        <boxGeometry args={[rack.width + 0.02, (topLike ? 0.1 : rack.height) + 0.02, rack.depth + 0.02]} />
        <meshBasicMaterial color={selected ? '#bfdbfe' : '#0f172a'} wireframe />
      </mesh>

      {!topLike &&
        shelfLines.map((line) => (
          <mesh key={`shelf-${line}`} position={[0, (rack.height / rack.shelfCount) * line, 0]}>
            <boxGeometry args={[rack.width + 0.03, 0.025, rack.depth + 0.04]} />
            <meshBasicMaterial color="#dbeafe" transparent opacity={0.7} />
          </mesh>
        ))}

      {binLines.map((line) => (
        <mesh
          key={`bin-${line}`}
          position={[-rack.width / 2 + (rack.width / rack.binsPerShelf) * line, topLike ? 0.11 : rack.height / 2, 0]}
        >
          <boxGeometry args={[0.018, topLike ? 0.035 : rack.height + 0.02, rack.depth + 0.05]} />
          <meshBasicMaterial color="#dbeafe" transparent opacity={0.75} />
        </mesh>
      ))}

      {gridSettings.showAccessZones && !topLike && (
        <mesh position={[0, 0.025, rack.depth / 2 + gridSettings.minimumAisleWidth / 2]}>
          <boxGeometry args={[rack.width, 0.04, gridSettings.minimumAisleWidth]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.16} />
        </mesh>
      )}

      {rack.showDimensions && (
        <Text
          position={[0, topLike ? 0.13 : rack.height + 0.55, rack.depth / 2 + 0.1]}
          rotation={labelRotation(topLike)}
          color="#bfdbfe"
          fontSize={topLike ? 0.12 : 0.16}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.006}
          outlineColor="#020617"
        >
          {displayMeasure(rack.width, unitPreference)} x {displayMeasure(rack.depth, unitPreference)} x{' '}
          {displayMeasure(rack.height, unitPreference)}
        </Text>
      )}
    </group>
  );
}

function PathStripes({ obj }: { obj: WarehouseObject }) {
  const count = Math.max(2, Math.floor(obj.width / 0.35));
  return (
    <group>
      {Array.from({ length: count }, (_, index) => (
        <mesh key={index} position={[-obj.width / 2 + (index + 0.5) * (obj.width / count), 0.075, 0]}>
          <boxGeometry args={[0.04, 0.025, obj.depth * 1.1]} />
          <meshBasicMaterial color="#e2e8f0" transparent opacity={0.45} />
        </mesh>
      ))}
    </group>
  );
}

function DoorMarker({ obj }: { obj: WarehouseObject }) {
  return (
    <group>
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[obj.width, 0.08, obj.depth]} />
        <meshBasicMaterial color="#020617" transparent opacity={0.75} />
      </mesh>
      <mesh position={[0, obj.height / 2, 0]}>
        <boxGeometry args={[obj.width, obj.height, 0.035]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.32} />
      </mesh>
    </group>
  );
}

export function ObjectRenderer({ obj }: { obj: WarehouseObject }) {
  const selectedId = useStore((state) => state.selectedId);
  const selected = selectedId === obj.id;

  if (!obj.visible) return null;

  const label = obj.type === 'rack' ? obj.rackCode : obj.type === 'note' ? obj.text : getObjectLabel(obj);

  return (
    <ObjectWrapper obj={obj} label={label}>
      {obj.type === 'rack' ? <RackVisual rack={obj} selected={selected} /> : null}
      {obj.type !== 'rack' && obj.type !== 'door' ? <BasicBlock obj={obj} selected={selected} /> : null}
      {obj.type === 'door' ? <DoorMarker obj={obj} /> : null}
      {obj.type === 'path' && obj.striped ? <PathStripes obj={obj} /> : null}
      {selected && (
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[getFootprint(obj).width + 0.08, 0.025, getFootprint(obj).depth + 0.08]} />
          <meshBasicMaterial color="#facc15" transparent opacity={0.38} />
        </mesh>
      )}
    </ObjectWrapper>
  );
}
