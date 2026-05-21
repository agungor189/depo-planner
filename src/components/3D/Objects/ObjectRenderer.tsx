import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { Text, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../../store/useStore';
import { LocationCode, ProductGroup, Rack, WarehouseObject } from '../../../types';
import { clampObjectToWarehouse, displayMeasure, getFootprint, getObjectLabel, getRackPositionCount } from '../../../utils/warehouse';

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
  const [transformObject, setTransformObject] = useState<THREE.Group | null>(null);
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

  useEffect(() => {
    setTransformObject(groupRef.current);
  }, [isSelected]);

  const group = (
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
  );

  return (
    <>
      {isSelected && !obj.locked && transformObject && (
      <TransformControls
        object={transformObject}
        mode="translate"
        showY={false}
        translationSnap={gridSettings.snap ? gridSettings.snapSize : undefined}
        onObjectChange={constrainTransform}
        onMouseUp={commitTransform}
      />
      )}
      {group}
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

const packageColors: Record<ProductGroup, string> = {
  Alüminyum: '#38bdf8',
  Döküm: '#a78bfa',
  'Karbon Çelik': '#d4d4d8',
  PPR: '#34d399',
  Karışık: '#f59e0b',
  Diğer: '#94a3b8',
};

function RackLocationCell({
  rack,
  location,
  positionCount,
  topLike,
  selectedPackageId,
  highlightedPackageIds,
  onClick,
}: {
  rack: Rack;
  location: LocationCode;
  positionCount: number;
  topLike: boolean;
  selectedPackageId: string | null;
  highlightedPackageIds: string[];
  onClick: (event: ThreeEvent<PointerEvent>, location: LocationCode) => void;
}) {
  const cellWidth = rack.width / Math.max(1, positionCount);
  const shelfHeight = rack.height / Math.max(1, rack.shelfCount);
  const x = -rack.width / 2 + (location.positionNumber - 0.5) * cellWidth;
  const shelfBase = (location.shelfNumber - 1) * shelfHeight;
  const packages = (location.packages || []).slice(0, location.capacityPackages);
  const depthSlots = Math.max(1, Math.floor(Number(rack.depthSlots || 1)));
  const stackLevels = Math.max(1, Math.floor(Number(rack.stackLevels || 1)));
  const slotDepth = rack.depth / depthSlots;
  const blockWidth = Math.max(0.05, cellWidth * 0.58);
  const blockDepth = Math.max(0.05, slotDepth * 0.55);
  const blockHeight = topLike ? 0.06 : Math.max(0.06, Math.min(0.18, shelfHeight * 0.32));
  const hasHighlight = packages.some((item) => highlightedPackageIds.includes(item.packageId));
  const hasSelected = Boolean(selectedPackageId && packages.some((item) => item.packageId === selectedPackageId));

  return (
    <group>
      <mesh
        position={[x, topLike ? 0.16 : shelfBase + shelfHeight / 2, 0]}
        onPointerDown={(event) => onClick(event, location)}
      >
        <boxGeometry args={[Math.max(0.05, cellWidth * 0.92), topLike ? 0.07 : shelfHeight * 0.9, rack.depth * 0.92]} />
        <meshBasicMaterial transparent opacity={0.02} color={hasSelected || hasHighlight ? '#facc15' : '#ffffff'} />
      </mesh>

      {packages.map((item, index) => {
        const depthIndex = Math.floor(index / stackLevels) % depthSlots;
        const stackIndex = index % stackLevels;
        const z = -rack.depth / 2 + (depthIndex + 0.5) * slotDepth;
        const y = topLike
          ? 0.22 + index * 0.012
          : shelfBase + blockHeight / 2 + 0.05 + stackIndex * (blockHeight + 0.025);
        const selectedPackage = selectedPackageId === item.packageId;
        const highlighted = highlightedPackageIds.includes(item.packageId);
        const color = selectedPackage ? '#facc15' : highlighted ? '#fb7185' : packageColors[item.category] || '#94a3b8';

        return (
          <mesh key={item.packageId} position={[x, y, z]} castShadow receiveShadow>
            <boxGeometry args={[blockWidth, blockHeight, blockDepth]} />
            <meshStandardMaterial
              color={color}
              emissive={selectedPackage || highlighted ? color : '#000000'}
              emissiveIntensity={selectedPackage || highlighted ? 0.45 : 0}
              roughness={0.5}
              metalness={0.05}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function RackVisual({ rack, selected }: { rack: Rack; selected: boolean }) {
  const viewMode = useStore((state) => state.viewMode);
  const gridSettings = useStore((state) => state.gridSettings);
  const unitPreference = useStore((state) => state.unitPreference);
  const generateLocationCodes = useStore((state) => state.generateLocationCodes);
  const selectLocation = useStore((state) => state.selectLocation);
  const setSelectedId = useStore((state) => state.setSelectedId);
  const selectedPackageId = useStore((state) => state.selectedPackageId);
  const selectedPackage = useStore((state) =>
    state.selectedPackageId ? state.importedPackages.find((item) => item.packageId === state.selectedPackageId) || null : null,
  );
  const highlightedPackageIds = useStore((state) => state.highlightedPackageIds);
  const placeImportedPackage = useStore((state) => state.placeImportedPackage);
  const topLike = viewMode === '2D' || viewMode === 'TOP';
  const shelfLines = Array.from({ length: Math.max(rack.shelfCount - 1, 0) }, (_, index) => index + 1);
  const positionCount = getRackPositionCount(rack);
  const binLines = Array.from({ length: Math.max(positionCount - 1, 0) }, (_, index) => index + 1);
  const locations = generateLocationCodes(rack.id);

  const handleCellClick = (event: ThreeEvent<PointerEvent>, location: LocationCode) => {
    event.stopPropagation();
    setSelectedId(rack.id);
    selectLocation(location.locationCode);
    if (selectedPackage?.status === 'unplaced') {
      placeImportedPackage(selectedPackage.packageId, location.locationCode);
    }
  };

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
          position={[-rack.width / 2 + (rack.width / positionCount) * line, topLike ? 0.11 : rack.height / 2, 0]}
        >
          <boxGeometry args={[0.018, topLike ? 0.035 : rack.height + 0.02, rack.depth + 0.05]} />
          <meshBasicMaterial color="#dbeafe" transparent opacity={0.75} />
        </mesh>
      ))}

      {locations.map((location) => (
        <RackLocationCell
          key={location.locationCode}
          rack={rack}
          location={location}
          positionCount={positionCount}
          topLike={topLike}
          selectedPackageId={selectedPackageId}
          highlightedPackageIds={highlightedPackageIds}
          onClick={handleCellClick}
        />
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
