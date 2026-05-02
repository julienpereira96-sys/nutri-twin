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
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [practitionerId, setPractitionerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [practitionerName, setPractitionerName] = useState("");

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const pid = data.user.id;
      setPractitionerId(pid);

      // Récupérer le nom du praticien
      const { data: practitioner } = await supabase
        .from("practitioners")
        .select("first_name, last_name")
        .eq("user_id", pid)
        .single();
      if (practitioner) {
        setPractitionerName(`${practitioner.first_name} ${practitioner.last_name}`);
      }

      // Récupérer les patients liés à ce praticien
      const { data: relations } = await supabase
        .from("patient_practitioner")
        .select("patient_id")
        .eq("practitioner_id", pid);

      if (!relations || relations.length === 0) {
        setLoading(false);
        return;
      }

      const patientIds = relations.map((r) => r.patient_id);

      // Récupérer les infos des patients
      const { data: patientsData } = await supabase
        .from("patients")
        .select("user_id, first_name, last_name, email")
        .in("user_id", patientIds);

      if (!patientsData) {
        setLoading(false);
        return;
      }

      // Récupérer le dernier message et le total pour chaque patient
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

  // Charger les conversations du patient sélectionné
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
              <div className="border-b border-white/10 px-5 py-4">
                <p className="text-lg font-semibold">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                <p className="text-sm text-zinc-400">{selectedPatient.email}</p>
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
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-zinc-500">Sélectionnez un patient</p>
            </div>
          )}
        </aside>
      </main>

      {/* Modale invitation */}
      {showInviteModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowInviteModal(false); }}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 50,
            display: "flex", alignItems: "center", justifyContent: "center",
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
