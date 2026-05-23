"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

const emerald = "#10b981";
const amber = "#f59e0b";

function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function AnimatedChat() {
  const messages = [
    { role: "patient", text: "Bonsoir, j'ai encore craqué ce soir. Je me sens nulle 😔", delay: 1500 },
    { role: "ai", text: "Bonsoir Sophie, un écart ça arrive, et ça ne définit pas votre parcours.", delay: 4500 },
    { role: "ai", text: "Vous aviez mangé quoi ce midi ?", delay: 6800 },
    { role: "patient", text: "Pas grand chose, un sandwich en vitesse.", delay: 10000 },
    { role: "ai", text: "Voilà, tout s'explique. Ce n'est pas de la faiblesse, c'est de la biologie.", delay: 13500 },
    { role: "ai", text: "Demain, on vise un vrai déjeuner avec des protéines. D'accord ?", delay: 16500 },
    { role: "patient", text: "Oui. Merci, ça me soulage d'avoir quelqu'un à qui écrire 💚", delay: 20000 },
  ];

  const [visibleMessages, setVisibleMessages] = useState<number[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingRole, setTypingRole] = useState<"patient" | "ai">("ai");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const timers: NodeJS.Timeout[] = [];
    messages.forEach((msg, i) => {
      timers.push(setTimeout(() => {
        setTypingRole(msg.role as "patient" | "ai");
        setIsTyping(true);
      }, msg.delay - 1200));
      timers.push(setTimeout(() => {
        setIsTyping(false);
        setVisibleMessages(prev => [...prev, i]);
      }, msg.delay));
    });
    timers.push(setTimeout(() => setDone(true), messages[messages.length - 1].delay + 2000));
    return () => timers.forEach(t => clearTimeout(t));
  }, [done]);

  return (
    <div className="relative mx-auto lg:ml-8 w-full lg:w-[460px]">
      <div className="absolute -inset-4 rounded-[2rem] bg-emerald-500/[0.07] blur-2xl" />
      <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#0d0d0d] shadow-2xl shadow-black/60">
        <div className="flex items-center gap-3 border-b border-white/[0.06] bg-[#111111] px-4 py-3">
          <div className="relative shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-xs font-bold text-black">CM</div>
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#111111] bg-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-white">Compagnon de suivi de Catherine Moreau</p>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-[10px] text-emerald-400">Répond instantanément</p>
            </div>
          </div>
          <div className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/20">21h14</div>
        </div>

        <div className="px-4 pt-4 pb-2" style={{ height: 470, overflowY: "hidden" }}>
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: msg.role === "ai" ? "flex-end" : "flex-start",
                opacity: visibleMessages.includes(i) ? 1 : 0,
                transform: visibleMessages.includes(i) ? "translateY(0)" : "translateY(6px)",
                transition: "opacity 0.5s ease, transform 0.5s ease",
                height: visibleMessages.includes(i) ? "auto" : 0,
                overflow: "hidden",
              }}>
                <div style={{
                  maxWidth: "82%",
                  borderRadius: 16,
                  borderBottomRightRadius: msg.role === "ai" ? 4 : 16,
                  borderBottomLeftRadius: msg.role === "patient" ? 4 : 16,
                  padding: "9px 14px",
                  fontSize: 13,
                  lineHeight: 1.6,
                  backgroundColor: msg.role === "ai" ? emerald : "#1e1e1e",
                  color: msg.role === "ai" ? "black" : "rgba(255,255,255,0.85)",
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
          <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: typingRole === "ai" ? "flex-end" : "flex-start" }}>
            {isTyping && (
              <div style={{
                display: "flex", gap: 5, alignItems: "center",
                padding: "9px 14px", borderRadius: 16,
                borderBottomRightRadius: typingRole === "ai" ? 4 : 16,
                borderBottomLeftRadius: typingRole === "patient" ? 4 : 16,
                backgroundColor: typingRole === "ai" ? emerald : "#1e1e1e",
              }}>
                {[0, 180, 360].map((delay, i) => (
                  <div key={i} style={{
                    width: 5, height: 5, borderRadius: "50%",
                    backgroundColor: typingRole === "ai" ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)",
                    animation: `typingBounce 1.2s ${delay}ms infinite`,
                  }} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2 rounded-2xl bg-[#1a1a1a] px-4 py-2.5">
            <span className="flex-1 text-[12px] text-zinc-600">Écrire un message...</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-full shrink-0" style={{ backgroundColor: emerald }}>
              <svg className="size-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function StaticDashboard() {
  const [showReport, setShowReport] = useState(true);
  const reportBtnRef = useRef<HTMLButtonElement>(null);
  const dashRef = useRef<HTMLDivElement>(null);

  const julieConversation = [
    { role: "patient", text: "Bonjour, j'ai fait mes 3 repas aujourd'hui comme convenu 🎉" },
    { role: "ai", text: "Bravo Julie ! C'est exactement ce que Catherine préconise. Comment vous sentez-vous ?" },
    { role: "patient", text: "Beaucoup mieux, moins de fringales en fin de journée." },
    { role: "ai", text: "C'est le signe que votre glycémie se stabilise. Continuez comme ça cette semaine." },
    { role: "patient", text: "J'ai un repas d'affaires jeudi, je fais comment ?" },
    { role: "ai", text: "Priorisez les protéines et légumes, évitez le pain en entrée. Un verre de vin max si vous le souhaitez, pas de culpabilité 😊" },
    { role: "patient", text: "Super, merci ! Je me sens vraiment accompagnée 💚" },
    { role: "ai", text: "C'est tout l'objectif. Catherine verra votre progression à votre prochain rendez-vous !" },
  ];

  const reportSections = [
    { icon: "📊", title: "Vue d'ensemble", color: emerald, bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)", content: "Humeur moyenne : 7.2/10, alimentation : 6.8/10, 18 entrées ce mois. Progression notable sur les repas du soir, Julie résiste davantage aux impulsions de commander." },
    { icon: "💚", title: "Points positifs", color: emerald, bg: "rgba(16,185,129,0.06)", border: "rgba(16,185,129,0.15)", content: "3 situations de stress gérées sans écart. Repas du midi réguliers. Engagement fort dans les échanges, elle répond systématiquement aux suggestions." },
    { icon: "⚠️", title: "Obstacles identifiés", color: "#f59e0b", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.15)", content: "Fatigue professionnelle récurrente le soir, 5 mentions ce mois. Tendance au grignotage après 21h en semaine." },
    { icon: "🎯", title: "Focus séance suivante", color: "#6366f1", bg: "rgba(99,102,241,0.06)", border: "rgba(99,102,241,0.15)", content: "Gestion de la fatigue professionnelle le soir, repas express adaptés, lien entre stress et comportement alimentaire." },
    { icon: "❓", title: "Questions pour vous", color: "#06b6d4", bg: "rgba(6,182,212,0.06)", border: "rgba(6,182,212,0.15)", content: "Est-ce que mon hypothyroïdie influence mes fringales ? Puis-je faire un jeûne intermittent avec mon traitement ?" },
    { icon: "🔔", title: "Alerte", color: "#ef4444", bg: "rgba(239,68,68,0.06)", border: "rgba(239,68,68,0.15)", content: "2 entrées avec humeur à 3/10 en milieu de mois. Sentiment de découragement exprimé. À explorer en consultation." },
  ];

  return (
    <div>
      {/* Desktop */}
      <div ref={dashRef} className="relative mx-auto hidden lg:block" style={{ maxWidth: 1100 }}>
        <div className="absolute -inset-x-10 -top-8 -bottom-8 bg-gradient-to-b from-transparent via-emerald-500/[0.04] to-transparent blur-3xl" />
        <div className="relative rounded-3xl border border-white/[0.08] bg-[#0d0d0d] p-2 shadow-2xl shadow-black/50">
          <div className="flex items-center gap-2 rounded-t-2xl bg-[#161616] px-4 py-3 border-b border-white/[0.06]">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
              <div className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
              <div className="h-3 w-3 rounded-full bg-[#28CA41]" />
            </div>
            <div className="mx-auto flex items-center gap-2 rounded-md bg-[#1a1a1a] px-4 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] text-zinc-500">nutri-twin.app/dashboard</span>
            </div>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: showReport ? "180px 1fr 320px" : "220px 1fr 200px",
            transition: "grid-template-columns 0.5s cubic-bezier(0.16,1,0.3,1)",
            minHeight: 540,
            borderRadius: "0 0 20px 20px",
            overflow: "hidden",
          }}>
            {/* Sidebar patients */}
            <div style={{ background: "#111111", borderRight: "1px solid rgba(255,255,255,0.06)", padding: 12, display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 12, marginBottom: 4 }}>
                <div style={{ width: 24, height: 24, borderRadius: 8, background: "rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>🍃</div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#d1d5db" }}>Mes patients</span>
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {[
                  { initials: "SM", name: "Sophie M.", msg: "Merci, ça m'aide 💚", time: "21:14", color: "#f43f5e", active: false },
                  { initials: "JP", name: "Julie P.", msg: "Je vais essayer 😊", time: "19:47", color: "#8b5cf6", active: true },
                  { initials: "TR", name: "Thomas R.", msg: "Super conseil !", time: "Hier", color: "#3b82f6", active: false },
                  { initials: "MD", name: "Marc D.", msg: "Je me sens mieux", time: "Lun", color: "#f59e0b", active: false },
                  { initials: "CL", name: "Claire L.", msg: "Bonne journée !", time: "Dim", color: "#ec4899", active: false },
                  { initials: "AB", name: "Alice B.", msg: "Merci du suivi", time: "Sam", color: "#14b8a6", active: false },
                  { initials: "RK", name: "Romain V.", msg: "À bientôt 👋", time: "Ven", color: "#f97316", active: false },
                ].map((p, i) => (
                  <div key={i} style={{ marginBottom: 6, borderRadius: 10, padding: "8px 10px", background: p.active ? "rgba(16,185,129,0.1)" : "transparent", border: p.active ? "1px solid rgba(16,185,129,0.2)" : "1px solid transparent" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: p.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "white", flexShrink: 0 }}>{p.initials}</div>
                      <span style={{ fontSize: 11, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: p.active ? emerald : "#d1d5db" }}>{p.name}</span>
                      <span style={{ fontSize: 9, color: "#4b5563", flexShrink: 0 }}>{p.time}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 10, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginLeft: 30 }}>{p.msg}</p>
                  </div>
                ))}
              </div>
              <div style={{ borderRadius: 8, background: emerald, padding: "6px 0", textAlign: "center", fontSize: 10, fontWeight: 600, color: "black", marginTop: 8 }}>+ Inviter un patient</div>
            </div>

            {/* Zone conversation */}
            <div style={{ background: "#0d0d0d", display: "flex", flexDirection: "column" }}>
              <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "white" }}>JP</div>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "white" }}>Julie P.</p>
                    <p style={{ margin: 0, fontSize: 10, color: "#6b7280" }}>julie.p@email.fr</p>
                  </div>
                </div>
                <button ref={reportBtnRef} onClick={() => setShowReport(!showReport)} style={{ borderRadius: 20, border: `1px solid rgba(16,185,129,${showReport ? "0.5" : "0.3"})`, padding: "4px 10px", fontSize: 10, fontWeight: 600, color: emerald, background: showReport ? "rgba(16,185,129,0.15)" : "transparent", cursor: "pointer", transition: "all 0.2s" }}>
                  📊 Rapport du patient
                </button>
              </div>
              <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
                {julieConversation.map((msg, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: msg.role === "ai" ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "76%", borderRadius: 14, borderBottomRightRadius: msg.role === "ai" ? 4 : 14, borderBottomLeftRadius: msg.role === "patient" ? 4 : 14, padding: "8px 12px", fontSize: 11, lineHeight: 1.5, backgroundColor: msg.role === "ai" ? emerald : "#1e1e1e", color: msg.role === "ai" ? "black" : "rgba(255,255,255,0.8)" }}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 10, background: "#1a1a1a", padding: "8px 12px" }}>
                  <span style={{ flex: 1, fontSize: 10, color: "#4b5563" }}>Conversation en lecture seule</span>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: emerald }} />
                </div>
              </div>
            </div>

            {/* Panneau rapport */}
            <div style={{ background: showReport ? "#0f0f0f" : "#111111", borderLeft: "1px solid rgba(255,255,255,0.06)", padding: 16, overflowY: "auto", transition: "background 0.3s" }}>
              {!showReport ? (
                <div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "white", marginBottom: 8 }}>JP</div>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "white" }}>Julie P.</p>
                    <p style={{ margin: "2px 0 0", fontSize: 10, color: "#6b7280" }}>julie.p@email.fr</p>
                  </div>
                  <div style={{ borderRadius: 10, background: "#161616", padding: 10, marginBottom: 12 }}>
                    {[{ label: "Âge", value: "28 ans" }, { label: "Objectif", value: "Rééquilibrage" }, { label: "Pathologie", value: "Aucune" }, { label: "Messages", value: "34" }].map((item, i) => (
                      <div key={i} style={{ marginBottom: 6 }}>
                        <p style={{ margin: 0, fontSize: 9, color: "#4b5563" }}>{item.label}</p>
                        <p style={{ margin: 0, fontSize: 10, color: "#d1d5db" }}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderRadius: 10, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", padding: 10 }}>
                    <p style={{ margin: "0 0 6px", fontSize: 9, color: "#9ca3af" }}>📊 Rapport mensuel</p>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, marginBottom: 4 }}>
                      <div style={{ height: "100%", width: "65%", background: emerald, borderRadius: 2 }} />
                    </div>
                    <p style={{ margin: 0, fontSize: 9, color: "#4b5563" }}>Généré le 1er du mois</p>
                  </div>
                </div>
              ) : (
                <div style={{ animation: "slideInRight 0.4s cubic-bezier(0.16,1,0.3,1)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "white" }}>📊 Rapport — Julie P.</p>
                      <p style={{ margin: "3px 0 0", fontSize: 10, color: "#4b5563" }}>Mai 2026</p>
                    </div>
                    <button onClick={() => setShowReport(false)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", fontSize: 14, cursor: "pointer", borderRadius: 6, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {reportSections.map((section, i) => (
                      <div key={i} style={{ background: section.bg, border: `1px solid ${section.border}`, borderRadius: 10, padding: "10px 12px", animation: `slideInRight 0.4s ${i * 0.06}s cubic-bezier(0.16,1,0.3,1) both` }}>
                        <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: section.color }}>{section.icon} {section.title}</p>
                        <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", lineHeight: 1.5 }}>{section.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile */}
      <div className="lg:hidden">
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0d0d]">
          <div className="flex items-center gap-2 border-b border-white/[0.06] bg-[#161616] px-4 py-3">
            <div className="flex gap-1.5">
              <div className="h-2 w-2 rounded-full bg-[#FF5F57]" />
              <div className="h-2 w-2 rounded-full bg-[#FFBD2E]" />
              <div className="h-2 w-2 rounded-full bg-[#28CA41]" />
            </div>
            <div className="mx-auto flex items-center gap-2 rounded-md bg-[#1a1a1a] px-3 py-1">
              <div className="h-1 w-1 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-zinc-500">nutri-twin.app/dashboard</span>
            </div>
          </div>
          <div className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-violet-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">JP</div>
              <div>
                <p className="text-[13px] font-semibold text-white">Julie P.</p>
                <p className="text-[10px] text-zinc-500">julie.p@email.fr</p>
              </div>
            </div>
            <div className="space-y-2 mb-3">
              {julieConversation.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "ai" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "82%", borderRadius: 12, borderBottomRightRadius: msg.role === "ai" ? 4 : 12, borderBottomLeftRadius: msg.role === "patient" ? 4 : 12, padding: "7px 11px", fontSize: 12, lineHeight: 1.5, backgroundColor: msg.role === "ai" ? emerald : "#1e1e1e", color: msg.role === "ai" ? "black" : "rgba(255,255,255,0.8)" }}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-[#1a1a1a] px-3 py-2">
              <span className="flex-1 text-[11px] text-zinc-600">Conversation en lecture seule</span>
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0f0f0f] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-bold text-white">📊 Rapport — Julie P.</p>
              <p className="text-[10px] text-zinc-600">Mai 2026</p>
            </div>
            <div className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[10px] font-semibold text-violet-400">Mensuel</div>
          </div>
          <div className="flex flex-col gap-3">
            {reportSections.map((section, i) => (
              <div key={i} style={{ background: section.bg, border: `1px solid ${section.border}`, borderRadius: 10, padding: "10px 12px" }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: section.color }}>{section.icon} {section.title}</p>
                <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", lineHeight: 1.5 }}>{section.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-xl text-center px-4">
        <p className="text-[15px] leading-relaxed" style={{ color: "#9ca3af" }}>
          NutriTwin répond à votre place, vous supervisez.<br />
          <span className="text-white font-semibold">Gardez le contrôle total sur chaque conseil délivré.</span>
        </p>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(16px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-[#070707] text-white"
      style={{ fontFamily: "var(--font-geist-sans), Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-1/4 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-emerald-500/[0.05] blur-[120px]" />
      </div>

      <header className="fixed top-0 z-50 w-full border-b border-white/[0.04] bg-[#070707]/80 backdrop-blur-2xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
      <a href="/" className="flex items-center gap-2">
      <img src="/logo.svg" alt="NutriTwin" className="h-7 sm:h-10 w-auto relative" />
      <span className="text-[18px] tracking-tight">Nutri<strong className="font-black" style={{ color: "#10b981" }}>Twin</strong></span>
        </a>

          <nav className="hidden items-center gap-8 lg:flex">
            {[
              { label: "Concept", href: "#concept" },
              { label: "Sécurité", href: "#securite" },
              { label: "Tarifs", href: "#tarifs" },
            ].map((item) => (
              <a key={item.href} href={item.href} className="text-[13px] font-medium text-white transition-colors hover:text-zinc-300">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login" className="text-[14px] font-medium transition-colors" style={{ color: emerald }}>
              Se connecter
            </Link>
            <button
              className="flex lg:hidden h-8 w-8 items-center justify-center rounded-lg border border-white/10"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <svg className="size-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {mobileMenuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                }
              </svg>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-white/[0.06] bg-[#0a0a0a] px-4 py-2 lg:hidden">
            {[
              { label: "Concept", href: "#concept" },
              { label: "Sécurité", href: "#securite" },
              { label: "Tarifs", href: "#tarifs" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center py-3 text-[15px] text-white border-b border-white/[0.06] last:border-0"
              >
                {item.label}
              </a>
            ))}
            <a
              href="#tarifs"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-3 mb-2 flex h-11 w-full items-center justify-center rounded-xl text-[14px] font-semibold text-black"
              style={{ backgroundColor: emerald }}
            >
              Commencer ici
            </a>
          </div>
        )}
      </header>

      <main className="relative z-10 pt-14 sm:pt-16 lg:pt-0">

      <section className="mx-auto max-w-7xl px-4 pb-16 pt-16 sm:pb-24 sm:pt-24 lg:px-8 lg:pt-32">
  <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
    <div className="w-full text-center lg:text-left">


              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-1.5 ring-1 ring-emerald-500/20">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: emerald }}>
                  Votre jumeau numérique
                </span>
              </div>

              <h1 className="font-black leading-[1.30] lg:leading-[1.05] tracking-tight" style={{ fontSize: "clamp(32px, 5vw, 60px)" }}>
                <span className="block text-white">Le suivi ne s'arrête</span>
                <span className="block text-white">pas à la porte</span>
                <span className="block text-white">du cabinet,</span>
                <span className="block" style={{ color: emerald }}>votre expertise</span>
                <span className="block" style={{ color: emerald }}>non plus.</span>
              </h1>

              <div className="mt-3 h-px w-10 rounded-full mx-auto lg:mx-0" style={{ backgroundColor: emerald }} />

              <p className="mt-5 lg:mt-5 mt-8 text-[15px] leading-relaxed text-zinc-400">
  <span className="hidden lg:inline">NutriTwin crée votre jumeau numérique, une IA<br />entraînée sur vos méthodes qui conseille vos patients,<br />avec votre style,{" "}</span>
  <span className="lg:hidden">NutriTwin crée votre jumeau numérique, une IA<br />entraînée sur vos méthodes qui conseille<br />vos patients, avec votre style,<br /></span>
  <span className="text-white font-medium">disponible 24h/24.</span>
</p>


              <div className="mt-8 flex flex-col items-center gap-3 lg:items-start lg:flex-row">
              <a
  href="#tarifs"
  className="inline-flex h-[48px] items-center justify-center gap-2 rounded-xl px-25 text-[14px] font-semibold text-black transition active:scale-95"
  style={{ backgroundColor: emerald }}
  onMouseEnter={(e) => {
    e.currentTarget.style.boxShadow = "0 0 0 1px rgba(16,185,129,0.5), 0 8px 30px rgba(16,185,129,0.4)";
    e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.boxShadow = "none";
    e.currentTarget.style.transform = "translateY(0) scale(1)";
  }}
>
                  Commencer ici
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </a>
              </div>
              <p className="mt-3 text-[11px] text-zinc-500">
                14 jours gratuits · Sans engagement · Annulable à tout moment
              </p>
            </div>

            <div className="w-full flex justify-center lg:justify-start overflow-hidden">
  <AnimatedChat />
</div>
          </div>
        </section>

        <div className="relative h-px w-full">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
        </div>

        <section id="concept" className="py-16 sm:py-24" style={{ background: "#0c0c0c" }}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-10 max-w-3xl text-center">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-1.5 ring-1 ring-emerald-500/20">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: emerald }}>
                  La continuité de votre suivi
                </span>
              </div>
              <h2 className="font-black tracking-tight" style={{ fontSize: "clamp(28px, 4vw, 44px)" }}>
                <span className="block text-white">Parce que vos patients</span>
                <span className="block text-white">ont besoin de vous,</span>
                <span className="block" style={{ color: emerald }}>même entre les séances.</span>
              </h2>
            </div>

            <div className="grid gap-4 lg:grid-cols-2 max-w-5xl mx-auto mt-10">
              <div className="rounded-2xl p-6 sm:p-10" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "#111111" }}>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/[0.05] px-3 py-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-red-400">Le silence</span>
                </div>
                <h3 className="mt-4 text-[20px] font-bold text-white mb-1">Entre deux rendez-vous,</h3>
                <h3 className="text-[20px] font-bold mb-6" style={{ color: "#ef4444" }}>c'est le silence.</h3>
                <div className="space-y-5">
                  {[
                    { title: "L'isolement", desc: "Entre deux séances, l'isolement s'installe. Le patient est seul face à ses doutes." },
                    { title: "La perte d'élan", desc: "Sans réponse immédiate, l'élan se brise et la motivation s'effrite." },
                    { title: "Le point de rupture", desc: "Le silence est le premier pas vers l'abandon." },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
                        <div className="h-1 w-2.5 rounded-full bg-red-400" />
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-zinc-200 mb-0.5">{item.title}</p>
                        <p className="text-[13px] leading-relaxed" style={{ color: "#9ca3af" }}>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative rounded-2xl p-6 sm:p-10" style={{ border: "1px solid rgba(16,185,129,0.25)", background: "linear-gradient(135deg, rgba(16,185,129,0.07), #0a0a0a)" }}>
                <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-1">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">La présence</span>
                </div>
                <h3 className="mt-4 text-[20px] font-bold text-white mb-1">Désormais,</h3>
                <h3 className="text-[20px] font-bold mb-6" style={{ color: emerald }}>votre voix reste.</h3>
                <div className="space-y-5">
                  {[
                    { title: "La continuité", desc: "Votre expertise, disponible immédiatement, au moment précis où ils en ont le plus besoin." },
                    { title: "L'engagement", desc: "Présence immédiate, engagement total : le patient ne décroche plus." },
                    { title: "Le relais maîtrisé", desc: "Vous gardez le contrôle total. Votre jumeau assure le relais en votre absence." },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: emerald }}>
                        <svg className="size-3 text-black" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-white mb-0.5">{item.title}</p>
                        <p className="text-[13px] leading-relaxed" style={{ color: "#d1d5db" }}>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mx-auto mt-10 max-w-xl text-center px-4">
              <p className="text-[15px] leading-relaxed" style={{ color: "#9ca3af" }}>
                Ne les laissez plus seuls face au doute.<br />
                <span className="text-white font-semibold">
                  Offrez-leur votre soutien,{" "}
                  <span className="inline sm:hidden"><br /></span>
                  même quand vous n'êtes pas là.
                </span>
              </p>
            </div>
          </div>
        </section>

        <div className="relative h-px w-full">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        <section className="py-16 sm:py-24" style={{ background: "#070707" }}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-1.5 ring-1 ring-emerald-500/20">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: emerald }}>La configuration</span>
              </div>
              <h2 className="font-black tracking-tight" style={{ fontSize: "clamp(28px, 4vw, 44px)" }}>
                <span style={{ color: emerald }}>3 étapes</span><br />
                <span className="text-white">pour lancer votre jumeau.</span>
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 max-w-5xl mx-auto">
              {[
                { num: "01", title: "La transmission", desc: "Incorporez vos protocoles, vos guides et vos méthodes. Complétez son savoir par un échange guidé pour capturer chaque nuance de votre expertise.", icon: "📚" },
                { num: "02", title: "L'apprentissage", desc: "Ajustez le ton, le style, les valeurs de votre double. Pour qu'il réponde exactement comme vous le feriez.", icon: "🧠" },
                { num: "03", title: "Le relais", desc: "Donnez le lien à vos patients. Ils sont désormais épaulés 24h/24, toujours sous votre contrôle.", icon: "🤝" },
              ].map((step, i) => (
                <div key={i} className="rounded-2xl p-6 sm:p-8" style={{ border: "1px solid rgba(255,255,255,0.10)", background: "#0d0d0d" }}>
                  <div className="mb-5 flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl text-xl" style={{ background: "rgba(16,185,129,0.10)", boxShadow: "0 0 0 1px rgba(16,185,129,0.25)" }}>
                      {step.icon}
                    </div>
                    <span className="text-[48px] font-black leading-none tracking-tighter" style={{ color: "rgba(255,255,255,0.12)" }}>{step.num}</span>
                  </div>
                  <h3 className="mb-2 text-[17px] font-bold text-white">{step.title}</h3>
                  <p className="text-[14px] leading-relaxed" style={{ color: "#9ca3af" }}>{step.desc}</p>
                </div>
              ))}
            </div>

            <div className="mx-auto mt-10 max-w-xl text-center px-4">
              <p className="text-[15px] leading-relaxed" style={{ color: "#9ca3af" }}>
              Bien plus qu'un chatbot générique,<span className="hidden sm:inline"> une extension de votre expertise,</span><span className="sm:hidden"><br />une extension de votre expertise,</span><br />
                <span className="text-white font-semibold">configurée une seule fois, active à vie.</span>
              </p>
            </div>
          </div>
        </section>

        <div className="relative h-px w-full">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        <section className="py-16 sm:py-24" style={{ background: "#0c0c0c" }}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-1.5 ring-1 ring-emerald-500/20">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: emerald }}>Votre cockpit</span>
              </div>
              <h2 className="font-black tracking-tight" style={{ fontSize: "clamp(28px, 4vw, 44px)" }}>
                <span className="text-white">Suivez vos patients</span><br />
                <span style={{ color: emerald }}>en temps réel.</span>
              </h2>
            </div>
            <StaticDashboard />
          </div>
        </section>

        <div className="relative h-px w-full">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        <section id="securite" className="py-16 sm:py-24" style={{ background: "#070707" }}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-1.5 ring-1 ring-emerald-500/20">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: emerald }}>Sécurité & Éthique</span>
              </div>
              <h2 className="font-black tracking-tight" style={{ fontSize: "clamp(28px, 4vw, 44px)" }}>
                <span className="text-white">Vos données.</span><br />
                <span style={{ color: emerald }}>Votre confiance.</span>
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 max-w-5xl mx-auto">
              {[
                { icon: "🔐", title: "Propriété Exclusive", desc: "Votre jumeau est privé. Votre savoir, vos protocoles et vos méthodes ne servent jamais à entraîner d'autres modèles." },
                { icon: "🇫🇷", title: "Souveraineté & RGPD", desc: "Vos données et celles de vos patients sont stockées sur des serveurs basés à Paris, conformément au RGPD." },
                { icon: "⚖️", title: "Cadre Éthique", desc: "NutriTwin est un assistant de suivi, pas de diagnostic. Pour toute question médicale, vous serez systématiquement consulté." },
              ].map((item, i) => (
                <div key={i} className="rounded-2xl p-6 sm:p-8" style={{ border: "1px solid rgba(255,255,255,0.10)", background: "#0d0d0d" }}>
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-xl" style={{ background: "rgba(16,185,129,0.10)", boxShadow: "0 0 0 1px rgba(16,185,129,0.25)" }}>
                    {item.icon}
                  </div>
                  <h3 className="mb-2 text-[16px] font-bold text-white">{item.title}</h3>
                  <p className="text-[14px] leading-relaxed" style={{ color: "#9ca3af" }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="relative h-px w-full">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        <section id="tarifs" className="py-16 sm:py-24" style={{ background: "#0c0c0c" }}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-5 max-w-2xl text-center">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-1.5 ring-1 ring-emerald-500/20">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: emerald }}>Tarifs</span>
              </div>
              <h2 className="font-black tracking-tight text-white" style={{ fontSize: "clamp(28px, 4vw, 44px)" }}>
                Commencez gratuitement
              </h2>
            </div>

            <div className="mx-auto mb-10 max-w-lg text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-2">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-[10px] sm:text-[12px] font-medium text-emerald-400">
  14 jours gratuits · Sans engagement · Annulable à tout moment
</span>

              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 max-w-5xl mx-auto">
              <PricingCard name="Essentiel" price="149€" description="Pour démarrer et accompagner vos patients prioritaires." features={["Jusqu'à 10 patients", "1 praticien", "Jumeau configuré sur 31 questions", "Chat patient 24h/24", "Journal de bord patient", "Dashboard praticien", "Support par email"]} plan="essentiel" featured={false} />
              <PricingCard name="Professionnel" price="249€" badge="Recommandé" description="Le jumeau le plus fidèle à votre expertise." features={["Jusqu'à 100 patients", "1 praticien", "Jumeau configuré sur 31 questions", "Upload documents & protocoles", "Fidélité maximale du jumeau", "Rapport IA mensuel par patient", "Journal de bord patient", "Support prioritaire"]} plan="pro" featured={true} />
              <PricingCard name="Cabinet" price="499€" description="Pour les cabinets multi-praticiens." features={["Patients illimités", "3 praticiens inclus", "Upload documents illimité", "Rapport IA mensuel par patient", "Journal de bord patient", "+99€/praticien supplémentaire", "Support dédié"]} plan="cabinet" featured={false} />
            </div>
          </div>
        </section>

        <div className="relative h-px w-full">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
        </div>

        <FounderSection />

      </main>

      <footer className="border-t border-white/[0.04] py-10" style={{ background: "#040404" }}>
  <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
  <div className="flex flex-wrap items-center justify-between gap-3 sm:flex-nowrap">
  <div className="hidden sm:flex flex-1" />
  <nav className="flex items-center gap-4 sm:gap-8 ml-14">
    <Link href="/cgu" className="text-[13px] font-medium text-white transition-colors hover:text-zinc-300">CGU</Link>
    <Link href="/confidentialite" className="text-[13px] font-medium text-white transition-colors hover:text-zinc-300">Confidentialité</Link>
    <Link href="/login" className="text-[13px] font-medium text-white transition-colors hover:text-zinc-300">Espace praticien</Link>
  </nav>
  <div className="hidden sm:flex flex-1 justify-end">
    <p className="text-[13px] text-zinc-400">© 2026 NutriTwin</p>
  </div>
  <div className="sm:hidden w-full text-center">
  <p className="text-[12px] text-zinc-400">© 2026 NutriTwin</p>
</div>
</div>

  </div>
</footer>


    </div>
  );
}

function FounderSection() {
  const [count, setCount] = useState(10);
  const { ref, inView } = useInView();

  useEffect(() => {
    fetch("/api/founder-count")
      .then((res) => res.json())
      .then((data: { count: number }) => {
        if (data.count !== undefined) setCount(data.count);
      })
      .catch(() => null);
  }, []);

  if (count <= 0) return null;

  return (
    <section className="py-16 sm:py-24" style={{ background: "#070707" }}>
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <div className="rounded-2xl border p-8 sm:p-12" style={{ borderColor: `${amber}30`, background: `rgba(245,158,11,0.04)` }}>
        <h2 className="font-black tracking-tight text-white mb-2 text-[26px] sm:text-[clamp(28px,4vw,48px)]">
  Prêt à vous dédoubler ?
</h2>

          <h3 className="text-[22px] sm:text-[26px] font-black tracking-tight mb-6" style={{ color: amber }}>
            Devenez Fondateur NutriTwin
          </h3>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5" style={{ borderColor: `${amber}30`, background: `${amber}08` }}>
            <div className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: amber }} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: amber }}>Programme Fondateur</span>
          </div>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-zinc-400 mb-2 max-w-xl mx-auto">
            Rejoignez les nutritionnistes qui transforment le suivi patient,<br />
            sans jamais compromettre la qualité humaine.
          </p>
          <p className="text-[14px] sm:text-[15px] leading-relaxed text-zinc-400 mb-8 max-w-xl mx-auto">
            En tant que membre fondateur, bénéficiez d'un surclassement permanent :<br />
            profitez de toute la puissance du plan Pro au tarif de l'offre Essentiel.<br />
            <strong className="text-white">149€/mois — Garanti à vie.</strong>
          </p>
          <div ref={ref} className="mx-auto mb-8 max-w-xs sm:max-w-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[12px] text-zinc-500">{10 - count} fondateurs ont rejoint</span>
              <span className="text-[18px] sm:text-[20px] font-black" style={{ color: amber }}>{count} places restantes</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/[0.05]">
              <div className="h-2 rounded-full transition-all duration-1000" style={{ width: inView ? `${((10 - count) / 10) * 100}%` : "0%", background: `linear-gradient(90deg, ${amber}, #fbbf24)` }} />
            </div>
          </div>
          <button
  onClick={() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("from_checkout") === "true") {window.location.href = `/checkout?plan=fondateur`;
    } else {
      window.location.href = `/signup?plan=fondateur`;
    }
  }}
  className="inline-flex h-[48px] sm:h-[52px] items-center justify-center rounded-xl px-8 sm:px-10 text-[14px] sm:text-[15px] font-semibold text-black transition active:scale-95 cursor-pointer"
  style={{ backgroundColor: amber }}
  onMouseEnter={(e) => {
    e.currentTarget.style.boxShadow = "0 0 0 1px rgba(245,158,11,0.5), 0 8px 30px rgba(245,158,11,0.4)";
    e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.boxShadow = "none";
    e.currentTarget.style.transform = "translateY(0) scale(1)";
  }}
>
  Je veux devenir Fondateur →
</button>
          <p className="mt-4 text-[11px] text-zinc-600">
            Aucun engagement · Annulable à tout moment
          </p>
        </div>
      </div>
    </section>
  );
}

function PricingCard({ name, price, badge, description, features, plan, featured }: {
  name: string; price: string; badge?: string; description: string; features: string[]; plan: string; featured: boolean;
}) {
  return (
    <div className="relative flex flex-col rounded-2xl p-6 sm:p-8 transition-all duration-300 group" style={{
      background: featured ? "linear-gradient(180deg, rgba(16,185,129,0.07), #080808)" : "#0d0d0d",
      border: featured ? "1px solid rgba(16,185,129,0.30)" : "1px solid rgba(255,255,255,0.08)",
      boxShadow: featured ? "0 20px 40px rgba(16,185,129,0.05)" : "none",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.border = `1px solid ${featured ? "rgba(16,185,129,0.8)" : "rgba(255,255,255,0.35)"}`;
      e.currentTarget.style.boxShadow = featured
        ? "0 0 0 1px rgba(16,185,129,0.3), 0 30px 80px rgba(16,185,129,0.25), 0 0 40px rgba(16,185,129,0.1) inset"
        : "0 0 0 1px rgba(255,255,255,0.15), 0 30px 60px rgba(255,255,255,0.08)";
      e.currentTarget.style.transform = "translateY(-6px) scale(1.01)";
      e.currentTarget.style.background = featured
        ? "linear-gradient(180deg, rgba(16,185,129,0.12), #080808)"
        : "linear-gradient(180deg, rgba(255,255,255,0.04), #0d0d0d)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.border = featured ? "1px solid rgba(16,185,129,0.30)" : "1px solid rgba(255,255,255,0.08)";
      e.currentTarget.style.boxShadow = featured ? "0 20px 40px rgba(16,185,129,0.05)" : "none";
      e.currentTarget.style.transform = "translateY(0) scale(1)";
      e.currentTarget.style.background = featured ? "linear-gradient(180deg, rgba(16,185,129,0.07), #080808)" : "#0d0d0d";
    }}
    
    >
      {featured && (
        <>
          <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
            <span className="rounded-full px-3 py-1 text-[11px] font-semibold text-black" style={{ backgroundColor: emerald }}>{badge}</span>
          </div>
        </>
      )}
      <p className="mb-1 text-[14px] font-bold text-white">{name}</p>
      <div className="mb-3 flex items-baseline gap-1">
        <span className="text-[42px] font-black tracking-tight text-white">{price}</span>
        <span className="text-[12px] text-zinc-600">/mois</span>
      </div>
      <p className="mb-5 text-[12px] leading-relaxed text-zinc-500">{description}</p>
      <ul className="mb-6 flex flex-1 flex-col gap-2.5">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <svg className="mt-0.5 size-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            <span className={`text-[12px] leading-snug ${i < 3 ? "text-zinc-200" : "text-zinc-500"}`}>{f}</span>
          </li>
        ))}
      </ul>
      <button
  onClick={() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("from_checkout") === "true") {window.location.href = `/checkout?plan=${plan}`;
    } else {
      window.location.href = `/signup?plan=${plan}`;
    }
  }}
  className="inline-flex h-[50px] w-full items-center justify-center rounded-xl text-[13px] font-semibold transition active:scale-95 mt-2"
  style={featured
    ? { backgroundColor: emerald, color: "black", boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }
    : { border: "1.5px solid rgba(255,255,255,0.12)", color: "#d1d5db", background: "rgba(255,255,255,0.03)" }
  }
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
    e.currentTarget.style.boxShadow = featured
      ? "0 0 0 1px rgba(16,185,129,0.5), 0 8px 30px rgba(16,185,129,0.4)"
      : "0 0 0 1px rgba(255,255,255,0.2), 0 8px 20px rgba(255,255,255,0.05)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "translateY(0) scale(1)";
    e.currentTarget.style.boxShadow = featured ? "0 4px 14px rgba(16,185,129,0.3)" : "none";
  }}
>

  Commencer l'essai gratuit →
</button>

    </div>
  );
}
