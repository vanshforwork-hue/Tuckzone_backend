import React from 'react';
import { ArrowRight } from 'lucide-react';
import './SectionHeader.css';

/** "Section title ... View All →" row used above card grids/lists on the customer app. */
export default function SectionHeader({ title, actionLabel, onAction }) {
  return (
    <div className="tz-section-header">
      <h2>{title}</h2>
      {actionLabel && (
        <button type="button" className="tz-section-action" onClick={onAction}>
          {actionLabel} <ArrowRight size={15} />
        </button>
      )}
    </div>
  );
}
