// src/components/Timer.jsx
import React, { useEffect, useRef } from "react";

export default function Timer({ seconds, onExpire }) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (seconds <= 0) return;
    timerRef.current = setInterval(() => {
      // Parent manages state; this just triggers expire
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const isWarning = seconds <= 300;  // last 5 mins
  const isCritical = seconds <= 60;

  const pad = (n) => String(n).padStart(2, "0");

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-lg font-bold transition-colors
      ${isCritical
        ? "bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse"
        : isWarning
        ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
        : "bg-slate-800 text-white border border-slate-700"
      }`}
    >
      <span>⏱</span>
      <span>{h > 0 ? `${pad(h)}:` : ""}{pad(m)}:{pad(s)}</span>
    </div>
  );
}
