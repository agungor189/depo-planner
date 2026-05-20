import { useStore } from '../../store/useStore';
import { Grid } from '@react-three/drei';

export function WarehouseFloor() {
  const warehouse = useStore((state) => state.warehouse);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[warehouse.width, warehouse.length]} />
        <meshStandardMaterial color="#2d3748" />
      </mesh>
      <Grid
        position={[0, 0, 0]}
        args={[warehouse.width, warehouse.length]}
        cellSize={1} // 1 meter cellSize
        cellThickness={1}
        cellColor="#4a5568"
        sectionSize={5}
        sectionThickness={1.5}
        sectionColor="#718096"
        fadeDistance={50}
        fadeStrength={1}
      />
    </group>
  );
}
