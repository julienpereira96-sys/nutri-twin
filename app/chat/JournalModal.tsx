
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";

type JournalEntry = {
  id?: string;
  date: string;
  mood: number;
  food_rating: number;
  emotions: string[];
  content: string;
  ai_response?: string;
};

const foodRatings = [
  { label: "Difficile", color: "#f43f5e", size: 8 },
  { label: "Bien", color: "#f59e0b", size: 14 },
  { label: "Excellent", color: "#10b981", size: 20 },
];

const emotionTags = [
  { emoji: "😤", label: "Stress", positive: false },
  { emoji: "😴", label: "Fatigue", positive: false },
  { emoji: "😔", label: "Tristesse", positive: false },
  { emoji: "😰", label: "Anxiété", positive: false },
  { emoji: "😠", label: "Frustration", positive: false },
  { emoji: "🥺", label: "Solitude", positive: false },
  { emoji: "😌", label: "Sérénité", positive: true },
  { emoji: "💪", label: "Motivation", positive: true },
  { emoji: "🎉", label: "Fierté", positive: true },
  { emoji: "🙏", label: "Gratitude", positive: true },
  { emoji: "⚡", label: "Énergie", positive: true },
  { emoji: "🌿", label: "Légèreté", positive: true },
];

const getMoodColor = (value: number) => {
  const colors = ["#f43f5e","#f97316","#f59e0b","#84cc16","#10b981","#10b981","#10b981","#10b981","#10b981","#10b981"];
  return colors[Math.min(value - 1, 9)];
};

