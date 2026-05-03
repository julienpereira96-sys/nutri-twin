"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

const emerald = "#10b981";

// Hook pour animer les nombres
function useCountUp(target: number, duration: number = 2000, start: boolean = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration, start]);
  return count;
}

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
    { role: "patient", text: "Bonsoir... j'ai encore craqué sur des chips. Je me sens nulle 😔", delay: 500 },
    { role: "ai", text: "Bonsoir Sophie. Un écart, ça arrive — et ça ne définit pas votre parcours. Vous aviez mangé quoi ce midi ?", delay: 1800 },
    { role: "patient", text: "Pas grand chose. Un sandwich en vitesse entre deux réunions.", delay: 3400 },
    { role: "ai", text: "Voilà, tout s'explique. Ce n'est pas de la faiblesse — c'est de la biologie. Demain, on vise un vrai déjeuner. D'accord ?", delay: 5000 },
    { role: "patient", text: "Oui. Merci, ça me soulage d'avoir quelqu'un à qui écrire 💚", delay: 6800 },
  ];

  const [visibleMessages, setVisibleMessages] = useState<number[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!started) return;
    messages.forEach((msg, i) => {
      const showTyping = setTimeout(() => {
        if (msg.role === "ai") setIsTyping(true);
      }, msg.delay - 600);

      const showMsg = setTimeout(() => {
        setIsTyping(false);
        setVisibleMessages(prev => [...prev, i]);
      }, msg.delay);

      return () => { clearTimeout(showTyping); clearTimeout(showMsg); };
    });
  }, [started]);

  return (
    <div className="relative">
      {/* Glow derrière */}
      <div className="absolute -inset-4 rounded-3xl bg-emerald-500/[0.06] blur-2xl" />

      <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#0d0d0d] shadow-2xl shadow-black/60">
        {/* Header */}
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

        {/* Messages */}
        <div className="space-y-3 px-4 py-5 min-h-[320px]">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex transition-all duration-500 ${
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

          {isTyping && (
            <div className="flex justify-end">
              <div className="flex items-center gap-1.5 rounded-[18px] rounded-br-md px-4 py-3" style={{ backgroundColor: emerald }}>
                {[0, 150, 300].map((delay, i) => (
                  <div
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-black/40 animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input */}
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

// Carte avec effet lumière souris
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
            background: `radial-gradient(200px circle at ${mousePos.x}px ${mousePos.y}px, rgba(16,185,129,0.08), transparent 70%)`,
          }}
        />
      )}
      {children}
    </div>
  );
}

