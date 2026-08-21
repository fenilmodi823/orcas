import { TriangleAlert } from 'lucide-react';
import './AlertBadge.css';

export interface AlertBadgeProps {
  message: string;
}

/** Conjunction alert — red, icon, and text together. Never colour alone (Rules.md §7). */
export function AlertBadge({ message }: AlertBadgeProps) {
  return (
    <div className="alert-badge" role="alert">
      <TriangleAlert aria-hidden size={14} strokeWidth={2} />
      <span>{message}</span>
    </div>
  );
}
