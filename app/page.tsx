import Link from "next/link";

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
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.18),transparent)]" />

      {/* Nav */}
      <header className="relative z-10 border-b border-white/[0.06]">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
              <span className="text-lg" aria-hidden>
                🍃
              </span>
            </div>
            <span className="text-lg font-bold tracking-tight">NutriTwin</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              href="/chat"
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition hover:text-white sm:px-4"
            >
              Démo chat
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        {/* HERO */}
        <section className="mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16 lg:px-8 lg:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <p
              className="mb-4 inline-flex rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wider ring-1"
              style={{
                backgroundColor: "rgba(16,185,129,0.08)",
                color: emerald,
                borderColor: `${emerald}33`,
              }}
            >
              Jumeau IA pour nutritionnistes
            </p>
            <h1 className="text-[1.625rem] font-bold leading-[1.15] tracking-tight text-white sm:text-4xl sm:leading-[1.1] lg:text-[2.75rem]">
              Votre expertise, disponible 24h/24
            </h1>
            <p className="mt-6 text-base leading-relaxed text-zinc-400 sm:text-lg sm:leading-8">
              NutriTwin crée votre jumeau numérique IA. Vos patients reçoivent vos
              conseils personnalisés, même en dehors des consultations.
            </p>
            <div className="mt-10 flex flex-col items-stretch gap-4 sm:flex-row sm:justify-center sm:gap-5">
              <a
                href="#tarifs"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full px-8 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ backgroundColor: emerald }}
              >
                14 jours gratuits, sans carte bancaire
              </a>
              <a
                href="#demo"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-8 text-sm font-medium text-white ring-1 ring-white/[0.08] backdrop-blur transition hover:bg-white/[0.08]"
              >
                Voir une conversation
              </a>
            </div>
          </div>
        </section>

        {/* PROBLÈME */}
        <section className="border-y border-white/[0.06] bg-[#070707] py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="mx-auto max-w-3xl text-center text-2xl font-bold tracking-tight sm:text-3xl">
              Vous perdez du temps. Vos patients aussi.
            </h2>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3 lg:gap-6">
              {[
                "Appels et messages entre les séances qui débordent",
                "Questions répétitives qui monopolisent votre agenda",
                "Suivi impossible entre deux consultations",
              ].map((text) => (
                <article
                  key={text}
                  className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#121212]/80 p-6 ring-1 ring-white/[0.04] backdrop-blur-sm transition hover:border-emerald-500/20"
                >
                  <div className="mb-4 size-10 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20" />
                  <p className="text-[15px] leading-snug text-zinc-300">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* SOLUTION */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="mx-auto max-w-4xl text-center text-2xl font-bold tracking-tight sm:text-3xl lg:text-[1.75rem]">
              NutriTwin répond à votre place, avec votre voix et votre expertise
            </h2>
            <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-3">
              <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-white/[0.02] px-6 py-8 text-center">
                <ClockIcon />
                <h3 className="mt-5 text-[15px] font-semibold leading-snug text-white">
                  Libérez 3h par semaine
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Moins d’entrées dispersées, votre jumeau gère les questions
                  récurrentes.
                </p>
              </div>
              <div className="flex flex-col items-center rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-6 py-8 text-center ring-1 ring-emerald-500/15">
                <HeartIcon />
                <h3 className="mt-5 text-[15px] font-semibold leading-snug text-white">
                  Vos patients mieux suivis
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                  Un fil conducteur aligné avec votre méthode, entre deux
                  rendez-vous.
                </p>
              </div>
              <div className="flex flex-col items-center rounded-2xl border border-white/[0.08] bg-white/[0.02] px-6 py-8 text-center">
                <SparklesIcon />
                <h3 className="mt-5 text-[15px] font-semibold leading-snug text-white">
                  Une IA entraînée à votre image
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Ton et recommandations cohérents avec votre pratique.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* DEMO — style iMessage dark */}
        <section
          id="demo"
          className="border-y border-white/[0.06] bg-[#050505] py-16 sm:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Comme si vous étiez là
              </h2>
              <p className="mt-3 text-sm text-zinc-400 sm:text-base">
                Aperçu d’une conversation entre un patient et le jumeau de Dr
                Martin.
              </p>
            </div>
            <div className="mx-auto mt-10 max-w-md sm:mt-14">
              <div className="overflow-hidden rounded-[2rem] border border-white/[0.1] bg-[#1c1c1e] shadow-2xl shadow-black/50 ring-1 ring-white/[0.05]">
                <div className="flex items-center justify-center gap-1 border-b border-white/[0.08] bg-[#2c2c2e] px-4 py-2.5">
                  <div className="size-8 rounded-full bg-zinc-600" />
                  <div className="min-w-0 flex-1 text-center">
                    <p className="truncate text-xs font-semibold text-white">
                      Dr Martin · Jumeau NutriTwin
                    </p>
                    <p className="text-[10px] text-zinc-400">Vu il y a 2 min</p>
                  </div>
                </div>
                <div className="space-y-3 bg-[linear-gradient(#1c1c1e,#1c1c1e)] px-4 py-6 pb-8">
                  <p className="text-center text-[10px] text-zinc-500">
                    Hier 18h42
                  </p>

                  {/* Patient left */}
                  <div className="flex justify-start">
                    <div className="max-w-[88%] rounded-[18px] rounded-bl-md bg-[#3a3a3c] px-3 py-2.5 text-[15px] leading-snug text-white">
                      Bonjour Sophie, depuis mercredi j’angoisse un peu le dîner
                      quand je rentre tard. Une idée simple sans me casser la tête ?
                    </div>
                  </div>
                  {/* Twin right — iMessage-like green */}
                  <div className="flex justify-end">
                    <div
                      className="max-w-[88%] rounded-[18px] rounded-br-md px-3 py-2.5 text-[15px] leading-snug text-black"
                      style={{ backgroundColor: emerald }}
                    >
                      Salut Thomas, ravie que tu m’écrives. À la maison tard, tu
                      peux viser quelque chose de prêt vite et stable : omelette
                      avec des légumes déjà coupés ou un bon yaourt épais +
                      granola maison comme on avait défini ensemble. Ça évite les
                      allers-retours au frigo 😊 Tu veux qu’on calibre une portion ?
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[88%] rounded-[18px] rounded-bl-md bg-[#3a3a3c] px-3 py-2.5 text-[15px] leading-snug text-white">
                      Oui, et si je suis très fatigué ? Je craque souvent sur le pain.
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div
                      className="max-w-[88%] rounded-[18px] rounded-br-md px-3 py-2.5 text-[15px] leading-snug text-black"
                      style={{ backgroundColor: emerald }}
                    >
                      Quand tu es à plat, prépare avant la semaine un “plan B” sous
                      la bouche qui te rassasse : hummus + légumes, ou deux œufs
                      durs. Le pain n’est pas interdit mais on peut le prendre après
                      la prot/fibres comme on s’est dit au cabinet. Ça aide la
                      satiété avant le grignotage.
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-[18px] rounded-bl-md bg-[#3a3a3c] px-3 py-2.5 text-[15px] leading-snug text-white">
                      Ok ça roule merci 💚
                    </div>
                  </div>
                  <div className="flex justify-center pt-2">
                    <span className="text-[11px] text-zinc-500">
                      Nutritional guidance — votre praticienne est informée
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TARIFS */}
        <section id="tarifs" className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
              Simple et transparent
            </h2>
            <div className="mt-12 grid gap-6 lg:mt-14 lg:grid-cols-3 lg:gap-8">
              <PricingCard
                name="Starter"
                price="149€"
                features={[
                  "Jusqu’à 30 patients",
                  "1 praticien",
                  "Fonctionnalités essentielles",
                ]}
              />
              <PricingCard
                name="Pro"
                price="249€"
                featured
                badge="Populaire"
                features={[
                  "Patients illimités",
                  "1 praticien",
                  "Toutes les fonctionnalités",
                  "Support par email",
                ]}
              />
              <PricingCard
                name="Cabinet"
                price="499€"
                features={[
                  "Patients illimités",
                  "Jusqu’à 5 praticiens",
                  "Support prioritaire",
                ]}
              />
            </div>
          </div>
        </section>

        {/* FONDATEURS */}
        <section className="border-t border-white/[0.06] bg-gradient-to-b from-emerald-500/[0.07] via-[#0a0a0a] to-[#0a0a0a] py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Programme Fondateurs
            </h2>
            <p className="mt-6 text-[15px] leading-relaxed text-zinc-300">
              Je cherche 15 nutritionnistes visionnaires pour co-construire
              NutriTwin. En échange de vos retours, vous devenez Fondateurs :
              149€/mois garanti à vie, patients illimités, votre nom dans
              l’histoire du produit.
            </p>
            <p
              className="mx-auto mt-8 inline-flex items-center rounded-full px-6 py-2 text-sm font-bold ring-2"
              style={{
                backgroundColor: "rgba(16,185,129,0.12)",
                color: emerald,
                borderColor: `${emerald}55`,
              }}
            >
              12 places restantes
            </p>
            <a
              href="#tarifs"
              className="mt-10 inline-flex min-h-[52px] w-full items-center justify-center rounded-full px-8 text-base font-semibold text-black shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 sm:inline-flex sm:w-auto"
              style={{ backgroundColor: emerald }}
            >
              Je veux devenir Fondateur
            </a>
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
              <a href="#" className="transition hover:text-white">
                CGU
              </a>
              <a href="#" className="transition hover:text-white">
                Confidentialité
              </a>
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

function PricingCard(props: {
  name: string;
  price: string;
  featured?: boolean;
  badge?: string;
  features: string[];
}) {
  const { name, price, featured, badge, features } = props;

  return (
    <article
      className={`relative flex flex-col rounded-3xl border p-8 ${
        featured
          ? "border-emerald-500/40 bg-gradient-to-b from-emerald-500/[0.12] to-[#121212]/90 shadow-xl shadow-emerald-500/10 ring-2 ring-emerald-500/30 lg:scale-[1.02]"
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
      <ul className="mt-8 flex flex-1 flex-col gap-4 text-[15px] text-zinc-300">
        {features.map((f) => (
          <li key={f} className="flex gap-3 leading-snug">
            <svg
              className="mt-0.5 size-5 shrink-0 text-emerald-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m4.5 12.75 6 6 9-13.5"
              />
            </svg>
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-8 shrink-0">
        <span
          className="inline-flex rounded-full px-4 py-1.5 text-xs font-semibold text-black"
          style={{ backgroundColor: emerald }}
        >
          14 jours gratuits
        </span>
      </div>
      <a
        href="#"
        className={`mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
          featured
            ? "text-black hover:bg-emerald-400"
            : "border border-white/15 bg-white/[0.05] text-white hover:bg-white/10"
        }`}
        style={featured ? { backgroundColor: emerald } : {}}
      >
        Commencer l’essai
      </a>
    </article>
  );
}

function ClockIcon() {
  return (
    <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
      <svg
        className="size-7 text-emerald-500"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.75}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
      </svg>
    </div>
  );
}

function HeartIcon() {
  return (
    <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
      <svg
        className="size-7 text-emerald-500"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.75}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
        />
      </svg>
    </div>
  );
}

function SparklesIcon() {
  return (
    <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
      <svg
        className="size-7 text-emerald-500"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.75}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423L16.5 15.75l.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
        />
      </svg>
    </div>
  );
}