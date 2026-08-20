// Shared branded header — the Carbon logo plus a title/subtitle, reused on
// every screen (join, player profile, admin login, admin dashboard/setup)
// so the game reads as "Carbon Commandos" everywhere, not a generic app.
export default function BrandHeader({
  title,
  subtitle,
  size = "md",
}: {
  title?: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
}) {
  const logoSize = size === "lg" ? 72 : size === "sm" ? 36 : 52;
  return (
    <div className="cc-brand-header">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/carbon-logo.png" alt="Carbon" height={logoSize} className="cc-brand-logo" />
      {(title || subtitle) && (
        <div>
          {title && <div className="cc-brand-title">{title}</div>}
          {subtitle && <div className="cc-brand-subtitle">{subtitle}</div>}
        </div>
      )}
    </div>
  );
}
