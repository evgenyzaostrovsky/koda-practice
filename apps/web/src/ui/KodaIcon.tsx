import { useId, type SVGProps } from "react";

// Approved soft silhouettes use the prototype 18-unit grid scaled into the shared 24-unit icon frame.
const shapes = {
  History: <g transform="scale(1.333333)" strokeWidth={1.4}><path d="M3 7C5 2 13 1 15 6s0 5-2 6c-2 1 1 4-2 5s-2-3-4-2-4-1-4-3 M2 3v4q0 1 1 1h4 M9 5c-1 2-1 3 0 4l3 1" /></g>,
  Errors: <g transform="scale(1.333333)" strokeWidth={1.4}><path d="M5 5C6 2 12 2 13 5l3 8q1 3-2 3H4q-3 0-2-3Z M9 6v4 M9 13v.2" /></g>,
  Home: <g transform="scale(1.333333)" strokeWidth={1.4}><path d="M2 9C5 8 6 2 9 3s3 5 7 5 M4 8v5c0 2 2 1 2 3s2 1 2-1v-3q1-2 3 0v2c0 3 3 2 3-1V8" /></g>,
  Practice: <g transform="scale(1.333333)" strokeWidth={1.4}><path d="M2 14c2-1 3-5 5-5s3 5 5 5 3-7 6-7 M15 7h3v3" /></g>,
  Route: <g transform="scale(1.333333)" strokeWidth={1.4}><path d="M2 6C4 2 6 2 9 5s5 3 7-1 M2 11c3-4 5-4 8-1s4 2 6-1 M2 16c3-4 5-4 8-1s4 2 6-1" /></g>,
  Topics: <><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><path d="M14 17h6m-3-3v6" /></>,
  Knowledge: <g transform="scale(1.333333)" strokeWidth={1.4}><path d="M9 5C6 2 3 3 2 4v9c3-1 4 0 5 2s2 2 2-1c2-2 4-2 7-1V4c-2-2-5-1-7 1Z M9 5c-1 4 1 5 0 9 M4 7q2-1 3 1 M11 7q2-1 3 0" /></g>,
  Sandbox: <g transform="scale(1.333333)" strokeWidth={1.4}><path d="M2 14c2-1 3-5 5-5s3 5 5 5 3-7 6-7 M15 7h3v3" /></g>,
  Progress: <g transform="scale(1.333333)" strokeWidth={1.4}><path d="M2 15c3 0 3-6 6-5s2 3 4-2 3-2 4-5 M13 3h3v3" /></g>,
  Achievement: <g transform="scale(1.333333)" strokeWidth={1.4}><path d="M9 2c2 0 2 3 4 3s3 2 2 4-1 4-3 4-2 3-4 2-3-1-3-3-3-2-2-4 3-2 3-4Z M6 9l2 2 4-4" /></g>,
  Profile: <g transform="scale(1.333333)" strokeWidth={1.4}><path d="M9 2c-4 0-4 6 0 6s4-6 0-6 M3 16c0-8 12-8 12 0" /></g>,
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

