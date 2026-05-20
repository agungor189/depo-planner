import { useRef, useEffect } from 'react';
import { useStore } from '../../../store/useStore';
import { Rack } from '../../../types';
import { TransformControls, Text } from '@react-three/drei';

export function RackModel({ obj }: { obj: Rack }) {
  const selectedId = useStore((state) => state.selectedId);
  const updateObject = useStore((state) => state.updateObject);
  const setSelectedId = useStore((state) => state.setSelectedId);
  
  const isSelected = selectedId === obj.id;

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    setSelectedId(obj.id);
  };

  const codeLabelOffset = obj.height + 0.2;

  const content = (
    <group position={[obj.x, 0, obj.z]} rotation={[0, obj.rotation, 0]} onClick={handlePointerDown}>
      <mesh position={[0, obj.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[obj.width, obj.height, obj.depth]} />
        <meshStandardMaterial color={isSelected ? '#3b82f6' : '#1e3a8a'} wireframe={false} />
        {/* Simple shelves visual (wireframe or lines) */}
      </mesh>
      
      {/* 3D Label */}
      <Text
        position={[0, codeLabelOffset, 0]}
        color="#ffffff"
        fontSize={0.4}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {obj.code}
      </Text>
    </group>
  );

  return content;
}
