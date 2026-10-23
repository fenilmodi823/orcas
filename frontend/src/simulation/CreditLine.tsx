import './CreditLine.css';

export interface CreditLineProps {
  /** Always on screen: the catalogue's provenance (RA-14 §2.3, RA14.D3) and ESA's Gaia acknowledgement. */
  readonly required: string;
  /** Every other credit, word for word, behind the Sources control. */
  readonly sources: readonly string[];
}

/**
 * The map-credit line (UI audit B.30). The attributions the data terms require
 * can never wait to be summoned, so they stay visible; the rest open from a
 * native disclosure, keyboard and screen-reader ready without any state.
 */
export function CreditLine({ required, sources }: CreditLineProps) {
  return (
    <div className="credit-line">
      <p className="credit-line__required">{required}</p>
      <details className="credit-line__sources">
        <summary className="credit-line__toggle">Sources</summary>
        <div className="credit-line__list">
          {sources.map((credit) => (
            <p key={credit}>{credit}</p>
          ))}
        </div>
      </details>
    </div>
  );
}
