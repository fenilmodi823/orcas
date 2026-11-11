import type { Conjunction, ScreeningRun } from '../data/conjunction-client.js';
import { GlassSurface } from './GlassSurface.js';
import { warningKey } from './conjunction-warning.js';
import { passText } from './conjunction-warning-text.js';
import { screenedCaption } from './passes-caption.js';
import './PassesTable.css';

export interface PassesTableProps {
  readonly run: ScreeningRun;
  readonly passes: readonly Conjunction[];
  readonly wallNowMs: number;
  readonly onWatch: (c: Conjunction) => void;
  readonly onHide: () => void;
}

/** The open close-passes list (Stage B §5.5): a table, the screened window as its caption. */
export function PassesTable({ run, passes, wallNowMs, onWatch, onHide }: PassesTableProps) {
  return (
    <GlassSurface variant="floating" className="raised passes-table">
      <table>
        <caption>
          <span>{screenedCaption(run.windowStartMs, run.windowEndMs, wallNowMs)}</span>
          <button type="button" className="passes-table__button" onClick={onHide}>Hide</button>
        </caption>
        <thead>
          <tr>
            <th scope="col">Pair</th>
            <th scope="col" className="passes-table__num">Miss</th>
            <th scope="col" className="passes-table__num">Closest approach (UTC)</th>
            <th scope="col"><span className="passes-table__sr">Action</span></th>
          </tr>
        </thead>
        <tbody>
          {passes.slice(0, 10).map((c) => {
            const p = passText(c);
            return (
              <tr key={warningKey(c)}>
                <td>{p.pair}</td>
                <td className="passes-table__num">{p.miss}</td>
                <td className="passes-table__num">{p.tca}</td>
                <td>
                  <button type="button" className="passes-table__button" aria-label={`Watch ${p.pair}`} onClick={() => onWatch(c)}>Watch</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </GlassSurface>
  );
}
