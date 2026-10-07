import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { KodaIcon, type KodaIconName } from "./KodaIcon";
import "./koda-ui.css";
export type KodaButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
  icon?: KodaIconName;
  loading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
};
export const KodaButton = forwardRef<HTMLButtonElement, KodaButtonProps>(function KodaButton({ variant = "primary", icon, loading = false, loadingLabel = "Выполняется", disabled, children, className = "", type = "button", ...props }, ref) {
  return <button {...props} ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined} aria-label={props["aria-label"] ?? (loading ? loadingLabel : undefined)} className={`koda-button koda-button--${variant} ${className}`}>
    <span className="koda-button-content" style={loading ? { visibility: "hidden" } : undefined}>{icon && <KodaIcon name={icon} />}{children}</span>
    {loading && <span className="koda-button-loading" role="status"><span className="koda-spinner" aria-hidden="true" /><span className="koda-sr-only">{loadingLabel}</span></span>}
  </button>;
});
export type KodaIconButtonProps = Omit<KodaButtonProps, "children" | "icon"> & { icon: KodaIconName; label: string };
export const KodaIconButton = forwardRef<HTMLButtonElement, KodaIconButtonProps>(function KodaIconButton({ icon, label, variant = "quiet", className = "", ...props }, ref) {
  return <KodaButton {...props} ref={ref} variant={variant} aria-label={label} title={props.title ?? label} className={`koda-icon-button ${className}`}><KodaIcon name={icon} /></KodaButton>;
});
