import { Canvas } from '@react-three/fiber';
import { Earth, Starfield } from '@orcas/scene';

/** Thin shell. Proves packages/orcas-scene renders inside the frontend workspace. */
export function App() {
  return (
    <Canvas camera={{ position: [0, 0, 4] }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} />
      <Starfield />
      <Earth />
    </Canvas>
  );
}
