"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

const emerald = "#10b981";

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

    messages.forEach((msg) => {
      timers.push(setTimeout(() => setIsTyping(true), msg.delay - 1000));
      timers.push(setTimeout(() => {
        setIsTyping(false);
        setVisibleMessages(prev => [...prev, messages.indexOf(msg)]);
      }, msg.delay));
    });

    timers.push(setTimeout(() => setVisibleMessages([]), messages[messages.length - 1].delay + 4000));

    return () => timers.forEach(t => clearTimeout(t));
  }, [visibleMessages.length === messages.length]);

  return (
    <div className="relative mx-auto max-w-sm">
      <div className="absolute -inset-6 rounded-[3rem] bg-emerald-500/[0.08] blur-3xl" />

      <div className="relative overflow-hidden rounded-[2.5rem] border border-white/[0.08] bg-[#0d0d0d] shadow-2xl shadow-black/60">
        <div className="flex items-center gap-3 border-b border-white/[0.06] bg-[#111111] px-5 py-4">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm font-bold text-black">TM</div>
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#111111] bg-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Thomas Moreau · NutriTwin</p>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-[11px] text-emerald-400">Répond instantanément</p>
            </div>
          </div>
          <div className="ml-auto rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/20">21h14</div>
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
                  msg.role === "ai" ? "rounded-br-md text-black" : "rounded-bl-md bg-[#1e1e1e] text-zinc-200"
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

// Icônes Lucide-style
const ClockIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);
const SparkIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
  </svg>
);
const HeartIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
  </svg>
);
const LockIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
  </svg>
);
const ShieldIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
  </svg>
);
const UserCheckIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
  </svg>
);
const BookIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
  </svg>
);
const SendIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
  </svg>
);

