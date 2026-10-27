import { TriangleAlert } from 'lucide-react';
import './AlertBadge.css';

export interface AlertBadgeProps {
  message: string;
  /** 'alert' announces at once (the default); null leaves it to a surrounding polite live region. */
  role?: 'alert' | null;
}

/** Conjunction alert — red, icon, and text together. Never colour alone (Rules.md §7). */
export function AlertBadge({ message, role = 'alert' }: AlertBadgeProps) {
  return (
    <div className="alert-badge" role={role ?? undefined}>
      <TriangleAlert aria-hidden size={14} strokeWidth={2} />
      <span>{message}</span>
    </div>
  );
}
