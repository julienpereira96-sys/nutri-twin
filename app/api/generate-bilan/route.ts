import { createClient } from "@supabase/supabase-js";
import { vertexGenerate } from "@/lib/vertexai";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

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

const ALERT_TYPE_LABELS: Record<string, string> = {
  critical: "Alerte critique (mots-clés)",
  critical_llm: "Alerte critique (analyse IA)",
  behavioral: "Alerte comportementale",
};

const RESOLUTION_LABELS: Record<string, string> = {
  practitioner_certified: "Certifiée traitée par le praticien",
  practitioner_resolved: "Résolue par le praticien (instruction transmise au jumeau)",
  practitioner_dismissed: "Classée sans suite par le praticien",
};

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const { patientId, practitionerId } = await request.json() as {
      patientId: string;
      practitionerId: string;
    };

    if (!patientId || !practitionerId) {
      return NextResponse.json({ error: "patientId et practitionerId requis." }, { status: 400 });
    }

    if (user.id !== practitionerId) return forbidden();

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Lire le curseur actuel pour ce patient
    const { data: practitionerRow } = await supabase
      .from("practitioners")
      .select("bilan_cursors")
      .eq("user_id", practitionerId)
      .single();

    const cursors = (practitionerRow?.bilan_cursors as Record<string, string> | null) ?? {};
    const lastCursor = cursors[patientId] ?? null;

    // Récupérer les données du patient en parallèle
    let conversationsQuery = supabase
      .from("conversations")
      .select("role, content, created_at")
      .eq("patient_id", patientId)
      .eq("practitioner_id", practitionerId)
      .neq("practitioner_only", true)
      .order("created_at", { ascending: true });

    // Filtrer après le curseur si présent
    if (lastCursor) {
      conversationsQuery = conversationsQuery.gt("created_at", lastCursor);
    }

    const [{ data: chatMessages }, { data: patient }, { data: sosEventsRaw }] = await Promise.all([
      conversationsQuery,
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
          objectif_delai, onboarding_answers,
          archived_alerts, practitioner_instruction
        `)
        .eq("user_id", patientId)
        .single(),
      // Épisodes Mon Soutien depuis le curseur (ou tout si pas de curseur)
      lastCursor
        ? supabase
            .from("sos_events")
            .select("triggered_at, sos_context, raw_response, origin, closing_message, intake_message, status")
            .eq("patient_id", patientId)
            .gt("triggered_at", lastCursor)
            .order("triggered_at", { ascending: false })
            .limit(20)
        : supabase
            .from("sos_events")
            .select("triggered_at, sos_context, raw_response, origin, closing_message, intake_message, status")
            .eq("patient_id", patientId)
            .order("triggered_at", { ascending: false })
            .limit(20),
    ]);

    const firstName = (patient as { first_name?: string } | null)?.first_name ?? "le patient";

    // Compter les messages patient depuis le curseur (pour le seuil et l'affichage)
    const allMessages = chatMessages ?? [];
    const patientMessages = allMessages.filter(m => m.role === "user");
    const messageCount = patientMessages.length;

    // Si moins de 5 messages depuis le dernier bilan, retourner un message honnête
    if (messageCount < 5) {
      const sinceText = lastCursor
        ? "depuis votre dernière préparation de séance"
        : "dans l'historique";
      return NextResponse.json({
        lowData: true,
        message: `Pas encore suffisamment d'échanges récents avec ${firstName} pour générer des questions pertinentes. Revenez après quelques nouvelles conversations.`,
      });
    }

    // Dialogue complet avec dates — patient + jumeau, sans troncature
    const chatData = allMessages
      .map(m => {
        const dt = new Date(m.created_at as string);
        const date = dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
        const time = dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        const role = m.role === "user" ? "Patient" : "Jumeau";
        return `[${date} ${time}] ${role} : ${m.content as string}`;
      })
      .join("\n");

    // ── Build rich onboarding profile (mêmes champs que le Rapport IA) ──
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

    const onboardingAnswers = (p?.onboarding_answers as Record<string, string> | null) ?? {};
    const answersLines = Object.entries(onboardingAnswers)
      .filter(([, v]) => v)
      .map(([k, v]) => `  • ${k} : ${v}`)
      .join("\n");

    const patientProfile = profileLines.length > 0
      ? `${profileLines.map(l => `- ${l}`).join("\n")}${answersLines ? `\n- Questions complémentaires :\n${answersLines}` : ""}`
      : "";

    // ── Murmures praticien actifs (consignes en cours) ──
    const murmuresActifs = (() => {
      const instr = p?.practitioner_instruction as { id: string; text: string; expires_at?: string | null }[] | null;
      if (!Array.isArray(instr)) return "";
      const active = instr.filter(m => !m.expires_at || new Date(m.expires_at) > new Date());
      if (active.length === 0) return "";
      return `MURMURES DU PRATICIEN ACTUELLEMENT EN COURS :\n${active.map(m => `  - "${m.text}"`).join("\n")}`;
    })();

    // ── Alertes praticien traitées depuis le dernier bilan ──
    type ArchivedAlert = {
      type?: string; alert_type?: string; date?: string; murmure?: string;
      message?: string; archived_at?: string; resolution?: string;
    };
    const archivedAlerts = (p?.archived_alerts as ArchivedAlert[] | null) ?? [];
    const recentArchivedAlerts = archivedAlerts
      .filter(a => {
        const ref = a.archived_at ?? a.date;
        if (!ref) return false;
        return lastCursor ? ref > lastCursor : true;
      })
      .slice(-10);
    const alertsSection = recentArchivedAlerts.length > 0
      ? `ALERTES PRATICIEN TRAITÉES DEPUIS LE DERNIER BILAN (${recentArchivedAlerts.length}) :\n` +
        recentArchivedAlerts.map(a => {
          const date = a.date ? new Date(a.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "date inconnue";
          const label = ALERT_TYPE_LABELS[a.alert_type ?? ""] ?? a.alert_type ?? "Alerte";
          const resolution = a.resolution ? ` — ${RESOLUTION_LABELS[a.resolution] ?? a.resolution}` : "";
          const detail = a.murmure || a.message || "";
          return `  - ${date} : ${label}${detail ? ` — ${detail}` : ""}${resolution}`;
        }).join("\n")
      : "";

    // Construire la section Mon Soutien
    const toolNames: Record<string, string> = {
      breathing: "Cohérence cardiaque", ancrage: "Ancrage sensoriel", marche: "Marche consciente",
      manger: "Pleine conscience alimentaire", body_scan: "Body scan", defusion: "Défusion cognitive",
      ecriture: "Écriture cathartique", adaptive_coaching: "Coaching personnalisé",
    };
    type SosEventRow = {
      triggered_at: string;
      sos_context: string;
      raw_response?: { tool_id?: string } | null;
      origin?: string | null;
      closing_message?: string | null;
      intake_message?: string | null;
      status?: string | null;
    };
    const sosEpisodes = (sosEventsRaw ?? []) as SosEventRow[];
    const sosCrises = sosEpisodes.filter(ev => ev.origin === "crise");
    const sosPratiques = sosEpisodes.filter(ev => ev.origin !== "crise");
    const sosSection = sosEpisodes.length > 0
      ? `ÉPISODES MON SOUTIEN DEPUIS LE DERNIER BILAN (${sosEpisodes.length} déclenchement${sosEpisodes.length > 1 ? "s" : ""}) :\n` +
        (sosCrises.length > 0
          ? `  Crises désamorcées (${sosCrises.length}) :\n` + sosCrises.map(ev => {
              const date = new Date(ev.triggered_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
              const context = ev.sos_context?.split(" | ")[0] ?? "non précisé";
              const toolId = ev.raw_response?.tool_id;
              const exercise = toolId ? (toolNames[toolId] ?? toolId) : "exercice non précisé";
              const outcome = ev.status === "success" ? "apaisé(e)" : "non résolu";
              return `    - ${date} : ${context} → ${exercise} (${outcome})`;
            }).join("\n")
          : "") +
        (sosPratiques.length > 0
          ? `${sosCrises.length > 0 ? "\n" : ""}  Pratique volontaire (${sosPratiques.length}) :\n` + sosPratiques.map(ev => {
              const date = new Date(ev.triggered_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
              const toolId = ev.raw_response?.tool_id;
              const exercise = toolId ? (toolNames[toolId] ?? toolId) : "exercice non précisé";
              return `    - ${date} : ${exercise}`;
            }).join("\n")
          : "")
      : "";

    const prompt = `Tu es l'assistant d'un nutritionniste qui prépare sa prochaine consultation avec ${firstName}.

${patientProfile ? `PROFIL PATIENT (onboarding complet) :\n${patientProfile}\n\n` : ""}DIALOGUE COMPLET DEPUIS LE DERNIER BILAN (${messageCount} messages patient, ${allMessages.length} échanges au total) :
${chatData}
${sosSection ? `\n${sosSection}\n` : ""}${alertsSection ? `\n${alertsSection}\n` : ""}${murmuresActifs ? `\n${murmuresActifs}\n` : ""}
Génère exactement 3 questions clés que le praticien devrait poser lors de la prochaine consultation. Les questions doivent être précises, personnalisées et montrer que le praticien a suivi de près l'évolution du patient.${sosSection ? " Intègre les épisodes Mon Soutien si pertinents pour comprendre l'état émotionnel du patient." : ""}${alertsSection ? " Tiens compte des alertes praticien traitées récemment." : ""}

Pour chaque question :
- "question" : la question à poser, formulée directement au patient
- "justification" : pourquoi cette question est importante, basée sur les données observées
- "objectif" : l'objectif clinique visé par cette question

N'invente aucune donnée non présente dans les échanges. Si un point n'est pas documenté, ne le mentionne pas.

Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks :
[
  {"question": "...", "justification": "...", "objectif": "..."},
  {"question": "...", "justification": "...", "objectif": "..."},
  {"question": "...", "justification": "...", "objectif": "..."}
]`;

    let questions: { question: string; justification: string; objectif: string }[];
    try {
      const rawText = (await vertexGenerate("gemini-3.5-flash", prompt, { maxOutputTokens: 4000, temperature: 0.6 })).trim().replace(/```json|```/g, "").trim();
      questions = JSON.parse(rawText) as typeof questions;
      if (!Array.isArray(questions) || questions.length === 0 || !questions[0].question) throw new Error("Structure JSON invalide");
    } catch (err: unknown) {
      const vertexMsg = err instanceof Error ? err.message : String(err);
      console.error("generate-bilan vertex error:", vertexMsg);
      return NextResponse.json({ error: vertexMsg }, { status: 502 });
    }

    // Mettre à jour le curseur avec le timestamp du message le plus récent
    const newestMessage = (chatMessages ?? []).reduce((latest, msg) => {
      const t = new Date(msg.created_at as string).getTime();
      return t > latest ? t : latest;
    }, 0);

    if (newestMessage > 0) {
      const newCursors = { ...cursors, [patientId]: new Date(newestMessage).toISOString() };
      await supabase
        .from("practitioners")
        .update({ bilan_cursors: newCursors })
        .eq("user_id", practitionerId);
    }

    return NextResponse.json({ questions });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("generate-bilan error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
