import { satrecFromOmm } from '@orcas/physics';
import type { ObjectMeta } from '../data/catalog-types.js';
import { ephemerisCsv, ephemerisFileName } from '../data/ephemeris-export.js';
import './ExportEphemerisButton.css';

const DURATION_S = 86_400; // one day
const STEP_S = 60;

/** Hands the browser a file to save — no server round-trip, nothing stored. */
function download(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * The selected object's SGP4 ephemeris for one day from the simulated time,
 * at one-minute steps, as a CSV whose header says what every number rests
 * on (data/ephemeris-export.ts). The legacy "export telemetry" ported with
 * its frames and provenance stated.
 */
export function ExportEphemerisButton({ object, startMs }: { object: ObjectMeta; startMs: number }) {
  function exportCsv() {
    const csv = ephemerisCsv(object, satrecFromOmm(object.record), {
      startMs,
      durationS: DURATION_S,
      stepS: STEP_S,
      generatedMs: Date.now(),
    });
    download(ephemerisFileName(object, startMs), csv);
  }

  return (
    <button type="button" className="export-ephemeris" onClick={exportCsv}>
      Download ephemeris (CSV, 24 h from the simulated time)
    </button>
  );
}
