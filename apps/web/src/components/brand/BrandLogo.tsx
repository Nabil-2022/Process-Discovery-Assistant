type BrandLogoProps = {
  variant?: 'full' | 'compact' | 'login' | 'sidebar';
  className?: string;
};

export function BrandLogo({ variant = 'full', className = '' }: BrandLogoProps) {
  const classes = ['brand-logo', `brand-logo--${variant}`, className].filter(Boolean).join(' ');
  const showText = variant !== 'compact';

  return (
    <a className={classes} href="/tenant/dashboard" aria-label="Process Discovery Assistant">
      <span className="brand-logo__mark" aria-hidden="true">
        <img src="/brand/process-discovery-mark.svg" alt="" />
      </span>
      {showText ? (
        <span className="brand-logo__wordmark">
          <span>Process Discovery</span>
          <small>Assistant</small>
        </span>
      ) : null}
    </a>
  );
}
