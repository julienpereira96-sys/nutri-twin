"use client";

/**
 * PulseOrb — orb audio-réactif sans canvas
 *
 * Corps CSS statique (radial-gradient) + boucle RAF lisant l'AnalyserNode.
 * Au repos : sine doux sur le halo (respiration légère).
 * En parole : le halo externe scale + s'illumine selon l'énergie réelle.
 *             L'orb lui-même reste immobile — seul le fond lumineux autour pulse.
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
        target = 0.30 + 0.06 * Math.sin(t * 0.7); // respiration douce au repos
      }

      e += (target - e) * 0.10;

      // Halo externe : scale 1.0 → ~1.6 + opacity 0.10 → 0.55
      const haloScale   = 1.0 + (e - 0.27) * 1.4;
      const haloOpacity = Math.min(0.85, 0.10 + e * 0.45);

      // Orb : pas de scale — juste un bord légèrement éclairé, fixe
      const edgeGlow = (e * 24).toFixed(0);

      if (haloRef.current) {
        haloRef.current.style.transform = `scale(${haloScale.toFixed(4)})`;
        haloRef.current.style.opacity   = haloOpacity.toFixed(3);
      }
      if (orbRef.current) {
        orbRef.current.style.boxShadow = `0 0 ${edgeGlow}px ${color}30`;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [color]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        {/* Halo externe — scale + opacité pilotés par RAF (seule partie qui pulse) */}
        <div ref={haloRef} style={{
          position: "absolute", inset: -52,
          background: `radial-gradient(circle, ${color}28 0%, ${color}0A 50%, transparent 72%)`,
          borderRadius: "50%", pointerEvents: "none",
          willChange: "transform, opacity",
        }} />

        {/* Corps de l'orb — statique, juste un léger bord éclairé */}
        <div ref={orbRef} style={{
          width: size, height: size,
          borderRadius: "50%",
          background: `radial-gradient(circle at 42% 42%, ${color}38 0%, ${color}0D 55%, transparent 100%)`,
          border: `1.5px solid ${color}2E`,
          willChange: "box-shadow",
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
