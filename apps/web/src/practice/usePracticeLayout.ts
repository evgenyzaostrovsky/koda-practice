import { useRef, useState } from "react";

export function usePracticeLayout() {
  const splitRef = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(
    () => Number(localStorage.getItem("koda:left-pane")) || 38,
  ),
    [editorH, setEditorH] = useState(
      () => Number(localStorage.getItem("koda:editor-height")) || 320,
    );
  const dragColumns = (ev: React.PointerEvent) => {
    ev.currentTarget.setPointerCapture(ev.pointerId);
    const move = (x: PointerEvent) => {
      const r = splitRef.current?.getBoundingClientRect();
      if(r) {
        const v = Math.max(
          35,
          Math.min(55, ((x.clientX - r.left) / r.width) * 100),
        );
        setLeft(v);
        localStorage.setItem("koda:left-pane", String(v));
      }
    };
    const up = () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
  };
  const dragRows = (ev: React.PointerEvent) => {
    ev.currentTarget.setPointerCapture(ev.pointerId);
    const start = ev.clientY,
      base = editorH;
    const move = (x: PointerEvent) => {
      const v = Math.max(220, Math.min(650, base + x.clientY - start));
      setEditorH(v);
      localStorage.setItem("koda:editor-height", String(v));
    };
    const up = () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
  };
  return { left, editorH, splitRef, dragColumns, dragRows };
}
