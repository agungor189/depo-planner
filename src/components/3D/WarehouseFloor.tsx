import { Grid, Text } from '@react-three/drei';
import { useStore } from '../../store/useStore';
import { trimNumber } from '../../utils/warehouse';

function range(max: number, step: number) {
  const values: number[] = [];
  for (let value = 0; value <= max + 0.001; value += step) {
    values.push(Number(value.toFixed(3)));
  }
  if (values[values.length - 1] !== max) values.push(max);
  return values;
}

function labelStep(max: number) {
  if (max <= 8) return 1;
  if (max <= 20) return 2;
  return 5;
}

export function WarehouseFloor() {
  const warehouseConfig = useStore((state) => state.warehouseConfig);
  const gridSettings = useStore((state) => state.gridSettings);
  const unitPreference = useStore((state) => state.unitPreference);
  const width = warehouseConfig.width;
  const length = warehouseConfig.length;
  const height = warehouseConfig.height;
  const halfWidth = width / 2;
  const halfLength = length / 2;
  const xLabels = range(width, labelStep(width));
  const zLabels = range(length, labelStep(length));

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color="#111827" roughness={0.88} metalness={0.08} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]}>
        <planeGeometry args={[width, length]} />
        <meshBasicMaterial color="#1e293b" transparent opacity={0.26} />
      </mesh>

      {gridSettings.showGrid && (
        <Grid
          position={[0, 0, 0]}
          args={[width, length]}
          cellSize={gridSettings.size}
          cellThickness={0.7}
          cellColor="#334155"
          sectionSize={Math.max(gridSettings.size * 4, 1)}
          sectionThickness={1.2}
          sectionColor="#64748b"
          fadeDistance={Math.max(width, length) * 2}
          fadeStrength={0.6}
          infiniteGrid={false}
        />
      )}

      <mesh position={[0, 0.012, -halfLength]}>
        <boxGeometry args={[width, 0.035, 0.035]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>
      <mesh position={[-halfWidth, 0.012, 0]}>
        <boxGeometry args={[0.035, 0.035, length]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>

      {gridSettings.showMeasurements && (
        <group>
          {xLabels.map((value) => (
            <group key={`x-${value}`} position={[value - halfWidth, 0.03, -halfLength - 0.25]}>
              <mesh position={[0, 0, 0.15]}>
                <boxGeometry args={[0.02, 0.02, 0.3]} />
                <meshBasicMaterial color="#38bdf8" />
              </mesh>
              <Text
                rotation={[-Math.PI / 2, 0, 0]}
                color="#cbd5e1"
                fontSize={0.16}
                anchorX="center"
                anchorY="middle"
              >
                {trimNumber(unitPreference === 'cm' ? value * 100 : value, unitPreference === 'cm' ? 0 : 1)} {unitPreference}
              </Text>
            </group>
          ))}
          {zLabels.map((value) => (
            <group key={`z-${value}`} position={[-halfWidth - 0.3, 0.03, value - halfLength]}>
              <mesh position={[0.15, 0, 0]}>
                <boxGeometry args={[0.3, 0.02, 0.02]} />
                <meshBasicMaterial color="#38bdf8" />
              </mesh>
              <Text
                rotation={[-Math.PI / 2, 0, Math.PI / 2]}
                color="#cbd5e1"
                fontSize={0.16}
                anchorX="center"
                anchorY="middle"
              >
                {trimNumber(unitPreference === 'cm' ? value * 100 : value, unitPreference === 'cm' ? 0 : 1)} {unitPreference}
              </Text>
            </group>
          ))}

          <Text
            position={[0, 0.04, -halfLength - 0.62]}
            rotation={[-Math.PI / 2, 0, 0]}
            color="#93c5fd"
            fontSize={0.2}
            anchorX="center"
            anchorY="middle"
          >
            X genişlik: 0 → {trimNumber(unitPreference === 'cm' ? width * 100 : width, unitPreference === 'cm' ? 0 : 1)} {unitPreference}
          </Text>
          <Text
            position={[-halfWidth - 0.7, 0.04, 0]}
            rotation={[-Math.PI / 2, 0, Math.PI / 2]}
            color="#93c5fd"
            fontSize={0.2}
            anchorX="center"
            anchorY="middle"
          >
            Z uzunluk: 0 → {trimNumber(unitPreference === 'cm' ? length * 100 : length, unitPreference === 'cm' ? 0 : 1)} {unitPreference}
          </Text>
        </group>
      )}

      {gridSettings.showWalls && (
        <group>
          <mesh position={[0, height / 2, -halfLength]}>
            <boxGeometry args={[width, height, 0.055]} />
            <meshStandardMaterial color="#64748b" transparent opacity={0.18} />
          </mesh>
          <mesh position={[0, height / 2, halfLength]}>
            <boxGeometry args={[width, height, 0.055]} />
            <meshStandardMaterial color="#64748b" transparent opacity={0.18} />
          </mesh>
          <mesh position={[-halfWidth, height / 2, 0]}>
            <boxGeometry args={[0.055, height, length]} />
            <meshStandardMaterial color="#64748b" transparent opacity={0.18} />
          </mesh>
          <mesh position={[halfWidth, height / 2, 0]}>
            <boxGeometry args={[0.055, height, length]} />
            <meshStandardMaterial color="#64748b" transparent opacity={0.18} />
          </mesh>
        </group>
      )}
    </group>
  );
}
