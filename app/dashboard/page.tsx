"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Message = {
  id: string;
  from: "patient" | "ai";
  text: string;
  time: string;
};

type Patient = {
  id: string;
  firstName: string;
  initials: string;
  avatarColor: string;
  age: number;
  objective: string;
  lastConsultation: string;
  activePlan: string;
  lastQuestion: string;
  lastMessageTime: string;
  hasNewMessage: boolean;
  monthlyStats: {
    messagesHandled: number;
    timeSaved: string;
    satisfaction: string;
  };
  conversation: Message[];
};

const patients: Patient[] = [
  {
    id: "p1",
    firstName: "Camille",
    initials: "CA",
    avatarColor: "bg-rose-500",
    age: 34,
    objective: "Perte de masse grasse durable",
    lastConsultation: "12 avril 2026",
    activePlan: "Plan Mediterraneen 1600 kcal",
    lastQuestion: "Je rentre tard ce soir, quoi manger rapidement sans craquer ?",
    lastMessageTime: "19:42",
    hasNewMessage: true,
    monthlyStats: { messagesHandled: 46, timeSaved: "2h40", satisfaction: "96%" },
    conversation: [
      { id: "c1", from: "patient", text: "Bonsoir, je finis tard et j'ai tres faim. Je peux faire quoi en 10 minutes ?", time: "19:12" },
      { id: "c2", from: "ai", text: "Bonsoir Camille. Fais une assiette simple avec une source de proteines, des legumes deja prets et un feculent en petite portion.", time: "19:13" },
      { id: "c3", from: "patient", text: "J'ai peur de regrignoter plus tard si je mange trop leger.", time: "19:18" },
      { id: "c4", from: "ai", text: "Bonne remarque. Ajoute un laitage riche en proteines ou une poignee d'amandes pour renforcer la satiete.", time: "19:19" },
      { id: "c5", from: "patient", text: "Parfait, je vais faire ca. Merci !", time: "19:22" },
      { id: "c6", from: "ai", text: "Avec plaisir. Demain matin, dis-moi comment tu t'es sentie apres ce diner.", time: "19:23" },
    ],
  },
  {
    id: "p2",
    firstName: "Julien",
    initials: "JU",
    avatarColor: "bg-blue-500",
    age: 41,
    objective: "Stabiliser la glycemie",
    lastConsultation: "08 avril 2026",
    activePlan: "Plan IG bas sur 4 semaines",
    lastQuestion: "Est-ce que je peux garder des fruits au petit-dejeuner ?",
    lastMessageTime: "17:08",
    hasNewMessage: true,
    monthlyStats: { messagesHandled: 39, timeSaved: "2h10", satisfaction: "94%" },
    conversation: [
      { id: "j1", from: "patient", text: "Je prends banane + cafe le matin, c'est ok pour ma glycemie ?", time: "17:00" },
      { id: "j2", from: "ai", text: "Tu peux garder un fruit, mais associe-le a une proteine et un peu de gras: yaourt grec, graines ou oeufs.", time: "17:01" },
    ],
  },
  {
    id: "p3",
    firstName: "Sophie",
    initials: "SO",
    avatarColor: "bg-violet-500",
    age: 29,
    objective: "Retrouver de l'energie",
    lastConsultation: "03 avril 2026",
    activePlan: "Plan anti-fatigue riche en fer",
    lastQuestion: "Je suis fatiguee l'apres-midi, quelle collation tu conseilles ?",
    lastMessageTime: "Hier",
    hasNewMessage: false,
    monthlyStats: { messagesHandled: 28, timeSaved: "1h35", satisfaction: "92%" },
    conversation: [
      { id: "s1", from: "patient", text: "Je m'endors presque vers 16h, tu as une idee de collation ?", time: "16:20" },
      { id: "s2", from: "ai", text: "Teste une collation avec proteines + fibres: skyr et fruit rouge, ou houmous et crudites.", time: "16:21" },
    ],
  },
  {
    id: "p4",
    firstName: "Thomas",
    initials: "TH",
    avatarColor: "bg-amber-500",
    age: 37,
    objective: "Prise de masse maigre",
    lastConsultation: "30 mars 2026",
    activePlan: "Plan performance 2800 kcal",
    lastQuestion: "Comment repartir mes proteines sur la journee ?",
    lastMessageTime: "Lun",
    hasNewMessage: false,
    monthlyStats: { messagesHandled: 33, timeSaved: "1h50", satisfaction: "95%" },
    conversation: [
      { id: "t1", from: "patient", text: "Je mange beaucoup le soir, c'est mieux de repartir ?", time: "12:10" },
      { id: "t2", from: "ai", text: "Oui, vise 25 a 35 g de proteines par repas et une portion post-entrainement.", time: "12:11" },
    ],
  },
  {
    id: "p5",
    firstName: "Nadia",
    initials: "NA",
    avatarColor: "bg-emerald-500",
    age: 46,
    objective: "Confort digestif",
    lastConsultation: "26 mars 2026",
    activePlan: "Plan digestion FODMAP progressif",
    lastQuestion: "Les legumes crus me ballonnent, je fais quoi ?",
    lastMessageTime: "Mar",
    hasNewMessage: false,
    monthlyStats: { messagesHandled: 25, timeSaved: "1h20", satisfaction: "93%" },
    conversation: [
      { id: "n1", from: "patient", text: "J'ai encore des ballonnements apres la salade du midi.", time: "13:40" },
      { id: "n2", from: "ai", text: "Passe sur des legumes cuits quelques jours et teste une progression graduelle.", time: "13:42" },
    ],
  },
];

