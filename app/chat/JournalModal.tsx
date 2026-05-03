"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

type JournalEntry = {
  id?: string;
  date: string;
  mood: number;
  food_rating: number;
  emotions: string[];
  content: string;
  ai_response?: string;
};

const moodEmojis = ["😔", "😐", "🙂", "😊", "🌟"];
const moodLabels = ["Difficile", "Moyen", "Bien", "Très bien", "Excellent"];

const foodRatings = [
  { emoji: "😅", label: "Journée difficile" },
  { emoji: "😊", label: "Dans l'ensemble bien" },
  { emoji: "🌟", label: "Super journée" },
];

const emotionTags = [
  { emoji: "😤", label: "Stress" },
  { emoji: "😴", label: "Fatigue" },
  { emoji: "😔", label: "Tristesse" },
  { emoji: "😰", label: "Anxiété" },
  { emoji: "😌", label: "Sérénité" },
  { emoji: "💪", label: "Motivation" },
  { emoji: "😋", label: "Envies" },
  { emoji: "🎉", label: "Fierté" },
];

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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const loadEntries = useCallback(async () => {
    if (!patientId) return;
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).toISOString().split("T")[0];
    const lastDay = new Date(year, month + 1, 0).toISOString().split("T")[0];

    const { data } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("patient_id", patientId)
      .gte("date", firstDay)
      .lte("date", lastDay);

    if (data) {
      const entriesMap: Record<string, JournalEntry> = {};
      data.forEach((e) => { entriesMap[e.date] = e; });
      setEntries(entriesMap);
    }
  }, [patientId, currentMonth]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const openEntry = (date: string) => {
    setSelectedDate(date);
    const existing = entries[date];
    if (existing) {
      setCurrentEntry(existing);
    } else {
      setCurrentEntry({
        date,
        mood: 3,
        food_rating: 2,
        emotions: [],
        content: "",
      });
    }
    setView("entry");
  };

  const toggleEmotion = (label: string) => {
    if (!currentEntry) return;
    const emotions = currentEntry.emotions.includes(label)
      ? currentEntry.emotions.filter((e) => e !== label)
      : [...currentEntry.emotions, label];
    setCurrentEntry({ ...currentEntry, emotions });
  };

  const saveEntry = async () => {
    if (!currentEntry || !patientId) return;
    setSaving(true);
    setAiLoading(true);

    try {
      const prompt = `Un patient écrit dans son journal de bord nutritionnel :
Humeur : ${moodEmojis[currentEntry.mood - 1]} (${moodLabels[currentEntry.mood - 1]})
Alimentation : ${foodRatings[currentEntry.food_rating - 1].label}
Émotions : ${currentEntry.emotions.join(", ") || "non renseignées"}
Note : ${currentEntry.content || "aucune note"}

Réponds de manière bienveillante, encourageante et personnalisée en 2-3 phrases. Sans markdown. Comme si tu étais leur praticien de confiance.`;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          practitionerId: practitionerId ?? undefined,
        }),
      });
      const aiData = (await res.json()) as { response?: string };
      const aiResponse = aiData.response ?? "Merci pour ce partage. 🌿";

      setAiLoading(false);

      const entryToSave = { ...currentEntry, ai_response: aiResponse, patient_id: patientId };

      if (currentEntry.id) {
        await supabase.from("journal_entries").update(entryToSave).eq("id", currentEntry.id);
      } else {
        await supabase.from("journal_entries").insert(entryToSave);
      }

      setCurrentEntry({ ...currentEntry, ai_response: aiResponse });
      await loadEntries();
    } finally {
      setSaving(false);
      setAiLoading(false);
    }
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

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "white", borderRadius: 24, padding: 28,
        width: "100%", maxWidth: 480,
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        maxHeight: "90vh", overflowY: "auto",
      }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {view === "entry" && (
              <button onClick={() => setView("calendar")} style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 20, color: "#94a3b8", padding: 0,
              }}>←</button>
            )}
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
              {view === "calendar"
                ? "📓 Mon journal de bord"
                : `📝 ${new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}`
              }
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 22, color: "#94a3b8",
          }}>×</button>
        </div>

        {/* VUE CALENDRIER */}
        {view === "calendar" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} style={{
                background: "#f8fafc", border: "1.5px solid #e2e8f0",
                borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 14,
              }}>←</button>
              <span style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", textTransform: "capitalize" }}>
                {monthName}
              </span>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} style={{
                background: "#f8fafc", border: "1.5px solid #e2e8f0",
                borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 14,
              }}>→</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 8 }}>
              {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                <div key={i} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "#94a3b8", padding: "4px 0" }}>
                  {d}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {getDaysInMonth().map((day, i) => {
                if (!day) return <div key={i} />;
                const entry = entries[day.date];
                const isToday = day.date === today;
                const isFuture = day.date > today;

                return (
                  <button
                    key={i}
                    onClick={() => !isFuture && openEntry(day.date)}
                    disabled={isFuture}
                    style={{
                      aspectRatio: "1",
                      borderRadius: 10,
                      border: isToday ? "2px solid #10b981" : "1.5px solid #e2e8f0",
                      background: entry ? "#f0fdf4" : isToday ? "rgba(16,185,129,0.05)" : "#f8fafc",
                      cursor: isFuture ? "not-allowed" : "pointer",
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                      gap: 2, opacity: isFuture ? 0.3 : 1,
                      transition: "all 0.15s",
                      padding: "6px 2px",
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? "#10b981" : "#374151" }}>
                      {day.day}
                    </span>
                    {entry && (
                      <span style={{ fontSize: 10 }}>{moodEmojis[entry.mood - 1]}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <p style={{ margin: "16px 0 0", fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
              Cliquez sur un jour pour ajouter une entrée
            </p>
          </>
        )}

        {/* VUE ENTRÉE */}
        {view === "entry" && currentEntry && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {currentEntry.ai_response && (
              <div style={{
                background: "#f0fdf4", borderRadius: 16, padding: "14px 16px",
                border: "1.5px solid #d1fae5",
                display: "flex", gap: 10, alignItems: "flex-start",
              }}>
                <span style={{ fontSize: 20 }}>🌿</span>
                <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
                  {currentEntry.ai_response}
                </p>
              </div>
            )}

            {/* Humeur */}
            <div>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                Comment vous sentez-vous aujourd'hui ?
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                {moodEmojis.map((emoji, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentEntry({ ...currentEntry, mood: i + 1 })}
                    style={{
                      flex: 1, padding: "10px 4px", borderRadius: 12,
                      border: `2px solid ${currentEntry.mood === i + 1 ? "#10b981" : "#e2e8f0"}`,
                      background: currentEntry.mood === i + 1 ? "#f0fdf4" : "#f8fafc",
                      cursor: "pointer", display: "flex", flexDirection: "column",
                      alignItems: "center", gap: 4, transition: "all 0.15s",
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{emoji}</span>
                    <span style={{ fontSize: 9, color: currentEntry.mood === i + 1 ? "#10b981" : "#94a3b8", fontWeight: 600 }}>
                      {moodLabels[i]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Alimentation */}
            <div>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                Comment s'est passée votre alimentation ?
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                {foodRatings.map((rating, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentEntry({ ...currentEntry, food_rating: i + 1 })}
                    style={{
                      flex: 1, padding: "10px 8px", borderRadius: 12,
                      border: `2px solid ${currentEntry.food_rating === i + 1 ? "#10b981" : "#e2e8f0"}`,
                      background: currentEntry.food_rating === i + 1 ? "#f0fdf4" : "#f8fafc",
                      cursor: "pointer", display: "flex", flexDirection: "column",
                      alignItems: "center", gap: 4, transition: "all 0.15s",
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{rating.emoji}</span>
                    <span style={{ fontSize: 10, color: currentEntry.food_rating === i + 1 ? "#10b981" : "#94a3b8", fontWeight: 600, textAlign: "center" }}>
                      {rating.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Émotions */}
            <div>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                Vos émotions du jour
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {emotionTags.map((tag) => {
                  const selected = currentEntry.emotions.includes(tag.label);
                  return (
                    <button
                      key={tag.label}
                      onClick={() => toggleEmotion(tag.label)}
                      style={{
                        padding: "7px 12px", borderRadius: 20,
                        border: `1.5px solid ${selected ? "#10b981" : "#e2e8f0"}`,
                        background: selected ? "#f0fdf4" : "#f8fafc",
                        cursor: "pointer", fontSize: 13,
                        color: selected ? "#059669" : "#64748b",
                        fontWeight: selected ? 600 : 400,
                        transition: "all 0.15s",
                        display: "flex", alignItems: "center", gap: 5,
                      }}
                    >
                      <span>{tag.emoji}</span> {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Texte libre */}
            <div>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                Vos pensées du jour
              </p>
              <textarea
                value={currentEntry.content}
                onChange={(e) => setCurrentEntry({ ...currentEntry, content: e.target.value })}
                placeholder="Écrivez librement... Un repas, une émotion, une victoire, un moment difficile. Ce journal est pour vous."
                rows={4}
                style={{
                  width: "100%", borderRadius: 16,
                  border: "1.5px solid #e2e8f0",
                  padding: "14px 16px", fontSize: 14, outline: "none",
                  background: "#f8fafc", color: "#0f172a",
                  boxSizing: "border-box", resize: "none",
                  fontFamily: "'Inter', sans-serif", lineHeight: 1.6,
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => e.target.style.borderColor = "#10b981"}
                onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
              />
            </div>

            {!currentEntry.ai_response ? (
              <button
                onClick={() => void saveEntry()}
                disabled={saving || aiLoading}
                style={{
                  width: "100%", height: 52, borderRadius: 26,
                  background: saving || aiLoading ? "#e2e8f0" : "linear-gradient(135deg, #34d399, #10b981)",
                  border: "none",
                  color: saving || aiLoading ? "#94a3b8" : "white",
                  fontSize: 15, fontWeight: 600,
                  cursor: saving || aiLoading ? "not-allowed" : "pointer",
                  boxShadow: saving || aiLoading ? "none" : "0 4px 14px rgba(16,185,129,0.35)",
                }}
              >
                {aiLoading ? "Votre compagnon répond... 🌿" : saving ? "Sauvegarde..." : "Enregistrer ma journée 💚"}
              </button>
            ) : (
              <button
                onClick={() => void saveEntry()}
                disabled={saving}
                style={{
                  width: "100%", height: 48, borderRadius: 24,
                  background: "transparent", border: "1.5px solid #e2e8f0",
                  color: "#64748b", fontSize: 14, cursor: "pointer",
                }}
              >
                {saving ? "Mise à jour..." : "Modifier cette entrée"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
