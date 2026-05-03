"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

const emerald = "#10b981";

// Hook intersection observer
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

// Chat animé
function AnimatedChat() {
  const messages = [
    { role: "patient", text: "Bonsoir... j'ai encore craqué sur des chips ce soir. Je me sens nulle 😔", delay: 1500 },
    { role: "ai", text: "Bonsoir Sophie. Un écart, ça arrive — et ça ne définit pas votre parcours.", delay: 4500 },
    { role: "ai", text: "Dites-moi, vous aviez mangé quoi ce midi ?", delay: 6500 },
    { role: "patient", text: "Pas grand chose. Un sandwich en vitesse entre deux réunions.", delay: 9500 },
    { role: "ai", text: "Voilà, tout s'explique. Ce n'est pas de la faiblesse — c'est de la biologie.", delay: 12500 },
    { role: "ai", text: "Demain, on vise un vrai déjeuner avec des protéines. D'accord ?", delay: 14500 },
    { role: "patient", text: "Oui. Merci, ça me soulage d'avoir quelqu'un à qui écrire 💚", delay: 17500 },
  ];

  const [visibleMessages, setVisibleMessages] = useState<number[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    messages.forEach((msg, i) => {
      const showTyping = setTimeout(() => {
        setIsTyping(true);
      }, msg.delay - 1000);

      const showMsg = setTimeout(() => {
        setIsTyping(false);
        setVisibleMessages(prev => [...prev, i]);
      }, msg.delay);

      timers.push(showTyping, showMsg);
    });

    // Reset après le dernier message
    const reset = setTimeout(() => {
      setVisibleMessages([]);
    }, messages[messages.length - 1].delay + 4000);
    timers.push(reset);

    return () => timers.forEach(t => clearTimeout(t));
  }, [visibleMessages.length === messages.length]);

  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-3xl bg-emerald-500/[0.06] blur-2xl" />

      <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#0d0d0d] shadow-2xl shadow-black/60">
        <div className="flex items-center gap-3 border-b border-white/[0.06] bg-[#111111] px-5 py-4">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm font-bold text-black">
              TM
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#111111] bg-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Thomas Moreau · NutriTwin</p>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-[11px] text-emerald-400">Répond instantanément</p>
            </div>
          </div>
          <div className="ml-auto rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
            21h14
          </div>
        </div>

        <div className="space-y-3 px-4 py-5 min-h-[420px]">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex transition-all duration-700 ${
                visibleMessages.includes(i) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
              } ${msg.role === "ai" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[82%] rounded-[18px] px-4 py-2.5 text-[13px] leading-relaxed ${
                  msg.role === "ai"
                    ? "rounded-br-md text-black"
                    : "rounded-bl-md bg-[#1e1e1e] text-zinc-200"
                }`}
                style={msg.role === "ai" ? { backgroundColor: emerald } : {}}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {isTyping && visibleMessages.length < messages.length && (
            <div className={`flex ${messages[visibleMessages.length]?.role === "ai" ? "justify-end" : "justify-start"}`}>
              <div
                className={`flex items-center gap-1.5 rounded-[18px] px-4 py-3 ${
                  messages[visibleMessages.length]?.role === "ai" ? "rounded-br-md" : "rounded-bl-md bg-[#1e1e1e]"
                }`}
                style={messages[visibleMessages.length]?.role === "ai" ? { backgroundColor: emerald } : {}}
              >
                {[0, 200, 400].map((delay, i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full animate-bounce ${
                      messages[visibleMessages.length]?.role === "ai" ? "bg-black/40" : "bg-zinc-500"
                    }`}
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2 rounded-2xl bg-[#1a1a1a] px-4 py-2.5">
            <span className="flex-1 text-[12px] text-zinc-600">Écrire un message...</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: emerald }}>
              <svg className="size-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Carte avec effet glow souris
function GlowCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={cardRef}
      className={`relative overflow-hidden ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isHovered && (
        <div
          className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300"
          style={{
            background: `radial-gradient(250px circle at ${mousePos.x}px ${mousePos.y}px, rgba(16,185,129,0.10), transparent 70%)`,
          }}
        />
      )}
      <div className="relative z-20 h-full">
        {children}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-[#070707] text-white"
      style={{ fontFamily: "var(--font-geist-sans), Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Glow ambiant fixe */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-1/4 left-1/2 h-[900px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-500/[0.05] blur-[140px]" />
      </div>

      {/* NAV */}
      <header className="fixed top-0 z-50 w-full border-b border-white/[0.04] bg-[#070707]/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/20">
              <span className="text-sm">🍃</span>
            </div>
            <span className="text-[15px] font-semibold tracking-tight">NutriTwin</span>
          </div>
          <nav className="hidden items-center gap-8 md:flex">
            {[
              { label: "Le problème", href: "#probleme" },
              { label: "La solution", href: "#solution" },
              { label: "Dashboard", href: "#dashboard" },
              { label: "Tarifs", href: "#tarifs" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-[13px] text-zinc-400 transition-colors hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-[13px] text-zinc-400 transition hover:text-white">
              Connexion
            </Link>
            <a
              href="#tarifs"
              className="rounded-full px-4 py-2 text-[13px] font-semibold text-black transition hover:opacity-90 active:scale-95"
              style={{ backgroundColor: emerald }}
            >
              Essai gratuit
            </a>
          </div>
        </div>
      </header>

      <main className="relative z-10 pt-16">

        {/* HERO SPLIT — fond #070707 */}
        <section className="mx-auto max-w-7xl px-6 pb-24 pt-24 lg:px-8 lg:pt-32">
          <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-20">

            <div>
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-1.5 backdrop-blur">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400">
                  Jumeau numérique · Nutritionnistes
                </span>
              </div>

              <h1 className="text-[52px] font-bold leading-[1.05] tracking-tight sm:text-[60px] lg:text-[68px]">
                <span className="block text-white">Le suivi</span>
                <span className="block text-white">ne s'arrête pas</span>
                <span className="block" style={{ color: emerald }}>à la porte</span>
                <span className="block" style={{ color: emerald }}>du cabinet.</span>
              </h1>

              <div className="mt-3 h-px w-16 rounded-full" style={{ backgroundColor: emerald }} />

              <p className="mt-6 text-[17px] font-medium leading-relaxed text-zinc-300">
                Votre expertise non plus.
              </p>

              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-zinc-500">
                Parce que vos patients ont besoin de vous entre les séances.
                NutriTwin crée votre jumeau numérique — une IA entraînée sur vos méthodes, disponible 24h/24.
              </p>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href="#tarifs"
                  className="group relative inline-flex h-[52px] items-center justify-center overflow-hidden rounded-full px-8 text-[15px] font-semibold text-black transition-all active:scale-95"
                  style={{ backgroundColor: emerald }}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Créer mon jumeau numérique
                    <svg className="size-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                  <div className="absolute inset-0 translate-y-full bg-emerald-400 transition-transform duration-300 group-hover:translate-y-0" />
                </a>
                <a
                  href="#solution"
                  className="inline-flex h-[52px] items-center justify-center gap-2 rounded-full border border-white/10 px-8 text-[15px] text-zinc-400 transition hover:border-white/20 hover:text-white"
                >
                  Voir la démo
                </a>
              </div>
            </div>

            <div className="lg:pl-4">
              <AnimatedChat />
            </div>
          </div>
        </section>

        {/* PROBLÈME — fond #0a0a0a */}
        <section id="probleme" className="border-y border-white/[0.04] bg-[#0a0a0a] py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-emerald-500">
                Ce que vivent vos patients
              </p>
              <h2 className="text-[36px] font-bold tracking-tight text-white sm:text-[44px]">
                Entre deux séances,<br />
                <span className="text-zinc-500">c'est le silence.</span>
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-3 max-w-5xl mx-auto">
              <GlowCard className="rounded-2xl border border-white/[0.06] bg-[#111111] p-7">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/10 ring-1 ring-orange-500/20">
                  <span className="text-xl">😟</span>
                </div>
                <h3 className="mb-3 text-[15px] font-bold text-white">Quand ils craquent, personne</h3>
                <p className="text-[13.5px] leading-relaxed text-zinc-500">
                  Un écart, une tentation, un moment de faiblesse. Et personne à qui se référer dans l'instant.
                </p>
              </GlowCard>

              <GlowCard className="rounded-2xl border border-white/[0.06] bg-[#111111] p-7">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
                  <span className="text-xl">❓</span>
                </div>
                <h3 className="mb-3 text-[15px] font-bold text-white">Des doutes sans réponse</h3>
                <p className="text-[13.5px] leading-relaxed text-zinc-500">
                  Des questions au quotidien, mais personne dans l'immédiat pour y répondre. L'incertitude s'installe.
                </p>
              </GlowCard>

              <GlowCard className="rounded-2xl border border-white/[0.06] bg-[#111111] p-7">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 ring-1 ring-red-500/20">
                  <span className="text-xl">😔</span>
                </div>
                <h3 className="mb-3 text-[15px] font-bold text-white">Se sentir seul, c'est abandonner</h3>
                <p className="text-[13.5px] leading-relaxed text-zinc-500">
                  Sans accompagnement entre les séances, le découragement gagne. Et certains ne reviennent plus.
                </p>
              </GlowCard>
            </div>
          </div>
        </section>

        {/* SOLUTION — fond #060606 */}
        <section id="solution" className="bg-[#060606] py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-emerald-500">
                La solution
              </p>
              <h2 className="text-[36px] font-bold tracking-tight text-white sm:text-[44px]">
                Avec NutriTwin,<br />
                <span style={{ color: emerald }}>vous êtes toujours là.</span>
              </h2>
              <p className="mt-5 text-[15px] leading-relaxed text-zinc-500">
                Pas un chatbot générique. Votre méthode, votre ton, vos protocoles — configurés une fois, actifs 24h/24.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-3 max-w-5xl mx-auto">
              <GlowCard className="relative rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/[0.07] to-[#080808] p-7">
                <div className="absolute -top-px left-7 right-7 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
                  <span className="text-xl">⏰</span>
                </div>
                <h3 className="mb-3 text-[15px] font-bold text-white">Disponible 24h/24</h3>
                <p className="text-[13.5px] leading-relaxed text-zinc-400">
                  Vos patients reçoivent une réponse immédiate et bienveillante, à toute heure du jour et de la nuit.
                </p>
              </GlowCard>

              <GlowCard className="rounded-2xl border border-white/[0.06] bg-[#111111] p-7">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.08]">
                  <span className="text-xl">🪞</span>
                </div>
                <h3 className="mb-3 text-[15px] font-bold text-white">Répond comme vous</h3>
                <p className="text-[13.5px] leading-relaxed text-zinc-500">
                  Avec votre méthode, votre ton, votre approche. Vos patients ne voient pas une IA — ils vous voient, vous.
                </p>
              </GlowCard>

              <GlowCard className="rounded-2xl border border-white/[0.06] bg-[#111111] p-7">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.08]">
                  <span className="text-xl">💚</span>
                </div>
                <h3 className="mb-3 text-[15px] font-bold text-white">Un suivi qui motive</h3>
                <p className="text-[13.5px] leading-relaxed text-zinc-500">
                  Un patient accompagné se sent soutenu. Il garde sa motivation et reste engagé sur la durée.
                </p>
              </GlowCard>
            </div>
          </div>
        </section>

        {/* COMMENT ÇA MARCHE — fond #0a0a0a */}
        <section className="border-y border-white/[0.04] bg-[#0a0a0a] py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center mb-20">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-emerald-500">
                Comment ça marche
              </p>
              <h2 className="text-[36px] font-bold tracking-tight text-white sm:text-[44px]">
                Configuré une fois.<br />
                <span className="text-zinc-500">Actif pour toujours.</span>
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
              {[
                {
                  num: "01",
                  icon: "⚙️",
                  title: "Configurez votre jumeau",
                  desc: "Répondez à 31 questions sur votre approche. Uploadez vos documents (Plan Pro). 20 minutes pour toute une vie.",
                },
                {
                  num: "02",
                  icon: "✉️",
                  title: "Invitez vos patients",
                  desc: "Un email suffit. Vos patients accèdent à leur espace personnalisé et peuvent écrire à votre jumeau immédiatement.",
                },
                {
                  num: "03",
                  icon: "🤖",
                  title: "Votre jumeau prend le relais",
                  desc: "Il répond avec votre ton et votre méthode. Vous suivez les conversations et générez des rapports IA.",
                },
              ].map((step, i) => (
                <GlowCard key={i} className="rounded-2xl border border-white/[0.06] bg-[#111111] p-7">
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                      <span className="text-2xl">{step.icon}</span>
                    </div>
                    <span className="text-3xl font-bold text-white/[0.08]">{step.num}</span>
                  </div>
                  <h3 className="mb-3 text-[16px] font-bold text-white">{step.title}</h3>
                  <p className="text-[13.5px] leading-relaxed text-zinc-500">{step.desc}</p>
                </GlowCard>
              ))}
            </div>
          </div>
        </section>

        {/* DASHBOARD — fond #060606 */}
        <section id="dashboard" className="bg-[#060606] py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center mb-12">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-emerald-500">
                Votre cockpit
              </p>
              <h2 className="text-[36px] font-bold tracking-tight text-white sm:text-[44px]">
                Suivez vos patients<br />
                <span className="text-zinc-500">en temps réel.</span>
              </h2>
              <p className="mt-5 text-[15px] leading-relaxed text-zinc-500">
                Toutes les conversations, profils et données dans une interface claire et puissante.
              </p>
            </div>

            <div className="relative mx-auto max-w-5xl">
              <div className="absolute -inset-x-20 -top-10 -bottom-10 bg-gradient-to-b from-transparent via-emerald-500/[0.04] to-transparent blur-3xl" />

              <div className="relative rounded-2xl border border-white/[0.08] bg-[#0f0f0f] p-2 shadow-2xl shadow-black/50">
                <div className="flex items-center gap-2 rounded-t-xl bg-[#161616] px-4 py-3 border-b border-white/[0.06]">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
                    <div className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
                    <div className="h-3 w-3 rounded-full bg-[#28CA41]" />
                  </div>
                  <div className="mx-auto flex items-center gap-2 rounded-md bg-[#1a1a1a] px-4 py-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[11px] text-zinc-500">nutri-twin.app/dashboard</span>
                  </div>
                </div>

                <div className="grid grid-cols-[220px_1fr_200px] gap-0 rounded-b-xl overflow-hidden" style={{ minHeight: 460 }}>
                  <div className="bg-[#111111] border-r border-white/[0.06] p-3">
                    <div className="mb-3 flex items-center gap-2 px-2 py-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20">
                        <span className="text-sm">🍃</span>
                      </div>
                      <span className="text-xs font-semibold text-zinc-300">Mes patients</span>
                    </div>
                    {[
                      { name: "Sophie M.", msg: "J'ai encore craqué ce soir...", time: "21:14", active: true, color: "bg-rose-500" },
                      { name: "Thomas R.", msg: "Que manger avant le sport ?", time: "18:30", active: false, color: "bg-blue-500" },
                      { name: "Julie P.", msg: "Merci pour les conseils !", time: "Hier", active: false, color: "bg-violet-500" },
                      { name: "Marc D.", msg: "Je me sens mieux cette semaine", time: "Lun", active: false, color: "bg-amber-500" },
                    ].map((p, i) => (
                      <div key={i} className={`mb-1.5 rounded-xl p-2.5 ${p.active ? "bg-emerald-500/10 border border-emerald-500/20" : "hover:bg-white/[0.03]"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${p.color}`}>
                            {p.name.split(" ").map(n => n[0]).join("")}
                          </div>
                          <span className={`text-xs font-semibold flex-1 ${p.active ? "text-emerald-400" : "text-zinc-300"}`}>{p.name}</span>
                          <span className="text-[10px] text-zinc-600">{p.time}</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 truncate ml-8">{p.msg}</p>
                      </div>
                    ))}
                    <div className="mt-3 rounded-full bg-emerald-500 py-2 text-center text-[11px] font-semibold text-black">
                      + Inviter un patient
                    </div>
                  </div>

                  <div className="bg-[#0d0d0d] flex flex-col">
                    <div className="border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">Sophie Martin</p>
                        <p className="text-[11px] text-zinc-500">sophie.m@email.fr</p>
                      </div>
                      <div className="rounded-full border border-emerald-500/30 px-3 py-1 text-[11px] font-semibold text-emerald-400">
                        📊 Rapport IA
                      </div>
                    </div>
                    <div className="flex-1 p-4 space-y-3">
                      <div className="flex justify-start">
                        <div className="max-w-[75%] rounded-2xl rounded-bl-md bg-[#1e1e1e] px-3 py-2.5">
                          <p className="text-[12px] text-zinc-200 leading-relaxed">Bonsoir... j'ai encore craqué sur des chips. Je me sens nulle 😔</p>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="max-w-[75%] rounded-2xl rounded-br-md px-3 py-2.5" style={{ backgroundColor: emerald }}>
                          <p className="text-[12px] text-black leading-relaxed">Bonsoir Sophie. Un écart, ça arrive — et ça ne définit pas votre parcours.</p>
                        </div>
                      </div>
                      <div className="flex justify-start">
                        <div className="max-w-[75%] rounded-2xl rounded-bl-md bg-[#1e1e1e] px-3 py-2.5">
                          <p className="text-[12px] text-zinc-200 leading-relaxed">Pas grand chose ce midi, juste un sandwich.</p>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="max-w-[75%] rounded-2xl rounded-br-md px-3 py-2.5" style={{ backgroundColor: emerald }}>
                          <p className="text-[12px] text-black leading-relaxed">Voilà, tout s'explique. Ce n'est pas de la faiblesse — c'est de la biologie.</p>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-white/[0.06] p-3">
                      <div className="flex items-center gap-2 rounded-xl bg-[#1a1a1a] px-3 py-2">
                        <span className="text-[11px] text-zinc-600 flex-1">Conversation en lecture seule</span>
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#111111] border-l border-white/[0.06] p-3">
                    <div className="flex flex-col items-center text-center mb-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white mb-2">SM</div>
                      <p className="text-xs font-semibold text-white">Sophie Martin</p>
                      <p className="text-[10px] text-zinc-500">sophie.m@email.fr</p>
                    </div>
                    <div className="space-y-2 rounded-xl bg-[#161616] p-2.5 mb-3">
                      {[
                        { label: "Âge", value: "34 ans" },
                        { label: "Objectif", value: "Perte de poids" },
                        { label: "Pathologies", value: "Hypothyroïdie" },
                        { label: "Messages", value: "47" },
                      ].map((item, i) => (
                        <div key={i}>
                          <p className="text-[10px] text-zinc-600">{item.label}</p>
                          <p className="text-[11px] text-zinc-300">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5">
                      <p className="text-[10px] text-zinc-400 mb-1.5">📊 Rapport mensuel</p>
                      <div className="h-1.5 w-full rounded-full bg-white/[0.05] mb-1.5">
                        <div className="h-1.5 w-3/4 rounded-full bg-emerald-500" />
                      </div>
                      <p className="text-[9px] text-zinc-600">Disponible dans 5 jours</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TARIFS — fond #0a0a0a */}
        <section id="tarifs" className="border-y border-white/[0.04] bg-[#0a0a0a] py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center mb-6">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-emerald-500">Tarifs</p>
              <h2 className="text-[36px] font-bold tracking-tight text-white sm:text-[44px]">
                Commencez gratuitement
              </h2>
            </div>

            <div className="mx-auto mb-14 max-w-lg text-center">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.05] px-5 py-2.5">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-[13px] font-medium text-emerald-400">
                  14 jours gratuits · Sans engagement · Annulable à tout moment
                </span>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-3 lg:gap-6 max-w-5xl mx-auto">
              <PricingCard
                name="Essentiel"
                price="149€"
                description="Pour démarrer et accompagner vos patients prioritaires."
                features={[
                  "Jusqu'à 10 patients",
                  "1 praticien",
                  "Jumeau configuré sur 31 questions",
                  "Chat patient 24h/24",
                  "Journal de bord patient",
                  "Dashboard praticien",
                  "Support par email",
                ]}
                plan="essentiel"
                featured={false}
              />
              <PricingCard
                name="Pro"
                price="249€"
                badge="Recommandé"
                description="Le jumeau le plus fidèle à votre expertise."
                features={[
                  "Jusqu'à 100 patients",
                  "1 praticien",
                  "Jumeau configuré sur 31 questions",
                  "Upload documents & protocoles",
                  "Fidélité maximale du jumeau",
                  "Rapport IA mensuel par patient",
                  "Journal de bord patient",
                  "Support prioritaire",
                ]}
                plan="pro"
                featured={true}
              />
              <PricingCard
                name="Cabinet"
                price="499€"
                description="Pour les cabinets multi-praticiens."
                features={[
                  "Patients illimités",
                  "3 praticiens inclus",
                  "Upload documents illimité",
                  "Rapport IA mensuel par patient",
                  "Journal de bord patient",
                  "+99€/praticien supplémentaire",
                  "Support dédié",
                ]}
                plan="cabinet"
                featured={false}
              />
            </div>
          </div>
        </section>

        {/* FONDATEURS — fond #070707 */}
        <FounderSection />

      </main>

      {/* FOOTER — fond #040404 */}
      <footer className="border-t border-white/[0.04] bg-[#040404] py-14">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/20">
                <span className="text-sm">🍃</span>
              </div>
              <span className="text-[15px] font-semibold">NutriTwin</span>
            </div>
            <nav className="flex flex-wrap gap-x-8 gap-y-2 text-[13px] text-zinc-600">
              <Link href="/cgu" className="transition hover:text-white">CGU</Link>
              <Link href="/confidentialite" className="transition hover:text-white">Confidentialité</Link>
              <Link href="/login" className="transition hover:text-white">Espace praticien</Link>
            </nav>
            <p className="text-[13px] text-zinc-700">© {new Date().getFullYear()} NutriTwin</p>
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
    <section className="bg-[#070707] py-28">
      <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/[0.05] px-4 py-1.5">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-amber-400">
            Offre limitée · {count} places restantes
          </span>
        </div>

        <h2 className="text-[36px] font-bold tracking-tight text-white sm:text-[44px] mb-6">
          Devenez Fondateur NutriTwin
        </h2>

        <p className="text-[15px] leading-relaxed text-zinc-500 mb-10 max-w-xl mx-auto">
          Je cherche 10 nutritionnistes visionnaires pour co-construire NutriTwin.
          En échange de vos retours pendant 2 mois — accès au plan Pro au prix de l'Essentiel,{" "}
          <strong className="text-white">149€/mois garanti à vie</strong>,
          patients illimités, votre nom dans l'histoire du produit.
        </p>

        <div ref={ref} className="mx-auto mb-10 max-w-sm">
          <div className="mb-3 flex items-center justify-between text-[12px]">
            <span className="text-zinc-500">{10 - count} fondateurs ont rejoint</span>
            <span className="font-semibold text-amber-400">{count} places restantes</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/[0.05]">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-1000"
              style={{ width: inView ? `${((10 - count) / 10) * 100}%` : "0%" }}
            />
          </div>
        </div>

        <Link
          href="/signup?plan=fondateur"
          className="inline-flex h-[52px] items-center justify-center rounded-full px-10 text-[15px] font-semibold text-black transition hover:opacity-90 active:scale-95"
          style={{ backgroundColor: emerald }}
        >
          Je veux devenir Fondateur →
        </Link>
        <p className="mt-4 text-[12px] text-zinc-600">Aucun engagement — annulable à tout moment</p>
      </div>
    </section>
  );
}

function PricingCard({
  name, price, badge, description, features, plan, featured
}: {
  name: string;
  price: string;
  badge?: string;
  description: string;
  features: string[];
  plan: string;
  featured: boolean;
}) {
  return (
    <div className={`relative flex flex-col rounded-2xl p-8 transition-all ${
      featured
        ? "border border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.07] to-[#080808] shadow-xl shadow-emerald-500/5"
        : "border border-white/[0.06] bg-[#111111] hover:border-white/[0.10]"
    }`}>
      {featured && (
        <>
          <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
            <span className="rounded-full px-3 py-1 text-[11px] font-semibold text-black" style={{ backgroundColor: emerald }}>
              {badge}
            </span>
          </div>
        </>
      )}

      <p className="mb-1 text-[13px] font-semibold text-zinc-400">{name}</p>

      <div className="mb-4 flex items-baseline gap-1">
        <span className="text-[42px] font-bold tracking-tight text-white">{price}</span>
        <span className="text-[13px] text-zinc-600">/mois</span>
      </div>

      <p className="mb-6 text-[13px] leading-relaxed text-zinc-600">{description}</p>

      <ul className="mb-8 flex flex-1 flex-col gap-3">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <svg className="mt-0.5 size-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            <span className={`text-[13px] leading-snug ${i < 3 ? "text-zinc-300" : "text-zinc-500"}`}>{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href={`/signup?plan=${plan}`}
        className={`inline-flex h-[44px] w-full items-center justify-center rounded-xl text-[14px] font-semibold transition active:scale-95 ${
          featured
            ? "text-black hover:opacity-90"
            : "border border-white/[0.08] text-zinc-300 hover:border-white/20 hover:text-white"
        }`}
        style={featured ? { backgroundColor: emerald } : {}}
      >
        Commencer l'essai gratuit
      </Link>
    </div>
  );
}
