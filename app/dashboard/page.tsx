"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

type RealPatient = {
  id: string;
  firstName: string;
  lastName: string;
  initials: string;
  avatarColor: string;
  email: string;
  lastMessage: string;
  lastMessageTime: string;
  lastMessageRole: string;
  totalMessages: number;
};

type Conversation = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type ReportPeriod = "week" | "month" | "custom";

const AVATAR_COLORS = [
  "bg-rose-500", "bg-blue-500", "bg-violet-500",
  "bg-amber-500", "bg-emerald-500", "bg-pink-500",
  "bg-cyan-500", "bg-orange-500",
];

export default function DashboardPage() {
  const [patients, setPatients] = useState<RealPatient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [practitionerId, setPractitionerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [practitionerName, setPractitionerName] = useState("");

  // Rapport
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("month");
  const [reportDateFrom, setReportDateFrom] = useState("");
  const [reportDateTo, setReportDateTo] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportContent, setReportContent] = useState("");

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const pid = data.user.id;
      setPractitionerId(pid);

      const { data: practitioner } = await supabase
        .from("practitioners")
        .select("first_name, last_name")
        .eq("user_id", pid)
        .single();
      if (practitioner) {
        setPractitionerName(`${practitioner.first_name} ${practitioner.last_name}`);
      }

      const { data: relations } = await supabase
        .from("patient_practitioner")
        .select("patient_id")
        .eq("practitioner_id", pid);

      if (!relations || relations.length === 0) {
        setLoading(false);
        return;
      }

      const patientIds = relations.map((r) => r.patient_id);

      const { data: patientsData } = await supabase
        .from("patients")
        .select("user_id, first_name, last_name, email")
        .in("user_id", patientIds);

      if (!patientsData) {
        setLoading(false);
        return;
      }

      const patientsWithStats = await Promise.all(
        patientsData.map(async (p, i) => {
          const { data: convs } = await supabase
            .from("conversations")
            .select("role, content, created_at")
            .eq("patient_id", p.user_id)
            .eq("practitioner_id", pid)
            .order("created_at", { ascending: false })
            .limit(1);

          const lastConv = convs?.[0];

          const { count } = await supabase
            .from("conversations")
            .select("*", { count: "exact", head: true })
            .eq("patient_id", p.user_id)
            .eq("practitioner_id", pid);

          const initials = `${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`.toUpperCase();

          return {
            id: p.user_id,
            firstName: p.first_name ?? "Patient",
            lastName: p.last_name ?? "",
            initials,
            avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
            email: p.email ?? "",
            lastMessage: lastConv?.content ?? "Aucun message pour l'instant",
            lastMessageTime: lastConv?.created_at
              ? new Date(lastConv.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
              : "",
            lastMessageRole: lastConv?.role ?? "",
            totalMessages: count ?? 0,
          };
        })
      );

      setPatients(patientsWithStats);
      if (patientsWithStats.length > 0) {
        setSelectedPatientId(patientsWithStats[0].id);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedPatientId || !practitionerId) return;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    supabase
      .from("conversations")
      .select("id, role, content, created_at")
      .eq("patient_id", selectedPatientId)
      .eq("practitioner_id", practitionerId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setConversations((data as Conversation[]) ?? []);
      });
  }, [selectedPatientId, practitionerId]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);
  const totalMessages = patients.reduce((sum, p) => sum + p.totalMessages, 0);

  const generateReport = async () => {
    if (!selectedPatientId) return;
    setReportLoading(true);
    setReportContent("");

    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Calculer les dates
      const now = new Date();
      let dateFrom = "";
      let dateTo = now.toISOString().split("T")[0];

      if (reportPeriod === "week") {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        dateFrom = weekAgo.toISOString().split("T")[0];
      } else if (reportPeriod === "month") {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        dateFrom = monthAgo.toISOString().split("T")[0];
      } else {
        dateFrom = reportDateFrom;
        dateTo = reportDateTo;
      }

      // Récupérer les entrées journal (données agrégées seulement — pas le texte libre)
      const { data: journalEntries } = await supabase
        .from("journal_entries")
        .select("date, mood, food_rating, emotions")
        .eq("patient_id", selectedPatientId)
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: true });

      if (!journalEntries || journalEntries.length === 0) {
        setReportContent("Aucune entrée de journal sur cette période.");
        setReportLoading(false);
        return;
      }

      // Agréger les données sans le texte libre
      const moodLabels = ["Difficile", "Moyen", "Bien", "Très bien", "Excellent"];
      const foodLabels = ["Difficile", "Bien", "Super"];

      const avgMood = (journalEntries.reduce((sum, e) => sum + e.mood, 0) / journalEntries.length).toFixed(1);
      const avgFood = (journalEntries.reduce((sum, e) => sum + e.food_rating, 0) / journalEntries.length).toFixed(1);

      const allEmotions = journalEntries.flatMap((e) => e.emotions as string[]);
      const emotionCounts: Record<string, number> = {};
      allEmotions.forEach((em) => {
        emotionCounts[em] = (emotionCounts[em] ?? 0) + 1;
      });
      const topEmotions = Object.entries(emotionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([em, count]) => `${em} (${count}x)`)
        .join(", ");

      const moodTrend = journalEntries.map((e) => `${e.date}: humeur ${moodLabels[e.mood - 1]}, alimentation ${foodLabels[e.food_rating - 1]}`).join("\n");

      const prompt = `Tu es un assistant pour un praticien en nutrition. Génère un compte rendu professionnel et bienveillant basé sur les données agrégées du journal de bord d'un patient sur la période du ${dateFrom} au ${dateTo}.

DONNÉES AGRÉGÉES (pas de texte libre du patient) :
- Nombre d'entrées : ${journalEntries.length}
- Humeur moyenne : ${avgMood}/5
- Alimentation moyenne : ${avgFood}/3
- Émotions dominantes : ${topEmotions || "non renseignées"}
- Évolution jour par jour :
${moodTrend}

Génère un compte rendu structuré avec :
1. Vue d'ensemble de la période
2. Tendances observées (humeur, alimentation, émotions)
3. Points positifs à valoriser en consultation
4. Axes de travail suggérés
5. Questions à poser au patient lors de la prochaine consultation

Ton : professionnel, bienveillant, orienté action. Sans markdown. Utilise des titres clairs.`;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          practitionerId: practitionerId ?? undefined,
        }),
      });

      const aiData = (await res.json()) as { response?: string };
      setReportContent(aiData.response ?? "Impossible de générer le rapport.");
    } finally {
      setReportLoading(false);
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError("");
    try {
      const res = await fetch("/api/invite-patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), practitionerId: practitionerId ?? "" }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setInviteError(data.error ?? "Une erreur est survenue.");
      } else {
        setInviteSuccess(true);
        setInviteEmail("");
      }
    } catch {
      setInviteError("Impossible d'envoyer l'invitation.");
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/10 bg-[#111111]/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              {practitionerName ? `Bonjour ${practitionerName.split(" ")[0]} 👋` : "Dashboard NutriTwin"}
            </h1>
            <p className="text-xs text-zinc-400 sm:text-sm">
              {patients.length} patient{patients.length > 1 ? "s" : ""} actif{patients.length > 1 ? "s" : ""} · {totalMessages} messages au total
            </p>
          </div>
          <Link
            href="/onboarding"
            className="rounded-full bg-[#10b981] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#34d399]"
          >
            Mon jumeau
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-[280px_minmax(0,1fr)_260px]">

        {/* Sidebar patients */}
        <aside className="flex h-[calc(100vh-130px)] flex-col rounded-2xl border border-white/10 bg-[#121212]">
          <div className="border-b border-white/10 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#10b981]/20">
                <span className="text-lg">🍃</span>
              </div>
              <div>
                <p className="font-semibold">Mes patients</p>
                <p className="text-xs text-zinc-400">Espace praticien</p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {loading ? (
              <p className="text-center text-xs text-zinc-500 mt-4">Chargement...</p>
            ) : patients.length === 0 ? (
              <div className="mt-6 text-center">
                <p className="text-sm text-zinc-400">Aucun patient pour l'instant</p>
                <p className="mt-2 text-xs text-zinc-500">Invitez votre premier patient !</p>
              </div>
            ) : (
              patients.map((patient) => {
                const isSelected = patient.id === selectedPatientId;
                return (
                  <button
                    key={patient.id}
                    type="button"
                    onClick={() => setSelectedPatientId(patient.id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      isSelected
                        ? "border-[#10b981]/70 bg-[#10b981]/10"
                        : "border-white/10 bg-[#171717] hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${patient.avatarColor}`}>
                        {patient.initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold">{patient.firstName}</p>
                          <span className="text-[11px] text-zinc-500">{patient.lastMessageTime}</span>
                        </div>
                        <p className="truncate text-xs text-zinc-400">{patient.lastMessage}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-white/10 p-3">
            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="w-full rounded-full bg-[#10b981] px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-[#34d399]"
            >
              + Inviter un patient
            </button>
          </div>
        </aside>

        {/* Zone conversations */}
        <section className="flex h-[calc(100vh-130px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111111]">
          {selectedPatient ? (
            <>
              <div className="border-b border-white/10 px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                  <p className="text-sm text-zinc-400">{selectedPatient.email}</p>
                </div>
                <button
                  onClick={() => { setShowReportModal(true); setReportContent(""); }}
                  className="rounded-full border border-[#10b981]/50 px-3 py-1.5 text-xs font-semibold text-[#10b981] transition hover:bg-[#10b981]/10"
                >
                  📊 Rapport IA
                </button>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto bg-[#0f0f0f] p-4 sm:p-6">
                {conversations.length === 0 ? (
                  <p className="text-center text-sm text-zinc-500 mt-8">
                    Aucune conversation pour l'instant
                  </p>
                ) : (
                  conversations.map((message) => {
                    const isPatient = message.role === "user";
                    return (
                      <div key={message.id} className={`flex ${isPatient ? "justify-start" : "justify-end"}`}>
                        <div className="max-w-[82%]">
                          <div className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                            isPatient ? "rounded-bl-md bg-[#2a2a2a] text-zinc-100" : "rounded-br-md bg-[#10b981] text-black"
                          }`}>
                            {message.content}
                          </div>
                          <div className={`mt-1 text-[11px] ${isPatient ? "text-zinc-500" : "text-right text-zinc-500"}`}>
                            {new Date(message.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-zinc-500">
                {loading ? "Chargement..." : "Sélectionnez un patient"}
              </p>
            </div>
          )}
        </section>

        {/* Fiche patient */}
        <aside className="h-[calc(100vh-130px)] overflow-y-auto rounded-2xl border border-white/10 bg-[#121212] p-4">
          {selectedPatient ? (
            <>
              <div className="mb-6 flex flex-col items-center text-center">
                <div className={`mb-3 flex h-16 w-16 items-center justify-center rounded-full text-sm font-bold text-white ${selectedPatient.avatarColor}`}>
                  {selectedPatient.initials}
                </div>
                <p className="text-lg font-semibold">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                <p className="text-xs text-zinc-400">{selectedPatient.email}</p>
              </div>

              <div className="space-y-3 rounded-xl border border-white/10 bg-[#181818] p-3 text-sm">
                <InfoRow label="Email" value={selectedPatient.email} />
                <InfoRow label="Messages totaux" value={String(selectedPatient.totalMessages)} />
              </div>

              <div className="mt-5">
                <p className="mb-3 text-sm font-semibold text-zinc-200">Statistiques</p>
                <div className="space-y-3">
                  <StatCard label="Messages échangés" value={String(selectedPatient.totalMessages)} />
                  <StatCard label="Dernier message" value={selectedPatient.lastMessageTime || "—"} />
                </div>
              </div>

              <div className="mt-5">
                <button
                  onClick={() => { setShowReportModal(true); setReportContent(""); }}
                  className="w-full rounded-xl bg-[#10b981]/10 border border-[#10b981]/30 px-4 py-3 text-sm font-semibold text-[#10b981] transition hover:bg-[#10b981]/20"
                >
                  📊 Générer rapport journal
                </button>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-zinc-500">Sélectionnez un patient</p>
            </div>
          )}
        </aside>
      </main>

      {/* Modale rapport */}
      {showReportModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowReportModal(false); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
        >
          <div style={{
            background: "#121212", borderRadius: 20, padding: 28,
            width: "100%", maxWidth: 560,
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            maxHeight: "85vh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "white" }}>
                📊 Rapport journal — {selectedPatient?.firstName}
              </h2>
              <button onClick={() => setShowReportModal(false)} style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 22, color: "#94a3b8",
              }}>×</button>
            </div>

            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b" }}>
              Ce rapport est généré à partir des données agrégées du journal (humeur, alimentation, émotions). Le contenu personnel du patient reste confidentiel.
            </p>

            {/* Choix période */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>Période</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {[
                  { value: "week", label: "Cette semaine" },
                  { value: "month", label: "Ce mois" },
                  { value: "custom", label: "Personnalisée" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setReportPeriod(option.value as ReportPeriod)}
                    style={{
                      flex: 1, height: 36, borderRadius: 8,
                      border: `1.5px solid ${reportPeriod === option.value ? "#10b981" : "rgba(255,255,255,0.1)"}`,
                      background: reportPeriod === option.value ? "rgba(16,185,129,0.15)" : "transparent",
                      color: reportPeriod === option.value ? "#10b981" : "#94a3b8",
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {reportPeriod === "custom" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <p style={{ margin: "0 0 6px", fontSize: 12, color: "#94a3b8" }}>Du</p>
                    <input
                      type="date"
                      value={reportDateFrom}
                      onChange={(e) => setReportDateFrom(e.target.value)}
                      style={{
                        width: "100%", height: 40, borderRadius: 8,
                        border: "1.5px solid rgba(255,255,255,0.1)",
                        background: "#1a1a1a", color: "white",
                        padding: "0 12px", fontSize: 13, outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <p style={{ margin: "0 0 6px", fontSize: 12, color: "#94a3b8" }}>Au</p>
                    <input
                      type="date"
                      value={reportDateTo}
                      onChange={(e) => setReportDateTo(e.target.value)}
                      style={{
                        width: "100%", height: 40, borderRadius: 8,
                        border: "1.5px solid rgba(255,255,255,0.1)",
                        background: "#1a1a1a", color: "white",
                        padding: "0 12px", fontSize: 13, outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {!reportContent && (
              <button
                onClick={() => void generateReport()}
                disabled={reportLoading || (reportPeriod === "custom" && (!reportDateFrom || !reportDateTo))}
                style={{
                  width: "100%", height: 48, borderRadius: 24,
                  background: reportLoading ? "#1a1a1a" : "#10b981",
                  border: "none",
                  color: reportLoading ? "#4a4a4a" : "black",
                  fontSize: 15, fontWeight: 600,
                  cursor: reportLoading ? "not-allowed" : "pointer",
                  marginBottom: 16,
                }}
              >
                {reportLoading ? "Génération en cours... 🤖" : "Générer le rapport IA"}
              </button>
            )}

            {reportContent && (
              <div style={{
                background: "#0f0f0f", borderRadius: 16, padding: "20px",
                border: "1px solid rgba(255,255,255,0.08)",
                fontSize: 14, color: "#e2e8f0", lineHeight: 1.8,
                whiteSpace: "pre-wrap",
              }}>
                {reportContent}
              </div>
            )}

            {reportContent && (
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button
                  onClick={() => { setReportContent(""); }}
                  style={{
                    flex: 1, height: 44, borderRadius: 12,
                    background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
                    color: "#94a3b8", cursor: "pointer", fontSize: 14,
                  }}
                >
                  Nouvelle période
                </button>
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(reportContent);
                  }}
                  style={{
                    flex: 1, height: 44, borderRadius: 12,
                    background: "#10b981", border: "none",
                    color: "black", cursor: "pointer", fontSize: 14, fontWeight: 600,
                  }}
                >
                  📋 Copier
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modale invitation */}
      {showInviteModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowInviteModal(false); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
        >
          <div style={{
            background: "#121212", borderRadius: 20, padding: 28,
            width: "100%", maxWidth: 420,
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "white" }}>
              Inviter un patient
            </h2>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#94a3b8" }}>
              Votre patient recevra un email pour accéder à son espace personnalisé.
            </p>
            {inviteSuccess ? (
              <div style={{
                background: "rgba(16,185,129,0.15)", border: "1px solid #10b981",
                borderRadius: 12, padding: "16px 18px", textAlign: "center",
                color: "#10b981", fontWeight: 600, fontSize: 15,
              }}>
                ✅ Invitation envoyée !
              </div>
            ) : (
              <>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void sendInvite(); }}
                  placeholder="email@patient.fr"
                  style={{
                    width: "100%", height: 48, borderRadius: 12,
                    border: "1.5px solid rgba(255,255,255,0.1)",
                    background: "#1a1a1a", color: "white",
                    padding: "0 16px", fontSize: 15, outline: "none",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "#10b981"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                />
                {inviteError && (
                  <p style={{ margin: "8px 0 0", fontSize: 13, color: "#f87171" }}>{inviteError}</p>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button
                    onClick={() => { setShowInviteModal(false); setInviteEmail(""); setInviteError(""); }}
                    style={{
                      flex: 1, height: 44, borderRadius: 12,
                      background: "transparent",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#94a3b8", cursor: "pointer", fontSize: 14,
                    }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => void sendInvite()}
                    disabled={inviting || !inviteEmail.trim()}
                    style={{
                      flex: 1, height: 44, borderRadius: 12,
                      background: inviting || !inviteEmail.trim() ? "#1a1a1a" : "#10b981",
                      border: "none",
                      color: inviting || !inviteEmail.trim() ? "#4a4a4a" : "black",
                      cursor: inviting || !inviteEmail.trim() ? "not-allowed" : "pointer",
                      fontSize: 14, fontWeight: 600, transition: "all 0.2s",
                    }}
                  >
                    {inviting ? "Envoi..." : "Envoyer"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-sm text-zinc-200">{value}</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#10b981]/20 bg-[#10b981]/10 p-3">
      <p className="text-xs text-zinc-300">{label}</p>
      <p className="mt-1 text-xl font-bold text-[#34d399]">{value}</p>
    </div>
  );
}
