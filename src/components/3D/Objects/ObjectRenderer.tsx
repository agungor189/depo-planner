import { useRef } from 'react';
import { useStore } from '../../../store/useStore';
import { TransformControls, Text, Box } from '@react-three/drei';
import * as THREE from 'three';

export function ObjectWrapper({ obj, children, color, label }: any) {
  const selectedId = useStore((state) => state.selectedId);
  const updateObject = useStore((state) => state.updateObject);
  const setSelectedId = useStore((state) => state.setSelectedId);
  const viewMode = useStore((state) => state.viewMode);

  const isSelected = selectedId === obj.id;
  const groupRef = useRef<THREE.Group>(null);

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    setSelectedId(obj.id);
  };

  const handleTransformChange = (e: any) => {
    if (!groupRef.current) return;
    const pos = groupRef.current.position;
    const rot = groupRef.current.rotation;
    // Debounce or update on mouse up preferred, but let's update raw
    // To avoid lag, we might only update store on mouseUp, but let's just do it on change with a small throttle or on dragging-changed.
  };

  const content = (
    <group
      ref={groupRef}
      position={[obj.x, 0, obj.z]}
      rotation={[0, obj.rotation, 0]}
      onClick={handlePointerDown}
      onPointerMissed={(e) => {
        if (e.type === 'click' && isSelected) {
          // setSelectedId(null) // handled in Scene normally
        }
      }}
    >
      <mesh position={[0, obj.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[obj.width, obj.height, obj.depth]} />
        <meshStandardMaterial color={isSelected ? '#60a5fa' : color} transparent opacity={obj.type === 'path' ? 0.3 : 1} />
      </mesh>

      {/* Wireframe for racks to simulate shelves */}
      {obj.type === 'rack' && (
        <mesh position={[0, obj.height / 2, 0]}>
           <boxGeometry args={[obj.width + 0.01, obj.height + 0.01, obj.depth + 0.01]} />
           <meshBasicMaterial color="#0f172a" wireframe />
        </mesh>
      )}

      {label && (
        <Text
          position={[0, obj.height + 0.3, 0]}
          color="#ffffff"
          fontSize={0.4}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
          rotation={viewMode === 'Top' ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}
        >
          {label}
        </Text>
      )}
    </group>
  );

  return (
    <>
      {isSelected && viewMode === '3D' ? (
        <TransformControls
          object={groupRef}
          mode="translate"
          onMouseUp={(e) => {
            if (groupRef.current) {
               updateObject(obj.id, {
                 x: Math.round(groupRef.current.position.x * 10) / 10,
                 z: Math.round(groupRef.current.position.z * 10) / 10
               });
            }
          }}
          showY={false}
        />
      ) : null}
      
      {isSelected && viewMode === 'Top' ? (
        <TransformControls
          object={groupRef}
          mode="translate"
          showY={false}
          onMouseUp={(e) => {
            if (groupRef.current) {
               updateObject(obj.id, {
                 x: Math.round(groupRef.current.position.x * 10) / 10,
                 z: Math.round(groupRef.current.position.z * 10) / 10
               });
            }
          }}
        />
      ) : null}
      {content}
    </>
  );
}

export function ObjectRenderer({ obj }: { obj: any }) {
  switch (obj.type) {
    case 'rack':
      return <ObjectWrapper obj={obj} color="#1e3a8a" label={obj.code} />;
    case 'column':
      return <ObjectWrapper obj={obj} color="#475569" />;
    case 'packing':
      return <ObjectWrapper obj={obj} color="#b45309" label="Paketleme" />;
    case 'path':
      return <ObjectWrapper obj={obj} color="#94a3b8" label="Yol" />;
    default:
      return null;
  }
}
