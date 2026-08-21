import { TelemetryReadout } from './TelemetryReadout.js';
import { StatusPill } from './StatusPill.js';
import './ObjectDetail.css';

export interface ObjectDetailData {
  eccentricity: number;
  raanDeg: number;
  argPericenterDeg: number;
  meanAnomalyDeg: number;
  epoch: Date;
  mahalanobisDistance?: number;
  probabilityOfCollision?: number;
}

export interface ObjectDetailProps {
  detail: ObjectDetailData;
}

/**
 * The disclosed grid behind "More information" (Design.md §6). The epoch is
 * always shown alongside — every value derived from an element set displays
 * its epoch (Design.md §4, non-negotiable).
 */
export function ObjectDetail({ detail }: ObjectDetailProps) {
  return (
    <div className="object-detail">
      <div className="object-detail__grid">
        <TelemetryReadout label="Ecc" value={detail.eccentricity} precision={4} />
        <TelemetryReadout label="RAAN" value={detail.raanDeg} unit="°" />
        <TelemetryReadout label="Arg Peri" value={detail.argPericenterDeg} unit="°" />
        <TelemetryReadout label="Mean Anomaly" value={detail.meanAnomalyDeg} unit="°" />
        {detail.mahalanobisDistance !== undefined && (
          <TelemetryReadout label="D_M" value={detail.mahalanobisDistance} precision={2} />
        )}
        {detail.probabilityOfCollision !== undefined && (
          <TelemetryReadout label="P_c" value={detail.probabilityOfCollision} />
        )}
      </div>
      <StatusPill epoch={detail.epoch} />
    </div>
  );
}