export default function Home() {
  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-[#070707] text-white"
      style={{ fontFamily: "var(--font-geist-sans), Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Glow ambiant */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-1/4 left-1/2 h-[900px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-500/[0.06] blur-[140px]" />
      </div>

      {/* HEADER glassmorphism */}
      <header className="fixed top-0 z-50 w-full border-b border-white/[0.04] bg-[#070707]/60 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/20">
              <span className="text-sm">🍃</span>
            </div>
            <span className="text-[15px] font-semibold tracking-tight">NutriTwin</span>
          </Link>
          <nav className="hidden items-center gap-10 md:flex">
            {[
              { label: "Concept", href: "#concept" },
              { label: "Sécurité", href: "#securite" },
              { label: "Tarifs", href: "#tarifs" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-[13px] font-medium text-zinc-400 transition-colors hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-[13px] font-medium text-zinc-400 transition hover:text-white">
              Se connecter
            </Link>
            <a
              href="#tarifs"
              className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black transition hover:bg-zinc-200 active:scale-95"
            >
              Créer mon jumeau
            </a>
          </div>
        </div>
      </header>

      <main className="relative z-10 pt-16">

        {/* HERO */}
        <section className="px-6 py-32 lg:px-8 lg:py-40">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-10 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 backdrop-blur">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-300">
                Jumeau numérique pour nutritionnistes
              </span>
            </div>

            <h1 className="text-[56px] font-black leading-[1.02] tracking-tight sm:text-[72px] lg:text-[88px]">
              <span className="block text-white">Le suivi ne s'arrête pas</span>
              <span className="block text-white">à la porte du cabinet,</span>
              <span className="block bg-gradient-to-r from-emerald-300 via-emerald-400 to-emerald-500 bg-clip-text text-transparent">
                votre expertise non plus.
              </span>
            </h1>

            <p className="mx-auto mt-10 max-w-2xl text-[17px] leading-relaxed text-zinc-400">
              NutriTwin crée votre jumeau numérique : une IA entraînée sur vos méthodes
              qui conseille vos patients, avec votre style, même quand vous n'êtes pas disponible.
            </p>

            <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="#tarifs"
                className="group inline-flex h-[56px] items-center justify-center gap-2 rounded-full bg-white px-9 text-[15px] font-semibold text-black transition hover:bg-zinc-200 active:scale-95"
              >
                Créer mon jumeau gratuitement
                <svg className="size-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
              <a
                href="#concept"
                className="inline-flex h-[56px] items-center justify-center rounded-full border border-white/[0.10] px-9 text-[15px] text-zinc-300 transition hover:border-white/20 hover:text-white"
              >
                Voir la démo
              </a>
            </div>

            <p className="mt-6 text-[12px] text-zinc-600">
              14 jours gratuits · Sans engagement · Annulable à tout moment
            </p>

            {/* Visuel chat smartphone */}
            <div className="mt-24">
              <AnimatedChat />
            </div>
          </div>
        </section>

        {/* TRANSITION */}
        <section className="border-y border-white/[0.04] bg-[#0a0a0a] py-32">
          <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
            <p className="text-[28px] font-medium leading-snug text-zinc-300 sm:text-[36px]">
              Parce que vos patients ont besoin de vous{" "}
              <span style={{ color: emerald }}>entre les séances.</span>
            </p>
          </div>
        </section>

        {/* MATCH PROBLÈME / SOLUTION */}
        <section id="concept" className="bg-[#070707] py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto mb-20 max-w-2xl text-center">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-500">
                Avant / Après
              </p>
              <h2 className="text-[40px] font-black tracking-tight text-white sm:text-[48px]">
                Le suivi entre deux séances<br />
                <span className="text-zinc-500">change tout.</span>
              </h2>
            </div>

            <div className="grid gap-6 lg:grid-cols-2 max-w-5xl mx-auto">

              {/* AVANT — sombre */}
              <div className="rounded-3xl border border-white/[0.06] bg-[#0a0a0a] p-10">
                <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/[0.05] px-3 py-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-red-400">Sans NutriTwin</span>
                </div>

                <h3 className="text-[22px] font-bold text-white mb-2">L'isolement du patient</h3>
                <p className="text-[14px] text-zinc-500 mb-8">Entre deux rendez-vous, c'est le silence.</p>

                <div className="space-y-5">
                  {[
                    { title: "90 repas en autonomie", desc: "Entre deux rendez-vous, le patient est livré à lui-même face à ses doutes." },
                    { title: "Le risque de décrochage", desc: "Une question sans réponse est souvent le début d'un abandon." },
                    { title: "Votre charge mentale", desc: "Votre téléphone vibre pour des questions répétitives, hors cabinet." },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                        <div className="h-1 w-2 rounded-full bg-red-400" />
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-zinc-300">{item.title}</p>
                        <p className="mt-0.5 text-[13px] text-zinc-600 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* APRÈS — vert lumineux */}
              <div className="relative rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.08] to-[#0a0a0a] p-10">
                <div className="absolute -top-px left-10 right-10 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />

                <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/[0.08] px-3 py-1">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">Avec NutriTwin</span>
                </div>

                <h3 className="text-[22px] font-bold text-white mb-2">La présence de votre jumeau</h3>
                <p className="text-[14px] text-zinc-400 mb-8">Une expertise toujours disponible, jamais distante.</p>

                <div className="space-y-5">
                  {[
                    { title: "Zéro attente", desc: "Une réponse immédiate et bienveillante à 21h, le dimanche, ou pendant vos vacances." },
                    { title: "L'engagement maintenu", desc: "Un soutien continu qui maintient la motivation et booste les résultats." },
                    { title: "Votre liberté retrouvée", desc: "L'IA gère les questions du quotidien. Vous gardez votre énergie pour l'humain." },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: emerald }}>
                        <svg className="size-3 text-black" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-white">{item.title}</p>
                        <p className="mt-0.5 text-[13px] text-zinc-400 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PROCESSUS — Bento Grid */}
        <section className="border-y border-white/[0.04] bg-[#0a0a0a] py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto mb-20 max-w-2xl text-center">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-500">
                Comment ça marche
              </p>
              <h2 className="text-[40px] font-black tracking-tight text-white sm:text-[48px]">
                Trois étapes,<br />
                <span className="text-zinc-500">une transformation.</span>
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-3 max-w-6xl mx-auto">
              {[
                {
                  num: "01",
                  title: "L'Imprégnation",
                  desc: "Confiez-lui vos protocoles, vos guides, vos méthodes. Ou laissez l'IA vous interviewer pour capturer votre savoir.",
                  icon: <BookIcon />,
                },
                {
                  num: "02",
                  title: "L'Apprentissage",
                  desc: "Ajustez le ton, le style, les valeurs de votre double. Pour qu'il réponde exactement comme vous le feriez.",
                  icon: <SparkIcon />,
                },
                {
                  num: "03",
                  title: "L'Accompagnement",
                  desc: "Donnez le lien à vos patients. Ils sont désormais épaulés 24h/24, toujours sous votre contrôle.",
                  icon: <SendIcon />,
                },
              ].map((step, i) => (
                <div key={i} className="rounded-3xl border border-white/[0.06] bg-[#0d0d0d] p-10 transition-all hover:border-white/[0.10]">
                  <div className="mb-6 flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                      {step.icon}
                    </div>
                    <span className="text-[60px] font-black leading-none text-white/[0.04] tracking-tighter">{step.num}</span>
                  </div>
                  <h3 className="mb-3 text-[19px] font-bold text-white">{step.title}</h3>
                  <p className="text-[14px] leading-relaxed text-zinc-500">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* DASHBOARD */}
        <section className="bg-[#070707] py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-500">
                Votre cockpit
              </p>
              <h2 className="text-[40px] font-black tracking-tight text-white sm:text-[48px]">
                Suivez vos patients<br />
                <span className="text-zinc-500">en temps réel.</span>
              </h2>
            </div>

            <div className="relative mx-auto max-w-5xl">
              <div className="absolute -inset-x-20 -top-10 -bottom-10 bg-gradient-to-b from-transparent via-emerald-500/[0.04] to-transparent blur-3xl" />

              <div className="relative rounded-3xl border border-white/[0.08] bg-[#0d0d0d] p-2 shadow-2xl shadow-black/50">
                <div className="flex items-center gap-2 rounded-t-2xl bg-[#161616] px-4 py-3 border-b border-white/[0.06]">
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

                <div className="grid grid-cols-[220px_1fr_200px] gap-0 rounded-b-2xl overflow-hidden" style={{ minHeight: 460 }}>
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
                      <div key={i} className={`mb-1.5 rounded-xl p-2.5 ${p.active ? "bg-emerald-500/10 border border-emerald-500/20" : ""}`}>
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

        {/* TRUST BAR */}
        <section id="securite" className="border-y border-white/[0.04] bg-[#0a0a0a] py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-500">
                Sécurité & Éthique
              </p>
              <h2 className="text-[40px] font-black tracking-tight text-white sm:text-[48px]">
                Vos données,<br />
                <span className="text-zinc-500">votre confiance.</span>
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-3 max-w-5xl mx-auto">
              {[
                {
                  icon: <LockIcon />,
                  title: "Chiffrement de bout en bout",
                  desc: "Toutes les données sont chiffrées et stockées sur des serveurs européens. Conformité RGPD totale.",
                },
                {
                  icon: <ShieldIcon />,
                  title: "Conçu pour le secret médical",
                  desc: "Les conversations restent confidentielles. Le praticien voit uniquement les données nécessaires à son suivi.",
                },
                {
                  icon: <UserCheckIcon />,
                  title: "Une IA qui assiste, jamais ne remplace",
                  desc: "Le jumeau seconde le praticien. Pour toute question médicale, il oriente toujours vers vous.",
                },
              ].map((item, i) => (
                <div key={i} className="rounded-3xl border border-white/[0.06] bg-[#0d0d0d] p-8">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                    {item.icon}
                  </div>
                  <h3 className="mb-3 text-[16px] font-bold text-white">{item.title}</h3>
                  <p className="text-[13.5px] leading-relaxed text-zinc-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TARIFS */}
        <section id="tarifs" className="bg-[#070707] py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto mb-6 max-w-2xl text-center">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-500">Tarifs</p>
              <h2 className="text-[40px] font-black tracking-tight text-white sm:text-[48px]">
                Commencez gratuitement
              </h2>
            </div>

            <div className="mx-auto mb-16 max-w-lg text-center">
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
                name="Professionnel"
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

        {/* CTA FINAL */}
        <section className="bg-[#0a0a0a] py-32">
          <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
            <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.08] via-[#0a0a0a] to-[#0a0a0a] p-16 sm:p-20">
              <h2 className="text-[40px] font-black tracking-tight text-white sm:text-[56px]">
                Prêt à vous{" "}
                <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-emerald-500 bg-clip-text text-transparent">
                  dédoubler ?
                </span>
              </h2>
              <p className="mt-6 text-[16px] leading-relaxed text-zinc-400 max-w-xl mx-auto">
                Rejoignez les nutritionnistes qui transforment le suivi patient — sans jamais compromettre la qualité humaine.
              </p>
              <div className="mt-12 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <a
                  href="#tarifs"
                  className="group inline-flex h-[56px] items-center justify-center gap-2 rounded-full bg-white px-9 text-[15px] font-semibold text-black transition hover:bg-zinc-200 active:scale-95"
                >
                  Commencer maintenant
                  <svg className="size-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </a>
              </div>
              <p className="mt-5 text-[12px] text-zinc-600">
                14 jours gratuits · Aucun engagement
              </p>
            </div>
          </div>
        </section>

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
    <section className="border-y border-white/[0.04] bg-[#0a0a0a] py-28">
      <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/[0.05] px-4 py-1.5">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-amber-400">
            Offre limitée · {count} places restantes
          </span>
        </div>

        <h2 className="text-[40px] font-black tracking-tight text-white sm:text-[48px] mb-6">
          Devenez Fondateur NutriTwin
        </h2>

        <p className="text-[15px] leading-relaxed text-zinc-500 mb-10 max-w-xl mx-auto">
          Je cherche 10 nutritionnistes visionnaires pour co-construire NutriTwin.
          En échange de vos retours pendant 2 mois — accès au plan Professionnel au prix de l'Essentiel,{" "}
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
          className="inline-flex h-[52px] items-center justify-center rounded-full bg-white px-10 text-[15px] font-semibold text-black transition hover:bg-zinc-200 active:scale-95"
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
    <div className={`relative flex flex-col rounded-3xl p-8 transition-all ${
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
        <span className="text-[42px] font-black tracking-tight text-white">{price}</span>
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
