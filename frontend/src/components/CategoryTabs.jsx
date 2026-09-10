import React from 'react';
import './CategoryTabs.css';

/** Horizontal pill tab row for filtering by category — active tab fills emerald. */
export default function CategoryTabs({ tabs, active, onChange }) {
  return (
    <div className="tz-category-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`tz-category-tab ${active === tab.key ? 'active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