export default function DashboardPage() {
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id ?? "");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState("");

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) ?? patients[0],
    [selectedPatientId],
  );

  const activePatients = patients.length;
  const messagesThisMonth = patients.reduce((sum, p) => sum + p.monthlyStats.messagesHandled, 0);

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError("");
    try {
      const res = await fetch("/api/invite-patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setInviteError(data.error ?? "Une erreur est survenue.");
      } else {
        setInviteSuccess(true);
        setInviteEmail("");
        setTimeout(() => {
          setInviteSuccess(false);
          setShowInviteModal(false);
        }, 2500);
      }
    } catch {
      setInviteError("Impossible d'envoyer l'invitation.");
    } finally {
      setInviting(false);
    }
  };

  if (!selectedPatient) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/10 bg-[#111111]/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">Dashboard NutriTwin</h1>
            <p className="text-xs text-zinc-400 sm:text-sm">
              {activePatients} patients actifs · {messagesThisMonth} messages ce mois
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
                <p className="font-semibold">NutriTwin</p>
                <p className="text-xs text-zinc-400">Espace praticien</p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {patients.map((patient) => {
              const isSelected = patient.id === selectedPatient.id;
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
                      <p className="truncate text-xs text-zinc-400">{patient.lastQuestion}</p>
                    </div>
                    {patient.hasNewMessage && <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#10b981]" />}
                  </div>
                </button>
              );
            })}
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

        {/* Zone chat */}
        <section className="flex h-[calc(100vh-130px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111111]">
          <div className="border-b border-white/10 px-5 py-4">
            <p className="text-lg font-semibold">{selectedPatient.firstName}</p>
            <p className="text-sm text-zinc-400">{selectedPatient.objective}</p>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-[#0f0f0f] p-4 sm:p-6">
            {selectedPatient.conversation.map((message) => {
              const isPatient = message.from === "patient";
              return (
                <div key={message.id} className={`flex ${isPatient ? "justify-start" : "justify-end"}`}>
                  <div className="max-w-[82%]">
                    <div className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                      isPatient ? "rounded-bl-md bg-[#2a2a2a] text-zinc-100" : "rounded-br-md bg-[#10b981] text-black"
                    }`}>
                      {message.text}
                    </div>
                    <div className={`mt-1 flex items-center gap-2 text-[11px] ${isPatient ? "justify-start text-zinc-500" : "justify-end text-zinc-500"}`}>
                      <span>{message.time}</span>
                    </div>
                    {!isPatient && (
                      <button type="button" className="mt-2 rounded-full border border-[#10b981]/50 px-3 py-1 text-xs font-medium text-[#34d399] transition hover:bg-[#10b981]/10">
                        Corriger cette reponse
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Fiche patient */}
        <aside className="h-[calc(100vh-130px)] overflow-y-auto rounded-2xl border border-white/10 bg-[#121212] p-4">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className={`mb-3 flex h-16 w-16 items-center justify-center rounded-full text-sm font-bold text-white ${selectedPatient.avatarColor}`}>
              {selectedPatient.initials}
            </div>
            <p className="text-lg font-semibold">{selectedPatient.firstName}</p>
            <p className="text-xs text-zinc-400">{selectedPatient.objective}</p>
          </div>

          <div className="space-y-3 rounded-xl border border-white/10 bg-[#181818] p-3 text-sm">
            <InfoRow label="Age" value={`${selectedPatient.age} ans`} />
            <InfoRow label="Objectif" value={selectedPatient.objective} />
            <InfoRow label="Derniere consultation" value={selectedPatient.lastConsultation} />
            <InfoRow label="Plan actif" value={selectedPatient.activePlan} />
          </div>

          <div className="mt-5">
            <p className="mb-3 text-sm font-semibold text-zinc-200">Stats du mois</p>
            <div className="space-y-3">
              <StatCard label="Messages traites" value={String(selectedPatient.monthlyStats.messagesHandled)} />
              <StatCard label="Temps economise estime" value={selectedPatient.monthlyStats.timeSaved} />
              <StatCard label="Satisfaction" value={selectedPatient.monthlyStats.satisfaction} />
            </div>
          </div>
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
            background: "#121212",
            borderRadius: 20,
            padding: 28,
            width: "100%",
            maxWidth: 420,
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "white" }}>
              Inviter un patient
            </h2>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#94a3b8" }}>
              Votre patient recevra un email pour acceder a son espace de chat personnalise.
            </p>

            {inviteSuccess ? (
              <div style={{
                background: "rgba(16,185,129,0.15)",
                border: "1px solid #10b981",
                borderRadius: 12,
                padding: "16px 18px",
                textAlign: "center",
                color: "#10b981",
                fontWeight: 600,
                fontSize: 15,
              }}>
                ✅ Invitation envoyee avec succes !
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
                    width: "100%",
                    height: 48,
                    borderRadius: 12,
                    border: "1.5px solid rgba(255,255,255,0.1)",
                    background: "#1a1a1a",
                    color: "white",
                    padding: "0 16px",
                    fontSize: 15,
                    outline: "none",
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
                      fontSize: 14, fontWeight: 600,
                      transition: "all 0.2s",
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
