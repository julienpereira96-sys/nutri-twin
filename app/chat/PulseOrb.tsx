"use client";

/**
 * PulseOrb — orb audio-réactif sans canvas
 *
 * Corps CSS (radial-gradient) + boucle RAF lisant l'AnalyserNode de sortie Gemini.
 * Au repos : sine doux entre ~0.27–0.37.
 * En parole : scale + glow pilotés par l'énergie réelle.
 */
import { useRef, useEffect } from "react";

export default function PulseOrb({
  speaking,
  analyser,
  size = 220,
  color = "#06B6D4",
  firstName,
}: {
  speaking: boolean;
  analyser?: AnalyserNode | null;
  size?: number;
  color?: string;
  firstName?: string;
}) {
  const orbRef  = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const spkRef  = useRef(speaking);
  const anRef   = useRef<AnalyserNode | null | undefined>(analyser);
  spkRef.current = speaking;
  anRef.current  = analyser;

  useEffect(() => {
    const buf = new Uint8Array(128);
    let e = 0.30;
    let t = 0;
    let raf: number;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      t += 0.016;
      const spk = spkRef.current;
      const an  = anRef.current;
      let target: number;

      if (spk) {
        if (an) {
          an.getByteFrequencyData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i];
          target = Math.max(0.35, (sum / buf.length) / 255);
        } else {
          target = 0.55;
        }
      } else {
        target = 0.32 + 0.05 * Math.sin(t * 0.7); // sine doux au repos
      }

      e += (target - e) * 0.10;
      const scale = 1 + (e - 0.27) * 0.30;
      const near  = (e * 52).toFixed(0);
      const far   = (e * 110).toFixed(0);

      if (orbRef.current) {
        orbRef.current.style.transform  = `scale(${scale.toFixed(4)})`;
        orbRef.current.style.boxShadow  = `0 0 ${near}px ${color}48, 0 0 ${far}px ${color}18`;
      }
      if (haloRef.current) {
        haloRef.current.style.opacity = (0.05 + e * 0.18).toFixed(3);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [color]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        {/* Halo externe — opacité pilotée par RAF */}
        <div ref={haloRef} style={{
          position: "absolute", inset: -36,
          background: `radial-gradient(circle, ${color}20 0%, transparent 68%)`,
          borderRadius: "50%", pointerEvents: "none",
        }} />

        {/* Corps de l'orb — scale + glow pilotés par RAF */}
        <div ref={orbRef} style={{
          width: size, height: size,
          borderRadius: "50%",
          background: `radial-gradient(circle at 42% 42%, ${color}38 0%, ${color}0D 55%, transparent 100%)`,
          border: `1.5px solid ${color}2E`,
          willChange: "transform, box-shadow",
        }} />
      </div>

      {firstName && (
        <p style={{
          color: "rgba(255,255,255,0.35)", fontSize: 12,
          letterSpacing: "0.16em", fontWeight: 300,
          textTransform: "uppercase", margin: 0,
        }}>
          {firstName}
        </p>
      )}
    </div>
  );
}
