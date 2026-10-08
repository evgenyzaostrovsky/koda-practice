import { useId } from "react";
import { achievementArtMap } from "./art-map";
const motifs: Record<number,string> = {
  9: "M34 37h52v45H34Z M34 52h52 M51 37v45 M68 37v45",
  10: "M38 76l12-30 27 10-11 30Z M47 67l23 9 M55 35l15-8",
  11: "M33 35h54L66 59v24l-13-5V59Z",
  12: "M35 36h17v17H35Z M69 36h17v17H69Z M45 76h30 M43 53l17 17 17-17",
  13: "M33 46h24v27H33Z M65 46h24v27H65Z M52 59h17",
  14: "M34 35h52v49H34Z M34 47h52 M46 29v12 M74 29v12 M45 61h5 M61 61h5 M45 74h5",
  15: "M40 82V66h13v16 M57 82V51h13v31 M74 82V35h13v47",
  16: "M38 83c-4-29 10-48 32-47 M69 36l-6-9 M70 36l-9 5 M44 75l18-14",
  17: "M60 34c-27 0-27 48 0 48s27-48 0-48 M60 47v14l10 7",
  18: "M38 65c9-20 17 20 26 0s15-14 19-8 M39 83h44",
  21: "M33 73l10-24 12 30 12-39 13 31 10-16",
  22: "M47 70c-18-21-9-40 13-40s31 19 13 40 M49 77h22 M53 85h14 M59 48v17",
  23: "M35 80c-9-23 0-32 13-23s19 1 15-12 13-24 22-6 M32 86h12",
  24: "M41 39l8 13-6 11-13-1 M43 63l25 24 13-13-24-26 M72 31l14 14",
  25: "M36 42h49v38H36Z M48 58l9 9 16-19",
  26: "M38 78c1-29 16-43 32-36 M70 42l11 23 M35 84h49",
  27: "M45 73c-14-19-6-37 15-37s29 18 15 37 M50 81h20 M60 47v15",
  28: "M36 78l13-31 14 25 21-34 M39 89h45",
  29: "M35 45h48 M35 59h36 M35 73h24 M73 73l8 8 8-8",
  30: "M40 34h40 M44 34c0 23 31 25 31 48 M76 34c0 23-31 25-31 48 M40 83h40",
  32: "M34 43h51v40H34Z M30 34h59v9H30Z M51 55h16",
  33: "M37 66c0-39 47-39 47 0 M46 66c0-23 29-23 29 0 M55 66c0-9 11-9 11 0 M60 66v20",
  34: "M32 78c15-2 10-23 26-23s11-23 30-23 M39 87h45",
  35: "M36 40h49v42H36Z M46 49h6 M46 61h6 M46 72h6 M62 50h14 M62 61h14 M62 73h14",
  36: "M60 30l13 22H47Z M34 69h21v21H34Z M73 68c-15 0-15 23 0 23s15-23 0-23",
  38: "M33 56h54v27H33Z M47 56V43h26v13 M33 67h54 M56 65v7h8v-7",
  39: "M34 40h17v17H34Z M70 40h17v17H70Z M50 74h21v16H50Z M43 57l17 17 18-17",
  40: "M38 80c-15-24 1-37 14-28s26 3 29-12 M74 34l8 6-4 10",
  41: "M42 80l-8-14 16-31 17 2 20 32-11 14Z M48 62l10 11 17-24",
  42: "M54 36c-25 0-25 36 0 36s25-36 0-36 M69 68l18 18 M45 51h18",
  43: "M33 44h23v33H33Z M70 37h17v47H70Z M55 60h18 M64 54l8 6-8 6",
  44: "M34 39h50v36H62l-14 12V75H34Z M53 51c0-9 17-9 17 0s-11 5-11 12 M59 68v1",
  46: "M30 69c8-18 16 18 24 0s16 18 24 0 10-8 13-4 M33 43h53",
  47: "M43 39c-24 0-24 28 0 28h13 M76 81c24 0 24-28 0-28H63 M47 60h28",
  48: "M33 80c17-21 2-33 23-36s12 36 30 24 M43 83h8 M63 31h10",
  49: "M32 81c7-5 11-17 20-16s14-20 23-19 10-11 14-15 M32 89h56",
  50: "M35 35h50v46H35Z M35 48h50 M51 30v10 M70 30v10 M46 63l10 9 18-16",
  1: "M36 67l15 14 34-43 M34 36h18 M34 45h12",
  2: "M35 72c4-28 13-47 22-27s16 29 27-7 M35 84h49",
  3: "M34 40c11-4 18 2 26 7 8-6 16-10 27-7v34c-11-3-20 1-27 8-8-7-15-10-26-8Z M60 47v35",
  4: "M38 62l15 14 28-33 M36 39l3-8 3 8 8 3-8 3-3 8-3-8-8-3Z",
  5: "M38 54c-1-24 38-27 44-2 M82 39v14H68 M82 66c1 24-38 27-44 2 M38 83V68h14",
  6: "M31 79c10-2 11-18 20-27s9 22 17 10 11-23 21-29 M61 36l5-10 5 10",
  7: "M48 32h24 M52 32v19L36 77q-3 9 9 9h32q12 0 8-9L68 51V32 M44 69c8-6 16 6 28 0",
  8: "M36 38q24-13 48 0v41q-24 15-48 0Z M36 38q24 13 48 0 M36 55q24 13 48 0 M36 72q24 13 48 0",
  19: "M83 55c-9-27-45-24-47 5s31 38 45 13 M82 36v20H64 M52 67l8-13",
  20: "M30 65c10-30 15 30 30 0s20 30 30 0 M37 84h5 M51 84h5 M65 84h5 M79 84h5",
  31: "M60 33c-33 0-34 48 0 48s33-48 0-48 M60 44v19l13 8 M33 41l-6-5 M86 41l6-5",
  37: "M34 37h20v20H34Z M66 37h20v20H66Z M34 69h20v20H34Z M66 69h20v20H66Z",
  45: "M36 79V41 M36 79h49 M46 67l13-15 11 6 13-22 M76 36h7v7"
};
export function AchievementArt({ id, label }: { id:string; label?:string }) {
 const gradient=useId(); const {family,stage}=achievementArtMap[id]??{family:1,stage:1};
 const tier = Math.min(stage,8);
 const shells = [
 "M35 80Q22 49 44 34Q67 22 84 48Q97 79 67 88Q48 94 35 80Z",
 "M29 77Q20 56 39 32Q59 12 82 35Q100 51 87 80Q58 100 29 77Z",
 "M24 77Q26 41 45 27Q61 13 77 28Q98 45 96 76Q83 97 59 91Q35 98 24 77Z",
 "M24 81Q16 58 28 36Q41 16 60 22Q82 12 94 39Q104 64 88 85L60 95Z",
 "M19 79Q15 53 28 32Q35 17 53 23Q66 8 82 26Q105 31 99 66L90 89Q61 105 19 79Z",
 "M18 82Q12 59 25 34L40 20Q56 27 63 14Q86 13 96 37Q109 56 99 85L74 98L46 94Z",
 "M16 84L19 45Q19 23 39 19L58 25L74 12Q99 20 104 45L99 83L79 100L51 93L30 98Z",
 "M13 85Q10 52 23 32L39 13L60 23L81 10Q107 29 108 58L100 89L76 103L54 93L30 102Z"
 ];
 return <svg className="achievement-art" data-tier={tier} viewBox="0 0 120 120" role={label?"img":undefined} aria-label={label} aria-hidden={label?undefined:true}>
 <defs><linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1"><stop stopColor={tier > 4 ? "#f6e7c8" : "#f3f1e8"}/><stop offset="1" stopColor={tier > 2 ? "#adc0ad" : "#d5ded0"}/></linearGradient></defs>
 <ellipse className="art-shadow" cx="60" cy="105" rx={23+tier*2} ry="3" fill="#416d53" opacity=".09"/>
 <path className="art-room-base" display="none" d="M46 82H74L72 99H79Q83 99 83 103V108H37V103Q37 99 41 99H48Z" fill="#c3c9b8" stroke="#a4b099" strokeWidth="1"/>
 <path className="art-shell" d={shells[tier-1]} fill={`url(#${gradient})`} stroke="#9aac97" strokeWidth="1.5"/>
 {tier >= 2 && <path d="M29 79Q55 98 89 77L88 86Q58 104 31 87Z" fill="#a8b79f" opacity=".6"/>}
 {tier >= 3 && <path d="M27 42Q40 24 52 31M78 30Q90 37 92 52" fill="none" stroke="#fffaf0" strokeWidth="4" strokeLinecap="round"/>}
 {tier >= 4 && <path d="M26 85L23 98H97L92 85Q60 103 26 85Z" fill="#c8bc9f" stroke="#a99c80"/>}
 {tier >= 5 && <path d="M21 65Q4 46 18 31Q31 19 34 39M95 65Q114 47 103 29Q92 18 89 38" fill="none" stroke="#9daa95" strokeWidth="5" strokeLinecap="round"/>}
 {tier >= 6 && <path d="M43 26Q38 7 54 12Q60 0 67 12Q85 5 79 25" fill="#d9c39a" stroke="#aa9270"/>}
 {tier >= 7 && <path d="M24 97L18 107H103L96 97Z" fill="#a8b29f" stroke="#7f917e"/>}
 {tier >= 8 && <path d="M17 30Q8 66 19 87M103 30Q115 67 101 88" fill="none" stroke="#d0b887" strokeWidth="4"/>}
 <path className="art-motif" d={motifs[family]} fill="none" stroke="#416d53" strokeWidth={tier > 3 ? "2.8" : "2.3"} strokeLinecap="round" strokeLinejoin="round"/>
 </svg>;
}
