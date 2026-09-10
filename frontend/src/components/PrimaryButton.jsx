import React from 'react';

/** Pill-shaped emerald action button used throughout the customer app (login, checkout,
 *  order-success). Renders a plain <button> unless `href` is given. */
export default function PrimaryButton({ children, icon, href, className = '', ...rest }) {
  const content = (
    <>
      <span>{children}</span>
      {icon}
    </>
  );
  const classes = `btn-pill btn-pill-primary ${className}`.trim();

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
