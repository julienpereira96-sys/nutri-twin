"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

const emerald = "#10b981";

function AnimatedChat() {
  const messages = [
    { role: "patient", text: "Bonsoir, j'ai encore craqué sur du chocolat. Je me sens vraiment nulle 😔", delay: 1500 },
    { role: "ai", text: "Bonsoir Justine. Un écart, ça fait partie du chemin, ça ne remet pas en cause tout ce que vous avez construit. Vous avez mangé quoi aujourd'hui ?", delay: 4500 },
    { role: "patient", text: "Un café le matin, un sandwich à midi... pas grand chose.", delay: 7500 },
    { role: "ai", text: "Tout s'explique. Ces fringales du soir ont presque toujours une cause en début de journée.", delay: 11500 },
    { role: "patient", text: "J'ai rarement faim le matin. C'est grave ?", delay: 14500 },
    { role: "ai", text: "Pas du tout. On va construire quelque chose qui vous ressemble vraiment, pas un plan standard qu'on applique à tout le monde.", delay: 18500 },
    { role: "patient", text: "Merci, ça me soulage d'avoir quelqu'un à qui écrire 💚", delay: 22000 },
  ];

  const [visibleMessages, setVisibleMessages] = useState<number[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [done, setDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (done) return;
    const timers: NodeJS.Timeout[] = [];
    messages.forEach((msg, i) => {
      if (msg.role === "ai") timers.push(setTimeout(() => setIsTyping(true), msg.delay - 1000));
      timers.push(setTimeout(() => { setIsTyping(false); setVisibleMessages(prev => [...prev, i]); }, msg.delay));
    });
    timers.push(setTimeout(() => setDone(true), messages[messages.length - 1].delay + 2000));
    return () => timers.forEach(t => clearTimeout(t));
  }, [done]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleMessages, isTyping]);

  return (
    <div className="relative mx-auto lg:ml-8 w-full lg:w-[460px]">
      <div className="absolute inset-0 rounded-[2rem] bg-emerald-500/[0.07] blur-xl" />
      <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#0d0d0d] shadow-2xl shadow-black/60">
        <div className="flex items-center gap-3 border-b border-white/[0.06] bg-[#111111] px-4 py-3">
          <div className="shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-black" style={{ background: "#10b981" }}>JM</div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-white">Compagnon de suivi de Justine</p>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] text-emerald-500">Répond instantanément</p>
            </div>
          </div>
          <div className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-500 ring-1 ring-emerald-500/20">21h14</div>
        </div>

        <div ref={scrollRef} className="px-4 pt-4 pb-2" style={{ height: 455, overflowY: "auto", scrollbarWidth: "none", display: "flex", flexDirection: "column", gap: 13 }}>
          {visibleMessages.map(i => {
            const msg = messages[i];
            return (
              <div key={i} style={{ display: "flex", justifyContent: msg.role === "patient" ? "flex-end" : "flex-start", animation: "chatFadeIn 0.35s ease forwards" }}>
                <div style={{
                  maxWidth: msg.role === "patient" ? "82%" : "100%",
                  borderRadius: msg.role === "patient" ? 22 : 0,
                  padding: msg.role === "patient" ? "12px 16px" : "2px 4px",
                  fontSize: 13,
                  lineHeight: msg.role === "patient" ? 1.6 : 1.7,
                  background: msg.role === "patient" ? "rgba(16,185,129,0.12)" : "transparent",
                  border: "none",
                  color: "rgba(255,255,255,0.95)",
                }}>
                  {msg.text}
                </div>
              </div>
            );
          })}
          {isTyping && (
            <div style={{ display: "flex", justifyContent: "flex-start", paddingTop: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", animation: "ntDot 1.4s ease-in-out infinite", animationDelay: "0s" }} />
                <div style={{ width: 5, height: 5, borderRadius: "50%", animation: "ntDot 1.4s ease-in-out infinite", animationDelay: "0.2s" }} />
                <div style={{ width: 5, height: 5, borderRadius: "50%", animation: "ntDot 1.4s ease-in-out infinite", animationDelay: "0.4s" }} />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-white/[0.06] px-4 py-3">
          <div style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 24, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "10px 8px 10px 18px" }}>
            <span style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,0.2)" }}>Écrire un message…</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 19V5M5 12l7-7 7 7" stroke="rgba(255,255,255,0.3)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes chatFadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ntDot { 0%, 60%, 100% { transform: translateY(0); background: rgba(255,255,255,0.18); box-shadow: none; } 30% { transform: translateY(-7px); background: rgba(255,255,255,0.88); box-shadow: 0 0 6px rgba(255,255,255,0.5); } }
      `}</style>
    </div>
  );
}

function StaticDashboard() {
  const julieConversation = [
    { role: "patient", text: "Encore une journée à n'en plus finir. Je n'ai presque rien mangé." },
    { role: "ai", text: "Bonsoir Julie. Ces journées sans pause laissent peu de place pour prendre soin de soi. Vous avez pu dîner ce soir ?" },
    { role: "patient", text: "Un sandwich froid en réunion... et là je grignote devant mon écran." },
    { role: "ai", text: "C'est votre corps qui cherche de l'énergie, pas un manque de volonté. Ce que vous portez en ce moment, c'est beaucoup." },
    { role: "patient", text: "Oui. Et je culpabilise en plus de tout ça." },
    { role: "ai", text: "Ne rajoutez pas ça. Vous gérez énormément, et vous êtes là quand même. Demain, on commence par un vrai petit-déjeuner, même 15 minutes, c'est un signal fort envoyé à votre corps." },
    { role: "patient", text: "J'ai des œufs je crois. Je peux faire quelque chose de rapide." },
    { role: "ai", text: "Parfait. Deux œufs brouillés et une tranche de pain, c'est déjà une vraie base. Votre corps vous remerciera dès midi." },
    { role: "patient", text: "Merci d'être là 💚" },
    { role: "ai", text: "Toujours. Bonne nuit Julie, prenez soin de vous." },
  ];

  const patients = [
    { initials: "JP", name: "Julie P.", insight: "Fatigue professionnelle", time: "19:47", color: "#8b5cf6", status: "orange", active: true, trophy: false },
    { initials: "TR", name: "Thomas R.", insight: "5 jours sans écart", time: "Hier", color: "#3b82f6", status: "green", active: false, trophy: true },
    { initials: "SM", name: "Sophie M.", insight: "Merci pour les conseils hier !", time: "Lun", color: "#f43f5e", status: "green", active: false, trophy: false },
    { initials: "MD", name: "Marc D.", insight: "Ça se passe bien cette semaine", time: "Mar", color: "#f59e0b", status: "green", active: false, trophy: false },
    { initials: "CL", name: "Claire L.", insight: "J'ai essayé votre recette 😊", time: "Dim", color: "#ec4899", status: "green", active: false, trophy: false },
    { initials: "AV", name: "Antoine V.", insight: "Bonsoir ! Grosse journée mais j'ai tenu 💪", time: "Dim", color: "#06b6d4", status: "green", active: false, trophy: false },
    { initials: "LB", name: "Léa B.", insight: "J'ai adoré la recette que vous m'avez donnée", time: "Sam", color: "#10b981", status: "green", active: false, trophy: false },
  ];

  return (
    <div>
      {/* Desktop */}
      <div className="relative mx-auto hidden lg:block" style={{ maxWidth: 1100 }}>
        <div className="absolute -inset-x-10 -top-8 -bottom-8 bg-gradient-to-b from-transparent via-emerald-500/[0.04] to-transparent blur-3xl" />
        <div className="relative rounded-3xl border border-white/[0.08] bg-[#0d0d0d] p-2 shadow-2xl shadow-black/50">
          {/* Titlebar */}
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

          {/* Header */}
          <div style={{ background: "#0d0d0d", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>Dashboard</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              <span style={{ fontSize: 9, color: "#4b5563" }}>6 patients</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", gap: 4 }}>
                {["Suivi", "Vue d'ensemble"].map((tab, i) => (
                  <div key={i} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: i === 0 ? "rgba(16,185,129,0.12)" : "transparent", color: i === 0 ? "#10b981" : "#4b5563", border: i === 0 ? "1px solid rgba(16,185,129,0.25)" : "1px solid transparent" }}>{tab}</div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 10, background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))", border: "1px solid rgba(16,185,129,0.18)" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM17.5 14v7M14 17.5h7" stroke="black" strokeWidth="2" strokeLinecap="round"/></svg>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#10b981" }}>Mon Jumeau</p>
                  <p style={{ margin: 0, fontSize: 9, color: "#64748b" }}>Gérer mes documents</p>
                </div>
              </div>
            </div>
          </div>

          {/* 3-column layout */}
          <div style={{ display: "grid", gridTemplateColumns: "240px 1fr 280px", minHeight: 520, gap: 10, padding: "10px 10px 10px 10px" }}>

            {/* Sidebar patients */}
            <div style={{ background: "#060908", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 10, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ background: "#1a1a1a", borderRadius: 8, padding: "6px 10px", marginBottom: 8, display: "flex", alignItems: "center", gap: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <span style={{ fontSize: 10, color: "#4b5563" }}>Rechercher...</span>
              </div>
              <div style={{ flex: 1 }}>
                {patients.map((p, i) => (
                  <div key={i} style={{ marginBottom: 2, borderRadius: 10, padding: "8px 10px", background: p.active ? "rgba(245,158,11,0.06)" : "transparent", border: p.active ? "1px solid rgba(245,158,11,0.25)" : "1px solid transparent" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: p.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "white", flexShrink: 0 }}>{p.initials}</div>
                      <span style={{ fontSize: 11, fontWeight: 600, flex: 1, color: p.active ? "#f59e0b" : "#d1d5db", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                      <span style={{ fontSize: 9, color: "#4b5563", flexShrink: 0 }}>{p.time}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 10, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginLeft: 35, display: "flex", alignItems: "center", gap: 3 }}>
                      {p.trophy && <span style={{ fontSize: 9 }}>🏆</span>}
                      {p.insight}
                    </p>
                  </div>
                ))}
              </div>
              <div style={{ borderRadius: 10, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#10b981" }}>Inviter un patient</p>
                  <p style={{ margin: 0, fontSize: 9, color: "#4b5563" }}>Envoyer un accès personnalisé</p>
                </div>
              </div>
            </div>

            {/* Zone conversation */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "white", flexShrink: 0 }}>JP</div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "white" }}>Julie P.</p>
                  <p style={{ margin: 0, fontSize: 9, color: "#6b7280" }}>julie.p@email.fr</p>
                </div>
              </div>
              <div style={{ flex: 1, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10, overflow: "hidden", background: "#0b0f0d" }}>
                {julieConversation.map((msg, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: msg.role === "patient" ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: msg.role === "patient" ? "78%" : "100%",
                      borderRadius: msg.role === "patient" ? 14 : 0,
                      padding: msg.role === "patient" ? "8px 12px" : "2px 4px",
                      fontSize: 11,
                      lineHeight: 1.65,
                      background: msg.role === "patient" ? "rgba(16,185,129,0.12)" : "transparent",
                      border: "none",
                      color: "rgba(255,255,255,0.95)",
                    }}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 10, background: "#161616", padding: "8px 12px", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ flex: 1, fontSize: 10, color: "#4b5563" }}>Conversation en lecture seule, accessible uniquement par le patient</span>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981" }} />
                </div>
              </div>
            </div>

            {/* Fiche patient (droite) */}
            <div style={{ background: "#060908", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "16px 14px", display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden" }}>
              {/* Identité */}
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: "0 0 1px", fontSize: 13, fontWeight: 700, color: "white" }}>Julie P.</p>
                <p style={{ margin: "0 0 10px", fontSize: 10, color: "#4b5563" }}>julie.p@email.fr</p>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 20, padding: "3px 10px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#f59e0b" }}>Fatigue professionnelle</span>
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { label: "Dernière connexion", value: "Il y a 2h" },
                  { label: "Assiduité", value: "5 jours actifs" },
                  { label: "Crises désamorcées", value: "Aucune" },
                ].map((stat, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: "#6b7280" }}>{stat.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#d1d5db" }}>{stat.value}</span>
                  </div>
                ))}
              </div>

              {/* Murmure */}
              <div style={{ background: "rgba(16,185,129,0.05)", borderRadius: 10, border: "1px solid rgba(16,185,129,0.2)", padding: "10px 12px" }}>
                <p style={{ margin: "0 0 5px", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#10b981" }}>Murmures</p>
                <p style={{ margin: 0, fontSize: 10, color: "#94a3b8", lineHeight: 1.6 }}>Rappelle-lui de prendre soin d'elle malgré la charge de travail.</p>
              </div>

              {/* Note privée */}
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", padding: "10px 12px" }}>
                <p style={{ margin: "0 0 5px", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>Notes privées</p>
                <p style={{ margin: 0, fontSize: 10, color: "#64748b", lineHeight: 1.6 }}>Lien fort alimentation / stress pro. Explorer en consultation.</p>
              </div>

              {/* Documents */}
              <div>
                <p style={{ margin: "0 0 7px", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#60a5fa" }}>Documents</p>
                <div style={{ height: 32, borderRadius: 8, background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.15)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#60a5fa" }}>Gérer mes documents</span>
                </div>
              </div>

              {/* Analyses IA */}
              <div>
                <p style={{ margin: "0 0 7px", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#818cf8" }}>Analyses IA</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ height: 32, borderRadius: 8, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#818cf8" }}>Préparer ma séance</span>
                  </div>
                  <div style={{ height: 32, borderRadius: 8, background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.15)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#818cf8" }}>Rapport IA</span>
                  </div>
                </div>
              </div>

              {/* Supprimer */}
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: 10, color: "#f87171" }}>Supprimer le patient</span>
              </div>
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
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, borderRadius: 20, padding: "3px 8px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#f59e0b" }} />
                <span style={{ fontSize: 9, fontWeight: 600, color: "#f59e0b" }}>Fatigue pro</span>
              </div>
            </div>
            <div className="space-y-3 mb-3">
              {julieConversation.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "patient" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "82%",
                    borderRadius: msg.role === "patient" ? 14 : 0,
                    padding: msg.role === "patient" ? "8px 12px" : "2px 0",
                    fontSize: 12,
                    lineHeight: 1.65,
                    background: msg.role === "patient" ? "rgba(16,185,129,0.12)" : "transparent",
                    border: "none",
                    color: "rgba(255,255,255,0.95)",
                  }}>
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
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-bold text-white">Rapport IA, Julie P.</p>
              <p className="text-[10px] text-zinc-600">Mai 2026</p>
            </div>
            <div className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[10px] font-semibold text-violet-400">Mensuel</div>
          </div>
          <div className="flex flex-col gap-2">
            <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 10, padding: "9px 11px" }}>
              <p style={{ margin: "0 0 3px", fontSize: 11, fontWeight: 700, color: "#10b981" }}>Points positifs</p>
              <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", lineHeight: 1.5 }}>Régularité des repas améliorée. Moins d'épisodes de grignotage nocturne cette semaine.</p>
            </div>
            <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 10, padding: "9px 11px" }}>
              <p style={{ margin: "0 0 3px", fontSize: 11, fontWeight: 700, color: "#f59e0b" }}>Points de vigilance</p>
              <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", lineHeight: 1.5 }}>Stress professionnel identifié comme déclencheur principal. Hydratation insuffisante.</p>
            </div>
            <div style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)", borderRadius: 10, padding: "9px 11px" }}>
              <p style={{ margin: "0 0 3px", fontSize: 11, fontWeight: 700, color: "#a78bfa" }}>Recommandations séance</p>
              <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", lineHeight: 1.5 }}>Explorer les stratégies de gestion du stress. Revoir les collations de l'après-midi.</p>
            </div>
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
      <a href="/" className="flex items-center gap-2.5">
        <div style={{ position: "relative", flexShrink: 0, width: 34, height: 34 }}>
          <div style={{ position: "absolute", inset: -8, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.2), transparent 70%)", pointerEvents: "none" }} />
          <div style={{ width: 34, height: 34, borderRadius: "50%", border: "1.5px solid rgba(16,185,129,0.6)", display: "flex", alignItems: "center", justifyContent: "center", background: "#070707", position: "relative" }}>
            <img src="/logo-new.svg" alt="" style={{ width: 18, height: 18 }} />
          </div>
        </div>
        <span className="text-[22px] tracking-tight" style={{ fontFamily: "var(--font-jakarta), sans-serif" }}>Nutri<strong className="font-black" style={{ color: "#10b981" }}>Twin</strong></span>
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
            <Link
              href="/login"
              className="text-[14px] font-medium"
              style={{
                color: emerald,
                transition: "color 0.15s ease",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = "rgba(16,185,129,0.7)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = emerald;
              }}
            >
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
              className="mt-3 mb-2 flex h-11 w-full items-center justify-center rounded-xl text-[14px] font-semibold text-black active:scale-95"
              style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "#000000", borderRadius: 12, boxShadow: "0 4px 24px rgba(16,185,129,0.25)", transition: "all 0.25s ease" }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 8px 32px rgba(16,185,129,0.4)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 4px 24px rgba(16,185,129,0.25)"; e.currentTarget.style.transform = "translateY(0)"; }}
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
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
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
  className="inline-flex h-[48px] items-center justify-center rounded-xl px-25 text-[14px] font-semibold text-black active:scale-95"
  style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "#000000", borderRadius: 12, boxShadow: "0 4px 24px rgba(16,185,129,0.25)", transition: "all 0.25s ease" }}
  onMouseEnter={(e) => {
    e.currentTarget.style.boxShadow = "0 8px 32px rgba(16,185,129,0.4)";
    e.currentTarget.style.transform = "translateY(-1px)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.boxShadow = "0 4px 24px rgba(16,185,129,0.25)";
    e.currentTarget.style.transform = "translateY(0)";
  }}
>
                  Commencer ici
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
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
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
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500">La présence</span>
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
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: emerald }}>La configuration</span>
              </div>
              <h2 className="font-black tracking-tight" style={{ fontSize: "clamp(28px, 4vw, 44px)" }}>
                <span style={{ color: emerald }}>3 étapes</span><br />
                <span className="text-white">pour lancer votre jumeau.</span>
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 max-w-5xl mx-auto mt-6 sm:mt-0">
              {[
                { num: "01", title: "La transmission", desc: "Incorporez vos protocoles, vos guides et vos méthodes. Complétez son savoir par un échange guidé pour capturer chaque nuance de votre expertise.", icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>
                )},
                { num: "02", title: "L'apprentissage", desc: "Ajustez le ton, le style, les valeurs de votre double. Pour qu'il réponde exactement comme vous le feriez.", icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18.9 7a8 8 0 0 1 1.1 5v1a6 6 0 0 0 .8 3"/>
                    <path d="M8 11a4 4 0 0 1 8 0v1a10 10 0 0 0 2 6"/>
                    <path d="M12 11v2a14 14 0 0 0 2.5 8"/>
                    <path d="M8 15a18 18 0 0 0 1.8 6"/>
                    <path d="M4.9 19a22 22 0 0 1-.9-7v-1a8 8 0 0 1 12-6.95"/>
                  </svg>
                )},
                { num: "03", title: "Le relais", desc: "Donnez le lien à vos patients. Ils sont désormais épaulés 24h/24, toujours sous votre contrôle.", icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                )},
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
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
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
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: emerald }}>Sécurité & Éthique</span>
              </div>
              <h2 className="font-black tracking-tight" style={{ fontSize: "clamp(28px, 4vw, 44px)" }}>
                <span className="text-white">Vos données.</span><br />
                <span style={{ color: emerald }}>Votre confiance.</span>
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 max-w-5xl mx-auto">
              {[
                { icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="12" rx="3"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    <circle cx="12" cy="16" r="1.5" fill="#10b981" stroke="none"/>
                    <line x1="12" y1="17.5" x2="12" y2="20"/>
                  </svg>
                ), title: "Propriété Exclusive", desc: "Votre jumeau est privé. Votre savoir, vos protocoles et vos méthodes ne servent jamais à entraîner d'autres modèles." },
                { icon: (
                    <svg width="22" height="16" viewBox="0 0 22 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: 2, overflow: "hidden", display: "block" }}>
                      <rect width="7.33" height="16" fill="#002395"/>
                      <rect x="7.33" width="7.34" height="16" fill="#FFFFFF"/>
                      <rect x="14.67" width="7.33" height="16" fill="#ED2939"/>
                    </svg>
                  ), title: "Souveraineté & RGPD", desc: "Vos données et celles de vos patients sont stockées sur des serveurs basés à Paris, conformément au RGPD." },
                { icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="3" x2="12" y2="21"/>
                    <path d="M8 21h8"/>
                    <line x1="3" y1="7" x2="21" y2="7"/>
                    <line x1="5" y1="7" x2="5" y2="12"/>
                    <path d="M3 12 Q5 14 7 12"/>
                    <line x1="19" y1="7" x2="19" y2="12"/>
                    <path d="M17 12 Q19 14 21 12"/>
                  </svg>
                ), title: "Cadre Éthique", desc: "NutriTwin est un assistant de suivi, pas de diagnostic. Pour toute question médicale, vous serez systématiquement consulté." },
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
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: emerald }}>Tarifs</span>
              </div>
              <h2 className="font-black tracking-tight text-white" style={{ fontSize: "clamp(28px, 4vw, 44px)" }}>
                Commencez gratuitement
              </h2>
            </div>

            <div className="mx-auto mb-10 max-w-lg text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-2">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-[10px] sm:text-[12px] font-medium text-emerald-500">
  14 jours gratuits · Sans engagement · Annulable à tout moment
</span>

              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 max-w-5xl mx-auto">
              <PricingCard
                name="Essentiel"
                price="89€"
                description="Pour démarrer et accompagner vos patients prioritaires."
                features={[
                  { text: "Jusqu'à 10 patients suivis en simultané", included: true, exclusive: false },
                  { text: "Votre Jumeau personnalisé (calqué sur votre approche et vos consignes)", included: true, exclusive: false },
                  { text: "Analyse en temps réel (détection des comportements et alertes de crises)", included: true, exclusive: false },
                  { text: "Préparation automatisée de vos consultations et bilans", included: true, exclusive: false },
                  { text: "Espace de stockage sécurisé pour vos protocoles et documents", included: true, exclusive: false },
                  { text: "Vision IA : Analyse et décodage des photos de repas", included: false, exclusive: true },
                  { text: "Mémoire clinique long terme (synthèse permanente de tout le parcours)", included: false, exclusive: true },
                ]}
                plan="essentiel"
                featured={false}
              />
              <PricingCard
                name="Professionnel"
                price="199€"
                badge="Recommandé"
                description="Idéal pour les praticiens indépendants qui gèrent un suivi actif au quotidien."
                features={[
                  { text: "Jusqu'à 25 patients suivis en simultané", included: true, exclusive: false },
                  { text: "Votre Jumeau personnalisé (calqué sur votre approche et vos consignes)", included: true, exclusive: false },
                  { text: "Analyse en temps réel (détection des comportements et alertes de crises)", included: true, exclusive: false },
                  { text: "Préparation automatisée de vos consultations et bilans", included: true, exclusive: false },
                  { text: "Espace de stockage sécurisé pour vos protocoles et documents", included: true, exclusive: false },
                  { text: "Vision IA : Analyse et décodage des photos de repas envoyées par vos patients", included: true, exclusive: true },
                  { text: "Mémoire clinique long terme (synthèse permanente de tout le parcours)", included: true, exclusive: true },
                  { text: "Plafond d'échanges quotidien étendu par patient (3)", included: true, exclusive: true },
                ]}
                plan="pro"
                featured={true}
              />
              <PricingCard
                name="Cabinet"
                price="499€"
                description="Pour les cabinets multi-praticiens et centres de santé."
                features={[
                  { text: "Jusqu'à 80 patients suivis en simultané (2)", included: true, exclusive: false },
                  { text: "Jumeau personnalisé (calqué sur l'approche et les consignes de chaque praticien)", included: true, exclusive: false },
                  { text: "Analyse en temps réel (détection des comportements et alertes de crises)", included: true, exclusive: false },
                  { text: "Préparation automatisée de vos consultations et bilans", included: true, exclusive: false },
                  { text: "Espace de stockage sécurisé pour vos protocoles et documents", included: true, exclusive: false },
                  { text: "Vision IA : Analyse et décodage des photos de repas envoyées par vos patients", included: true, exclusive: true },
                  { text: "Mémoire clinique long terme (synthèse permanente de tout le parcours)", included: true, exclusive: true },
                  { text: "Plafond d'échanges quotidien étendu par patient (3)", included: true, exclusive: true },
                  { text: "Espace collaboratif : Possibilité de transférer ou de partager un dossier entre confrères", included: true, exclusive: true },
                ]}
                plan="cabinet"
                featured={false}
                footnoteMark="1"
              />
            </div>

            {/* Notes de bas de grille tarifaire */}
            <div className="mx-auto mt-8 max-w-3xl text-left text-[11px] leading-relaxed text-zinc-500 flex flex-col gap-2">
              <p><sup>(1)</sup> Le plan Cabinet inclut 3 comptes praticiens indépendants. Chaque praticien supplémentaire est facturé 149&nbsp;€/mois et ouvre 25 patients additionnels.</p>
              <p><sup>(2)</sup> 80 patients inclus pour les 3 praticiens du plan Cabinet ; chaque praticien supplémentaire bénéficie de 25 patients additionnels.</p>
              <p><sup>(3)</sup> Gestion des volumes et sécurité : L&apos;enveloppe de messages est fixée à 30 messages/jour sur le plan Essentiel et élargie à 100 messages/jour sur les plans Professionnel et Cabinet afin de garantir la stabilité technique de la plateforme et de maintenir un cadre d&apos;échange structuré pour le patient. Conformément à la réglementation, toutes vos données cliniques sont chiffrées, hébergées sur des serveurs sécurisés en Europe, et ne sont jamais utilisées pour entraîner des modèles d&apos;IA publics.</p>
            </div>
          </div>
        </section>

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

function PricingCard({ name, price, badge, description, features, plan, featured, footnoteMark }: {
  name: string; price: string; badge?: string; description: string;
  features: Array<{ text: string; included: boolean; exclusive: boolean }>;
  plan: string; featured: boolean; footnoteMark?: string;
}) {
  return (
    <div className="relative flex flex-col rounded-2xl p-6 sm:p-8 transition-all duration-300" style={{
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
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <span className="rounded-full px-3 py-1 text-[11px] font-semibold text-black" style={{ backgroundColor: emerald }}>{badge}</span>
          </div>
        </>
      )}
      <p className="mb-1 text-[14px] font-bold text-white">{name}</p>
      <div className="mb-3 flex items-baseline gap-1">
        <span className="text-[42px] font-black tracking-tight text-white">{price}</span>
        {footnoteMark && <sup className="text-[13px] font-normal text-zinc-500 ml-0.5">({footnoteMark})</sup>}
        <span className="text-[12px] text-zinc-600">/mois</span>
      </div>
      <p className="mb-5 text-[12px] leading-relaxed text-zinc-500">{description}</p>
      <ul className="mb-6 flex flex-1 flex-col gap-2.5">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            {f.included ? (
              <svg className="mt-0.5 size-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            ) : (
              <svg className="mt-0.5 size-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className={`text-[12px] leading-snug ${!f.included ? "text-zinc-700 line-through" : i < 5 ? "text-zinc-200" : "text-zinc-500"}`}>
              {f.text.split(/(\([123]\))/).map((part, j) =>
                /^\([123]\)$/.test(part) ? <sup key={j} style={{ fontSize: "0.75em" }}>{part}</sup> : part
              )}
            </span>
          </li>
        ))}
      </ul>
      <button
        onClick={() => {
          if (typeof window !== "undefined" && document.cookie.includes("changing_plan=true")) {
            document.cookie = `selected_plan=${plan}; path=/; max-age=300`;
            window.location.assign(`/checkout?plan=${plan}`);
          } else {
            window.location.assign(`/signup?plan=${plan}`);
          }
        }}
        className="inline-flex h-[50px] w-full items-center justify-center rounded-xl text-[13px] font-semibold active:scale-95 mt-2 cursor-pointer"
        style={featured
          ? { background: "linear-gradient(135deg, #10b981, #059669)", color: "#000000", border: "none", boxShadow: "0 4px 24px rgba(16,185,129,0.25)", transition: "all 0.25s ease" }
          : { border: "1.5px solid rgba(255,255,255,0.12)", color: "#d1d5db", background: "rgba(255,255,255,0.03)", transition: "all 0.25s ease" }
        }
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = featured ? "0 8px 32px rgba(16,185,129,0.4)" : "0 8px 20px rgba(255,255,255,0.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = featured ? "0 4px 24px rgba(16,185,129,0.25)" : "none";
        }}
      >
        Commencer l'essai gratuit
      </button>
    </div>
  );
}
