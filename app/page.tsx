"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

const emerald = "#10b981";

export default function Home() {
  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-[#080808] text-white"
      style={{ fontFamily: "var(--font-geist-sans), Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Gradient ambiant */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-emerald-500/[0.06] blur-[120px]" />
        <div className="absolute top-1/3 -left-40 h-[500px] w-[500px] rounded-full bg-emerald-500/[0.04] blur-[100px]" />
        <div className="absolute top-2/3 -right-40 h-[500px] w-[500px] rounded-full bg-emerald-500/[0.04] blur-[100px]" />
      </div>

      {/* Nav */}
      <header className="relative z-50 border-b border-white/[0.04] bg-[#080808]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/25">
              <span className="text-base">🍃</span>
            </div>
            <span className="text-base font-semibold tracking-tight text-white">NutriTwin</span>
          </div>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#probleme" className="text-sm text-zinc-400 transition hover:text-white">Pourquoi</a>
            <a href="#solution" className="text-sm text-zinc-400 transition hover:text-white">Solution</a>
            <a href="#demo" className="text-sm text-zinc-400 transition hover:text-white">Démo</a>
            <a href="#tarifs" className="text-sm text-zinc-400 transition hover:text-white">Tarifs</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-zinc-400 transition hover:text-white">
              Connexion
            </Link>
            <a
              href="#tarifs"
              className="rounded-full px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
              style={{ backgroundColor: emerald }}
            >
              Essai gratuit
            </a>
          </div>
        </div>
      </header>

      <main className="relative z-10">

        {/* HERO */}
        <section className="relative mx-auto max-w-7xl px-6 pb-24 pt-28 lg:px-8 lg:pt-36">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400 tracking-wide">Jumeau numérique pour nutritionnistes</span>
            </div>

            <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Le suivi ne s'arrête pas{" "}
              <span className="relative">
                <span className="relative z-10" style={{ color: emerald }}>à la porte du cabinet.</span>
              </span>
              <br />
              <span className="text-zinc-300">Votre expertise non plus.</span>
            </h1>

            <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-zinc-400">
              Parce que vos patients ont besoin de vous entre les séances.
            </p>

            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-500">
              NutriTwin crée votre jumeau numérique — une IA entraînée sur vos méthodes qui conseille vos patients,
              avec votre style, même quand vous n'êtes pas disponible.
            </p>

            <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-4">
              <a
                href="#tarifs"
                className="group relative inline-flex min-h-[52px] items-center justify-center overflow-hidden rounded-full px-8 text-[15px] font-semibold text-black transition-all"
                style={{ backgroundColor: emerald }}
              >
                <span className="relative z-10">Créer mon jumeau numérique</span>
                <div className="absolute inset-0 translate-y-full bg-emerald-400 transition-transform duration-300 group-hover:translate-y-0" />
              </a>
              <a
                href="#demo"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-8 text-[15px] text-zinc-300 backdrop-blur transition hover:border-white/20 hover:text-white"
              >
                Voir la démo
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
            </div>

            <p className="mt-5 text-xs text-zinc-600">
              14 jours gratuits · Aucun engagement · Annulable à tout moment
            </p>
          </div>

          {/* Dashboard mockup */}
          <div className="relative mt-20 mx-auto max-w-5xl">
            <div className="absolute -inset-x-20 -top-10 -bottom-10 bg-gradient-to-b from-transparent via-emerald-500/[0.04] to-transparent blur-3xl" />
            <div className="relative rounded-2xl border border-white/[0.08] bg-[#0f0f0f] p-2 shadow-2xl shadow-black/50 ring-1 ring-white/[0.04]">
              {/* MacBook top bar */}
              <div className="flex items-center gap-2 rounded-t-xl bg-[#161616] px-4 py-3 border-b border-white/[0.06]">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
                  <div className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
                  <div className="h-3 w-3 rounded-full bg-[#28CA41]" />
                </div>
                <div className="mx-auto flex items-center gap-2 rounded-md bg-[#1a1a1a] px-4 py-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[11px] text-zinc-500">nutri-twin.vercel.app/dashboard</span>
                </div>
              </div>
              {/* Dashboard preview */}
              <div className="grid grid-cols-[220px_1fr_200px] gap-0 rounded-b-xl overflow-hidden" style={{ minHeight: 420 }}>
                {/* Sidebar */}
                <div className="bg-[#111111] border-r border-white/[0.06] p-3">
                  <div className="mb-3 flex items-center gap-2 px-2 py-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20">
                      <span className="text-sm">🍃</span>
                    </div>
                    <span className="text-xs font-semibold text-zinc-300">Mes patients</span>
                  </div>
                  {[
                    { name: "Sophie M.", msg: "J'ai encore craqué ce soir...", time: "21:14", active: true },
                    { name: "Thomas R.", msg: "Que manger avant le sport ?", time: "18:30", active: false },
                    { name: "Julie P.", msg: "Merci pour les conseils !", time: "Hier", active: false },
                    { name: "Marc D.", msg: "Je me sens mieux cette semaine", time: "Lun", active: false },
                  ].map((p, i) => (
                    <div key={i} className={`mb-1.5 rounded-xl p-2.5 ${p.active ? "bg-emerald-500/10 border border-emerald-500/20" : "hover:bg-white/[0.03]"}`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-xs font-semibold ${p.active ? "text-emerald-400" : "text-zinc-300"}`}>{p.name}</span>
                        <span className="text-[10px] text-zinc-600">{p.time}</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 truncate">{p.msg}</p>
                    </div>
                  ))}
                  <div className="mt-3 rounded-full bg-emerald-500 py-2 text-center text-[11px] font-semibold text-black">
                    + Inviter un patient
                  </div>
                </div>
                {/* Conversation */}
                <div className="bg-[#0d0d0d] flex flex-col">
                  <div className="border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Sophie M.</p>
                      <p className="text-[11px] text-zinc-500">sophie@email.fr</p>
                    </div>
                    <div className="rounded-full border border-emerald-500/30 px-3 py-1 text-[11px] font-semibold text-emerald-400">
                      📊 Rapport IA
                    </div>
                  </div>
                  <div className="flex-1 p-4 space-y-3">
                    <div className="flex justify-start">
                      <div className="max-w-[75%] rounded-2xl rounded-bl-md bg-[#1e1e1e] px-3 py-2.5">
                        <p className="text-[12px] text-zinc-200 leading-relaxed">Bonsoir... j'ai encore craqué sur des chips ce soir. Je me sens nulle 😔</p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="max-w-[75%] rounded-2xl rounded-br-md px-3 py-2.5" style={{ backgroundColor: emerald }}>
                        <p className="text-[12px] text-black leading-relaxed">Bonsoir Sophie. Un écart, ça arrive — et ça ne définit pas votre parcours. Dites-moi, vous aviez mangé quoi ce midi ?</p>
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="max-w-[75%] rounded-2xl rounded-bl-md bg-[#1e1e1e] px-3 py-2.5">
                        <p className="text-[12px] text-zinc-200 leading-relaxed">Pas grand chose... un sandwich en vitesse.</p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="max-w-[75%] rounded-2xl rounded-br-md px-3 py-2.5" style={{ backgroundColor: emerald }}>
                        <p className="text-[12px] text-black leading-relaxed">Voilà, tout s'explique. Ce n'est pas un manque de volonté — c'est de la biologie. Demain, on vise un vrai déjeuner. D'accord ?</p>
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
                {/* Fiche patient */}
                <div className="bg-[#111111] border-l border-white/[0.06] p-3">
                  <div className="flex flex-col items-center text-center mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white mb-2">SM</div>
                    <p className="text-xs font-semibold text-white">Sophie M.</p>
                    <p className="text-[10px] text-zinc-500">sophie@email.fr</p>
                  </div>
                  <div className="space-y-2 rounded-xl bg-[#161616] p-2.5 mb-3">
                    {[
                      { label: "Âge", value: "34 ans" },
                      { label: "Objectif", value: "Perte de poids" },
                      { label: "Messages", value: "47" },
                    ].map((item, i) => (
                      <div key={i}>
                        <p className="text-[10px] text-zinc-600">{item.label}</p>
                        <p className="text-[11px] text-zinc-300">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5">
                    <p className="text-[10px] text-zinc-400 mb-1">📊 Générer rapport journal</p>
                    <div className="h-1.5 w-full rounded-full bg-white/[0.05]">
                      <div className="h-1.5 w-3/4 rounded-full bg-emerald-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Glow */}
            <div className="absolute -bottom-8 left-1/2 h-32 w-96 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
          </div>
        </section>

        {/* PROBLÈME */}
        <section id="probleme" className="py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-500">Le quotidien de vos patients</p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-white">
                Ce qui se passe entre deux séances
              </h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 max-w-4xl mx-auto">
              <div className="group relative rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[#111111] to-[#0d0d0d] p-8 transition-all hover:border-white/[0.12]">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 ring-1 ring-orange-500/20">
                  <span className="text-2xl">🌙</span>
                </div>
                <h3 className="mb-3 text-lg font-bold text-white">Le silence entre deux séances</h3>
                <p className="text-[15px] leading-relaxed text-zinc-400">
                  Entre deux rendez-vous, votre patient est seul face à ses doutes. Il hésite, il cherche, il craque. Sans réponse, il lâche prise.
                </p>
              </div>
              <div className="group relative rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[#111111] to-[#0d0d0d] p-8 transition-all hover:border-white/[0.12]">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 ring-1 ring-red-500/20">
                  <span className="text-2xl">😔</span>
                </div>
                <h3 className="mb-3 text-lg font-bold text-white">Un patient sans réponse lâche prise</h3>
                <p className="text-[15px] leading-relaxed text-zinc-400">
                  Il craque, il culpabilise, il attend la prochaine séance pour en parler. Mais parfois, il ne revient plus.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SOLUTION */}
        <section id="solution" className="border-y border-white/[0.04] bg-[#060606] py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-500">La solution</p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-white">
                NutriTwin répond à votre place,<br />avec votre vision et votre expertise
              </h2>
              <p className="mt-4 text-base text-zinc-400">
                Pas un chatbot générique. Votre méthode, votre ton, vos protocoles — configurés une fois, actifs 24h/24.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-3 max-w-5xl mx-auto">
              {[
                {
                  icon: "🔄",
                  color: "emerald",
                  title: "Un suivi qui ne s'interrompt plus",
                  desc: "Vos patients restent accompagnés entre les séances, avec cohérence et bienveillance.",
                  featured: true,
                },
                {
                  icon: "🪞",
                  color: "blue",
                  title: "Votre image, intacte",
                  desc: "Chaque réponse reflète votre approche. Vos patients ne voient pas une IA — ils vous voient, vous.",
                  featured: false,
                },
                {
                  icon: "⚡",
                  color: "violet",
                  title: "Votre énergie pour ce qui compte",
                  desc: "Les questions du quotidien ? Votre jumeau les gère. Vous restez concentré sur ce que seul un humain peut faire.",
                  featured: false,
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`relative flex flex-col rounded-2xl p-8 ${
                    item.featured
                      ? "border border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.08] to-emerald-500/[0.02]"
                      : "border border-white/[0.06] bg-[#0f0f0f]"
                  }`}
                >
                  {item.featured && (
                    <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
                  )}
                  <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${
                    item.featured ? "bg-emerald-500/15 ring-1 ring-emerald-500/30" : "bg-white/[0.04] ring-1 ring-white/[0.08]"
                  }`}>
                    <span className="text-2xl">{item.icon}</span>
                  </div>
                  <h3 className="mb-3 text-base font-bold text-white">{item.title}</h3>
                  <p className="text-[14px] leading-relaxed text-zinc-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* DEMO */}
        <section id="demo" className="py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-500">Démonstration</p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-white">Comme si vous étiez là</h2>
              <p className="mt-4 text-base text-zinc-400">
                21h14. Thomas Moreau, nutritionniste, n'est plus disponible.<br />Son jumeau, lui, répond.
              </p>
            </div>

            <div className="mx-auto max-w-sm">
              <div className="overflow-hidden rounded-[2.5rem] border border-white/[0.08] bg-[#0f0f0f] shadow-2xl shadow-black/60 ring-1 ring-white/[0.04]">
                <div className="flex items-center gap-3 border-b border-white/[0.06] bg-[#141414] px-5 py-4">
                  <div className="relative">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-base font-bold text-black">TM</div>
                    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#141414] bg-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Thomas Moreau · NutriTwin</p>
                    <p className="text-[11px] text-emerald-400">● En ligne · Répond instantanément</p>
                  </div>
                </div>

                <div className="space-y-3 px-4 py-6">
                  <p className="text-center text-[10px] text-zinc-600">Aujourd'hui · 21h14</p>

                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-[18px] rounded-bl-md bg-[#1e1e1e] px-4 py-3 text-[14px] leading-relaxed text-zinc-200">
                      Bonsoir... j'ai encore craqué sur des chips. Je me sens nulle 😔
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-[18px] rounded-br-md px-4 py-3 text-[14px] leading-relaxed text-black" style={{ backgroundColor: emerald }}>
                      Bonsoir Sophie. Un écart, ça arrive — et ça ne définit pas votre parcours. Vous aviez mangé quoi ce midi ?
                    </div>
                  </div>

                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-[18px] rounded-bl-md bg-[#1e1e1e] px-4 py-3 text-[14px] leading-relaxed text-zinc-200">
                      Pas grand chose. Un sandwich en vitesse entre deux réunions.
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-[18px] rounded-br-md px-4 py-3 text-[14px] leading-relaxed text-black" style={{ backgroundColor: emerald }}>
                      Voilà, tout s'explique. Ce n'est pas de la faiblesse — c'est de la biologie. Demain, on vise un vrai déjeuner avec des protéines. D'accord ?
                    </div>
                  </div>

                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-[18px] rounded-bl-md bg-[#1e1e1e] px-4 py-3 text-[14px] leading-relaxed text-zinc-200">
                      Oui. Merci, ça me soulage d'avoir quelqu'un à qui écrire 💚
                    </div>
                  </div>

                  <div className="flex justify-center pt-1">
                    <span className="text-[10px] text-zinc-600">Thomas sera informé lors de votre prochaine séance</span>
                  </div>
                </div>

                <div className="border-t border-white/[0.06] px-4 py-3">
                  <div className="flex items-center gap-2 rounded-2xl bg-[#1a1a1a] px-4 py-2.5">
                    <span className="flex-1 text-[13px] text-zinc-600">Écrire un message...</span>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: emerald }}>
                      <svg className="size-3.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TARIFS */}
        <section id="tarifs" className="border-t border-white/[0.04] bg-[#060606] py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center mb-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-500">Tarifs</p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-white">
                Commencez gratuitement
              </h2>
            </div>
            <div className="mx-auto mb-12 max-w-lg text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-5 py-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-medium text-emerald-400">14 jours gratuits · Sans engagement · Annulable à tout moment</span>
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
                  "Jumeau basé sur vos 31 réponses",
                  "Chat patient 24h/24",
                  "Journal de bord patient",
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
                  "Jumeau basé sur vos 31 réponses",
                  "Upload de documents, protocoles, guides",
                  "Fidélité maximale du jumeau",
                  "Rapport IA mensuel par patient",
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
                  "Upload de documents illimité",
                  "Rapport IA mensuel par patient",
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
      <footer className="relative z-10 border-t border-white/[0.04] bg-[#050505] py-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/25">
              <span className="text-base">🍃</span>
            </div>
            <span className="text-sm font-semibold text-white">NutriTwin</span>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-zinc-500">
            <Link href="/cgu" className="transition hover:text-white">CGU</Link>
            <Link href="/confidentialite" className="transition hover:text-white">Confidentialité</Link>
            <Link href="/login" className="transition hover:text-white">Espace praticien</Link>
          </nav>
          <p className="text-sm text-zinc-600">© {new Date().getFullYear()} NutriTwin</p>
        </div>
      </footer>
    </div>
  );
}

function FounderSection() {
  const [count, setCount] = useState(10);

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
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/[0.06] px-4 py-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-medium text-amber-400">Offre limitée · {count} places restantes</span>
        </div>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-white mb-6">
          Devenez Fondateur NutriTwin
        </h2>
        <p className="text-base leading-relaxed text-zinc-400 mb-10">
          Je cherche 10 nutritionnistes visionnaires pour co-construire NutriTwin.
          En échange de vos retours pendant 2 mois, vous accédez au plan Pro
          au prix de l'Essentiel —{" "}
          <strong className="text-white">149€/mois garanti à vie</strong>,
          patients illimités, votre nom dans l'histoire du produit.
        </p>

        {/* Barre progression */}
        <div className="mx-auto mb-10 max-w-xs">
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
            <span>{10 - count} fondateurs ont rejoint</span>
            <span>{count} places restantes</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/[0.06]">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
              style={{ width: `${((10 - count) / 10) * 100}%` }}
            />
          </div>
        </div>

        <Link
          href="/signup?plan=fondateur"
          className="inline-flex min-h-[52px] items-center justify-center rounded-full px-10 text-base font-semibold text-black transition hover:opacity-90"
          style={{ backgroundColor: emerald }}
        >
          Je veux devenir Fondateur →
        </Link>
        <p className="mt-4 text-xs text-zinc-600">Aucun engagement — annulable à tout moment</p>
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
    <div className={`relative flex flex-col rounded-2xl p-8 ${
      featured
        ? "border border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.08] to-[#0a0a0a]"
        : "border border-white/[0.06] bg-[#0f0f0f]"
    }`}>
      {featured && (
        <>
          <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="rounded-full px-3 py-1 text-xs font-semibold text-black" style={{ backgroundColor: emerald }}>
              {badge}
            </span>
          </div>
        </>
      )}

      <div className="mb-1">
        <p className="text-sm font-semibold text-zinc-300">{name}</p>
      </div>

      <div className="mb-4 flex items-baseline gap-1">
        <span className="text-4xl font-bold tracking-tight text-white">{price}</span>
        <span className="text-sm text-zinc-500">/mois</span>
      </div>

      <p className="mb-6 text-[13px] leading-relaxed text-zinc-500">{description}</p>

      <ul className="mb-8 flex flex-1 flex-col gap-3">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <svg className="mt-0.5 size-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            <span className="text-[13px] text-zinc-300 leading-snug">{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href={`/signup?plan=${plan}`}
        className={`inline-flex min-h-[44px] w-full items-center justify-center rounded-xl text-sm font-semibold transition ${
          featured
            ? "text-black hover:opacity-90"
            : "border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
        }`}
        style={featured ? { backgroundColor: emerald } : {}}
      >
        Commencer l'essai gratuit
      </Link>
    </div>
  );
}
