import { useId } from "react";

// Quiet, near-flat relief. The gently yielding outlines echo KODA's wave.
export function AchievementArt({ id, label }: { id: string; label?: string }) {
  const gradient = useId();
  const variant = [...id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 5;
  return <svg className="achievement-art" viewBox="0 0 120 120" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <defs><linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f5f8ef"/><stop offset="1" stopColor="#c8d9c5"/></linearGradient></defs>
    <ellipse cx="60" cy="98" rx="28" ry="4" fill="#416d53" opacity=".07"/>
    <path d="M26 40C28 19 50 16 64 20S96 30 94 55 84 90 60 91 24 76 26 40Z" fill={`url(#${gradient})`} stroke="#b6cbb2" strokeWidth="1"/>
    <g fill="none" stroke="#416d53" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {variant === 0 && <><path d="M39 61c8-18 12 16 23 0s13-23 22-8"/><circle cx="82" cy="47" r="2" fill="#416d53" stroke="none"/></>}
      {variant === 1 && <><path d="M43 74c-9-20 0-35 19-38 12 20 5 35-19 38Z M44 72l17-29"/><path d="M47 59l9 1"/></>}
      {variant === 2 && <><path d="M37 43c9-4 17 0 23 5 7-6 14-8 23-5v28c-10-3-16 0-23 5-7-5-14-8-23-5Z M60 48c-3 9 3 18 0 28"/></>}
      {variant === 3 && <><path d="M40 63c0-20 35-25 40-3s-13 24-23 16c-8-7 6-20 15-14 M40 63c-2 9 3 14 10 15"/></>}
      {variant === 4 && <><path d="M39 43h40v30c-7 8-13-4-20 2s-15 3-20-2Z M39 54h40 M52 44c-3 11 3 22 0 31 M66 44v30"/></>}
    </g>
    <path d="M34 36c8-13 24-14 37-9" fill="none" stroke="white" strokeWidth="2" opacity=".7" strokeLinecap="round"/>
  </svg>;
}
