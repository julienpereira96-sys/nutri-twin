"use client";

import { KeyboardEvent, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const practitionerName = "Dr. Martin";

const affirmations = [
  "Chaque repas est une opportunité de prendre soin de vous.",
  "Votre corps mérite votre bienveillance aujourd'hui.",
  "Un petit pas chaque jour mène à de grands changements.",
  "Vous faites de votre mieux, et c'est déjà beaucoup.",
  "Manger avec plaisir fait partie d'une alimentation saine.",
  "Votre relation avec la nourriture peut évoluer, doucement.",
  "Chaque journée est une nouvelle chance de prendre soin de vous.",
];

const quickActions = [
  "Je peux manger des pâtes le soir ?",
  "Comment gérer une fringale ?",
  "Quels sont les bons en-cas ?",
  "J'ai faim après mes repas",
];

const badges = [
  { emoji: "💧", label: "Hydratation au top" },
  { emoji: "🧘", label: "Repas en pleine conscience" },
  { emoji: "🥗", label: "Légumes du jour" },
  { emoji: "⭐", label: "Objectif atteint" },
];

type BreathingStep = "idle" | "inhale" | "hold" | "exhale";

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [breathing, setBreathing] = useState<BreathingStep>("idle");
  const [earnedBadges, setEarnedBadges] = useState<number[]>([0, 2]);
  const affirmation = affirmations[new Date().getDay() % affirmations.length];

  const startBreathing = () => {
    setBreathing("inhale");
    setTimeout(() => setBreathing("hold"), 4000);
    setTimeout(() => setBreathing("exhale"), 8000);
    setTimeout(() => setBreathing("idle"), 12000);
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
        body: JSON.stringify({ message: trimmedMessage }),
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

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void send();
    }
  };

  const breathingLabel: Record<BreathingStep, string> = {
    idle: "Démarrer",
    inhale: "Inspirez... 4s",
    hold: "Retenez... 4s",
    exhale: "Expirez... 4s",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f8fafc",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>

      {/* Affirmation du jour */}
      <div style={{
        background: "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))",
        borderBottom: "1px solid rgba(16,185,129,0.12)",
        padding: "10px 20px",
        textAlign: "center",
      }}>
        <p style={{ margin: 0, fontSize: 13, color: "#059669", fontStyle: "italic", fontWeight: 500 }}>
          ✨ {affirmation}
        </p>
      </div>

      {/* Layout principal */}
      <div style={{ display: "flex", flex: 1, position: "relative" }}>

        {/* Sidebar */}
        <>
          {/* Overlay mobile */}
          {sidebarOpen && (
            <div
              onClick={() => setSidebarOpen(false)}
              style={{
                position: "fixed", inset: 0,
                background: "rgba(0,0,0,0.3)",
                zIndex: 20,
                display: "block",
              }}
            />
          )}

          <aside style={{
            width: 280,
            background: "white",
            borderRight: "1px solid rgba(0,0,0,0.06)",
            display: "flex",
            flexDirection: "column",
            gap: 20,
            padding: "24px 16px",
            position: "fixed",
            top: 0,
            left: sidebarOpen ? 0 : -300,
            bottom: 0,
            zIndex: 30,
            transition: "left 0.3s ease",
            overflowY: "auto",
            boxShadow: sidebarOpen ? "4px 0 24px rgba(0,0,0,0.1)" : "none",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                Mon espace
              </h2>
              <button
                onClick={() => setSidebarOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8" }}
              >
                ×
              </button>
            </div>

            {/* Affirmation glassmorphism */}
            <div style={{
              background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))",
              borderRadius: 16,
              padding: "16px",
              border: "1px solid rgba(16,185,129,0.2)",
              backdropFilter: "blur(8px)",
            }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#10b981", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>
                ✨ Affirmation du jour
              </p>
              <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.6, fontStyle: "italic" }}>
                "{affirmation}"
              </p>
            </div>

            {/* Tableau des victoires */}
            <div>
              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.8px", textTransform: "uppercase" }}>
                🏆 Mes victoires
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {badges.map((badge, i) => (
                  <div
                    key={i}
                    onClick={() => setEarnedBadges(prev =>
                      prev.includes(i) ? prev.filter(b => b !== i) : [...prev, i]
                    )}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px",
                      borderRadius: 12,
                      background: earnedBadges.includes(i) ? "#f0fdf4" : "#f8fafc",
                      border: `1.5px solid ${earnedBadges.includes(i) ? "#10b981" : "#e2e8f0"}`,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      opacity: earnedBadges.includes(i) ? 1 : 0.5,
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{badge.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: earnedBadges.includes(i) ? "#059669" : "#94a3b8" }}>
                      {badge.label}
                    </span>
                    {earnedBadges.includes(i) && (
                      <span style={{ marginLeft: "auto", fontSize: 14 }}>✅</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* SOS Calme */}
            <div style={{ marginTop: "auto" }}>
              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.8px", textTransform: "uppercase" }}>
                🧘 SOS Calme
              </p>
              {breathing !== "idle" ? (
                <div style={{
                  textAlign: "center",
                  padding: "20px",
                  background: "#f0fdf4",
                  borderRadius: 16,
                  border: "1.5px solid #10b981",
                }}>
                  <div style={{
                    width: 70, height: 70,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, #10b981, #6ee7b7)",
                    margin: "0 auto 12px",
                    animation: breathing === "inhale" ? "grow 4s ease-in-out" :
                              breathing === "exhale" ? "shrink 4s ease-in-out" : "none",
                    boxShadow: "0 4px 20px rgba(16,185,129,0.4)",
                  }} />
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#059669" }}>
                    {breathingLabel[breathing]}
                  </p>
                </div>
              ) : (
                <button
                  onClick={startBreathing}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: 14,
                    background: "linear-gradient(135deg, #6ee7b7, #10b981)",
                    border: "none",
                    color: "white",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(16,185,129,0.3)",
                  }}
                >
                  🫁 Guide de respiration
                </button>
              )}
            </div>
          </aside>
        </>

        {/* Zone chat */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

          {/* Header */}
          <header style={{
            background: "rgba(255,255,255,0.9)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(0,0,0,0.05)",
            padding: "14px 20px",
            position: "sticky",
            top: 0,
            zIndex: 10,
            boxShadow: "0 1px 20px rgba(0,0,0,0.04)",
          }}>
            <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", alignItems: "center", gap: 14 }}>
              {/* Bouton sidebar */}
              <button
                onClick={() => setSidebarOpen(true)}
                style={{
                  width: 40, height: 40,
                  borderRadius: 12,
                  background: "#f0fdf4",
                  border: "1.5px solid #d1fae5",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                🌿
              </button>

              {/* Avatar */}
              <div style={{ position: "relative" }}>
                <div style={{
                  position: "absolute", inset: -4, borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(16,185,129,0.25), transparent 70%)",
                  animation: "halo 2.5s ease-in-out infinite",
                }} />
                <div style={{
                  width: 46, height: 46, borderRadius: 23,
                  background: "linear-gradient(135deg, #6ee7b7, #10b981)",
                  display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 22,
                  boxShadow: "0 4px 14px rgba(16,185,129,0.3)",
                  position: "relative",
                }}>
                  🌿
                </div>
                <div style={{
                  position: "absolute", bottom: 1, right: 1,
                  width: 12, height: 12, borderRadius: "50%",
                  background: "#10b981", border: "2.5px solid white",
                  animation: "pulse-dot 2s infinite",
                }} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>
                  Compagnon de suivi
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Jumeau numérique de{" "}
                  <span style={{ color: "#10b981", fontWeight: 600 }}>{practitionerName}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: "#10b981",
                    animation: "pulse-dot 2s infinite",
                  }} />
                  <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>En ligne</span>
                </div>
              </div>
            </div>
          </header>

          {/* Messages */}
          <main style={{ maxWidth: 680, width: "100%", margin: "0 auto", padding: "28px 16px 160px", flex: 1 }}>

            {messages.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  `Bonjour ! Je suis votre compagnon de suivi nutritionnel, créé à partir de l'expertise de ${practitionerName}. 🌱`,
                  "Je suis disponible entre vos consultations pour répondre à vos questions et vous encourager.",
                ].map((text, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
                    {i === 0 ? (
                      <div style={{
                        width: 38, height: 38, borderRadius: 19,
                        background: "linear-gradient(135deg, #6ee7b7, #10b981)",
                        display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 18, flexShrink: 0,
                        boxShadow: "0 3px 10px rgba(16,185,129,0.25)",
                      }}>🌿</div>
                    ) : (
                      <div style={{ width: 38, flexShrink: 0 }} />
                    )}
                    <div style={{
                      background: "white",
                      borderRadius: "22px 22px 22px 6px",
                      padding: "14px 20px",
                      maxWidth: "80%",
                      boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
                      border: "1px solid rgba(0,0,0,0.04)",
                    }}>
                      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "#374151" }}>{text}</p>
                    </div>
                  </div>
                ))}

                <div style={{ marginTop: 24, paddingLeft: 48 }}>
                  <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12, fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase" }}>
                    Par où commencer ?
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {quickActions.map((action) => (
                      <button
                        key={action}
                        onClick={() => void send(action)}
                        style={{
                          background: "white",
                          border: "1.5px solid #d1fae5",
                          borderRadius: 22,
                          padding: "9px 16px",
                          fontSize: 13,
                          color: "#059669",
                          cursor: "pointer",
                          fontWeight: 500,
                          transition: "all 0.2s",
                          boxShadow: "0 1px 6px rgba(16,185,129,0.08)",
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
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {messages.map((chatMessage, index) => {
                const isUser = chatMessage.role === "user";
                return (
                  <div
                    key={`${chatMessage.role}-${index}`}
                    style={{
                      display: "flex",
                      justifyContent: isUser ? "flex-end" : "flex-start",
                      alignItems: "flex-end",
                      gap: 10,
                      animation: "fadeUp 0.3s ease",
                    }}
                  >
                    {!isUser && (
                      <div style={{
                        width: 38, height: 38, borderRadius: 19,
                        background: "linear-gradient(135deg, #6ee7b7, #10b981)",
                        display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 18, flexShrink: 0,
                        boxShadow: "0 3px 10px rgba(16,185,129,0.25)",
                      }}>🌿</div>
                    )}
                    <div style={{
                      maxWidth: "78%",
                      padding: "14px 20px",
                      borderRadius: isUser ? "22px 22px 6px 22px" : "22px 22px 22px 6px",
                      background: isUser ? "#10b981" : "white",
                      color: isUser ? "white" : "#374151",
                      fontSize: 15,
                      lineHeight: 1.7,
                      boxShadow: isUser
                        ? "0 4px 16px rgba(16,185,129,0.35)"
                        : "0 2px 16px rgba(0,0,0,0.06)",
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
                    display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 18,
                    boxShadow: "0 3px 10px rgba(16,185,129,0.25)",
                  }}>🌿</div>
                  <div style={{
                    background: "white",
                    borderRadius: "22px 22px 22px 6px",
                    padding: "16px 22px",
                    display: "flex", gap: 6, alignItems: "center",
                    boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
                  }}>
                    {[0, 200, 400].map((delay, i) => (
                      <div key={i} style={{
                        width: 9, height: 9, borderRadius: "50%",
                        background: "#10b981",
                        animation: `bounce 1.4s infinite ${delay}ms`,
                      }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* Input */}
          <div style={{
            position: "fixed",
            bottom: 0, left: 0, right: 0,
            background: "rgba(248,250,252,0.92)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
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
                  border: "1.5px solid #e2e8f0",
                  padding: "0 22px", fontSize: 15, outline: "none",
                  background: "white", color: "#0f172a",
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
                  background: loading || !message.trim()
                    ? "#e2e8f0"
                    : "linear-gradient(135deg, #34d399, #10b981)",
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
        @keyframes grow {
          from { transform: scale(0.8); }
          to { transform: scale(1.2); }
        }
        @keyframes shrink {
          from { transform: scale(1.2); }
          to { transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
