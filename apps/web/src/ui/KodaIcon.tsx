import { useId, type SVGProps } from "react";

// Original KODA Soft Line geometry: a shared 24-unit grid and open, rounded strokes.
const shapes = {
  Home: <><path d="M3.5 10.5 12 3.5l8.5 7v9a1 1 0 0 1-1 1h-5v-7h-5v7h-5a1 1 0 0 1-1-1z" /></>,
  Practice: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="m9 9-3 3 3 3m6-6 3 3-3 3m-2-8-2 10" /></>,
  Route: <><circle cx="5" cy="5" r="2" /><circle cx="19" cy="19" r="2" /><path d="M8 5h7a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h7" /></>,
  Topics: <><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><path d="M14 17h6m-3-3v6" /></>,
  Knowledge: <><path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1zm0 0v14M6 9h3m-3 4h3m6-4h3m-3 4h3" /></>,
  Sandbox: <><path d="M8 3.5h8m-6 0v6L4.5 18a1.7 1.7 0 0 0 1.5 2.5h12a1.7 1.7 0 0 0 1.5-2.5L14 9.5v-6M7.5 14h9" /><circle cx="10" cy="17" r=".6" /></>,
  Progress: <><path d="M3 19C6.5 19 6 12 9.5 12S12 16 15 10s3.5-1 6-6" /><path d="M17.5 4H21v3.5" /></>,
  Achievement: <><path d="m12 3 2.7 2.2 3.5.3.3 3.5 2.2 3-2.2 2.7-.3 3.5-3.5.3L12 21l-2.7-2.5-3.5-.3-.3-3.5L3 12l2.5-3 .3-3.5 3.5-.3zM8.5 12l2.5 2.5 4.5-5" /></>,
  Profile: <><circle cx="12" cy="7.5" r="3.5" /><path d="M4.5 20v-1a7.5 7.5 0 0 1 15 0v1" /></>,
  Settings: <><path d="M4 6h16M4 12h16M4 18h16" /><rect x="7" y="3.5" width="4" height="5" rx="1.5" fill="var(--koda-ui-surface, #fff)" /><rect x="14" y="9.5" width="4" height="5" rx="1.5" fill="var(--koda-ui-surface, #fff)" /><rect x="6" y="15.5" width="4" height="5" rx="1.5" fill="var(--koda-ui-surface, #fff)" /></>,
  Run: <path d="M7 4.5 20 12 7 19.5z" />,
  Check: <path d="m4.5 12 5 5 10-11" />,
  Hint: <><path d="M8.5 16c0-2-3-3-3-6a6.5 6.5 0 0 1 13 0c0 3-3 4-3 6zm1 3h5m-4 2h3M10 10l2 2 2-2m-2 2v4" /></>,
  Reset: <><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" /></>,
  Search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></>,
  Close: <path d="m6 6 12 12M18 6 6 18" />,
  ChevronDown: <path d="m5 9 7 7 7-7" />,
  ArrowLeft: <path d="m10 5-7 7 7 7M3 12h18" />,
  Save: <><path d="M4 3.5h13l3.5 3.5v13.5h-17v-17zm3 0v6h9v-6M7 20.5v-7h10v7" /></>,
  DataTable: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M3 9h18M3 14.5h18M9 9v11m6-11v11" /></>,
};
export const kodaIconNames = Object.keys(shapes) as (keyof typeof shapes)[];
export type KodaIconName = keyof typeof shapes;
export type KodaIconProps = Omit<SVGProps<SVGSVGElement>, "name" | "children"> & { name: KodaIconName; size?: number; title?: string };
export function KodaIcon({ name, size = 20, title, ...props }: KodaIconProps) {
  const titleId = useId();
  return <svg {...props} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" focusable="false" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-labelledby={title ? titleId : undefined}>{title && <title id={titleId}>{title}</title>}{shapes[name]}</svg>;
}
