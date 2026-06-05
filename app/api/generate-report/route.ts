import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

const MOTIVATION_LABELS: Record<string, string> = {
  abloc: "Très motivé(e) en ce moment",
  progres: "Voir des progrès concrets",
  sante: "Améliorer ma santé",
  poids: "Atteindre mon poids de forme",
  energie: "Avoir plus d'énergie",
  autre: "Autre raison personnelle",
};

const OBJECTIVE_LABELS: Record<string, string> = {
  perte: "Perte de poids",
  maintien: "Maintien du poids",
  prise: "Prise de masse",
  equilibre: "Rééquilibrage alimentaire",
  tca: "Troubles du comportement alimentaire",
  performance: "Performance sportive",
  autre: "Autre objectif",
};

const DEFI_LABELS: Record<string, string> = {
  grignotage: "Grignotage / compulsions",
  stress: "Alimentation émotionnelle / stress",
  temps: "Manque de temps pour cuisiner",
  motivation: "Manque de motivation",
  connaissance: "Manque de connaissances nutritionnelles",
  sociaux: "Repas sociaux difficiles à gérer",
  autre: "Autre défi",
};

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const { patientId, practitionerId, dateFrom, dateTo } = await request.json() as {
      patientId: string;
      practitionerId: string;
      dateFrom: string;
      dateTo: string;
    };

    if (!patientId || !practitionerId || !dateFrom || !dateTo) {
      return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
    }

    if (user.id !== practitionerId) return forbidden();

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const [
      { data: chatMessages },
      { data: patient },
      { data: sosEvents },
    ] = await Promise.all([
      supabase
        .from("conversations")
        .select("role, content, created_at")
        .eq("patient_id", patientId)
        .eq("practitioner_id", practitionerId)
        .gte("created_at", `${dateFrom}T00:00:00`)
        .lte("created_at", `${dateTo}T23:59:59`)
        .order("created_at", { ascending: true }),
      supabase
        .from("patients")
        .select(`
          first_name, last_name, age, pathologies,
          objective, objectif_clinique,
          motivation, defi,
          alimentation_actuelle, habitudes_alimentaires,
          restrictions_alimentaires, allergies,
          activite_physique, niveau_stress,
          rythme_de_vie, sommeil,
          rapport_corps, rapport_alimentation,
          historique_regime, contexte_social,
          objectif_poids_actuel, objectif_poids_cible,
          objectif_delai, onboarding_answers
        `)
        .eq("user_id", patientId)
        .single(),
      // SOS events for the period
      supabase
        .from("sos_feedback")
        .select("tool_id, stress_before, stress_after, created_at")
        .eq("patient_id", patientId)
        .gte("created_at", `${dateFrom}T00:00:00`)
        .lte("created_at", `${dateTo}T23:59:59`)
        .order("created_at", { ascending: true }),
    ]);

    const firstName = (patient as { first_name?: string } | null)?.first_name ?? "le patient";
    const patientMessages = (chatMessages ?? []).filter((m: { role: string }) => m.role === "user");
    const messageCount = patientMessages.length;

    // Check minimum data
    if (messageCount < 5) {
      return NextResponse.json({
        lowData: true,
        message: `${firstName} n'a que peu d'activité sur cette période (${messageCount} message${messageCount > 1 ? "s" : ""} de chat). Il n'y a pas encore suffisamment de données pour générer un rapport pertinent. Essayez une période plus longue ou revenez après quelques échanges supplémentaires.`,
      });
    }

    // ── Build onboarding profile ──
    const p = patient as Record<string, unknown> | null;
    const motivationRaw = (p?.motivation as string) ?? "";
    const objectiveRaw = (p?.objective as string) ?? "";
    const defiRaw = (p?.defi as string) ?? "";

    const profileLines: string[] = [];
    if (p?.age) profileLines.push(`Âge : ${p.age as number} ans`);
    if (p?.pathologies) profileLines.push(`Pathologies : ${p.pathologies as string}`);
    if (p?.objectif_clinique) profileLines.push(`Objectif clinique (praticien) : ${p.objectif_clinique as string}`);
    if (objectiveRaw) profileLines.push(`Objectif personnel : ${OBJECTIVE_LABELS[objectiveRaw] ?? objectiveRaw}`);
    if (motivationRaw) profileLines.push(`Niveau de motivation : ${MOTIVATION_LABELS[motivationRaw] ?? motivationRaw}`);
    if (defiRaw) profileLines.push(`Principal défi : ${DEFI_LABELS[defiRaw] ?? defiRaw}`);
    if (p?.alimentation_actuelle) profileLines.push(`Alimentation actuelle : ${p.alimentation_actuelle as string}`);
    if (p?.habitudes_alimentaires) profileLines.push(`Habitudes alimentaires : ${p.habitudes_alimentaires as string}`);
    if (p?.restrictions_alimentaires) profileLines.push(`Restrictions / allergies : ${p.restrictions_alimentaires as string}`);
    if (p?.activite_physique) profileLines.push(`Activité physique : ${p.activite_physique as string}`);
    if (p?.niveau_stress) profileLines.push(`Niveau de stress habituel : ${p.niveau_stress as string}`);
    if (p?.sommeil) profileLines.push(`Qualité du sommeil : ${p.sommeil as string}`);
    if (p?.rapport_corps) profileLines.push(`Rapport au corps : ${p.rapport_corps as string}`);
    if (p?.rapport_alimentation) profileLines.push(`Rapport à l'alimentation : ${p.rapport_alimentation as string}`);
    if (p?.historique_regime) profileLines.push(`Historique régimes : ${p.historique_regime as string}`);
    if (p?.contexte_social) profileLines.push(`Contexte social : ${p.contexte_social as string}`);
    if (p?.objectif_poids_actuel && p?.objectif_poids_cible) profileLines.push(`Poids actuel → cible : ${p.objectif_poids_actuel as string} kg → ${p.objectif_poids_cible as string} kg${p.objectif_delai ? ` (horizon : ${p.objectif_delai as string})` : ""}`);

    // Additional onboarding Q&A answers
    const onboardingAnswers = (p?.onboarding_answers as Record<string, string> | null) ?? {};
    const answersLines = Object.entries(onboardingAnswers)
      .filter(([, v]) => v)
      .map(([k, v]) => `  • ${k} : ${v}`)
      .join("\n");

    const profileSection = profileLines.length > 0
      ? `PROFIL PATIENT (onboarding complet) :\n${profileLines.map(l => `- ${l}`).join("\n")}${answersLines ? `\n- Questions complémentaires :\n${answersLines}` : ""}`
      : "";

    // ── Build SOS stats ──
    const events = (sosEvents ?? []) as { tool_id: string; stress_before: number | null; stress_after: number | null }[];
    let sosSection = "";
    if (events.length > 0) {
      const withFeedback = events.filter(e => e.stress_before != null && e.stress_after != null);
      const apaises = withFeedback.filter(e => (e.stress_after ?? 0) >= 6).length;
      const persistants = withFeedback.length - apaises;
      const avgDelta = withFeedback.length > 0
        ? (withFeedback.reduce((s, e) => s + ((e.stress_after ?? 0) - (e.stress_before ?? 0)), 0) / withFeedback.length).toFixed(1)
        : null;
      const toolCounts: Record<string, number> = {};
      events.forEach(e => { toolCounts[e.tool_id] = (toolCounts[e.tool_id] ?? 0) + 1; });
      const topTools = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t} (${c}x)`).join(", ");

      sosSection = `DONNÉES SOS / CRISES (période du ${dateFrom} au ${dateTo}) :
