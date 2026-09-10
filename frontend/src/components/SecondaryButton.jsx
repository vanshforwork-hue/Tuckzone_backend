import React from 'react';

/** Pill-shaped outlined button — the secondary action alongside PrimaryButton. */
export default function SecondaryButton({ children, icon, href, className = '', ...rest }) {
  const content = (
    <>
      <span>{children}</span>
      {icon}
    </>
  );
  const classes = `btn-pill btn-pill-secondary ${className}`.trim();

  if (href) {
    return (
      <a href={href} className={classes}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" className={classes} {...rest}>
      {content}
    </button>
  );
}
