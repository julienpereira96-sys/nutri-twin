"use client";

/**
 * PulseOrb — orb audio-réactif sans canvas
 *
 * Corps CSS statique (radial-gradient) + boucle RAF lisant l'AnalyserNode.
 * Au repos     : sine doux sur le halo (respiration légère).
 * En parole    : le halo externe scale + s'illumine selon l'énergie réelle.
 *               L'orb lui-même reste immobile — seul le fond lumineux autour pulse.
 * Mode souffle : l'orb ET le halo s'expandent/contractent sur le rythme
 *               respiratoire (4s inspire → expand / 6s expire → contract).
 */
import { useRef, useEffect } from "react";

export default function PulseOrb({
  speaking,
  analyser,
  size = 220,
  color = "#06B6D4",
  firstName,
  breathPhase,
}: {
  speaking: boolean;
  analyser?: AnalyserNode | null;
  size?: number;
  color?: string;
  firstName?: string;
  /** Piloter l'orbe sur le rythme respiratoire (4s inspire / 6s expire). */
  breathPhase?: "inspire" | "expire" | null;
}) {
  const orbRef  = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const spkRef  = useRef(speaking);
  const anRef   = useRef<AnalyserNode | null | undefined>(analyser);
  const bpRef   = useRef(breathPhase ?? null);
  const breathStartRef = useRef<{ phase: "inspire" | "expire" | null; startedAt: number }>(
    { phase: null, startedAt: 0 }
  );

  spkRef.current = speaking;
  anRef.current  = analyser;

  // Enregistrer le moment où la phase respiratoire change
  if (bpRef.current !== (breathPhase ?? null)) {
    bpRef.current = breathPhase ?? null;
    breathStartRef.current = { phase: breathPhase ?? null, startedAt: performance.now() };
  }

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
      const bp  = bpRef.current;
      let target: number;
      let orbScale = 1.0;

      if (spk) {
        // ── Mode audio-réactif (Gemini parle) ──────────────────────────────
        if (an) {
          an.getByteFrequencyData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i];
          target = Math.max(0.35, (sum / buf.length) / 255);
        } else {
          target = 0.55;
        }
        orbScale = 1.0; // corps statique en mode parole
      } else if (bp) {
        // ── Mode souffle (patient respire) ─────────────────────────────────
        const elapsed = (performance.now() - breathStartRef.current.startedAt) / 1000;
        const dur     = bp === "inspire" ? 4 : 6;
        const p       = Math.min(1, elapsed / dur);
        const eased   = Math.sin(p * Math.PI / 2); // ease-in puis ease-out
        if (bp === "inspire") {
          target   = 0.22 + 0.68 * eased;  // 0.22 → 0.90
          orbScale = 1.0  + 0.14 * eased;  // 1.00 → 1.14
        } else {
          target   = 0.90 - 0.68 * eased;  // 0.90 → 0.22
          orbScale = 1.14 - 0.14 * eased;  // 1.14 → 1.00
        }
      } else {
        // ── Mode repos (sine doux) ─────────────────────────────────────────
        target   = 0.30 + 0.06 * Math.sin(t * 0.7);
        orbScale = 1.0;
      }

      e += (target - e) * 0.10;

      // Halo externe : scale 1.0 → ~1.9 + opacity 0.10 → 0.85
      const haloScale   = 1.0 + (e - 0.27) * 1.4;
      const haloOpacity = Math.min(0.85, 0.10 + e * 0.45);

      if (haloRef.current) {
        haloRef.current.style.transform = `scale(${haloScale.toFixed(4)})`;
        haloRef.current.style.opacity   = haloOpacity.toFixed(3);
      }
      if (orbRef.current) {
        orbRef.current.style.transform = `scale(${orbScale.toFixed(4)})`;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [color]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        {/* Halo externe — scale + opacité pilotés par RAF */}
        <div ref={haloRef} style={{
          position: "absolute", inset: -52,
          background: `radial-gradient(circle, ${color}28 0%, ${color}0A 50%, transparent 72%)`,
          borderRadius: "50%", pointerEvents: "none",
          willChange: "transform, opacity",
        }} />

        {/* Corps de l'orb — statique en mode parole, souffle en mode breath */}
        <div ref={orbRef} style={{
          width: size, height: size,
          borderRadius: "50%",
          background: `radial-gradient(circle at 42% 42%, ${color}55 0%, ${color}1A 55%, transparent 100%)`,
          border: `1.5px solid ${color}50`,
          willChange: "transform",
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
