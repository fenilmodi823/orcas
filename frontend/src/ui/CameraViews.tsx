import './CameraViews.css';

export interface CameraViewOption<T extends string> {
  readonly id: T;
  readonly label: string;
}

/**
 * NASA Eyes' camera views for the selected body (Reference §4.4, S6b): Nearby / System, the Sun's Nearby /
 * Inner / Outer. In ORCAS's panel as a row of pills under the header, the current one pressed (B.15).
 */
export function CameraViews<T extends string>({
  options,
  active,
  onSelect,
}: {
  readonly options: readonly CameraViewOption<T>[];
  readonly active: T;
  readonly onSelect: (id: T) => void;
}) {
  return (
    <div className="camera-views" role="group" aria-label="Camera view">
      {options.map((o) => (
        <button key={o.id} type="button" className="camera-views__option" aria-pressed={o.id === active} onClick={() => onSelect(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