export default function JournalModal({
  patientId,
  practitionerId,
  onClose,
}: {
  patientId: string | null;
  practitionerId: string | null;
  onClose: () => void;
}) {
  const [view, setView] = useState<"calendar" | "entry">("calendar");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [entries, setEntries] = useState<Record<string, JournalEntry>>({});
  const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [customEmotion, setCustomEmotion] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const loadEntries = useCallback(async () => {
    if (!patientId) return;
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).toISOString().split("T")[0];
    const lastDay = new Date(year, month + 1, 0).toISOString().split("T")[0];
    const { data } = await supabase.from("journal_entries").select("*").eq("patient_id", patientId).gte("date", firstDay).lte("date", lastDay);
    if (data) {
      const entriesMap: Record<string, JournalEntry> = {};
      data.forEach((e) => { entriesMap[e.date] = e; });
      setEntries(entriesMap);
    }
  }, [patientId, currentMonth]);

  useEffect(() => { void loadEntries(); }, [loadEntries]);

  const openEntry = (date: string) => {
    setSelectedDate(date);
    const existing = entries[date];
    if (existing) { setCurrentEntry(existing); }
    else { setCurrentEntry({ date, mood: 5, food_rating: 2, emotions: [], content: "" }); }
    setView("entry");
  };

  const toggleEmotion = (label: string) => {
    if (!currentEntry) return;
    const emotions = currentEntry.emotions.includes(label)
      ? currentEntry.emotions.filter((e) => e !== label)
      : [...currentEntry.emotions, label];
    setCurrentEntry({ ...currentEntry, emotions });
  };

  const addCustomEmotion = () => {
    if (!customEmotion.trim() || !currentEntry) return;
    if (!currentEntry.emotions.includes(customEmotion.trim())) {
      setCurrentEntry({ ...currentEntry, emotions: [...currentEntry.emotions, customEmotion.trim()] });
    }
    setCustomEmotion("");
    setShowCustomInput(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => { stream.getTracks().forEach((t) => t.stop()); };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => setRecordingTime((p) => p + 1), 1000);
    } catch { alert("Impossible d'accéder au microphone."); }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
  };

  const saveEntry = async () => {
    if (!currentEntry || !patientId) return;
    setSaving(true);
    setAiLoading(true);
    try {
      const moodLabel = currentEntry.mood <= 3 ? "Difficile" : currentEntry.mood <= 6 ? "Moyen" : currentEntry.mood <= 8 ? "Bien" : "Excellent";
      const foodLabel = foodRatings[currentEntry.food_rating - 1]?.label ?? "Bien";
      const prompt = `Un patient écrit dans son journal de bord nutritionnel :
Humeur : ${currentEntry.mood}/10 (${moodLabel})
Alimentation : ${foodLabel}
Émotions : ${currentEntry.emotions.join(", ") || "non renseignées"}
Note : ${currentEntry.content || "aucune note"}
Réponds de manière bienveillante, encourageante et personnalisée en 2-3 phrases. Sans markdown. Comme si tu étais leur praticien de confiance.`;
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: prompt, patientId: patientId ?? undefined, practitionerId: practitionerId ?? undefined }) });
      const aiData = (await res.json()) as { response?: string };
      const aiResponse = aiData.response ?? "Merci pour ce partage. 🌿";
      setAiLoading(false);
      const entryToSave = { ...currentEntry, ai_response: aiResponse, patient_id: patientId };
      if (currentEntry.id) { await supabase.from("journal_entries").update(entryToSave).eq("id", currentEntry.id); }
      else { await supabase.from("journal_entries").insert(entryToSave); }
      setCurrentEntry({ ...currentEntry, ai_response: aiResponse });
      await loadEntries();
    } finally { setSaving(false); setAiLoading(false); }
  };

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: ({ day: number; date: string } | null)[] = [];
    const startDay = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({ day: i, date: dateStr });
    }
    return days;
  };

  const today = new Date().toISOString().split("T")[0];
  const monthName = currentMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const moodColor = currentEntry ? getMoodColor(currentEntry.mood) : "#10b981";
  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#0a0a0a", borderRadius: 24, padding: 28, width: "100%", maxWidth: 480, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)", maxHeight: "90vh", overflowY: "auto", fontFamily: "Inter, sans-serif" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {view === "entry" && (
              <button onClick={() => setView("calendar")}
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", fontSize: 14, color: "#94a3b8", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "white"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#94a3b8"; }}>
                ←
              </button>
            )}
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "white" }}>
              {view === "calendar" ? "Journal de bord" : new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </h2>
          </div>
          <button onClick={onClose}
            style={{ background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", fontSize: 18, color: "#94a3b8", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "white"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#94a3b8"; }}>
            ×
          </button>
        </div>

        {/* VUE CALENDRIER */}
        {view === "calendar" && (
          <>
            {/* Navigation mois */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, width: 36, height: 36, cursor: "pointer", fontSize: 16, color: "white", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}>
                ←
              </button>
              <span style={{ fontSize: 14, fontWeight: 700, color: "white", textTransform: "capitalize", letterSpacing: "0.02em" }}>{monthName}</span>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, width: 36, height: 36, cursor: "pointer", fontSize: 16, color: "white", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}>
                →
              </button>
            </div>

            {/* Jours de la semaine */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 8 }}>
              {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                <div key={i} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#4b5563", padding: "6px 0", letterSpacing: "0.05em" }}>{d}</div>
              ))}
            </div>

            {/* Grille jours */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
              {getDaysInMonth().map((day, i) => {
                if (!day) return <div key={i} />;
                const entry = entries[day.date];
                const isToday = day.date === today;
                const isFuture = day.date > today;
                const entryColor = entry ? getMoodColor(entry.mood) : null;

                return (
                  <button key={i}
                    onClick={() => !isFuture && openEntry(day.date)}
                    disabled={isFuture}
                    style={{
                      aspectRatio: "1", borderRadius: 12,
                      border: isToday ? `2px solid #10b981` : `1px solid ${entry ? `${entryColor}40` : "rgba(255,255,255,0.06)"}`,
                      background: entry ? `${entryColor}12` : isToday ? "rgba(16,185,129,0.06)" : "rgba(255,255,255,0.02)",
                      cursor: isFuture ? "not-allowed" : "pointer",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      gap: 3, opacity: isFuture ? 0.15 : 1, transition: "all 0.15s",
                      boxShadow: entry ? `0 0 8px ${entryColor}20` : "none",
                    }}
                    onMouseEnter={e => { if (!isFuture) { e.currentTarget.style.background = entry ? `${entryColor}22` : "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = entry ? `${entryColor}60` : isToday ? "#10b981" : "rgba(255,255,255,0.15)"; e.currentTarget.style.transform = "scale(1.05)"; } }}
                    onMouseLeave={e => { if (!isFuture) { e.currentTarget.style.background = entry ? `${entryColor}12` : isToday ? "rgba(16,185,129,0.06)" : "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = isToday ? "#10b981" : entry ? `${entryColor}40` : "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "scale(1)"; } }}>
                    <span style={{ fontSize: 12, fontWeight: isToday ? 800 : entry ? 600 : 400, color: isToday ? "#10b981" : entry ? entryColor ?? "white" : "#94a3b8" }}>{day.day}</span>
                    {entry && (
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: entryColor ?? "#10b981", boxShadow: `0 0 4px ${entryColor}` }} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Légende */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 16, padding: "10px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {[{ color: "#f43f5e", label: "Difficile" }, { color: "#f59e0b", label: "Moyen" }, { color: "#10b981", label: "Bien" }].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color }} />
                  <span style={{ fontSize: 10, color: "#4b5563" }}>{item.label}</span>
                </div>
              ))}
            </div>

            <p style={{ margin: "8px 0 0", fontSize: 11, color: "#374151", textAlign: "center" }}>
              Cliquez sur un jour pour écrire
            </p>
          </>
        )}

        {/* VUE ENTRÉE */}
        {view === "entry" && currentEntry && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Réponse IA */}
            {currentEntry.ai_response && (
              <div style={{ background: "rgba(16,185,129,0.08)", borderRadius: 16, padding: "14px 16px", border: "1px solid rgba(16,185,129,0.2)", display: "flex", gap: 10 }}>
                <span style={{ fontSize: 18 }}>🌿</span>
                <p style={{ margin: 0, fontSize: 14, color: "#d1d5db", lineHeight: 1.6 }}>{currentEntry.ai_response}</p>
              </div>
            )}

            {/* Slider humeur */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>Humeur & Énergie</p>
                <span style={{ fontSize: 20, fontWeight: 800, color: moodColor, fontVariantNumeric: "tabular-nums", transition: "color 0.3s" }}>
                  {currentEntry.mood}<span style={{ fontSize: 13, color: "#4b5563" }}>/10</span>
                </span>
              </div>
              <div style={{ position: "relative", height: 32, display: "flex", alignItems: "center" }}>
                <div style={{ position: "absolute", left: 0, right: 0, height: 3, borderRadius: 2, background: "linear-gradient(to right, #f43f5e, #f97316, #f59e0b, #84cc16, #10b981)" }} />
                <input type="range" min={1} max={10} value={currentEntry.mood}
                  onChange={(e) => setCurrentEntry({ ...currentEntry, mood: parseInt(e.target.value) })}
                  style={{ position: "relative", width: "100%", appearance: "none", background: "transparent", cursor: "pointer", zIndex: 1 }} />
              </div>
              <style>{`
                input[type='range']::-webkit-slider-thumb {
                  appearance: none; width: 22px; height: 22px; border-radius: 50%;
                  background: white; border: 3px solid ${moodColor};
                  box-shadow: 0 0 8px ${moodColor}60; cursor: pointer;
                  transition: border-color 0.3s, box-shadow 0.3s;
                }
                input[type='range']::-webkit-slider-runnable-track { background: transparent; }
              `}</style>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 10, color: "#f43f5e" }}>Difficile</span>
                <span style={{ fontSize: 10, color: "#10b981" }}>Excellent</span>
              </div>
            </div>

            {/* Alimentation */}
            <div>
              <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>Alimentation du jour</p>
              <div style={{ display: "flex", gap: 10 }}>
                {foodRatings.map((rating, i) => {
                  const isSelected = currentEntry.food_rating === i + 1;
                  return (
                    <button key={i} onClick={() => setCurrentEntry({ ...currentEntry, food_rating: i + 1 })}
                      style={{ flex: 1, padding: "14px 8px", borderRadius: 14, border: `1.5px solid ${isSelected ? rating.color : "rgba(255,255,255,0.08)"}`, background: isSelected ? `${rating.color}15` : "rgba(255,255,255,0.03)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, transition: "all 0.2s" }}
                      onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor = `${rating.color}60`; e.currentTarget.style.background = `${rating.color}08`; e.currentTarget.style.transform = "translateY(-2px)"; } }}
                      onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.transform = "translateY(0)"; } }}>
                      <div style={{ width: rating.size * 1.5, height: rating.size * 1.5, borderRadius: "50%", background: isSelected ? rating.color : "rgba(255,255,255,0.1)", boxShadow: isSelected ? `0 0 12px ${rating.color}60` : "none", transition: "all 0.2s" }} />
                      <span style={{ fontSize: 11, color: isSelected ? rating.color : "#4b5563", fontWeight: 600 }}>{rating.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Émotions */}
            <div>
              <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>Émotions du jour</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {emotionTags.map((tag) => {
                  const selected = currentEntry.emotions.includes(tag.label);
                  return (
                    <button key={tag.label} onClick={() => toggleEmotion(tag.label)}
                      style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${selected ? "#10b981" : "rgba(255,255,255,0.08)"}`, background: selected ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.03)", backdropFilter: "blur(8px)", cursor: "pointer", fontSize: 12, color: selected ? "#10b981" : "#64748b", fontWeight: selected ? 600 : 400, transition: "all 0.2s", boxShadow: selected ? "0 0 8px rgba(16,185,129,0.3)" : "none", display: "flex", alignItems: "center", gap: 5 }}
                      onMouseEnter={e => { if (!selected) { e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; e.currentTarget.style.background = "rgba(16,185,129,0.06)"; e.currentTarget.style.color = "#94a3b8"; } }}
                      onMouseLeave={e => { if (!selected) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#64748b"; } }}>
                      <span>{tag.emoji}</span> {tag.label}
                    </button>
                  );
                })}

                {currentEntry.emotions.filter((e) => !emotionTags.map((t) => t.label).includes(e)).map((e) => (
                  <button key={e} onClick={() => toggleEmotion(e)}
                    style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid rgba(99,102,241,0.5)", background: "rgba(99,102,241,0.1)", backdropFilter: "blur(8px)", cursor: "pointer", fontSize: 12, color: "#818cf8", fontWeight: 600, transition: "all 0.2s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.2)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(99,102,241,0.1)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                    {e}
                  </button>
                ))}

                {showCustomInput ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input autoFocus value={customEmotion} onChange={(e) => setCustomEmotion(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addCustomEmotion(); if (e.key === "Escape") setShowCustomInput(false); }}
                      placeholder="Votre émotion..."
                      style={{ height: 32, borderRadius: 16, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "white", padding: "0 12px", fontSize: 12, outline: "none", width: 130 }} />
                    <button onClick={addCustomEmotion}
                      style={{ height: 32, width: 32, borderRadius: "50%", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", cursor: "pointer", fontSize: 14, transition: "all 0.2s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.25)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.15)"; }}>
                      ✓
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setShowCustomInput(true)}
                    style={{ padding: "6px 14px", borderRadius: 20, border: "1px dashed rgba(255,255,255,0.15)", background: "transparent", cursor: "pointer", fontSize: 12, color: "#4b5563", transition: "all 0.2s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"; e.currentTarget.style.color = "#94a3b8"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "#4b5563"; }}>
                    + Autre
                  </button>
                )}
              </div>
            </div>

            {/* Zone texte */}
            <div>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>Vos pensées du jour</p>
              <div style={{ position: "relative" }}>
                <textarea value={currentEntry.content} onChange={(e) => setCurrentEntry({ ...currentEntry, content: e.target.value })}
                  placeholder="Écrivez librement... Un repas, une émotion, une victoire, un moment difficile. Ce journal est pour vous."
                  rows={4}
                  style={{ width: "100%", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", padding: "14px 48px 14px 16px", fontSize: 14, outline: "none", background: "rgba(255,255,255,0.03)", boxShadow: "inset 0 2px 8px rgba(0,0,0,0.2)", color: "white", boxSizing: "border-box", resize: "none", fontFamily: "Inter, sans-serif", lineHeight: 1.6, transition: "border-color 0.2s" }}
                  onFocus={(e) => e.target.style.borderColor = "rgba(16,185,129,0.3)"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.06)"} />
                <button onClick={isRecording ? stopRecording : startRecording}
                  style={{ position: "absolute", bottom: 12, right: 12, width: 32, height: 32, borderRadius: "50%", background: isRecording ? "rgba(244,63,94,0.2)" : "rgba(255,255,255,0.06)", border: isRecording ? "1px solid rgba(244,63,94,0.4)" : "1px solid rgba(255,255,255,0.1)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: isRecording ? "#f43f5e" : "#64748b", transition: "all 0.2s" }}
                  onMouseEnter={e => { if (!isRecording) { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "white"; } }}
                  onMouseLeave={e => { if (!isRecording) { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#64748b"; } }}>
                  {isRecording ? formatTime(recordingTime) : "🎙"}
                </button>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 11, color: "#374151", textAlign: "right" }}>Votre jumeau analyse votre récit pour mieux vous accompagner.</p>
            </div>

            {/* Bouton enregistrer */}
            {!currentEntry.ai_response ? (
              <button onClick={() => void saveEntry()} disabled={saving || aiLoading}
                style={{ width: "100%", height: 52, borderRadius: 14, background: saving || aiLoading ? "rgba(255,255,255,0.04)" : "rgba(16,185,129,0.12)", border: `1px solid ${saving || aiLoading ? "rgba(255,255,255,0.06)" : "rgba(16,185,129,0.3)"}`, color: saving || aiLoading ? "#4b5563" : "#10b981", fontSize: 15, fontWeight: 600, cursor: saving || aiLoading ? "not-allowed" : "pointer", transition: "all 0.2s" }}
                onMouseEnter={e => { if (!saving && !aiLoading) { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
                onMouseLeave={e => { if (!saving && !aiLoading) { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; e.currentTarget.style.transform = "translateY(0)"; } }}>
                {aiLoading ? "Votre jumeau répond... 🌿" : saving ? "Sauvegarde..." : "Enregistrer ma journée →"}
              </button>
            ) : (
              <button onClick={() => void saveEntry()} disabled={saving}
                style={{ width: "100%", height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b", fontSize: 14, cursor: "pointer", transition: "all 0.2s" }}
                onMouseEnter={e => { if (!saving) { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; } }}
                onMouseLeave={e => { if (!saving) { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#64748b"; } }}>
                {saving ? "Mise à jour..." : "Modifier cette entrée"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}