export default function Home() {
  const { ref: statsRef, inView: statsInView } = useInView();
  const count3 = useCountUp(3, 1500, statsInView);
  const count80 = useCountUp(80, 1800, statsInView);
  const count24 = useCountUp(24, 1200, statsInView);

  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-[#070707] text-white"
      style={{ fontFamily: "var(--font-geist-sans), Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Gradient ambiant fixe */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-1/4 left-1/2 h-[900px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-500/[0.05] blur-[140px]" />
        <div className="absolute top-1/2 -left-1/4 h-[600px] w-[600px] rounded-full bg-emerald-500/[0.03] blur-[120px]" />
        <div className="absolute top-1/3 -right-1/4 h-[500px] w-[500px] rounded-full bg-emerald-500/[0.03] blur-[100px]" />
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
            {["Pourquoi", "Solution", "Démo", "Tarifs"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-[13px] text-zinc-400 transition-colors hover:text-white"
              >
                {item}
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

        {/* HERO SPLIT */}
        <section className="mx-auto max-w-7xl px-6 pb-24 pt-24 lg:px-8 lg:pt-32">
          <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-20">

            {/* Texte gauche */}
            <div>
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-1.5 backdrop-blur">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400">
                  Jumeau numérique · Nutritionnistes
                </span>
              </div>

              <h1 className="text-[52px] font-bold leading-[1.05] tracking-tight sm:text-[64px] lg:text-[72px]">
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
                NutriTwin crée votre jumeau numérique — une IA entraînée sur vos méthodes,
                disponible 24h/24.
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
                  href="#demo"
                  className="inline-flex h-[52px] items-center justify-center gap-2 rounded-full border border-white/10 px-8 text-[15px] text-zinc-400 transition hover:border-white/20 hover:text-white"
                >
                  Voir la démo
                </a>
              </div>

              <div className="mt-6 flex items-center gap-2">
                <div className="flex -space-x-2">
                  {["TM", "SL", "JR", "MP"].map((init, i) => (
                    <div
                      key={i}
                      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#070707] text-[9px] font-bold text-white"
                      style={{ backgroundColor: ["#10b981", "#6366f1", "#f59e0b", "#ec4899"][i] }}
                    >
                      {init}
                    </div>
                  ))}
                </div>
                <p className="text-[12px] text-zinc-500">
                  Rejoignez les praticiens qui font confiance à NutriTwin
                </p>
              </div>
            </div>

            {/* Chat animé droite */}
            <div className="lg:pl-4">
              <AnimatedChat />
            </div>
          </div>
        </section>

        {/* STATS */}
        <section ref={statsRef} className="border-y border-white/[0.04] bg-[#050505]">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid grid-cols-3 divide-x divide-white/[0.04]">
              {[
                { value: count3, suffix: "h", label: "économisées par semaine en moyenne" },
                { value: count80, suffix: "%", label: "des questions gérées automatiquement" },
                { value: count24, suffix: "h/24", label: "disponible pour vos patients" },
              ].map((stat, i) => (
                <div key={i} className="px-8 py-12 text-center">
                  <p className="text-5xl font-bold tracking-tight text-white">
                    {stat.value}{stat.suffix}
                  </p>
                  <p className="mt-2 text-[13px] text-zinc-500 max-w-[140px] mx-auto leading-relaxed">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PROBLÈME */}
        <section id="pourquoi" className="py-28 sm:py-36">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-xl text-center mb-20">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-emerald-500">Le quotidien de vos patients</p>
              <h2 className="text-[36px] font-bold tracking-tight text-white sm:text-[44px]">
                Ce qui se passe<br />entre deux séances
              </h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 max-w-3xl mx-auto">
              <GlowCard className="rounded-2xl border border-white/[0.06] bg-[#0d0d0d] p-8">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 ring-1 ring-orange-500/15">
                  <span className="text-2xl">🌙</span>
                </div>
                <h3 className="mb-3 text-[17px] font-bold text-white">Le silence entre deux séances</h3>
                <p className="text-[14px] leading-relaxed text-zinc-500">
                  Entre deux rendez-vous, votre patient est seul face à ses doutes. Il hésite, il cherche. Sans réponse, il lâche prise.
                </p>
              </GlowCard>

              <GlowCard className="rounded-2xl border border-white/[0.06] bg-[#0d0d0d] p-8">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 ring-1 ring-red-500/15">
                  <span className="text-2xl">😔</span>
                </div>
                <h3 className="mb-3 text-[17px] font-bold text-white">Un patient sans réponse lâche prise</h3>
                <p className="text-[14px] leading-relaxed text-zinc-500">
                  Il craque, culpabilise, attend la prochaine séance pour en parler. Mais parfois, il ne revient plus.
                </p>
              </GlowCard>
            </div>
          </div>
        </section>

        {/* COMMENT ÇA MARCHE */}
        <section className="border-y border-white/[0.04] bg-[#050505] py-28 sm:py-36">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-xl text-center mb-20">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-emerald-500">Comment ça marche</p>
              <h2 className="text-[36px] font-bold tracking-tight text-white sm:text-[44px]">
                Configuré une fois.<br />Actif pour toujours.
              </h2>
            </div>

            <div className="relative max-w-4xl mx-auto">
              {/* Ligne de connexion */}
              <div className="absolute left-[39px] top-12 bottom-12 w-px bg-gradient-to-b from-emerald-500/40 via-emerald-500/20 to-transparent hidden lg:block" />

              <div className="space-y-12">
                {[
                  {
                    num: "01",
                    title: "Configurez votre jumeau en 20 minutes",
                    desc: "Répondez à 31 questions sur votre approche, vos valeurs, vos protocoles. Uploadez vos documents et guides (Plan Pro). Une fois. Pour toujours.",
                    icon: "⚙️",
                  },
                  {
                    num: "02",
                    title: "Invitez vos patients en un clic",
                    desc: "Un email suffit. Vos patients accèdent à leur espace personnalisé et peuvent écrire à votre jumeau immédiatement.",
                    icon: "✉️",
                  },
                  {
                    num: "03",
                    title: "Votre jumeau prend le relais",
                    desc: "Il répond avec votre ton, vos valeurs, votre méthode. Vous suivez les conversations depuis votre dashboard et générez des rapports IA.",
                    icon: "🤖",
                  },
                ].map((step, i) => (
                  <div key={i} className="flex gap-8 items-start">
                    <div className="relative shrink-0">
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06]">
                        <span className="text-3xl">{step.icon}</span>
                      </div>
                      <div className="absolute -bottom-1 -right-1 rounded-full bg-[#050505] px-1.5 py-0.5 text-[10px] font-bold text-emerald-500 ring-1 ring-emerald-500/30">
                        {step.num}
                      </div>
                    </div>
                    <div className="pt-2">
                      <h3 className="mb-2 text-[18px] font-bold text-white">{step.title}</h3>
                      <p className="text-[14px] leading-relaxed text-zinc-500 max-w-lg">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SOLUTION / BÉNÉFICES */}
        <section id="solution" className="py-28 sm:py-36">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-xl text-center mb-20">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-emerald-500">La solution</p>
              <h2 className="text-[36px] font-bold tracking-tight text-white sm:text-[44px]">
                NutriTwin répond à votre place,<br />
                <span className="text-zinc-500">avec votre vision.</span>
              </h2>
              <p className="mt-5 text-[15px] leading-relaxed text-zinc-500">
                Pas un chatbot générique. Votre méthode, votre ton, vos protocoles — configurés une fois, actifs 24h/24.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3 max-w-5xl mx-auto">
              <GlowCard className="relative col-span-1 lg:col-span-1 rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/[0.07] to-[#0a0a0a] p-8">
                <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/25">
                  <span className="text-2xl">🔄</span>
                </div>
                <h3 className="mb-3 text-[16px] font-bold text-white">Un suivi qui ne s'interrompt plus</h3>
                <p className="text-[13px] leading-relaxed text-zinc-400">
                  Vos patients restent accompagnés entre les séances, avec cohérence et bienveillance.
                </p>
              </GlowCard>

              <GlowCard className="rounded-2xl border border-white/[0.06] bg-[#0d0d0d] p-8">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.08]">
                  <span className="text-2xl">🪞</span>
                </div>
                <h3 className="mb-3 text-[16px] font-bold text-white">Votre image, intacte</h3>
                <p className="text-[13px] leading-relaxed text-zinc-400">
                  Vos patients ne voient pas une IA — ils vous voient, vous. Chaque réponse reflète votre approche.
                </p>
              </GlowCard>

              <GlowCard className="rounded-2xl border border-white/[0.06] bg-[#0d0d0d] p-8">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.08]">
                  <span className="text-2xl">⚡</span>
                </div>
                <h3 className="mb-3 text-[16px] font-bold text-white">Votre énergie pour ce qui compte</h3>
                <p className="text-[13px] leading-relaxed text-zinc-400">
                  Les questions du quotidien ? Votre jumeau les gère. Vous restez concentré sur ce que seul un humain peut faire.
                </p>
              </GlowCard>
            </div>
          </div>
        </section>

        {/* DÉMO */}
        <section id="demo" className="border-y border-white/[0.04] bg-[#050505] py-28 sm:py-36">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid items-center gap-16 lg:grid-cols-2">
              <div>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-emerald-500">Démonstration</p>
                <h2 className="text-[36px] font-bold tracking-tight text-white sm:text-[44px] mb-6">
                  Comme si<br />vous étiez là.
                </h2>
                <p className="text-[15px] leading-relaxed text-zinc-500 mb-8">
                  21h14. Thomas Moreau, nutritionniste, n'est plus disponible. Son jumeau, lui, répond — avec ses mots, sa bienveillance, sa méthode.
                </p>
                <div className="space-y-4">
                  {[
                    "Une réponse immédiate et bienveillante 24h/24",
                    "Le ton et la méthode du praticien, pas une IA générique",
                    "Le praticien suit toutes les conversations depuis son dashboard",
                  ].map((point, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: emerald }}>
                        <svg className="size-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      </div>
                      <p className="text-[14px] text-zinc-400">{point}</p>
                    </div>
                  ))}
                </div>
              </div>
              <AnimatedChat />
            </div>
          </div>
        </section>

        {/* TARIFS */}
        <section id="tarifs" className="py-28 sm:py-36">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-xl text-center mb-6">
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

        {/* FONDATEURS */}
        <FounderSection />

      </main>

      {/* FOOTER */}
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
    <section className="border-t border-white/[0.04] bg-[#050505] py-28 sm:py-36">
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
        : "border border-white/[0.06] bg-[#0d0d0d] hover:border-white/[0.10]"
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
            <span className={`text-[13px] leading-snug ${i === 0 || i === 1 ? "text-zinc-300" : "text-zinc-500"}`}>{f}</span>
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
