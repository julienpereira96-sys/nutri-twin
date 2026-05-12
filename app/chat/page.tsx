"use client";

import { KeyboardEvent, useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import JournalModal from "./JournalModal";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  hidden?: boolean;
};

type Tool = "breathing" | "ancrage" | "marche" | "manger" | "journal" | null;
type BreathingStep = "idle" | "inhale" | "hold" | "exhale" | "done";

type Session = {
  id: string;
  title: string;
  last_message_at: string;
};

const quickActions = [
  "J'ai craqué ce soir, que faire ?",
  "Pourquoi j'ai encore faim après avoir mangé ?",
  "Que manger quand je rentre tard ?",
  "Comment résister à une fringale ?",
  "Comment rester motivé ?",
  "Pourquoi je ne vois pas de résultats ?",
];

const tools = [
  { id: "breathing", emoji: "🫁", label: "Respirer" },
  { id: "ancrage", emoji: "🌊", label: "S'apaiser" },
  { id: "marche", emoji: "🚶", label: "Se vider la tête" },
  { id: "manger", emoji: "🍽️", label: "Manger en pleine conscience" },
];

async function compressImage(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width, height = img.height;
        if (width > 1024 || height > 1024) {
          if (width > height) { height = Math.round((height * 1024) / width); width = 1024; }
          else { width = Math.round((width * 1024) / height); height = 1024; }
        }
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
        resolve({ base64: canvas.toDataURL("image/jpeg", 0.7).split(",")[1], mimeType: "image/jpeg" });
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const emerald = "#10b981";

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientFirstName, setPatientFirstName] = useState<string>("");
  const [practitionerIdFromDb, setPractitionerIdFromDb] = useState<string | null>(null);
  const [practitionerName, setPractitionerName] = useState("votre praticien");
  const [practitionerPlan, setPractitionerPlan] = useState<string>("essentiel");
  const [isMobile, setIsMobile] = useState(false);
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [imageCompressing, setImageCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [pendingImage, setPendingImage] = useState<{ base64: string; mimeType: string; previewUrl: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);
  const [breathingStep, setBreathingStep] = useState<BreathingStep>("idle");
  const [breathingCycle, setBreathingCycle] = useState(0);
  const [breathingTimer, setBreathingTimer] = useState(0);
  const breathingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [ancrageStep, setAncrageStep] = useState(0);
  const [marcheStep, setMarcheStep] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasMessages = messages.filter(m => !m.hidden).length > 0;

  const ancrageSteps = [
    { count: 5, sense: "voyez", icon: "👀" },
    { count: 4, sense: "touchez", icon: "🤲" },
    { count: 3, sense: "entendez", icon: "👂" },
    { count: 2, sense: "sentez", icon: "👃" },
    { count: 1, sense: "goûtez", icon: "👅" },
  ];

  const marcheSteps = [
    "Levez-vous doucement. Sentez vos pieds sur le sol. Respirez profondément.",
    "Commencez à marcher lentement. Portez attention à chaque pas.",
    "Observez votre environnement. Quelles couleurs, quelles formes ?",
    "Sentez l'air sur votre peau. La température, le mouvement autour de vous.",
    "Portez votre attention sur votre respiration.",
    "Vous êtes ancré dans le moment présent. Chaque pas est une intention. 🌿",
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const loadSessions = useCallback(async (pid: string) => {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await supabase.from("conversations_sessions").select("id, title, last_message_at").eq("patient_id", pid).order("last_message_at", { ascending: false }).limit(15);
    if (data) setSessions(data as Session[]);
  }, []);

  useEffect(() => {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setPatientId(data.user.id);
      const { data: relation } = await supabase.from("patient_practitioner").select("practitioner_id").eq("patient_id", data.user.id).single();
      if (relation) {
        const practId = relation.practitioner_id as string;
        setPractitionerIdFromDb(practId);
        const { data: practitioner } = await supabase.from("practitioners").select("first_name, last_name, plan").eq("user_id", practId).single();
        if (practitioner) {
          const p = practitioner as { first_name: string; last_name: string; plan: string };
          setPractitionerName(`${p.first_name} ${p.last_name}`);
          setPractitionerPlan(p.plan || "essentiel");
        }
        const { data: history } = await supabase.from("conversations").select("role, content").eq("patient_id", data.user.id).eq("practitioner_id", practId).is("session_id", null).order("created_at", { ascending: true });
        if (history?.length) setMessages(history as ChatMessage[]);
      }
      const { data: patient } = await supabase.from("patients").select("first_name").eq("user_id", data.user.id).single();
      if (patient) { const p = patient as { first_name?: string }; if (p.first_name) setPatientFirstName(p.first_name); }
      await loadSessions(data.user.id);
    });
  }, [loadSessions]);

  useEffect(() => () => { if (breathingIntervalRef.current) clearInterval(breathingIntervalRef.current); }, []);

  const closeTool = useCallback((toolId?: string) => {
    setActiveTool(null);
    setBreathingStep("idle"); setBreathingCycle(0); setBreathingTimer(0);
    if (breathingIntervalRef.current) clearInterval(breathingIntervalRef.current);
    setAncrageStep(0); setMarcheStep(0);
    if (toolId) {
      const names: Record<string, string> = { breathing: "cohérence cardiaque", ancrage: "ancrage sensoriel 5-4-3-2-1", marche: "marche consciente", manger: "pleine conscience alimentaire" };
      if (names[toolId]) void sendHidden(`[INFO : Le patient vient de terminer une séance de ${names[toolId]}. Adapte ton prochain message subtilement.]`);
    }
  }, []);

  const sendHidden = async (msg: string) => {
    if (!patientId || !practitionerIdFromDb) return;
    try {
      await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg, patientId, practitionerId: practitionerIdFromDb, sessionId: currentSessionId ?? undefined }) });
    } catch { /* silencieux */ }
  };

  const createSession = async (firstMessage: string) => {
    if (!patientId || !practitionerIdFromDb) return null;
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await supabase.from("conversations_sessions").insert({ patient_id: patientId, practitioner_id: practitionerIdFromDb, title: firstMessage.slice(0, 40) + (firstMessage.length > 40 ? "..." : ""), last_message: firstMessage, last_message_at: new Date().toISOString() }).select().single();
    return (data as { id: string } | null)?.id ?? null;
  };

  const loadSession = async (sessionId: string) => {
    if (!patientId || !practitionerIdFromDb) return;
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await supabase.from("conversations").select("role, content").eq("patient_id", patientId).eq("practitioner_id", practitionerIdFromDb).eq("session_id", sessionId).order("created_at", { ascending: true });
    if (data) { setMessages(data as ChatMessage[]); setCurrentSessionId(sessionId); if (isMobile) setSidebarOpen(false); }
  };

  const deleteSession = async (sessionId: string) => {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    await supabase.from("conversations_sessions").delete().eq("id", sessionId);
    if (currentSessionId === sessionId) { setMessages([]); setCurrentSessionId(null); }
    if (patientId) await loadSessions(patientId);
  };

  const handleImageClick = () => {
    if (!["pro", "cabinet", "fondateur"].includes(practitionerPlan)) { setShowUpsellModal(true); return; }
    fileInputRef.current?.click();
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageCompressing(true); setCompressionProgress(0);
    try {
      const pi = setInterval(() => setCompressionProgress(p => Math.min(p + 30, 90)), 100);
      const compressed = await compressImage(file);
      clearInterval(pi); setCompressionProgress(100);
      setTimeout(() => { setImageCompressing(false); setCompressionProgress(0); setPendingImage({ ...compressed, previewUrl: `data:image/jpeg;base64,${compressed.base64}` }); }, 300);
    } catch { setImageCompressing(false); setCompressionProgress(0); }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startBreathing = () => {
    let cycle = 1, phase: BreathingStep = "inhale", timer = 5;
    setBreathingStep("inhale"); setBreathingCycle(1); setBreathingTimer(5);
    const dur: Record<string, number> = { inhale: 5, hold: 4, exhale: 5 };
    const interval = setInterval(() => {
      timer--; setBreathingTimer(timer);
      if (timer <= 0) {
        if (phase === "inhale") { phase = "hold"; timer = dur.hold; setBreathingStep("hold"); setBreathingTimer(timer); }
        else if (phase === "hold") { phase = "exhale"; timer = dur.exhale; setBreathingStep("exhale"); setBreathingTimer(timer); }
        else { cycle++; if (cycle <= 5) { phase = "inhale"; timer = dur.inhale; setBreathingStep("inhale"); setBreathingCycle(cycle); setBreathingTimer(timer); } else { setBreathingStep("done"); clearInterval(interval); } }
      }
    }, 1000);
    breathingIntervalRef.current = interval;
  };

  const abortControllerRef = useRef<AbortController | null>(null);

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
    setLoading(false);
  };

  const send = async (text?: string) => {
    const trimmed = (text ?? message).trim();
    if ((!trimmed && !pendingImage) || loading) return;
    let sessionId = currentSessionId;
    if (!sessionId) { sessionId = await createSession(trimmed || "📷 Photo"); setCurrentSessionId(sessionId); }
    const img = pendingImage;
    const newMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed || "📷 Photo de repas", imageUrl: img?.previewUrl }];
    setMessages(newMessages); setMessage(""); setPendingImage(null); setLoading(true);

    // Message assistant vide qu'on va remplir au fur et à mesure
    const assistantIndex = newMessages.length;
    setMessages([...newMessages, { role: "assistant", content: "" }]);

    abortControllerRef.current = new AbortController();

    try {
      const body: Record<string, string | undefined> = {
        message: trimmed || "Analyse cette photo",
        patientId: patientId ?? undefined,
        practitionerId: practitionerIdFromDb ?? undefined,
        sessionId: sessionId ?? undefined,
      };
      if (img) { body.imageBase64 = img.base64; body.imageMimeType = img.mimeType; }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error("Erreur serveur");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        // Retirer le JSON technique avant affichage
        const cleanText = fullText.replace(/\|\|\|[\s\S]*?\|\|\|/, "").trim();

        setMessages(prev => {
          const updated = [...prev];
          updated[assistantIndex] = { role: "assistant", content: cleanText };
          return updated;
        });
      }

      if (patientId) await loadSessions(patientId);
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // Stop volontaire — on garde ce qui a été streamé
      } else {
        setMessages(prev => {
          const updated = [...prev];
          updated[assistantIndex] = { role: "assistant", content: "Impossible de contacter le serveur." };
          return updated;
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") { e.preventDefault(); void send(); } };
  const breathingLabel: Record<BreathingStep, string> = { idle: "", inhale: "Inspirez...", hold: "Retenez...", exhale: "Expirez...", done: "Bravo ! 🎉" };
  const breathingColor: Record<BreathingStep, string> = { idle: emerald, inhale: emerald, hold: "#6366f1", exhale: "#06b6d4", done: emerald };
  const visibleMessages = messages.filter(m => !m.hidden);

  const renderTool = () => {
    if (!activeTool) return null;
    if (activeTool === "journal") return <JournalModal patientId={patientId} practitionerId={practitionerIdFromDb} onClose={() => closeTool()} />;

    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#0d0d0d", borderRadius: 24, padding: 32, width: "100%", maxWidth: 440, border: "1px solid rgba(255,255,255,0.08)", position: "relative" }}>
          <button onClick={() => closeTool(activeTool)} style={{ position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>

          {activeTool === "breathing" && (
            <div style={{ textAlign: "center" }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "white" }}>🫁 Respirer</h2>
              <p style={{ margin: "0 0 24px", fontSize: 14, color: "#64748b" }}>5 cycles · 5s · 4s · 5s</p>
              {breathingStep === "idle" && <><p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 24, lineHeight: 1.7 }}>La cohérence cardiaque réduit le stress et les envies de grignoter.</p><button onClick={startBreathing} style={{ width: "100%", height: 52, borderRadius: 12, background: emerald, border: "none", color: "black", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Commencer</button></>}
              {breathingStep !== "idle" && breathingStep !== "done" && (
                <><p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Cycle {breathingCycle} / 5</p>
                  <div style={{ width: 140, height: 140, borderRadius: "50%", background: `radial-gradient(circle, ${breathingColor[breathingStep]}, ${breathingColor[breathingStep]}44)`, margin: "0 auto 24px", transition: "transform 1s ease-in-out", transform: breathingStep === "inhale" ? "scale(1.2)" : breathingStep === "exhale" ? "scale(0.85)" : "scale(1.05)", boxShadow: `0 8px 30px ${breathingColor[breathingStep]}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 36, fontWeight: 800, color: "white" }}>{breathingTimer}</span>
                  </div>
                  <p style={{ fontSize: 22, fontWeight: 700, color: breathingColor[breathingStep] }}>{breathingLabel[breathingStep]}</p>
                  <button onClick={() => closeTool(activeTool)} style={{ marginTop: 20, width: "100%", height: 44, borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#64748b", fontSize: 14, cursor: "pointer" }}>Arrêter</button></>
              )}
              {breathingStep === "done" && <><div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div><h3 style={{ fontSize: 20, fontWeight: 700, color: "white", margin: "0 0 8px" }}>Excellent !</h3><p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 24 }}>Votre corps vous remercie. 🌿</p><button onClick={() => closeTool(activeTool)} style={{ width: "100%", height: 48, borderRadius: 12, background: emerald, border: "none", color: "black", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Terminer</button></>}
            </div>
          )}

          {activeTool === "ancrage" && (
            <div style={{ textAlign: "center" }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "white" }}>🌊 S'apaiser</h2>
              <p style={{ margin: "0 0 24px", fontSize: 14, color: "#64748b" }}>Ancrez-vous dans le moment présent</p>
              {ancrageStep < 5 ? (
                <><div style={{ fontSize: 48, marginBottom: 16 }}>{ancrageSteps[ancrageStep].icon}</div>
                  <div style={{ background: "rgba(16,185,129,0.08)", borderRadius: 16, padding: "20px", marginBottom: 24, border: "1px solid rgba(16,185,129,0.2)" }}>
                    <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color: emerald }}>{ancrageSteps[ancrageStep].count}</p>
                    <p style={{ margin: "8px 0 0", fontSize: 16, color: "white" }}>chose{ancrageSteps[ancrageStep].count > 1 ? "s" : ""} que vous <strong>{ancrageSteps[ancrageStep].sense}</strong></p>
                  </div>
                  <button onClick={() => setAncrageStep(p => p + 1)} style={{ width: "100%", height: 52, borderRadius: 12, background: emerald, border: "none", color: "black", fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 10 }}>{ancrageStep < 4 ? "Suivant →" : "Terminer"}</button>
                  <button onClick={() => closeTool(activeTool)} style={{ width: "100%", height: 40, borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b", fontSize: 13, cursor: "pointer" }}>Quitter</button></>
              ) : (
                <><div style={{ fontSize: 56, marginBottom: 16 }}>✨</div><h3 style={{ fontSize: 20, fontWeight: 700, color: "white", margin: "0 0 8px" }}>Vous êtes ancré(e) !</h3><p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 24 }}>Vous venez de ramener votre esprit dans le présent. 🌿</p><button onClick={() => closeTool(activeTool)} style={{ width: "100%", height: 48, borderRadius: 12, background: emerald, border: "none", color: "black", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Fermer</button></>
              )}
            </div>
          )}

          {activeTool === "marche" && (
            <div style={{ textAlign: "center" }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "white" }}>🚶 Se vider la tête</h2>
              <p style={{ margin: "0 0 24px", fontSize: 14, color: "#64748b" }}>Étape {Math.min(marcheStep + 1, marcheSteps.length)} / {marcheSteps.length}</p>
              {marcheStep < marcheSteps.length ? (
                <><div style={{ background: "rgba(16,185,129,0.06)", borderRadius: 16, padding: 24, marginBottom: 16, border: "1px solid rgba(16,185,129,0.1)", minHeight: 90, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <p style={{ margin: 0, fontSize: 15, color: "#e2e8f0", lineHeight: 1.7 }}>{marcheSteps[marcheStep]}</p>
                </div>
                  <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginBottom: 20 }}>
                    <div style={{ height: "100%", borderRadius: 2, background: emerald, width: `${((marcheStep + 1) / marcheSteps.length) * 100}%`, transition: "width 0.3s" }} />
                  </div>
                  <button onClick={() => setMarcheStep(p => p + 1)} style={{ width: "100%", height: 52, borderRadius: 12, background: emerald, border: "none", color: "black", fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 10 }}>{marcheStep < marcheSteps.length - 1 ? "Suivant →" : "Terminer"}</button>
                  <button onClick={() => closeTool(activeTool)} style={{ width: "100%", height: 40, borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b", fontSize: 13, cursor: "pointer" }}>Quitter</button></>
              ) : (
                <><div style={{ fontSize: 56, marginBottom: 16 }}>🌿</div><h3 style={{ fontSize: 20, fontWeight: 700, color: "white", margin: "0 0 8px" }}>Belle promenade !</h3><p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 24 }}>Chaque pas conscient est une victoire. 💚</p><button onClick={() => closeTool(activeTool)} style={{ width: "100%", height: 48, borderRadius: 12, background: emerald, border: "none", color: "black", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Fermer</button></>
              )}
            </div>
          )}

          {activeTool === "manger" && (
            <div>
              <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "white", textAlign: "center" }}>🍽️ Manger en pleine conscience</h2>
              <p style={{ margin: "0 0 24px", fontSize: 14, color: "#64748b", textAlign: "center" }}>Avant de commencer votre repas</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
                {[
                  { icon: "📵", text: "Posez votre téléphone. Ce repas mérite toute votre attention." },
                  { icon: "👀", text: "Regardez votre assiette. Observez les couleurs, les textures." },
                  { icon: "🫁", text: "Prenez 3 respirations profondes avant de commencer." },
                  { icon: "🐢", text: "Mangez lentement. Posez vos couverts entre chaque bouchée." },
                  { icon: "💚", text: "Il n'y a pas d'aliment interdit. Chaque repas est un soin." },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                    <p style={{ margin: 0, fontSize: 14, color: "#d1d5db", lineHeight: 1.6 }}>{item.text}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => closeTool(activeTool)} style={{ width: "100%", height: 52, borderRadius: 12, background: emerald, border: "none", color: "black", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Bon appétit 🌿</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const sidebarWidth = 260;

  return (
    <div style={{ minHeight: "100vh", background: "#070B09", fontFamily: "'Inter', -apple-system, sans-serif", display: "flex", color: "white", overflow: "hidden" }}>
      {renderTool()}

      {/* Upsell */}
      {showUpsellModal && (
        <div onClick={() => setShowUpsellModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0d0d0d", borderRadius: 24, padding: 32, width: "100%", maxWidth: 400, textAlign: "center", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📸</div>
            <h3 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700, color: "white" }}>Analyse visuelle</h3>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>Cette option n'est pas encore activée par votre praticien.</p>
            <button onClick={() => setShowUpsellModal(false)} style={{ width: "100%", height: 48, borderRadius: 12, background: emerald, border: "none", color: "black", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Compris !</button>
          </div>
        </div>
      )}

      {/* Overlay mobile */}
      {sidebarOpen && isMobile && <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 20 }} />}

      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? sidebarWidth : 0,
        minWidth: sidebarOpen ? sidebarWidth : 0,
        background: "#040604",
        borderRight: sidebarOpen ? "1px solid rgba(255,255,255,0.06)" : "none",
        display: "flex",
        flexDirection: "column",
        position: isMobile ? "fixed" : "relative",
        top: 0, left: 0, height: "100vh",
        zIndex: isMobile ? 30 : 1,
        transition: "width 0.25s ease, min-width 0.25s ease",
        overflow: "hidden",
        flexShrink: 0,
      }}>
        <div style={{ width: sidebarWidth, display: "flex", flexDirection: "column", height: "100%" }}>

          {/* Logo */}
          <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(16,185,129,0.2)", filter: "blur(6px)" }} />
              <img src="/logo.svg" alt="NutriTwin" style={{ height: 24, width: "auto", position: "relative" }} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: "white", letterSpacing: "-0.3px" }}>
              Nutri<strong style={{ color: emerald }}>Twin</strong>
            </span>
          </div>

          {/* Nouvelle conversation */}
          <div style={{ padding: "12px" }}>
            <button onClick={() => { setMessages([]); setCurrentSessionId(null); if (isMobile) setSidebarOpen(false); }}
              style={{ width: "100%", height: 38, borderRadius: 8, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: emerald, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span style={{ fontSize: 16 }}>+</span> Nouvelle conversation
            </button>
          </div>

          {/* Journal */}
          <div style={{ padding: "0 12px 12px" }}>
            <button onClick={() => { setActiveTool("journal"); if (isMobile) setSidebarOpen(false); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.06))", border: "1px solid rgba(16,185,129,0.25)", cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.1))"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.06))"; }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>📓</div>
              <div style={{ textAlign: "left" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: emerald }}>Mon Journal</p>
                <p style={{ margin: 0, fontSize: 11, color: "#4b5563" }}>Humeur · Repas · Émotions</p>
              </div>
            </button>
          </div>

          {/* Mes Ressources */}
          <div style={{ padding: "0 12px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ margin: "0 0 8px 2px", fontSize: 11, fontWeight: 600, color: "#374151", letterSpacing: "0.08em", textTransform: "uppercase" }}>Mes ressources</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {tools.map(tool => (
                <button key={tool.id} onClick={() => { setActiveTool(tool.id as Tool); if (isMobile) setSidebarOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, background: "transparent", border: "1px solid transparent", cursor: "pointer", fontSize: 13, color: "#64748b", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.08)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.15)"; e.currentTarget.style.color = "#94a3b8"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "#64748b"; }}>
                  <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{tool.emoji}</span>
                  <span>{tool.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sessions */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
            <p style={{ margin: "0 0 8px 2px", fontSize: 11, fontWeight: 600, color: "#374151", letterSpacing: "0.08em", textTransform: "uppercase" }}>Discussions</p>
            {sessions.length === 0 ? (
              <p style={{ fontSize: 12, color: "#374151", textAlign: "center", marginTop: 12 }}>Aucune discussion</p>
            ) : sessions.map(session => (
              <div key={session.id}
                style={{ position: "relative", marginBottom: 2 }}
                onMouseEnter={() => setHoveredSession(session.id)}
                onMouseLeave={() => setHoveredSession(null)}>
                <button onClick={() => void loadSession(session.id)}
                  style={{ width: "100%", padding: "9px 10px", borderRadius: 8, textAlign: "left", background: currentSessionId === session.id ? "rgba(16,185,129,0.12)" : hoveredSession === session.id ? "rgba(255,255,255,0.04)" : "transparent", border: `1px solid ${currentSessionId === session.id ? "rgba(16,185,129,0.25)" : "transparent"}`, cursor: "pointer", transition: "all 0.15s", paddingRight: hoveredSession === session.id ? 80 : 10 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: currentSessionId === session.id ? emerald : "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>{session.title}</p>
                  <p style={{ margin: 0, fontSize: 10, color: "#374151" }}>{new Date(session.last_message_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</p>
                </button>

                {/* Actions hover */}
                {hoveredSession === session.id && (
                  <div style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 2 }}>
                    <button
                      onClick={e => { e.stopPropagation(); void navigator.clipboard.writeText(session.title); }}
                      title="Copier"
                      style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#64748b" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}
                      onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}>
                      📋
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); void deleteSession(session.id); }}
                      title="Supprimer"
                      style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#64748b" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(244,63,94,0.15)"; e.currentTarget.style.color = "#f87171"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#64748b"; }}>
                      🗑
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Zone principale */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>

        {/* Header fixe */}
        <header style={{ background: "rgba(7,11,9,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 20px", height: 56, display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10, flexShrink: 0 }}>

          {/* Bouton hamburger */}
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.08)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.2)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="#64748b" style={{ width: 18, height: 18 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          {hasMessages ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
              {/* Feuille avec halo */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ position: "absolute", inset: -6, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.25), transparent 70%)", animation: loading ? "glow-loading 1s ease-in-out infinite" : "glow-idle 3s ease-in-out infinite" }} />
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, position: "relative" }}>🌿</div>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "white" }}>Votre compagnon de suivi</p>
                <p style={{ margin: 0, fontSize: 11, color: "#4b5563" }}>Basé sur l'approche de votre praticien</p>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: emerald, animation: "breathe 3s ease-in-out infinite" }} />
                <span style={{ fontSize: 11, color: emerald, fontWeight: 500 }}>{loading ? "En train de réfléchir..." : "À votre écoute"}</span>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1 }} />
          )}
        </header>

        {/* Contenu principal */}
        <main style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

          {!hasMessages ? (
            /* Écran d'accueil centré */
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px 160px", textAlign: "center" }}>
              <div style={{ maxWidth: 560, width: "100%" }}>

                {/* Avatar feuille */}
                <div style={{ position: "relative", width: 64, height: 64, margin: "0 auto 24px" }}>
                  <div style={{ position: "absolute", inset: -12, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.2), transparent 70%)", animation: "glow-idle 3s ease-in-out infinite" }} />
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, position: "relative" }}>🌿</div>
                </div>

                {/* Salutation */}
                <h1 style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 700, color: "white" }}>
                  {patientFirstName ? `Bonjour ${patientFirstName} 👋` : "Bonjour 👋"}
                </h1>
                <p style={{ margin: "0 0 24px", fontSize: 15, color: "#64748b", lineHeight: 1.6 }}>
                  Je suis votre compagnon de suivi, créé à partir de l'expertise de votre praticien.
                </p>

                {/* Encadré */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "18px 24px", marginBottom: 24 }}>
                  <p style={{ margin: 0, fontSize: 15, color: "#94a3b8", lineHeight: 1.7 }}>
                    Posez-moi vos questions, je suis là pour vous accompagner entre vos séances. 🌿
                  </p>
                </div>

                {/* Quick actions */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 28 }}>
                  {quickActions.map(action => (
                    <button key={action} onClick={() => void send(action)}
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "8px 14px", fontSize: 13, color: "#64748b", cursor: "pointer", transition: "all 0.2s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.08)"; e.currentTarget.style.color = emerald; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#64748b"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}>
                      {action}
                    </button>
                  ))}
                </div>

                {/* Bouton photo */}
                <div>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} style={{ display: "none" }} />
                  <button onClick={handleImageClick}
                    style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 auto", height: 44, borderRadius: 10, padding: "0 20px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "#64748b", fontSize: 14, transition: "all 0.2s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.08)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; e.currentTarget.style.color = emerald; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#64748b"; }}>
                    <span style={{ fontSize: 18 }}>📷</span>
                    <span>Analyser votre repas</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Messages */
            <div style={{ flex: 1, padding: "24px 20px 180px" }}>
              <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
                {visibleMessages.map((msg, index) => {
                  const isUser = msg.role === "user";
                  return (
                    <div key={index} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 10, animation: "fadeUp 0.3s ease" }}>
                      {!isUser && (
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <div style={{ position: "absolute", inset: -4, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.15), transparent 70%)" }} />
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, position: "relative" }}>🌿</div>
                        </div>
                      )}
                      <div style={{ maxWidth: "75%" }}>
                        {msg.imageUrl && (
                          <div style={{ marginBottom: 8, display: "flex", justifyContent: "flex-end" }}>
                            <img src={msg.imageUrl} alt="Photo" style={{ maxWidth: 200, maxHeight: 200, borderRadius: 12, objectFit: "cover", border: "1px solid rgba(16,185,129,0.3)" }} />
                          </div>
                        )}
                        <div style={{
                          padding: "12px 16px",
                          borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                          background: isUser ? "#065f46" : "rgba(255,255,255,0.05)",
                          backdropFilter: isUser ? "none" : "blur(12px)",
                          color: isUser ? "white" : "#e2e8f0",
                          fontSize: 15, lineHeight: 1.7,
                          border: isUser ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.08)",
                        }}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  );
                })}

{loading && (
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div style={{ position: "absolute", inset: -6, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.3), transparent 70%)", animation: "glow-loading 1s ease-in-out infinite" }} />
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, position: "relative" }}>🌿</div>
    </div>
    <button onClick={stopGeneration}
      style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.05)", backdropFilter: "blur(12px)", borderRadius: "16px 16px 16px 4px", padding: "10px 16px", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "#64748b", fontSize: 13, transition: "all 0.2s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(244,63,94,0.3)"; e.currentTarget.style.color = "#f87171"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#64748b"; }}>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: emerald, animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>
      <span style={{ marginLeft: 6 }}>En train de réfléchir... · Arrêter</span>
    </button>
  </div>
)}

                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </main>

        {/* Zone saisie fixe en bas */}
        <div style={{ position: "fixed", bottom: 0, left: sidebarOpen && !isMobile ? sidebarWidth : 0, right: 0, background: "rgba(7,11,9,0.95)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 20px", paddingBottom: "max(16px, env(safe-area-inset-bottom))", transition: "left 0.25s ease" }}>

          {pendingImage && (
            <div style={{ maxWidth: 680, margin: "0 auto 10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img src={pendingImage.previewUrl} alt="Preview" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", border: `1px solid ${emerald}` }} />
                <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Photo prête à envoyer</p>
                <button onClick={() => setPendingImage(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#64748b" }}>×</button>
              </div>
            </div>
          )}

          {imageCompressing && (
            <div style={{ maxWidth: 680, margin: "0 auto 8px" }}>
              <div style={{ height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 1 }}>
                <div style={{ height: "100%", background: emerald, borderRadius: 1, width: `${compressionProgress}%`, transition: "width 0.1s" }} />
              </div>
            </div>
          )}

          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", background: "rgba(255,255,255,0.04)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", padding: "6px 8px 6px 12px", transition: "border-color 0.2s" }}
              onFocus={() => {}} >

              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} style={{ display: "none" }} />

              <input value={message} onChange={e => setMessage(e.target.value)} onKeyDown={handleKeyDown}
                placeholder={pendingImage ? "Ajoutez un commentaire..." : "Posez votre question..."}
                style={{ flex: 1, height: 40, border: "none", background: "transparent", color: "white", fontSize: 15, outline: "none" }} />

              {!hasMessages && (
                <button onClick={handleImageClick}
                  style={{ width: 36, height: 36, borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#64748b", transition: "color 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.color = emerald}
                  onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
                  📷
                </button>
              )}

              {hasMessages && (
                <button onClick={handleImageClick}
                  style={{ width: 36, height: 36, borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#64748b", transition: "color 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.color = emerald}
                  onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
                  📷
                </button>
              )}

              <button onClick={() => void send()} disabled={loading || (!message.trim() && !pendingImage)}
                style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: loading || (!message.trim() && !pendingImage) ? "rgba(255,255,255,0.06)" : emerald, border: "none", cursor: loading || (!message.trim() && !pendingImage) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: loading || (!message.trim() && !pendingImage) ? "#374151" : "black", transition: "all 0.2s", boxShadow: loading || (!message.trim() && !pendingImage) ? "none" : "0 2px 12px rgba(16,185,129,0.4)" }}
                onMouseEnter={e => { if (!loading && (message.trim() || pendingImage)) e.currentTarget.style.boxShadow = "0 4px 20px rgba(16,185,129,0.6)"; }}
                onMouseLeave={e => { if (!loading && (message.trim() || pendingImage)) e.currentTarget.style.boxShadow = "0 2px 12px rgba(16,185,129,0.4)"; }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 16, height: 16 }}>
                  <path d="M5 12h13" /><path d="m12 5 7 7-7 7" />
                </svg>
              </button>
            </div>

            <p style={{ margin: "8px 0 0", fontSize: 11, color: "#374151", textAlign: "center" }}>
              NutriTwin est une IA et peut se tromper. En cas de doute, consultez votre praticien.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes glow-idle { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.1); } }
        @keyframes glow-loading { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes breathe { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.3; transform: scale(0.8); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes dot-bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 2px; }
        ::placeholder { color: #374151; }
      `}</style>
    </div>
  );
}
