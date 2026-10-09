import { useEffect, useRef } from "react";
import type { GlassAtlasRegion } from "./glass-atlas-map";

// SVG image error events may not repeat when a failed resource is cached.
// A shared HTML image probe delivers the result to every later-mounted stage.
const atlasLoads = new Map<string, Promise<boolean>>();
function loadAtlas(src: string): Promise<boolean> {
  const cached = atlasLoads.get(src);
  if (cached) return cached;
  const loading = new Promise<boolean>(resolve => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = src;
  });
  atlasLoads.set(src, loading);
  return loading;
}

/** Cropping stays local to this viewport; a failed asset uses the existing vector art. */
export function GlassAchievementArt({ region, label, onError }: { region: GlassAtlasRegion; label?: string; onError: () => void }) {
  const errorHandler = useRef(onError);
  errorHandler.current = onError;
  useEffect(() => {
    let active = true;
    void loadAtlas(region.src).then(loaded => {
      if (active && !loaded) errorHandler.current();
    });
    return () => { active = false; };
  }, [region.src]);
  const fail = () => {
    atlasLoads.set(region.src, Promise.resolve(false));
    errorHandler.current();
  };
  const { crop: [x, y, width, height], baseline } = region;
  const scale = Math.min(104 / width, 102 / (baseline - y));
  return <svg className="achievement-art glass-achievement-art" data-tier={region.stage} viewBox="0 0 120 120" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <svg x={(120 - width * scale) / 2} y={108 - (baseline - y) * scale} width={width * scale} height={height * scale} viewBox={`${x} ${y} ${width} ${height}`} overflow="hidden">
      <image href={region.src} width={region.atlasWidth} height={region.atlasHeight} onError={fail}/>
    </svg>
  </svg>;
}
