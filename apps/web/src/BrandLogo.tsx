export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <img
      className={`brand-logo ${className}`.trim()}
      src="/brand/kusiy-logo.png"
      alt=""
      aria-hidden="true"
    />
  );
}
