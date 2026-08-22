import type { Vec3 } from './hermite.js';

export interface Sgp4VerCase {
  readonly satnum: number;
  readonly line1: string;
  readonly line2: string;
  readonly tsinceMin: number;
  readonly positionKm: Vec3;
  readonly velocityKmS: Vec3;
}

/**
 * Parse Vallado's published SGP4 verification fixtures — SGP4-VER.TLE
 * (input TLEs) and tcppver.out (reference TEME state vectors), bundled
 * verbatim with python-sgp4 and copied into fixtures/ from the backend's
 * installed package (same file the backend's own SGP4 is validated
 * against — see backend M0.3). Returns one case per (satellite, tsince)
 * pair actually present in tcppver.out.
 */
export function parseSgp4VerFixture(tleText: string, outText: string): Sgp4VerCase[] {
  const tleLines = tleText.split('\n').map((l) => l.trimEnd());
  const tlesBySatnum = new Map<number, { line1: string; line2: string }>();
  for (let i = 0; i < tleLines.length; i++) {
    const line = tleLines[i];
    if (line.startsWith('1 ')) {
      const line2 = tleLines[i + 1];
      if (!line2 || !line2.startsWith('2 ')) continue;
      const satnum = Number.parseInt(line.slice(2, 7), 10);
      tlesBySatnum.set(satnum, { line1: line, line2 });
    }
  }

  const cases: Sgp4VerCase[] = [];
  let current: { satnum: number; line1: string; line2: string } | null = null;
  for (const rawLine of outText.split('\n')) {
    const line = rawLine.trim();
    if (line === '') continue;
    const header = /^(\d+)\s+xx$/.exec(line);
    if (header) {
      const satnum = Number.parseInt(header[1], 10);
      const tle = tlesBySatnum.get(satnum);
      current = tle ? { satnum, ...tle } : null;
      continue;
    }
    if (!current) continue;
    const cols = line.split(/\s+/);
    if (cols.length < 7) continue;
    const nums = cols.slice(0, 7).map(Number);
    if (nums.some((n) => Number.isNaN(n))) continue;
    const [tsinceMin, x, y, z, vx, vy, vz] = nums;
    cases.push({
      satnum: current.satnum,
      line1: current.line1,
      line2: current.line2,
      tsinceMin,
      positionKm: { x, y, z },
      velocityKmS: { x: vx, y: vy, z: vz },
    });
  }
  return cases;
}
