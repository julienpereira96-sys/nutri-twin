"use client";

import { KeyboardEvent, useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type Tool = "breathing" | "ancrage" | "marche" | "manger" | "journal" | null;
type BreathingStep = "idle" | "inhale" | "hold" | "exhale" | "done";

const quickActions = [
  "J'ai craqué ce soir, que faire ?",
  "Pourquoi j'ai encore faim après avoir mangé ?",
  "Que manger quand je rentre tard le soir ?",
  "Comment résister à une fringale ?",
  "Comment rester motivé sur la durée ?",
  "Pourquoi je ne vois pas de résultats ?",
];

const tools = [
  { id: "breathing", emoji: "🫁", label: "Cohérence cardiaque" },
  { id: "ancrage", emoji: "🌊", label: "Technique 5-4-3-2-1" },
  { id: "marche", emoji: "🚶", label: "Marche consciente" },
  { id: "manger", emoji: "🍽️", label: "Manger en pleine conscience" },
  { id: "journal", emoji: "✍️", label: "Journal de gratitude" },
];

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientFirstName, setPatientFirstName] = useState<string>("");
  const [practitionerIdFromDb, setPractitionerIdFromDb] = useState<string | null>(null);
  const [practitionerName, setPractitionerName] = useState("votre praticien");

  // Breathing
  const [breathingStep, setBreathingStep] = useState<BreathingStep>("idle");
  const [breathingCycle, setBreathingCycle] = useState(0);

  // Ancrage 5-4-3-2-1
  const [ancrageStep, setAncrageStep] = useState(0);
  const ancrageSteps = [
    { count: 5, sense: "voyez", icon: "👀" },
    { count: 4, sense: "touchez", icon: "🤲" },
    { count: 3, sense: "entendez", icon: "👂" },
    { count: 2, sense: "sentez", icon: "👃" },
    { count: 1, sense: "goûtez", icon: "👅" },
  ];

  // Marche
  const [marcheStep, setMarcheStep] = useState(0);
  const [marcheText, setMarcheText] = useState("");
  const marcheSteps = [
    "Levez-vous doucement. Sentez vos pieds sur le sol. Respirez profondément.",
    "Commencez à marcher lentement. Portez attention à chaque pas. Sentez le contact de vos pieds avec le sol.",
    "Observez votre environnement. Qu'est-ce que vous voyez ? Quelles couleurs, quelles formes ?",
    "Sentez l'air sur votre peau. Remarquez la température, le mouvement de l'air autour de vous.",
    "Portez votre attention sur votre respiration. Elle se synchronise naturellement avec vos pas.",
    "Vous êtes ancré dans le moment présent. Chaque pas est une intention, chaque souffle est une renaissance. 🌿",
  ];

  // Journal
  const [journalEntry, setJournalEntry] = useState("");
  const [journalResponse, setJournalResponse] = useState("");
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalSent, setJournalSent] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setPatientId(data.user.id);

        const { data: relation } = await supabase
          .from("patient_practitioner")
          .select("practitioner_id")
          .eq("patient_id", data.user.id)
          .single();

        if (relation) {
          setPractitionerIdFromDb(relation.practitioner_id as string);

          const { data: practitioner } = await supabase
            .from("practitioners")
            .select("first_name, last_name")
            .eq("user_id", relation.practitioner_id)
            .single();

          if (practitioner) {
            setPractitionerName(`${practitioner.first_name} ${practitioner.last_name}`);
          }

          const { data: history } = await supabase
            .from("conversations")
            .select("role, content")
            .eq("patient_id", data.user.id)
            .eq("practitioner_id", relation.practitioner_id)
            .order("created_at", { ascending: true });

          if (history && history.length > 0) {
            setMessages(history as ChatMessage[]);
          }
        }

        // Récupérer le prénom du patient
        const { data: patient } = await supabase
          .from("patients")
          .select("first_name")
          .eq("user_id", data.user.id)
          .single();

        if (patient?.first_name) setPatientFirstName(patient.first_name);
      }
    });
  }, []);

  // Breathing logic
  const startBreathing = () => {
    setBreathingStep("inhale");
    setBreathingCycle(1);
    let cycle = 1;
    const runCycle = () => {
      setTimeout(() => setBreathingStep("hold"), 5000);
      setTimeout(() => setBreathingStep("exhale"), 9000);
      setTimeout(() => {
        cycle++;
        if (cycle <= 5) {
          setBreathingStep("inhale");
          setBreathingCycle(cycle);
          runCycle();
        } else {
          setBreathingStep("done");
        }
      }, 14000);
    };
    runCycle();
  };

  const send = async (text?: string) => {
    const trimmedMessage = (text ?? message).trim();
    if (!trimmedMessage || loading) return;

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: trimmedMessage }];
    setMessages(newMessages);
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmedMessage,
          patientId: patientId ?? undefined,
          practitionerId: practitionerIdFromDb ?? undefined,
        }),
      });
      const data = (await res.json()) as { response?: string; error?: string };
      const assistantReply =
        typeof data.response === "string" && data.response.trim()
          ? data.response
          : (data.error ?? "Une erreur est survenue.");
      setMessages([...newMessages, { role: "assistant", content: assistantReply }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Impossible de contacter le serveur." }]);
    } finally {
      setLoading(false);
    }
  };

  const sendJournal = async () => {
    if (!journalEntry.trim() || journalLoading) return;
    setJournalLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `L'utilisateur écrit dans son journal de gratitude : "${journalEntry}". Réponds de manière très encourageante, bienveillante et chaleureuse en 2-3 phrases. Sans markdown.`,
          patientId: patientId ?? undefined,
          practitionerId: practitionerIdFromDb ?? undefined,
        }),
      });
      const data = (await res.json()) as { response?: string };
      setJournalResponse(data.response ?? "Merci pour ce partage. 🌿");
      setJournalSent(true);
    } finally {
      setJournalLoading(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void send();
    }
  };

  const breathingLabel: Record<BreathingStep, string> = {
    idle: "",
    inhale: "Inspirez...",
    hold: "Retenez...",
    exhale: "Expirez...",
    done: "Bravo ! 🎉",
  };

  const breathingColor: Record<BreathingStep, string> = {
    idle: "#10b981",
    inhale: "#10b981",
    hold: "#6366f1",
    exhale: "#06b6d4",
    done: "#10b981",
  };

  const renderTool = () => {
    if (!activeTool) return null;

    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}>
        <div style={{
          background: "white", borderRadius: 24, padding: 32,
          width: "100%", maxWidth: 440,
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        }}>

          {/* COHÉRENCE CARDIAQUE */}
          {activeTool === "breathing" && (
            <div style={{ textAlign: "center" }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#0f172a" }}>🫁 Cohérence cardiaque</h2>
              <p style={{ margin: "0 0 24px", fontSize: 14, color: "#64748b" }}>5 cycles de respiration · 5 secondes chacun</p>

              {breathingStep === "idle" && (
                <>
                  <p style={{ fontSize: 15, color: "#374151", marginBottom: 24 }}>
                    La cohérence cardiaque réduit le stress et les envies de grignoter. Prenez 5 minutes pour vous.
                  </p>
                  <button onClick={startBreathing} style={{
                    width: "100%", height: 52, borderRadius: 26,
                    background: "linear-gradient(135deg, #34d399, #10b981)",
                    border: "none", color: "white", fontSize: 16, fontWeight: 600, cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(16,185,129,0.35)",
                  }}>
                    Commencer
                  </button>
                </>
              )}

              {breathingStep !== "idle" && breathingStep !== "done" && (
                <>
                  <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>Cycle {breathingCycle} / 5</p>
                  <div style={{
                    width: 120, height: 120, borderRadius: "50%",
                    background: `radial-gradient(circle, ${breathingColor[breathingStep]}, ${breathingColor[breathingStep]}88)`,
                    margin: "0 auto 24px",
                    transition: "transform 5s ease-in-out, background 1s",
                    transform: breathingStep === "inhale" ? "scale(1.3)" : breathingStep === "exhale" ? "scale(0.8)" : "scale(1.1)",
                    boxShadow: `0 8px 30px ${breathingColor[breathingStep]}44`,
                  }} />
                  <p style={{ fontSize: 22, fontWeight: 700, color: breathingColor[breathingStep] }}>
                    {breathingLabel[breathingStep]}
                  </p>
                  <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 8 }}>
                    {breathingStep === "inhale" ? "5 secondes" : breathingStep === "hold" ? "4 secondes" : "5 secondes"}
                  </p>
                </>
              )}

              {breathingStep === "done" && (
                <>
                  <div style={{ fontSize: 60, marginBottom: 16 }}>🎉</div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>
                    Excellent travail !
                  </h3>
                  <p style={{ fontSize: 15, color: "#64748b", marginBottom: 24 }}>
                    Vous venez de faire quelque chose de précieux pour vous. Votre corps vous remercie. 🌿
                  </p>
                  <button onClick={() => { setActiveTool(null); setBreathingStep("idle"); setBreathingCycle(0); }} style={{
                    width: "100%", height: 48, borderRadius: 24,
                    background: "linear-gradient(135deg, #34d399, #10b981)",
                    border: "none", color: "white", fontSize: 15, fontWeight: 600, cursor: "pointer",
                  }}>
                    Terminer
                  </button>
                </>
              )}

              {breathingStep === "idle" && (
                <button onClick={() => setActiveTool(null)} style={{
                  marginTop: 12, width: "100%", height: 44, borderRadius: 22,
                  background: "transparent", border: "1.5px solid #e2e8f0",
                  color: "#94a3b8", fontSize: 14, cursor: "pointer",
                }}>
                  Annuler
                </button>
              )}
            </div>
          )}

          {/* ANCRAGE 5-4-3-2-1 */}
          {activeTool === "ancrage" && (
            <div style={{ textAlign: "center" }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#0f172a" }}>🌊 Technique 5-4-3-2-1</h2>
              <p style={{ margin: "0 0 24px", fontSize: 14, color: "#64748b" }}>Ancrez-vous dans le moment présent</p>

              {ancrageStep < 5 ? (
                <>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>{ancrageSteps[ancrageStep].icon}</div>
                  <div style={{
                    background: "#f0fdf4", borderRadius: 16, padding: "20px 24px", marginBottom: 24,
                    border: "1.5px solid #d1fae5",
                  }}>
                    <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color: "#10b981" }}>
                      {ancrageSteps[ancrageStep].count}
                    </p>
                    <p style={{ margin: "8px 0 0", fontSize: 16, color: "#374151" }}>
                      chose{ancrageSteps[ancrageStep].count > 1 ? "s" : ""} que vous <strong>{ancrageSteps[ancrageStep].sense}</strong>
                    </p>
                  </div>
                  <p style={{ fontSize: 14, color: "#64748b", marginBottom: 24 }}>
                    Prenez le temps d'identifier chacune. Il n'y a pas de bonne ou mauvaise réponse.
                  </p>
                  <button onClick={() => setAncrageStep(prev => prev + 1)} style={{
                    width: "100%", height: 52, borderRadius: 26,
                    background: "linear-gradient(135deg, #34d399, #10b981)",
                    border: "none", color: "white", fontSize: 16, fontWeight: 600, cursor: "pointer",
                  }}>
                    {ancrageStep < 4 ? "Suivant →" : "Terminer"}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 60, marginBottom: 16 }}>✨</div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>
                    Vous êtes ancré(e) !
                  </h3>
                  <p style={{ fontSize: 15, color: "#64748b", marginBottom: 24 }}>
                    Vous venez de ramener votre esprit dans le moment présent. C'est un acte de soin envers vous-même. 🌿
                  </p>
                  <button onClick={() => { setActiveTool(null); setAncrageStep(0); }} style={{
                    width: "100%", height: 48, borderRadius: 24,
                    background: "linear-gradient(135deg, #34d399, #10b981)",
                    border: "none", color: "white", fontSize: 15, fontWeight: 600, cursor: "pointer",
                  }}>
                    Fermer
                  </button>
                </>
              )}

              {ancrageStep < 5 && (
                <button onClick={() => { setActiveTool(null); setAncrageStep(0); }} style={{
                  marginTop: 12, width: "100%", height: 44, borderRadius: 22,
                  background: "transparent", border: "1.5px solid #e2e8f0",
                  color: "#94a3b8", fontSize: 14, cursor: "pointer",
                }}>
                  Annuler
                </button>
              )}
            </div>
          )}

          {/* MARCHE CONSCIENTE */}
          {activeTool === "marche" && (
            <div style={{ textAlign: "center" }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#0f172a" }}>🚶 Marche consciente</h2>
              <p style={{ margin: "0 0 24px", fontSize: 14, color: "#64748b" }}>
                Étape {Math.min(marcheStep + 1, marcheSteps.length)} / {marcheSteps.length}
              </p>

              {marcheStep < marcheSteps.length ? (
                <>
                  <div style={{
                    background: "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))",
                    borderRadius: 16, padding: "24px", marginBottom: 24,
                    border: "1px solid rgba(16,185,129,0.15)",
                    minHeight: 100, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <p style={{ margin: 0, fontSize: 16, color: "#374151", lineHeight: 1.7, textAlign: "center" }}>
                      {marcheSteps[marcheStep]}
                    </p>
                  </div>
                  <div style={{ height: 4, background: "#e2e8f0", borderRadius: 2, marginBottom: 24 }}>
                    <div style={{
                      height: "100%", borderRadius: 2, background: "#10b981",
                      width: `${((marcheStep + 1) / marcheSteps.length) * 100}%`,
                      transition: "width 0.3s",
                    }} />
                  </div>
                  <button onClick={() => setMarcheStep(prev => prev + 1)} style={{
                    width: "100%", height: 52, borderRadius: 26,
                    background: "linear-gradient(135deg, #34d399, #10b981)",
                    border: "none", color: "white", fontSize: 16, fontWeight: 600, cursor: "pointer",
                  }}>
                    {marcheStep < marcheSteps.length - 1 ? "Suivant →" : "Terminer"}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 60, marginBottom: 16 }}>🌿</div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>
                    Belle promenade !
                  </h3>
                  <p style={{ fontSize: 15, color: "#64748b", marginBottom: 24 }}>
                    Chaque pas conscient est une victoire. Vous avez pris soin de votre corps et de votre esprit. 💚
                  </p>
                  <button onClick={() => { setActiveTool(null); setMarcheStep(0); setMarcheText(""); }} style={{
                    width: "100%", height: 48, borderRadius: 24,
                    background: "linear-gradient(135deg, #34d399, #10b981)",
                    border: "none", color: "white", fontSize: 15, fontWeight: 600, cursor: "pointer",
                  }}>
                    Fermer
                  </button>
                </>
              )}

              {marcheStep < marcheSteps.length && (
                <button onClick={() => { setActiveTool(null); setMarcheStep(0); }} style={{
                  marginTop: 12, width: "100%", height: 44, borderRadius: 22,
                  background: "transparent", border: "1.5px solid #e2e8f0",
                  color: "#94a3b8", fontSize: 14, cursor: "pointer",
                }}>
                  Annuler
                </button>
              )}
            </div>
          )}

          {/* MANGER EN PLEINE CONSCIENCE */}
          {activeTool === "manger" && (
            <div style={{ textAlign: "center" }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#0f172a" }}>🍽️ Manger en pleine conscience</h2>
              <p style={{ margin: "0 0 24px", fontSize: 14, color: "#64748b" }}>Avant de commencer votre repas</p>

              <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 16, marginBottom: 28 }}>
                {[
                  { icon: "📵", text: "Posez votre téléphone. Ce repas mérite toute votre attention." },
                  { icon: "👀", text: "Regardez votre assiette. Observez les couleurs, les textures, les formes." },
                  { icon: "🫁", text: "Prenez 3 respirations profondes avant de commencer." },
                  { icon: "🐢", text: "Mangez lentement. Posez vos couverts entre chaque bouchée." },
                  { icon: "💚", text: "Il n'y a pas d'aliment interdit. Chaque repas est une occasion de prendre soin de vous, pas une épreuve." },
                  { icon: "🌟", text: "Vous êtes ici, vous mangez, vous prenez soin de vous. C'est déjà beaucoup." },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                    <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.6 }}>{item.text}</p>
                  </div>
                ))}
              </div>

              <button onClick={() => setActiveTool(null)} style={{
                width: "100%", height: 52, borderRadius: 26,
                background: "linear-gradient(135deg, #34d399, #10b981)",
                border: "none", color: "white", fontSize: 16, fontWeight: 600, cursor: "pointer",
              }}>
                Bon appétit 🌿
              </button>
            </div>
          )}

          {/* JOURNAL DE GRATITUDE */}
          {activeTool === "journal" && (
            <div>
              <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#0f172a" }}>✍️ Journal de gratitude</h2>
              <p style={{ margin: "0 0 20px", fontSize: 14, color: "#64748b" }}>
                Notez 3 choses pour lesquelles vous êtes reconnaissant(e) aujourd'hui
              </p>

              {!journalSent ? (
                <>
                  <textarea
                    value={journalEntry}
                    onChange={(e) => setJournalEntry(e.target.value)}
                    placeholder="Aujourd'hui je suis reconnaissant(e) pour..."
                    rows={5}
                    style={{
                      width: "100%", borderRadius: 16,
                      border: "1.5px solid #e2e8f0",
                      padding: "14px 16px", fontSize: 15, outline: "none",
                      background: "#f8fafc", color: "#0f172a",
                      boxSizing: "border-box", resize: "none",
                      fontFamily: "'Inter', sans-serif", lineHeight: 1.6,
                    }}
                    onFocus={(e) => e.target.style.borderColor = "#10b981"}
                    onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
                  />
                  <button
                    onClick={() => void sendJournal()}
                    disabled={!journalEntry.trim() || journalLoading}
                    style={{
                      marginTop: 12, width: "100%", height: 52, borderRadius: 26,
                      background: !journalEntry.trim() || journalLoading ? "#e2e8f0" : "linear-gradient(135deg, #34d399, #10b981)",
                      border: "none",
                      color: !journalEntry.trim() || journalLoading ? "#94a3b8" : "white",
                      fontSize: 15, fontWeight: 600,
                      cursor: !journalEntry.trim() || journalLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    {journalLoading ? "Envoi..." : "Partager mon journal 💚"}
                  </button>
                  <button onClick={() => setActiveTool(null)} style={{
                    marginTop: 10, width: "100%", height: 44, borderRadius: 22,
                    background: "transparent", border: "1.5px solid #e2e8f0",
                    color: "#94a3b8", fontSize: 14, cursor: "pointer",
                  }}>
                    Annuler
                  </button>
                </>
              ) : (
                <>
                  <div style={{
                    background: "#f0fdf4", borderRadius: 16, padding: "16px 20px",
                    border: "1.5px solid #d1fae5", marginBottom: 16,
                  }}>
                    <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>Votre entrée :</p>
                    <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.6, fontStyle: "italic" }}>
                      "{journalEntry}"
                    </p>
                  </div>
                  <div style={{
                    background: "white", borderRadius: 16, padding: "16px 20px",
                    border: "1.5px solid #e2e8f0", marginBottom: 20,
                    display: "flex", gap: 12, alignItems: "flex-start",
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 16, flexShrink: 0,
                      background: "linear-gradient(135deg, #6ee7b7, #10b981)",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                    }}>🌿</div>
                    <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.7 }}>
                      {journalResponse}
                    </p>
                  </div>
                  <button onClick={() => { setActiveTool(null); setJournalEntry(""); setJournalResponse(""); setJournalSent(false); }} style={{
                    width: "100%", height: 48, borderRadius: 24,
                    background: "linear-gradient(135deg, #34d399, #10b981)",
                    border: "none", color: "white", fontSize: 15, fontWeight: 600, cursor: "pointer",
                  }}>
                    Fermer 🌿
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#f8fafc",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      {renderTool()}

      <div style={{ display: "flex", flex: 1, position: "relative" }}>

        {/* Sidebar overlay */}
        {sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 20,
          }} />
        )}

        {/* Sidebar */}
        <aside style={{
          width: 290, background: "white",
          borderRight: "1px solid rgba(0,0,0,0.06)",
          display: "flex", flexDirection: "column",
          position: "fixed", top: 0, left: sidebarOpen ? 0 : -300, bottom: 0,
          zIndex: 30, transition: "left 0.3s ease",
          overflowY: "auto", boxShadow: sidebarOpen ? "4px 0 24px rgba(0,0,0,0.1)" : "none",
        }}>
          <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Mon espace</h2>
              <button onClick={() => setSidebarOpen(false)} style={{
                background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8",
              }}>×</button>
            </div>

            {/* Nouvelle conversation */}
            <button
              onClick={() => { setMessages([]); setSidebarOpen(false); }}
              style={{
                width: "100%", height: 40, borderRadius: 10,
                background: "linear-gradient(135deg, #34d399, #10b981)",
                border: "none", color: "white", fontSize: 13, fontWeight: 600,
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", gap: 8,
              }}
            >
              ✏️ Nouvelle conversation
            </button>
          </div>

          {/* Outils bien-être */}
          <div style={{ padding: "16px" }}>
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.8px", textTransform: "uppercase" }}>
              🌿 Outils bien-être
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => { setActiveTool(tool.id as Tool); setSidebarOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 10,
                    background: "#f8fafc", border: "1.5px solid #e2e8f0",
                    cursor: "pointer", transition: "all 0.2s", textAlign: "left",
                    fontSize: 13, fontWeight: 500, color: "#374151",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f0fdf4";
                    e.currentTarget.style.borderColor = "#10b981";
                    e.currentTarget.style.color = "#059669";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#f8fafc";
                    e.currentTarget.style.borderColor = "#e2e8f0";
                    e.currentTarget.style.color = "#374151";
                  }}
                >
                  <span style={{ fontSize: 18 }}>{tool.emoji}</span>
                  {tool.label}
                </button>
              ))}
            </div>
          </div>

          {/* Discussions récentes */}
          {messages.length > 0 && (
            <div style={{ padding: "0 16px 16px", flex: 1 }}>
              <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.8px", textTransform: "uppercase" }}>
                💬 Discussion récente
              </p>
              <div style={{
                padding: "10px 12px", borderRadius: 10,
                background: "#f0fdf4", border: "1.5px solid #d1fae5",
                fontSize: 13, color: "#059669", fontWeight: 500,
              }}>
                {messages.filter(m => m.role === "user").slice(-1)[0]?.content.slice(0, 40)}...
              </div>
            </div>
          )}
        </aside>

        {/* Zone chat */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

          {/* Header */}
          <header style={{
            background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(0,0,0,0.05)",
            padding: "14px 20px", position: "sticky", top: 0, zIndex: 10,
            boxShadow: "0 1px 20px rgba(0,0,0,0.04)",
          }}>
            <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", alignItems: "center", gap: 14 }}>
              <button onClick={() => setSidebarOpen(true)} style={{
                width: 40, height: 40, borderRadius: 12,
                background: "#f0fdf4", border: "1.5px solid #d1fae5",
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 18, flexShrink: 0,
              }}>🌿</button>

              <div style={{ position: "relative" }}>
                <div style={{
                  position: "absolute", inset: -4, borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(16,185,129,0.25), transparent 70%)",
                  animation: "halo 2.5s ease-in-out infinite",
                }} />
                <div style={{
                  width: 46, height: 46, borderRadius: 23,
                  background: "linear-gradient(135deg, #6ee7b7, #10b981)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, boxShadow: "0 4px 14px rgba(16,185,129,0.3)", position: "relative",
                }}>🌿</div>
                <div style={{
                  position: "absolute", bottom: 1, right: 1,
                  width: 12, height: 12, borderRadius: "50%",
                  background: "#10b981", border: "2.5px solid white",
                  animation: "pulse-dot 2s infinite",
                }} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>Compagnon de suivi</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Jumeau numérique de{" "}
                  <span style={{ color: "#10b981", fontWeight: 600 }}>{practitionerName}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", animation: "pulse-dot 2s infinite" }} />
                  <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>En ligne</span>
                </div>
              </div>
            </div>
          </header>

          {/* Messages */}
          <main style={{ maxWidth: 680, width: "100%", margin: "0 auto", padding: "28px 16px 160px", flex: 1 }}>

            {messages.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 19,
                    background: "linear-gradient(135deg, #6ee7b7, #10b981)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, flexShrink: 0, boxShadow: "0 3px 10px rgba(16,185,129,0.25)",
                  }}>🌿</div>
                  <div style={{
                    background: "white", borderRadius: "22px 22px 22px 6px",
                    padding: "14px 20px", maxWidth: "80%",
                    boxShadow: "0 2px 16px rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.04)",
                  }}>
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "#374151" }}>
                      {patientFirstName
                        ? `Bonjour ${patientFirstName} ! 🌱 Je suis votre compagnon de suivi, créé à partir de l'expertise de ${practitionerName}. Posez-moi vos questions, je suis là pour vous accompagner entre vos consultations.`
                        : `Bonjour ! 🌱 Je suis votre compagnon de suivi, créé à partir de l'expertise de ${practitionerName}. Posez-moi vos questions, je suis là pour vous accompagner entre vos consultations.`
                      }
                    </p>
                  </div>
                </div>

                <div style={{ marginTop: 20, paddingLeft: 48 }}>
                  <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12, fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase" }}>
                    Questions fréquentes
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {quickActions.map((action) => (
                      <button
                        key={action}
                        onClick={() => void send(action)}
                        style={{
                          background: "white", border: "1.5px solid #d1fae5",
                          borderRadius: 22, padding: "9px 16px", fontSize: 13,
                          color: "#059669", cursor: "pointer", fontWeight: 500,
                          transition: "all 0.2s", boxShadow: "0 1px 6px rgba(16,185,129,0.08)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#f0fdf4";
                          e.currentTarget.style.borderColor = "#10b981";
                          e.currentTarget.style.transform = "translateY(-1px)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "white";
                          e.currentTarget.style.borderColor = "#d1fae5";
                          e.currentTarget.style.transform = "translateY(0)";
                        }}
                      >{action}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {messages.map((chatMessage, index) => {
                const isUser = chatMessage.role === "user";
                return (
                  <div key={`${chatMessage.role}-${index}`} style={{
                    display: "flex", justifyContent: isUser ? "flex-end" : "flex-start",
                    alignItems: "flex-end", gap: 10, animation: "fadeUp 0.3s ease",
                  }}>
                    {!isUser && (
                      <div style={{
                        width: 38, height: 38, borderRadius: 19,
                        background: "linear-gradient(135deg, #6ee7b7, #10b981)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 18, flexShrink: 0, boxShadow: "0 3px 10px rgba(16,185,129,0.25)",
                      }}>🌿</div>
                    )}
                    <div style={{
                      maxWidth: "78%", padding: "14px 20px",
                      borderRadius: isUser ? "22px 22px 6px 22px" : "22px 22px 22px 6px",
                      background: isUser ? "#10b981" : "white",
                      color: isUser ? "white" : "#374151",
                      fontSize: 15, lineHeight: 1.7,
                      boxShadow: isUser ? "0 4px 16px rgba(16,185,129,0.35)" : "0 2px 16px rgba(0,0,0,0.06)",
                      border: isUser ? "none" : "1px solid rgba(0,0,0,0.04)",
                    }}>
                      {chatMessage.content}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 19,
                    background: "linear-gradient(135deg, #6ee7b7, #10b981)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, boxShadow: "0 3px 10px rgba(16,185,129,0.25)",
                  }}>🌿</div>
                  <div style={{
                    background: "white", borderRadius: "22px 22px 22px 6px",
                    padding: "16px 22px", display: "flex", gap: 6, alignItems: "center",
                    boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
                  }}>
                    {[0, 200, 400].map((delay, i) => (
                      <div key={i} style={{
                        width: 9, height: 9, borderRadius: "50%", background: "#10b981",
                        animation: `bounce 1.4s infinite ${delay}ms`,
                      }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </main>

          {/* Input */}
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0,
            background: "rgba(248,250,252,0.92)",
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            borderTop: "1px solid rgba(0,0,0,0.05)",
            padding: "14px 16px",
            paddingBottom: "max(18px, env(safe-area-inset-bottom))",
            boxShadow: "0 -4px 24px rgba(0,0,0,0.04)",
          }}>
            <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", gap: 10, alignItems: "center" }}>
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Posez votre question..."
                style={{
                  flex: 1, height: 52, borderRadius: 26,
                  border: "1.5px solid #e2e8f0", padding: "0 22px",
                  fontSize: 15, outline: "none", background: "white", color: "#0f172a",
                  boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#10b981";
                  e.target.style.boxShadow = "0 0 0 3px rgba(16,185,129,0.1)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#e2e8f0";
                  e.target.style.boxShadow = "0 1px 6px rgba(0,0,0,0.04)";
                }}
              />
              <button
                onClick={() => void send()}
                disabled={loading || !message.trim()}
                style={{
                  width: 52, height: 52, borderRadius: 26,
                  background: loading || !message.trim() ? "#e2e8f0" : "linear-gradient(135deg, #34d399, #10b981)",
                  border: "none",
                  cursor: loading || !message.trim() ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: loading || !message.trim() ? "#94a3b8" : "white",
                  boxShadow: loading || !message.trim() ? "none" : "0 4px 16px rgba(16,185,129,0.4)",
                  transition: "all 0.2s", flexShrink: 0,
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ width: 20, height: 20 }}>
                  <path d="M5 12h13" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-8px); opacity: 1; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        @keyframes halo {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
