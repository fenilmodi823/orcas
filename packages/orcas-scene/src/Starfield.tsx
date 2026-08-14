import { Stars } from '@react-three/drei';

/** Background starfield. Reuses drei's Stars rather than a hand-rolled point cloud. */
export function Starfield() {
  return <Stars radius={80} depth={40} count={4000} factor={2} saturation={0} fade speed={0.2} />;
}
