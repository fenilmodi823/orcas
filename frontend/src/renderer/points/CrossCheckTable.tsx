import type { CrossCheckRow } from './points-cross-check.js';

/** The table itself, so the route file stays under the 250-line ban
 * while the whole cross-check keeps one module. */
export function CrossCheckTable({ rows }: { readonly rows: readonly CrossCheckRow[] }) {
  return (
          <table className="points-debug__table">
            <thead>
              <tr>
                <th>NORAD</th>
                <th>rendered (km)</th>
                <th>direct SGP4 (km)</th>
                <th>delta (m)</th>
                <th>expected px</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: CrossCheckRow) => (
                <tr key={row.norad}>
                  <td>{row.norad}</td>
                  <td>
                    {row.renderedKm.x.toFixed(1)}, {row.renderedKm.y.toFixed(1)}, {row.renderedKm.z.toFixed(1)}
                  </td>
                  <td>
                    {row.directKm.x.toFixed(1)}, {row.directKm.y.toFixed(1)}, {row.directKm.z.toFixed(1)}
                  </td>
                  <td>{row.deltaM.toFixed(1)}</td>
                  <td>{row.drawPx.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
  );
}
