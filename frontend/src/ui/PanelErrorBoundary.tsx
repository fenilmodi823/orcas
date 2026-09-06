import { Component } from 'react';
import type { ReactNode } from 'react';
import { GlassSurface } from './GlassSurface.js';
import './PanelErrorBoundary.css';

interface Props {
  /** Named in the fallback message — e.g. "Camera panel hit an error." */
  readonly label: string;
  readonly children: ReactNode;
}

interface State {
  readonly hasError: boolean;
}

/**
 * Rules.md §4: "Panel throws → per-panel boundary — one dies, app
 * survives." Class component because React only supports error boundaries
 * via getDerivedStateFromError/componentDidCatch — no hook equivalent.
 * No retry: a page reload already recovers, and a broken local retry could
 * make things worse than the honest fallback below.
 */
export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`[${this.props.label}]`, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <GlassSurface variant="floating" elevation={2} className="panel-error-boundary">
          <p data-error>{this.props.label} hit an error.</p>
        </GlassSurface>
      );
    }
    return this.props.children;
  }
}
