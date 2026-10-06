import './Breadcrumb.css';

export interface Crumb {
  readonly label: string;
  /** Flies there. The last crumb is where you are and is never a control, unless it is the only one. */
  readonly onSelect?: () => void;
}

/**
 * NASA Eyes' breadcrumb (Reference §4.4: "EYES ON THE SOLAR SYSTEM › Earth › Moons › Moon"), ORCAS's
 * tokens. Each crumb above the current one flies to it; the root is the home view (S5a).
 */
export function Breadcrumb({ crumbs }: { readonly crumbs: readonly Crumb[] }) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol className="breadcrumb__list">
        {crumbs.map((crumb, i) => {
          const current = i === crumbs.length - 1 && crumbs.length > 1;
          return (
            <li key={crumb.label} className="breadcrumb__item">
              {crumb.onSelect && !current ? (
                <button type="button" className="breadcrumb__link" onClick={crumb.onSelect}>
                  {crumb.label}
                </button>
              ) : (
                <span className="breadcrumb__current" aria-current={current ? 'location' : undefined}>
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
