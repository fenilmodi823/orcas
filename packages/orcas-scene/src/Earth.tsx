/**
 * Placeholder Earth mesh. Scene units, not km — the real ScaleManager /
 * log-depth-buffer scale strategy is Phase 4 work (Architecture.md
 * "Scale strategy"). This proves R3F wiring end to end, nothing more.
 */
export function Earth() {
  return (
    <mesh>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial color="#0E1626" emissive="#00E5FF" emissiveIntensity={0.05} roughness={0.85} />
    </mesh>
  );
}