- Volume : ${events.length} déclenchement${events.length > 1 ? "s" : ""} SOS
- Outils utilisés : ${topTools || "non renseigné"}
${withFeedback.length > 0 ? `- Crises apaisées (score après ≥ 6) : ${apaises} / ${withFeedback.length}
- Crises persistantes (score après < 6) : ${persistants} / ${withFeedback.length}
- Évolution stress moyenne : ${avgDelta !== null ? (Number(avgDelta) >= 0 ? `+${avgDelta}` : avgDelta) : "n/a"} points (négatif = réduction du stress)` : "- Aucun feedback recueilli"}`;
    }

    // ── Build chat section ──
    const chatSection = messageCount > 0
      ? `CONVERSATIONS PATIENT (${messageCount} messages, période du ${dateFrom} au ${dateTo}) :
${patientMessages.slice(-30).map((m: { content: string }) => `- ${(m.content as string).slice(0, 200)}`).join("\n")}`
      : "";

    const prompt = `Tu es l'assistant d'un nutritionniste. Génère un compte rendu professionnel pour ${firstName} sur la période du ${dateFrom} au ${dateTo}.

${profileSection ? `${profileSection}\n\n` : ""}${sosSection ? `${sosSection}\n\n` : ""}${chatSection ? `${chatSection}\n\n` : ""}Génère EXACTEMENT les 4 sections suivantes, basées UNIQUEMENT sur les données fournies. N'invente aucune information. Si une section n'a pas de données suffisantes, dis-le honnêtement en une phrase.

- synthese : Vue d'ensemble de la période (2-3 phrases). Ton clinique et factuel.
- patterns : Patterns comportementaux ou émotionnels observés dans les données (2-4 phrases). Ne cite que ce qui est documenté.
- victoires : Points positifs et progrès concrets constatés sur la période (1-3 phrases). Si aucun n'est visible dans les données, dis-le simplement.
- murmures_bilan : Points à approfondir lors de la prochaine consultation, basés sur les signaux observés (2-4 phrases). Intègre les données SOS si présentes.

Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks :
{"synthese": "...", "patterns": "...", "victoires": "...", "murmures_bilan": "..."}`;

    let report: { synthese: string; patterns: string; victoires: string; murmures_bilan: string };
    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-3-flash-preview",
        generationConfig: { maxOutputTokens: 1000, temperature: 0.5 },
      });
      const result = await model.generateContent(prompt);
      const rawText = result.response.text().trim().replace(/```json|```/g, "").trim();
      report = JSON.parse(rawText) as typeof report;
      if (!report.synthese || !report.patterns) throw new Error("Structure JSON invalide");
    } catch {
      return NextResponse.json(
        { error: "Une erreur est survenue lors de la génération du rapport. Veuillez réessayer dans quelques instants." },
        { status: 502 }
      );
    }

    return NextResponse.json({ report });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("generate-report error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
