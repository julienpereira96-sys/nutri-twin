"use client";

import Link from "next/link";
import { useState } from "react";

const emerald = "#10b981";

export default function Home() {
  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-[#0a0a0a] text-white"
      style={{
        fontFamily:
          "var(--font-geist-sans), Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.18),transparent)]" />

      {/* Nav */}
      <header className="relative z-10 border-b border-white/[0.06]">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
              <span className="text-lg" aria-hidden>🍃</span>
            </div>
            <span className="text-lg font-bold tracking-tight">NutriTwin</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition hover:text-white sm:px-4"
            >
              Connexion
            </Link>
            <Link
              href="/signup"
              className="rounded-full px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400"
              style={{ backgroundColor: emerald }}
            >
              Essai gratuit
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10">

        {/* HERO */}
        <section className="mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-24 lg:px-8 lg:pt-32">
          <div className="mx-auto max-w-3xl text-center">
            <p
              className="mb-6 inline-flex rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wider ring-1"
              style={{
                backgroundColor: "rgba(16,185,129,0.08)",
                color: emerald,
                borderColor: `${emerald}33`,
              }}
            >
              Votre IA personnalisée pour nutritionnistes
            </p>

            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Votre expertise,<br />disponible 24h/24
            </h1>

            <p className="mt-8 text-xl font-medium leading-relaxed text-white sm:text-2xl">
              Parce que vos patients ont besoin de vous<br className="hidden sm:block" /> entre les séances aussi.
            </p>

            {/* Phrase forte mise en avant */}
            <div className="mx-auto mt-8 max-w-xl">
              <p
                className="text-base leading-relaxed sm:text-lg"
                style={{ color: emerald }}
              >
                Le suivi ne s'arrête pas à la porte du cabinet.<br />
                <span className="text-white">Votre expertise non plus.</span>
              </p>
            </div>

            <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-zinc-500 sm:text-base">
              NutriTwin crée votre jumeau numérique — vos patients reçoivent vos conseils,
              dans votre style, même quand vous n'êtes pas disponible.
            </p>

            <div className="mt-12 flex flex-col items-stretch gap-4 sm:flex-row sm:justify-center sm:gap-5">
              <Link
                href="/signup"
                className="inline-flex min-h-[52px] items-center justify-center rounded-full px-10 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                style={{ backgroundColor: emerald }}
              >
                14 jours gratuits — aucun engagement
              </Link>
              <a
                href="#demo"
                className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-10 text-sm font-medium text-white ring-1 ring-white/[0.08] backdrop-blur transition hover:bg-white/[0.08]"
              >
                Voir une conversation →
              </a>
            </div>
          </div>
        </section>

        {/* PROBLÈME */}
        <section className="border-y border-white/[0.06] bg-[#070707] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: emerald }}>
                Le quotidien de vos patients
              </p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Ce qui se passe entre deux séances
              </h2>
              <p className="mt-4 text-base text-zinc-400">
                Et ce que vous n'avez plus le temps de gérer.
              </p>
            </div>
            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: "💬",
                  title: "Le message du soir",
                  text: "Ils vous écrivent à 21h parce qu'ils ne savent pas quoi manger ce soir.",
                },
                {
                  icon: "🔁",
                  title: "Les mêmes questions",
                  text: "Ils posent les mêmes questions à chaque séance, faute de suivi entre les consultations.",
                },
                {
                  icon: "😔",
                  title: "Le craquage silencieux",
                  text: "Ils craquent, culpabilisent, et attendent la prochaine séance pour en parler.",
                },
              ].map((item) => (
                <article
                  key={item.title}
                  className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#121212]/80 p-7 ring-1 ring-white/[0.04] backdrop-blur-sm transition hover:border-emerald-500/20"
                >
                  <span className="mb-5 text-4xl">{item.icon}</span>
                  <h3 className="mb-2 text-base font-bold text-white">{item.title}</h3>
                  <p className="text-[15px] leading-relaxed text-zinc-400">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* SOLUTION */}
        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: emerald }}>
                La solution
              </p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                NutriTwin répond à votre place,<br />avec votre vision et votre expertise
              </h2>
              <p className="mt-4 text-base text-zinc-400">
                Pas un chatbot générique. Votre méthode, votre ton, vos protocoles —
                configurés une fois, actifs 24h/24.
              </p>
            </div>
            <div className="mx-auto mt-16 grid max-w-5xl gap-6 lg:grid-cols-3">
              <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-white/[0.02] px-6 py-10 text-center">
                <ClockIcon />
                <h3 className="mt-6 text-base font-bold text-white">
                  Libérez 3h par semaine
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                  Votre jumeau gère les questions récurrentes. Vous gardez votre
                  énergie pour ce qui compte vraiment.
                </p>
              </div>
              <div className="flex flex-col items-center rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-6 py-10 text-center ring-1 ring-emerald-500/15">
                <HeartIcon />
                <h3 className="mt-6 text-base font-bold text-white">
                  Un suivi qui ne s'interrompt plus
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                  Vos patients restent accompagnés entre les séances, avec
                  cohérence et bienveillance.
                </p>
              </div>
              <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-white/[0.02] px-6 py-10 text-center">
                <SparklesIcon />
                <h3 className="mt-6 text-base font-bold text-white">
                  Votre image, intacte
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                  Chaque réponse reflète votre approche. Vos patients ne voient
                  pas une IA — ils vous voient, vous.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* DEMO */}
        <section
          id="demo"
          className="border-y border-white/[0.06] bg-[#050505] py-20 sm:py-28"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: emerald }}>
                Démonstration
              </p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Comme si vous étiez là
              </h2>
              <p className="mt-4 text-base text-zinc-400">
                Une conversation réelle entre Thomas et le jumeau de sa nutritionniste.
              </p>
            </div>
            <div className="mx-auto mt-14 max-w-md">
              <div className="overflow-hidden rounded-[2rem] border border-white/[0.1] bg-[#1c1c1e] shadow-2xl shadow-black/50 ring-1 ring-white/[0.05]">
                <div className="flex items-center gap-3 border-b border-white/[0.08] bg-[#2c2c2e] px-4 py-3">
                  <div className="flex size-9 items-center justify-center rounded-full bg-emerald-500/20 text-base">
                    🌿
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Dr Sophie Martin · NutriTwin</p>
                    <p className="text-[10px]" style={{ color: emerald }}>● En ligne</p>
                  </div>
                </div>
                <div className="space-y-3 px-4 py-6 pb-8">
                  <p className="text-center text-[10px] text-zinc-500">Aujourd'hui 21h14</p>
                  <div className="flex justify-start">
                    <div className="max-w-[88%] rounded-[18px] rounded-bl-md bg-[#3a3a3c] px-3 py-2.5 text-[14px] leading-relaxed text-white">
                      Bonsoir... j'ai encore craqué sur des chips ce soir. Je me sens nul 😔
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div
                      className="max-w-[88%] rounded-[18px] rounded-br-md px-3 py-2.5 text-[14px] leading-relaxed text-black"
                      style={{ backgroundColor: emerald }}
                    >
                      Bonsoir Thomas. Un écart, ça arrive — et ça ne définit pas votre parcours. Dites-moi, vous aviez mangé quoi ce midi ?
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[88%] rounded-[18px] rounded-bl-md bg-[#3a3a3c] px-3 py-2.5 text-[14px] leading-relaxed text-white">
                      Pas grand chose, j'avais pas le temps. Un sandwich en vitesse.
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div
                      className="max-w-[88%] rounded-[18px] rounded-br-md px-3 py-2.5 text-[14px] leading-relaxed text-black"
                      style={{ backgroundColor: emerald }}
                    >
                      Voilà, tout s'explique. Un déjeuner insuffisant crée une vraie dette énergétique le soir. Ce n'est pas un manque de volonté — c'est de la biologie. Demain, on vise un déjeuner avec une vraie source de protéines. D'accord ?
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-[18px] rounded-bl-md bg-[#3a3a3c] px-3 py-2.5 text-[14px] leading-relaxed text-white">
                      Oui, merci. Ça me soulage d'avoir quelqu'un à qui écrire 💚
                    </div>
                  </div>
                  <div className="flex justify-center pt-2">
                    <span className="text-[11px] text-zinc-500">
                      Votre praticienne sera informée lors de votre prochaine séance
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TARIFS */}
        <section id="tarifs" className="py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: emerald }}>
                Tarifs
              </p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Un investissement qui se rembourse seul
              </h2>
              <p className="mt-4 text-base text-zinc-400">
                Sans engagement. Annulable à tout moment.
              </p>
            </div>
            <div className="mt-16 grid gap-6 lg:grid-cols-3 lg:gap-8">
              <PricingCard
                name="Essentiel"
                price="149€"
                description="Offrez une présence rassurante entre deux consultations à vos patients prioritaires."
                features={[
                  "Jusqu'à 10 patients",
                  "1 praticien",
                  "Fonctionnalités essentielles",
                  "Support par email",
                  "Sans engagement",
                ]}
                ctaHref="/signup"
              />
              <PricingCard
                name="Pro"
                price="249€"
                featured
                badge="Recommandé"
                description="L'offre de référence pour automatiser votre suivi et offrir votre expertise sans jamais sacrifier la qualité."
                features={[
                  "Jusqu'à 100 patients",
                  "1 praticien",
                  "Toutes les fonctionnalités",
                  "Support prioritaire",
                  "Sans engagement",
                ]}
                ctaHref="/signup"
              />
              <PricingCard
                name="Cabinet"
                price="499€"
                description="Passez à la vitesse supérieure avec un outil qui gère l'intégralité de votre patientèle en toute autonomie."
                features={[
                  "Patients illimités",
                  "3 praticiens inclus",
                  "+99€/praticien supplémentaire",
                  "Support dédié",
                  "Sans engagement",
                ]}
                ctaHref="/signup"
              />
            </div>
          </div>
        </section>

        {/* FONDATEURS */}
        <section className="border-t border-white/[0.06] bg-gradient-to-b from-emerald-500/[0.07] via-[#0a0a0a] to-[#0a0a0a] py-20 sm:py-28">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <p
              className="mb-4 inline-flex rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider ring-1"
              style={{
                backgroundColor: "rgba(16,185,129,0.12)",
                color: emerald,
                borderColor: `${emerald}55`,
              }}
            >
              Offre limitée aux 10 premiers
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Devenez Fondateur NutriTwin
            </h2>
            <p className="mt-6 text-base leading-relaxed text-zinc-300 sm:text-lg">
              Je cherche 10 nutritionnistes visionnaires pour co-construire NutriTwin.
              En échange de vos retours pendant 2 mois, vous accédez au plan Pro
              au prix de l'Essentiel —{" "}
              <strong className="text-white">149€/mois garanti à vie</strong>,
              patients illimités, votre nom dans l'histoire du produit.
            </p>
            <div className="mx-auto mt-10 max-w-sm">
              <FounderCounter />
            </div>
            <Link
              href="/signup"
              className="mt-10 inline-flex min-h-[52px] w-full items-center justify-center rounded-full px-10 text-base font-semibold text-black shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 sm:w-auto"
              style={{ backgroundColor: emerald }}
            >
              Je veux devenir Fondateur →
            </Link>
            <p className="mt-4 text-xs text-zinc-500">
              Aucun engagement — annulable à tout moment
            </p>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/[0.06] bg-[#050505] py-12 sm:py-14">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/25">
              <span className="text-lg">🍃</span>
            </div>
            <span className="text-lg font-bold">NutriTwin</span>
          </div>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-12">
            <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-zinc-400">
              <a href="#" className="transition hover:text-white">CGU</a>
              <a href="#" className="transition hover:text-white">Confidentialité</a>
            </nav>
            <p className="text-sm text-zinc-500">
              © {new Date().getFullYear()} NutriTwin. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FounderCounter() {
  const [count] = useState(7);
  const total = 10;
  const percentage = ((total - count) / total) * 100;

  return (
    <div
      className="rounded-2xl border p-6 text-left"
      style={{
        background: "rgba(16,185,129,0.06)",
        borderColor: `${emerald}33`,
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-300">Places restantes</span>
        <span className="text-3xl font-bold" style={{ color: emerald }}>{count}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percentage}%`, backgroundColor: emerald }}
        />
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        {total - count} praticien{total - count > 1 ? "s" : ""} ont déjà rejoint le programme
      </p>
    </div>
  );
}

function PricingCard(props: {
  name: string;
  price: string;
  featured?: boolean;
  badge?: string;
  description: string;
  features: string[];
  ctaHref: string;
}) {
  const { name, price, featured, badge, description, features, ctaHref } = props;
  const [hovered, setHovered] = useState(false);

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative flex flex-col rounded-3xl border p-8 transition-all duration-300 ${
        featured
          ? "border-emerald-500/40 bg-gradient-to-b from-emerald-500/[0.12] to-[#121212]/90 shadow-xl shadow-emerald-500/10 ring-2 ring-emerald-500/30 lg:scale-[1.02]"
          : hovered
          ? "border-emerald-500/30 bg-[#141414] ring-1 ring-emerald-500/20 shadow-lg shadow-emerald-500/5"
          : "border-white/[0.08] bg-[#121212]/60 ring-1 ring-white/[0.04]"
      }`}
    >
      {featured && badge ? (
        <span
          className="absolute right-6 top-6 rounded-full px-3 py-1 text-xs font-semibold text-black"
          style={{ backgroundColor: emerald }}
        >
          {badge}
        </span>
      ) : null}
      <h3 className="text-xl font-bold">{name}</h3>
      <div className="mt-6 flex flex-wrap items-baseline gap-1">
        <span className="text-4xl font-bold tracking-tight">{price}</span>
        <span className="text-base text-zinc-400">/mois</span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">{description}</p>
      <ul className="mt-6 flex flex-1 flex-col gap-3 text-[14px] text-zinc-300">
        {features.map((f) => (
          <li key={f} className="flex gap-3 leading-snug">
            <svg className="mt-0.5 size-5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-6 shrink-0">
        <span
          className="inline-flex rounded-full px-4 py-1.5 text-xs font-semibold text-black"
          style={{ backgroundColor: emerald }}
        >
          14 jours gratuits
        </span>
      </div>
      <Link
        href={ctaHref}
        className={`mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl text-sm font-semibold transition ${
          featured
            ? "text-black hover:bg-emerald-400"
            : "border border-white/15 bg-white/[0.05] text-white hover:bg-white/10"
        }`}
        style={featured ? { backgroundColor: emerald } : {}}
      >
        Commencer l'essai
      </Link>
    </article>
  );
}

function ClockIcon() {
  return (
    <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
      <svg className="size-7 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    </div>
  );
}

function HeartIcon() {
  return (
    <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
      <svg className="size-7 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
      </svg>
    </div>
  );
}

function SparklesIcon() {
  return (
    <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
      <svg className="size-7 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423L16.5 15.75l.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
      </svg>
    </div>
  );
}
