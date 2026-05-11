"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const emerald = "#10b981";
const amber = "#f59e0b";
const coral = "#f43f5e";

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
  age?: number;
  sexe?: string;
  taille?: number;
  poids?: number;
  objective?: string;
  pathologies?: string;
  allergies?: string;
  traitements?: string;
  objectif_clinique?: string;
  niveau_activite?: string;
  regime_specifique?: string;
  notes?: string;
  brief_jumeau?: string;
  practitioner_instruction?: string;
  emotional_status?: string;
  emotional_insight?: string;
};

type Conversation = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type ReportPeriod = "week" | "month" | "custom";
type ActiveTab = "patients" | "radar" | "valeur" | "patterns";

type Document = {
  id: string;
  file_name: string;
  file_type: string;
  created_at: string;
};

type MonthlyStats = {
  messages_geres: number;
  crises_nocturnes: number;
  temps_economise_heures: number;
  taux_retention: number;
  questions_repetitives_pct: number;
};

const AVATAR_COLORS = [
  "#f43f5e", "#3b82f6", "#8b5cf6",
  "#f59e0b", "#10b981", "#ec4899",
  "#06b6d4", "#f97316",
];

function getStatusColor(status?: string) {
  if (status === "red") return coral;
  if (status === "orange") return amber;
  return emerald;
}

function getStatusEmoji(status?: string) {
  if (status === "red") return "🔴";
  if (status === "orange") return "🟠";
  return "🟢";
}

export default function DashboardPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [activeTab, setActiveTab] = useState<ActiveTab>("patients");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    window.history.pushState(null, "", window.location.pathname);
    const handlePopState = () => window.history.pushState(null, "", window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const [patients, setPatients] = useState<RealPatient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showJumeauModal, setShowJumeauModal] = useState(false);
  const [showMurmureModal, setShowMurmureModal] = useState(false);
  const [practitionerId, setPractitionerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [practitionerName, setPractitionerName] = useState("");
  const [hasDocuments, setHasDocuments] = useState<boolean | null>(null);
  const [showFidelity, setShowFidelity] = useState(true);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null);

  // Murmure
  const [murmureText, setMurmureText] = useState("");
  const [savingMurmure, setSavingMurmure] = useState(false);

  // Invitation
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteAge, setInviteAge] = useState("");
  const [inviteSexe, setInviteSexe] = useState("");
  const [inviteTaille, setInviteTaille] = useState("");
  const [invitePoids, setInvitePoids] = useState("");
  const [invitePathologies, setInvitePathologies] = useState("");
  const [inviteAllergies, setInviteAllergies] = useState("");
  const [inviteTraitements, setInviteTraitements] = useState("");
  const [inviteObjectifClinique, setInviteObjectifClinique] = useState("");
  const [inviteBriefJumeau, setInviteBriefJumeau] = useState("");
  const [inviteNotes, setInviteNotes] = useState("");
  const [inviteNiveauActivite, setInviteNiveauActivite] = useState("");
  const [inviteRegime, setInviteRegime] = useState("");

  // Documents
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [documentType, setDocumentType] = useState<"protocole" | "patient" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mémo vocal
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fidelityScore = hasDocuments === true ? 100 : 70;
  const fidelityColor = hasDocuments === true ? emerald : amber;
  const fidelityLabel = hasDocuments === true ? "Jumeau Fidèle" : "Jumeau Personnalisé";

  // Profil patient
  const [editAge, setEditAge] = useState("");
  const [editObjective, setEditObjective] = useState("");
  const [editPathologies, setEditPathologies] = useState("");
  const [editAllergies, setEditAllergies] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Rapport
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("month");
  const [reportDateFrom, setReportDateFrom] = useState("");
  const [reportDateTo, setReportDateTo] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportContent, setReportContent] = useState("");
  const [reportMonth, setReportMonth] = useState(new Date());

  // Patterns
  const [patternInsight, setPatternInsight] = useState("");
  const [patternLoading, setPatternLoading] = useState(false);

  useEffect(() => {
    if (inviteSuccess) {
      const timer = setTimeout(() => {
        setInviteSuccess(false);
        setShowInviteModal(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [inviteSuccess]);

  const loadDocuments = async (pid: string) => {
    setLoadingDocs(true);
    const { data } = await supabase
      .from("documents")
      .select("id, file_name, file_type, created_at")
      .eq("practitioner_id", pid)
      .order("created_at", { ascending: false });

    const seen = new Set<string>();
    const unique = (data as Document[] ?? []).filter((d) => {
      if (seen.has(d.file_name)) return false;
      seen.add(d.file_name);
      return true;
    });

    setDocuments(unique);
    setLoadingDocs(false);
  };

  const loadMonthlyStats = async (pid: string) => {
    const month = new Date().toISOString().slice(0, 7);
    const { data } = await supabase
      .from("stats_mensuelles_praticien")
      .select("*")
      .eq("practitioner_id", pid)
      .eq("month", month)
      .single();

    if (data) {
      setMonthlyStats(data as MonthlyStats);
    } else {
      // Calculer en temps réel si pas de stats en cache
      const { count: totalMessages } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("practitioner_id", pid)
        .gte("created_at", `${month}-01T00:00:00`);

      const { count: nightMessages } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("practitioner_id", pid)
        .gte("created_at", `${month}-01T00:00:00`)
        .gte("created_at", `${month}-01T21:00:00`);

      const msgs = totalMessages ?? 0;
      setMonthlyStats({
        messages_geres: msgs,
        crises_nocturnes: nightMessages ?? 0,
        temps_economise_heures: Math.round(msgs * 0.02 * 10) / 10,
        taux_retention: 85,
        questions_repetitives_pct: 72,
      });
    }
  };

  const loadPatients = async (pid: string) => {
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
      .select("user_id, first_name, last_name, email, age, sexe, taille, poids, objective, pathologies, allergies, traitements, objectif_clinique, niveau_activite, regime_specifique, notes, brief_jumeau, practitioner_instruction, emotional_status, emotional_insight")
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
          age: p.age,
          sexe: p.sexe,
          taille: p.taille,
          poids: p.poids,
          traitements: p.traitements,
          objectif_clinique: p.objectif_clinique,
          niveau_activite: p.niveau_activite,
          regime_specifique: p.regime_specifique,
          objective: p.objective,
          pathologies: p.pathologies,
          allergies: p.allergies,
          notes: p.notes,
          brief_jumeau: p.brief_jumeau,
          practitioner_instruction: p.practitioner_instruction,
          emotional_status: p.emotional_status ?? "green",
          emotional_insight: p.emotional_insight ?? "",
        };
      })
    );

    setPatients(patientsWithStats);
    if (patientsWithStats.length > 0) setSelectedPatientId(patientsWithStats[0].id);
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const pid = data.user.id;
      setPractitionerId(pid);

      const { data: practitioner } = await supabase
        .from("practitioners")
        .select("first_name, last_name")
        .eq("user_id", pid)
        .single();
      if (practitioner) setPractitionerName(`${practitioner.first_name} ${practitioner.last_name}`);

      const { count } = await supabase
        .from("documents")
        .select("*", { count: "exact", head: true })
        .eq("practitioner_id", pid);
      setHasDocuments((count ?? 0) > 0);
      if ((count ?? 0) > 0) {
        const hidden = localStorage.getItem("fidelity_hidden");
        if (hidden === "true") setShowFidelity(false);
      }

      await Promise.all([loadPatients(pid), loadMonthlyStats(pid)]);
    });
  }, []);

  useEffect(() => {
    if (!selectedPatientId || !practitionerId) return;
    supabase
      .from("conversations")
      .select("id, role, content, created_at")
      .eq("patient_id", selectedPatientId)
      .eq("practitioner_id", practitionerId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setConversations((data as Conversation[]) ?? []));
  }, [selectedPatientId, practitionerId]);

  const filteredPatients = patients.filter((p) =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const redPatients = patients.filter((p) => p.emotional_status === "red");
  const orangePatients = patients.filter((p) => p.emotional_status === "orange");

  const openMurmureModal = () => {
    const patient = patients.find((p) => p.id === selectedPatientId);
    setMurmureText(patient?.practitioner_instruction ?? "");
    setShowMurmureModal(true);
  };

  const saveMurmure = async () => {
    if (!selectedPatientId) return;
    setSavingMurmure(true);
    await supabase
      .from("patients")
      .update({ practitioner_instruction: murmureText || null })
      .eq("user_id", selectedPatientId);

    setPatients((prev) => prev.map((p) =>
      p.id === selectedPatientId ? { ...p, practitioner_instruction: murmureText || undefined } : p
    ));
    setSavingMurmure(false);
    setShowMurmureModal(false);
  };

  const generatePatternInsight = async () => {
    if (!selectedPatientId || !practitionerId) return;
    setPatternLoading(true);
    setPatternInsight("");

    const { data: journalEntries } = await supabase
      .from("journal_entries")
      .select("date, mood, food_rating, emotions")
      .eq("patient_id", selectedPatientId)
      .order("date", { ascending: false })
      .limit(30);

    const { data: chatMessages } = await supabase
      .from("conversations")
      .select("role, content, created_at")
      .eq("patient_id", selectedPatientId)
      .eq("practitioner_id", practitionerId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!journalEntries?.length && !chatMessages?.length) {
      setPatternInsight("Pas encore assez de données pour détecter des patterns.");
      setPatternLoading(false);
      return;
    }

    const journalData = journalEntries?.map((e) =>
      `${e.date}: humeur=${e.mood}/5, alimentation=${e.food_rating}/3, émotions=${(e.emotions as string[])?.join(",")}`
    ).join("\n") ?? "";

    const chatData = chatMessages?.filter((m) => m.role === "user")
      .slice(0, 20)
      .map((m) => m.content.slice(0, 100))
      .join(" | ") ?? "";

    const prompt = `Tu es un analyste de données nutritionnelles. Analyse ces données d'un patient et détecte des corrélations ou patterns comportementaux.

Journal (30 derniers jours) :
${journalData}

Messages du patient (extraits) :
${chatData}

Génère 3 insights sous forme de phrases courtes et percutantes, comme :
- "Corrélation détectée : quand le score alimentaire chute le vendredi, l'humeur baisse le lundi."
- "Pattern identifié : les échanges nocturnes (+21h) correspondent à des pics de découragement."
- "Signal positif : la régularité du journal est corrélée à de meilleures semaines alimentaires."

Sois précis, factuel, médical. 3 insights maximum. Sans markdown.`;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, practitionerId }),
      });
      const data = await res.json() as { response?: string };
      setPatternInsight(data.response ?? "Impossible de générer les insights.");
    } catch {
      setPatternInsight("Erreur lors de l'analyse.");
    }
    setPatternLoading(false);
  };

  const openJumeauModal = async () => {
    setShowJumeauModal(true);
    setUploadedFiles([]);
    setUploadSuccess([]);
    setUploadErrors([]);
    setDocumentType(null);
    if (practitionerId) await loadDocuments(practitionerId);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const valid = files.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase();
      return ["pdf", "docx", "txt", "jpg", "jpeg", "png", "xlsx", "csv", "mp3", "wav", "m4a"].includes(ext ?? "");
    });
    setUploadedFiles((prev) => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/mp3" });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
    } catch {
      alert("Impossible d'accéder au microphone.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
  };

  const uploadAudioMemo = () => {
    if (!audioBlob) return;
    const file = new File([audioBlob], `memo_vocal_${Date.now()}.mp3`, { type: "audio/mp3" });
    setUploadedFiles((prev) => [...prev, file]);
    setAudioBlob(null);
  };

  const uploadFiles = async () => {
    if (uploadedFiles.length === 0 || !documentType) return;
    let pid = practitionerId;
    if (!pid) {
      const { data: { user } } = await supabase.auth.getUser();
      pid = user?.id ?? null;
    }
    if (!pid) return;

    setUploading(true);
    setUploadErrors([]);
    setUploadSuccess([]);

    for (const file of uploadedFiles) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("practitionerId", pid);
      formData.append("documentType", documentType);

      try {
        const res = await fetch("/api/upload-document", { method: "POST", body: formData });
        const data = await res.json() as { success?: boolean; error?: string };
        if (res.ok && data.success) setUploadSuccess((prev) => [...prev, file.name]);
        else setUploadErrors((prev) => [...prev, `${file.name} : ${data.error ?? "Erreur"}`]);
      } catch {
        setUploadErrors((prev) => [...prev, `${file.name} : Erreur réseau`]);
      }
    }

    setUploading(false);
    setUploadedFiles([]);
    setDocumentType(null);
    setHasDocuments(true);
    await loadDocuments(pid);
  };

  const deleteDocument = async (docId: string, fileName: string) => {
    if (!practitionerId) return;
    await supabase.from("documents").delete().eq("practitioner_id", practitionerId).eq("file_name", fileName);
    await loadDocuments(practitionerId);
    const { count } = await supabase.from("documents").select("*", { count: "exact", head: true }).eq("practitioner_id", practitionerId);
    setHasDocuments((count ?? 0) > 0);
  };

  const openProfileModal = () => {
    const patient = patients.find((p) => p.id === selectedPatientId);
    if (!patient) return;
    setEditAge(patient.age ? String(patient.age) : "");
    setEditObjective(patient.objective ?? "");
    setEditPathologies(patient.pathologies ?? "");
    setEditAllergies(patient.allergies ?? "");
    setEditNotes(patient.notes ?? "");
    setProfileSaved(false);
    setShowProfileModal(true);
  };

  const saveProfile = async () => {
    if (!selectedPatientId) return;
    setSavingProfile(true);
    await supabase.from("patients").update({
      age: editAge ? parseInt(editAge) : null,
      objective: editObjective || null,
      pathologies: editPathologies || null,
      allergies: editAllergies || null,
      notes: editNotes || null,
    }).eq("user_id", selectedPatientId);

    setPatients((prev) => prev.map((p) => {
      if (p.id !== selectedPatientId) return p;
      return { ...p, age: editAge ? parseInt(editAge) : undefined, objective: editObjective || undefined, pathologies: editPathologies || undefined, allergies: editAllergies || undefined, notes: editNotes || undefined };
    }));

    setSavingProfile(false);
    setProfileSaved(true);
    setTimeout(() => setShowProfileModal(false), 1500);
  };

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);
  const totalMessages = patients.reduce((sum, p) => sum + p.totalMessages, 0);

  const getCalendarDays = () => {
    const year = reportMonth.getFullYear();
    const month = reportMonth.getMonth();
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

  const generateReport = async () => {
    if (!selectedPatientId) return;
    setReportLoading(true);
    setReportContent("");

    try {
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

      const { data: journalEntries } = await supabase
        .from("journal_entries")
        .select("date, mood, food_rating, emotions")
        .eq("patient_id", selectedPatientId)
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: true });

      const { data: chatMessages } = await supabase
        .from("conversations")
        .select("role, content, created_at")
        .eq("patient_id", selectedPatientId)
        .eq("practitioner_id", practitionerId!)
        .gte("created_at", `${dateFrom}T00:00:00`)
        .lte("created_at", `${dateTo}T23:59:59`)
        .order("created_at", { ascending: true });

      const hasJournal = journalEntries && journalEntries.length > 0;
      const hasChat = chatMessages && chatMessages.length > 0;

      if (!hasJournal && !hasChat) {
        setReportContent("Aucune donnée disponible sur cette période.");
        setReportLoading(false);
        return;
      }

      let journalSection = "";
      if (hasJournal) {
        const moodLabels = ["Difficile", "Moyen", "Bien", "Très bien", "Excellent"];
        const foodLabels = ["Difficile", "Bien", "Super"];
        const avgMood = (journalEntries.reduce((sum, e) => sum + e.mood, 0) / journalEntries.length).toFixed(1);
        const avgFood = (journalEntries.reduce((sum, e) => sum + e.food_rating, 0) / journalEntries.length).toFixed(1);
        const allEmotions = journalEntries.flatMap((e) => e.emotions as string[]);
        const emotionCounts: Record<string, number> = {};
        allEmotions.forEach((em) => { emotionCounts[em] = (emotionCounts[em] ?? 0) + 1; });
        const topEmotions = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([em, count]) => `${em} (${count}x)`).join(", ");
        const moodTrend = journalEntries.map((e) => `${e.date}: humeur ${moodLabels[e.mood - 1]}, alimentation ${foodLabels[e.food_rating - 1]}`).join("\n");
        journalSection = `\nJOURNAL DE BORD (${journalEntries.length} entrées) :\n- Humeur moyenne : ${avgMood}/5\n- Alimentation moyenne : ${avgFood}/3\n- Émotions dominantes : ${topEmotions || "non renseignées"}\n- Évolution :\n${moodTrend}`;
      }

      let chatSection = "";
      if (hasChat) {
        const patientMessages = chatMessages.filter((m) => m.role === "user").map((m) => m.content).join("\n- ");
        chatSection = `\nCONVERSATIONS AVEC LE JUMEAU (${chatMessages.length} messages) :\nMessages du patient :\n- ${patientMessages}`;
      }

      const prompt = `Tu es un assistant pour un praticien en nutrition. Génère un compte rendu professionnel et synthétique basé sur les données d'un patient sur la période du ${dateFrom} au ${dateTo}.
${journalSection}
${chatSection}

Génère un compte rendu structuré avec :
1. Vue d'ensemble de la période
2. État émotionnel et alimentaire (si journal disponible)
3. Préoccupations et sujets abordés dans le chat (si conversations disponibles)
4. Points positifs à valoriser
5. Axes de travail pour la prochaine consultation
6. Questions clés à poser au patient

Ton professionnel, bienveillant et concis. Sans markdown.`;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, practitionerId: practitionerId ?? undefined }),
      });

      const aiData = (await res.json()) as { response?: string };
      setReportContent(aiData.response ?? "Impossible de générer le rapport.");
    } finally {
      setReportLoading(false);
    }
  };

  const resetInviteForm = () => {
    setInviteEmail(""); setInviteAge(""); setInviteSexe(""); setInviteTaille("");
    setInvitePoids(""); setInvitePathologies(""); setInviteAllergies("");
    setInviteTraitements(""); setInviteObjectifClinique(""); setInviteBriefJumeau("");
    setInviteNotes(""); setInviteNiveauActivite(""); setInviteRegime(""); setInviteError("");
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError("");
    try {
      const res = await fetch("/api/invite-patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(), practitionerId: practitionerId ?? "",
          age: inviteAge ? parseInt(inviteAge) : null, sexe: inviteSexe || null,
          taille: inviteTaille ? parseInt(inviteTaille) : null, poids: invitePoids ? parseFloat(invitePoids) : null,
          pathologies: invitePathologies || null, allergies: inviteAllergies || null,
          traitements: inviteTraitements || null, objectif_clinique: inviteObjectifClinique || null,
          brief_jumeau: inviteBriefJumeau || null, notes: inviteNotes || null,
          niveau_activite: inviteNiveauActivite || null, regime_specifique: inviteRegime || null,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) setInviteError(data.error ?? "Une erreur est survenue.");
      else {
        setInviteSuccess(true);
        resetInviteForm();
        if (practitionerId) await loadPatients(practitionerId);
      }
    } catch {
      setInviteError("Impossible d'envoyer l'invitation.");
    } finally {
      setInviting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const fileTypeIcon = (type: string) => {
    if (["jpg", "jpeg", "png"].includes(type)) return "🖼️";
    if (["mp3", "wav", "m4a"].includes(type)) return "🎙️";
    if (["xlsx", "csv"].includes(type)) return "📊";
    if (type === "pdf") return "📕";
    if (type === "docx") return "📝";
    return "📄";
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div style={{ minHeight: "100vh", background: "#070707", color: "white", fontFamily: "Inter, sans-serif" }}>

      {/* Header */}
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(7,7,7,0.8)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 40, padding: "0 24px" }}>
        <div style={{ maxWidth: 1600, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(16,185,129,0.2)", filter: "blur(8px)" }} />
              <img src="/logo.svg" alt="NutriTwin" style={{ height: 28, width: "auto", position: "relative" }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "white" }}>
                {practitionerName ? `Bonjour ${practitionerName.split(" ")[0]} 👋` : "Dashboard"}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                {patients.length} patient{patients.length > 1 ? "s" : ""} · {totalMessages} messages
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Onglets */}
            {(["patients", "radar", "valeur", "patterns"] as ActiveTab[]).map((tab) => {
              const labels: Record<ActiveTab, string> = {
                patients: "Patients",
                radar: "Radar",
                valeur: "Valeur",
                patterns: "Patterns",
              };
              const isActive = activeTab === tab;
              return (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{ height: 36, borderRadius: 8, padding: "0 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: isActive ? "rgba(16,185,129,0.15)" : "transparent", color: isActive ? emerald : "#64748b", transition: "all 0.2s" }}>
                  {labels[tab]}
                </button>
              );
            })}
            <button onClick={() => void openJumeauModal()} style={{ height: 36, borderRadius: 8, padding: "0 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: emerald, color: "black" }}>
              Mon Jumeau
            </button>
          </div>
        </div>
      </header>

      {/* Bandeau alertes */}
      {(redPatients.length > 0 || orangePatients.length > 0) && (
        <div style={{ background: "rgba(244,63,94,0.08)", borderBottom: "1px solid rgba(244,63,94,0.2)", padding: "10px 24px" }}>
          <div style={{ maxWidth: 1600, margin: "0 auto", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: coral, letterSpacing: "0.1em", textTransform: "uppercase" }}>⚡ Attention requise</span>
            {redPatients.map((p) => (
              <button key={p.id} onClick={() => { setSelectedPatientId(p.id); setActiveTab("patients"); }}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: 20, padding: "4px 12px", cursor: "pointer" }}>
                <span style={{ fontSize: 10 }}>🔴</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: coral }}>{p.firstName}</span>
                {p.emotional_insight && <span style={{ fontSize: 11, color: "#94a3b8" }}>— {p.emotional_insight}</span>}
              </button>
            ))}
            {orangePatients.map((p) => (
              <button key={p.id} onClick={() => { setSelectedPatientId(p.id); setActiveTab("patients"); }}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 20, padding: "4px 12px", cursor: "pointer" }}>
                <span style={{ fontSize: 10 }}>🟠</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: amber }}>{p.firstName}</span>
                {p.emotional_insight && <span style={{ fontSize: 11, color: "#94a3b8" }}>— {p.emotional_insight}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <main style={{ maxWidth: 1600, margin: "0 auto", padding: "24px" }}>

        {/* ═══ VUE PATIENTS ═══ */}
        {activeTab === "patients" && (
          <div style={{ display: "grid", gridTemplateColumns: "280px minmax(0,1fr) 280px", gap: 16, height: "calc(100vh - 160px)" }}>

            {/* Sidebar patients */}
            <div style={{ display: "flex", flexDirection: "column", background: "rgba(255,255,255,0.02)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <input
                  type="text"
                  placeholder="Rechercher un patient..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: "100%", height: 36, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "white", padding: "0 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
                {loading ? (
                  <p style={{ textAlign: "center", fontSize: 13, color: "#64748b", marginTop: 20 }}>Chargement...</p>
                ) : filteredPatients.length === 0 ? (
                  <p style={{ textAlign: "center", fontSize: 13, color: "#64748b", marginTop: 20 }}>Aucun patient</p>
                ) : filteredPatients.map((patient) => {
                  const isSelected = patient.id === selectedPatientId;
                  const statusColor = getStatusColor(patient.emotional_status);
                  const isRed = patient.emotional_status === "red";
                  return (
                    <button key={patient.id} onClick={() => setSelectedPatientId(patient.id)}
                      style={{
                        width: "100%", borderRadius: 10, padding: "10px 12px", textAlign: "left", cursor: "pointer", marginBottom: 4,
                        background: isSelected ? "rgba(16,185,129,0.08)" : "transparent",
                        border: isSelected ? "1px solid rgba(16,185,129,0.2)" : "1px solid transparent",
                        boxShadow: isRed && !isSelected ? "0 0 0 1px rgba(244,63,94,0.2), 0 0 12px rgba(244,63,94,0.08)" : "none",
                        transition: "all 0.2s",
                      }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: patient.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "white", flexShrink: 0 }}>
                          {patient.initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: isSelected ? emerald : "white" }}>{patient.firstName}</span>
                            <span style={{ fontSize: 10, color: statusColor }}>●</span>
                          </div>
                          <p style={{ margin: 0, fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {patient.emotional_insight || patient.lastMessage}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <button onClick={() => setShowInviteModal(true)} style={{ width: "100%", height: 40, borderRadius: 8, background: emerald, border: "none", color: "black", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  + Inviter un patient
                </button>
              </div>
            </div>

            {/* Zone conversation */}
            <div style={{ display: "flex", flexDirection: "column", background: "rgba(255,255,255,0.02)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
              {selectedPatient ? (
                <>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: selectedPatient.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "white" }}>
                        {selectedPatient.initials}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "white" }}>{selectedPatient.firstName} {selectedPatient.lastName}</p>
                        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{selectedPatient.email}</p>
                      </div>
                    </div>
                    <button onClick={() => { setShowReportModal(true); setReportContent(""); }}
                      style={{ height: 32, borderRadius: 8, padding: "0 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.08)", color: emerald }}>
                      📊 Rapport IA
                    </button>
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", background: "#070707", display: "flex", flexDirection: "column", gap: 12 }}>
                    {conversations.length === 0 ? (
                      <p style={{ textAlign: "center", fontSize: 13, color: "#64748b", marginTop: 40 }}>Aucune conversation</p>
                    ) : conversations.map((message) => {
                      const isPatient = message.role === "user";
                      return (
                        <div key={message.id} style={{ display: "flex", justifyContent: isPatient ? "flex-start" : "flex-end" }}>
                          <div style={{ maxWidth: "78%" }}>
                            <div style={{ borderRadius: 14, borderBottomRightRadius: isPatient ? 14 : 4, borderBottomLeftRadius: isPatient ? 4 : 14, padding: "10px 14px", fontSize: 14, lineHeight: 1.6, background: isPatient ? "rgba(255,255,255,0.06)" : emerald, color: isPatient ? "#e2e8f0" : "black" }}>
                              {message.content}
                            </div>
                            <p style={{ margin: "4px 0 0", fontSize: 10, color: "#4b5563", textAlign: isPatient ? "left" : "right" }}>
                              {new Date(message.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <p style={{ fontSize: 14, color: "#4b5563" }}>{loading ? "Chargement..." : "Sélectionnez un patient"}</p>
                </div>
              )}
            </div>

            {/* Fiche patient */}
            <div style={{ overflowY: "auto", background: "rgba(255,255,255,0.02)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 16 }}>
              {selectedPatient ? (
                <>
                  <div style={{ textAlign: "center", marginBottom: 16 }}>
                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: selectedPatient.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "white", margin: "0 auto 10px" }}>
                      {selectedPatient.initials}
                    </div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{selectedPatient.firstName} {selectedPatient.lastName}</p>
                    <p style={{ margin: "2px 0 8px", fontSize: 12, color: "#64748b" }}>{selectedPatient.email}</p>

                    {/* Statut émotionnel */}
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 20, padding: "4px 12px", background: `${getStatusColor(selectedPatient.emotional_status)}15`, border: `1px solid ${getStatusColor(selectedPatient.emotional_status)}30` }}>
                      <span style={{ fontSize: 10 }}>{getStatusEmoji(selectedPatient.emotional_status)}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: getStatusColor(selectedPatient.emotional_status) }}>
                        {selectedPatient.emotional_insight || (selectedPatient.emotional_status === "green" ? "Adhésion positive" : selectedPatient.emotional_status === "orange" ? "Vigilance modérée" : "Attention requise")}
                      </span>
                    </div>
                  </div>

                  {/* Badges */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14, justifyContent: "center" }}>
                    {selectedPatient.allergies?.split(",").map((a) => (
                      <span key={a} style={{ borderRadius: 20, background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.25)", padding: "2px 8px", fontSize: 10, fontWeight: 600, color: "#f87171" }}>⚠️ {a.trim()}</span>
                    ))}
                    {selectedPatient.objectif_clinique && (
                      <span style={{ borderRadius: 20, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", padding: "2px 8px", fontSize: 10, fontWeight: 600, color: "#60a5fa" }}>🎯 {selectedPatient.objectif_clinique}</span>
                    )}
                    {selectedPatient.regime_specifique && (
                      <span style={{ borderRadius: 20, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", padding: "2px 8px", fontSize: 10, fontWeight: 600, color: "#a78bfa" }}>🥗 {selectedPatient.regime_specifique}</span>
                    )}
                  </div>

                  {/* Infos */}
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: "10px 12px", marginBottom: 10 }}>
                    {[
                      { label: "Messages", value: String(selectedPatient.totalMessages) },
                      selectedPatient.age ? { label: "Âge", value: `${selectedPatient.age} ans` } : null,
                      selectedPatient.poids ? { label: "Poids", value: `${selectedPatient.poids} kg` } : null,
                      selectedPatient.niveau_activite ? { label: "Activité", value: selectedPatient.niveau_activite } : null,
                    ].filter(Boolean).map((item) => item && (
                      <div key={item.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: "#64748b" }}>{item.label}</span>
                        <span style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 500 }}>{item.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Murmure actif */}
                  {selectedPatient.practitioner_instruction && (
                    <div style={{ background: "rgba(16,185,129,0.05)", borderRadius: 10, border: "1px solid rgba(16,185,129,0.2)", padding: "10px 12px", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 11 }}>🎙️</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: emerald }}>Murmure actif</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>{selectedPatient.practitioner_instruction}</p>
                    </div>
                  )}

                  {/* Boutons */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button onClick={openMurmureModal} style={{ height: 38, borderRadius: 8, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: emerald, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      🎙️ {selectedPatient.practitioner_instruction ? "Modifier le murmure" : "Ajouter un murmure"}
                    </button>
                    <button onClick={openProfileModal} style={{ height: 38, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      ✏️ Modifier le profil
                    </button>
                    <button onClick={() => { setShowReportModal(true); setReportContent(""); }} style={{ height: 38, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      📊 Rapport IA
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                  <p style={{ fontSize: 13, color: "#4b5563" }}>Sélectionnez un patient</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ VUE RADAR ═══ */}
        {activeTab === "radar" && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>Radar émotionnel</h2>
              <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Statut IA de vos patients mis à jour à chaque message</p>
            </div>
            {patients.length === 0 ? (
              <p style={{ textAlign: "center", color: "#64748b", marginTop: 60 }}>Aucun patient</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {[...patients].sort((a, b) => {
                  const order = { red: 0, orange: 1, green: 2 };
                  return (order[a.emotional_status as keyof typeof order] ?? 2) - (order[b.emotional_status as keyof typeof order] ?? 2);
                }).map((patient) => {
                  const statusColor = getStatusColor(patient.emotional_status);
                  const isRed = patient.emotional_status === "red";
                  return (
                    <button key={patient.id} onClick={() => { setSelectedPatientId(patient.id); setActiveTab("patients"); }}
                      style={{
                        textAlign: "left", borderRadius: 16, padding: "20px", cursor: "pointer",
                        background: isRed ? "rgba(244,63,94,0.05)" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${isRed ? "rgba(244,63,94,0.25)" : "rgba(255,255,255,0.06)"}`,
                        boxShadow: isRed ? "0 0 24px rgba(244,63,94,0.12)" : "none",
                        transition: "all 0.3s",
                      }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 40, height: 40, borderRadius: "50%", background: patient.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "white" }}>
                            {patient.initials}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "white" }}>{patient.firstName} {patient.lastName}</p>
                            <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>{patient.totalMessages} messages</p>
                          </div>
                        </div>
                        <span style={{ fontSize: 18 }}>{getStatusEmoji(patient.emotional_status)}</span>
                      </div>
                      {patient.emotional_insight && (
                        <p style={{ margin: 0, fontSize: 12, color: statusColor, lineHeight: 1.5, fontStyle: "italic" }}>
                          "{patient.emotional_insight}"
                        </p>
                      )}
                      {patient.practitioner_instruction && (
                        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 10 }}>🎙️</span>
                          <span style={{ fontSize: 10, color: emerald }}>Murmure actif</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ VUE VALEUR PRODUITE ═══ */}
        {activeTab === "valeur" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>Valeur produite</h2>
              <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Ce que votre jumeau a accompli ce mois-ci</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16, marginBottom: 24 }}>
              {[
                {
                  icon: "💬", label: "Messages gérés", value: monthlyStats?.messages_geres ?? 0, unit: "messages",
                  desc: "Questions répondues à votre place", color: emerald,
                },
                {
                  icon: "🌙", label: "Crises nocturnes", value: monthlyStats?.crises_nocturnes ?? 0, unit: "interventions",
                  desc: "Moments où votre jumeau était là pour eux", color: "#8b5cf6",
                },
                {
                  icon: "⏱️", label: "Temps économisé", value: monthlyStats?.temps_economise_heures ?? 0, unit: "heures",
                  desc: "Estimé à 1,2 min par message géré", color: amber,
                },
                {
                  icon: "🔄", label: "Questions répétitives", value: `${monthlyStats?.questions_repetitives_pct ?? 0}%`, unit: "",
                  desc: "Absorbées par le jumeau sans vous", color: "#06b6d4",
                },
              ].map((stat, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "24px", backdropFilter: "blur(20px)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <span style={{ fontSize: 24 }}>{stat.icon}</span>
                    <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>{stat.label}</span>
                  </div>
                  <p style={{ margin: "0 0 4px", fontSize: 36, fontWeight: 800, color: stat.color, fontVariantNumeric: "tabular-nums" }}>
                    {stat.value}
                    {stat.unit && <span style={{ fontSize: 14, fontWeight: 400, color: "#64748b", marginLeft: 6 }}>{stat.unit}</span>}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{stat.desc}</p>
                </div>
              ))}
            </div>

            {/* Message synthèse */}
            <div style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 16, padding: "24px", backdropFilter: "blur(20px)" }}>
              <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "white" }}>🧬 Synthèse du mois</p>
              <p style={{ margin: 0, fontSize: 14, color: "#94a3b8", lineHeight: 1.8 }}>
                Ce mois-ci, votre jumeau a répondu à <strong style={{ color: "white" }}>{monthlyStats?.messages_geres ?? 0} questions</strong>, géré <strong style={{ color: "white" }}>{monthlyStats?.crises_nocturnes ?? 0} moments difficiles</strong> en dehors de vos heures de consultation, et vous a économisé environ <strong style={{ color: "white" }}>{monthlyStats?.temps_economise_heures ?? 0} heures</strong> de suivi.
                <br /><br />
                <strong style={{ color: emerald }}>{monthlyStats?.questions_repetitives_pct ?? 0}% des questions répétitives</strong> ont été absorbées sans votre intervention. Votre expertise travaille 24h/24.
              </p>
            </div>
          </div>
        )}

        {/* ═══ VUE PATTERNS ═══ */}
        {activeTab === "patterns" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>Patterns comportementaux</h2>
              <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>L'IA détecte ce que l'œil humain ne voit pas</p>
            </div>

            {/* Sélecteur patient */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>Analyser le patient</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {patients.map((p) => (
                  <button key={p.id} onClick={() => setSelectedPatientId(p.id)}
                    style={{ height: 36, borderRadius: 8, padding: "0 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: selectedPatientId === p.id ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)", color: selectedPatientId === p.id ? emerald : "#64748b", transition: "all 0.2s" }}>
                    {p.firstName} {p.lastName}
                  </button>
                ))}
              </div>
            </div>

            {selectedPatient && (
              <div style={{ marginBottom: 20 }}>
                <button onClick={() => void generatePatternInsight()} disabled={patternLoading}
                  style={{ height: 44, borderRadius: 10, padding: "0 24px", fontSize: 14, fontWeight: 600, cursor: patternLoading ? "not-allowed" : "pointer", border: "none", background: patternLoading ? "rgba(255,255,255,0.05)" : emerald, color: patternLoading ? "#64748b" : "black" }}>
                  {patternLoading ? "Analyse en cours... 🧬" : `Analyser ${selectedPatient.firstName} →`}
                </button>
              </div>
            )}

            {patternInsight && (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "24px", backdropFilter: "blur(20px)" }}>
                <p style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 700, color: emerald, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  🧬 Insights — {selectedPatient?.firstName}
                </p>
                {patternInsight.split("\n").filter(Boolean).map((line, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: emerald, flexShrink: 0, marginTop: 7 }} />
                    <p style={{ margin: 0, fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>{line.replace(/^[-•*]\s*/, "")}</p>
                  </div>
                ))}
              </div>
            )}

            {!patternInsight && !patternLoading && (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <p style={{ fontSize: 32, marginBottom: 12 }}>🔬</p>
                <p style={{ fontSize: 15, fontWeight: 600, color: "white", marginBottom: 6 }}>Détection de patterns comportementaux</p>
                <p style={{ fontSize: 13, color: "#64748b", maxWidth: 400, margin: "0 auto" }}>
                  Sélectionnez un patient et lancez l'analyse. L'IA croisera journal de bord et conversations pour révéler des corrélations invisibles.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ═══ MODALE MURMURE ═══ */}
      {showMurmureModal && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowMurmureModal(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 20, padding: 28, width: "100%", maxWidth: 480, border: "1px solid rgba(16,185,129,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "white" }}>🎙️ Murmure du praticien</h2>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>Consigne prioritaire pour {selectedPatient?.firstName} · Persistante jusqu'à suppression</p>
              </div>
              <button onClick={() => setShowMurmureModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8" }}>×</button>
            </div>

            <div style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 12, color: "#10b981", lineHeight: 1.6 }}>
                ⚡ Cette consigne sera injectée en priorité absolue dans chaque réponse du jumeau pour ce patient, jusqu'à ce que vous la supprimiez.
              </p>
            </div>

            <textarea
              value={murmureText}
              onChange={(e) => setMurmureText(e.target.value)}
              placeholder="Ex: Sois plus doux cette semaine, elle traverse une période difficile au travail. Mets l'accent sur les petites victoires."
              rows={5}
              style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "14px", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "Inter, sans-serif", lineHeight: 1.6 }}
            />

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              {murmureText && (
                <button onClick={() => setMurmureText("")} style={{ height: 44, borderRadius: 10, padding: "0 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid rgba(244,63,94,0.3)", background: "rgba(244,63,94,0.08)", color: "#f87171" }}>
                  Supprimer
                </button>
              )}
              <button onClick={() => void saveMurmure()} disabled={savingMurmure}
                style={{ flex: 1, height: 44, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", border: "none", background: emerald, color: "black" }}>
                {savingMurmure ? "Sauvegarde..." : "Activer le murmure →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODALE JUMEAU ═══ */}
      {showJumeauModal && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowJumeauModal(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 24, padding: 28, width: "100%", maxWidth: 560, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "white" }}>Améliorer mon jumeau</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>Gérez les documents qui enrichissent votre jumeau</p>
              </div>
              <button onClick={() => setShowJumeauModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#94a3b8" }}>×</button>
            </div>

            <div style={{ background: hasDocuments ? "rgba(16,185,129,0.05)" : "rgba(245,158,11,0.08)", borderRadius: 16, border: `1px solid ${hasDocuments ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.3)"}`, padding: "16px", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>Score de fidélité</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: fidelityColor }}>{fidelityScore}%</span>
              </div>
              <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4 }}>
                <div style={{ height: "100%", borderRadius: 4, backgroundColor: fidelityColor, width: `${fidelityScore}%`, transition: "width 0.7s" }} />
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 13, color: hasDocuments ? emerald : amber, fontWeight: 500 }}>
                {hasDocuments ? "✅ Jumeau Fidèle — Votre jumeau est prêt." : "⚠️ Importez au moins un document."}
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px" }}>Documents indexés ({documents.length})</p>
              {loadingDocs ? (
                <p style={{ fontSize: 13, color: "#64748b" }}>Chargement...</p>
              ) : documents.length === 0 ? (
                <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px dashed rgba(255,255,255,0.08)", padding: "20px", textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Aucun document indexé</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {documents.map((doc) => (
                    <div key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{fileTypeIcon(doc.file_type)}</span>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, color: "white", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.file_name}</p>
                          <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>{new Date(doc.created_at).toLocaleDateString("fr-FR")}</p>
                        </div>
                      </div>
                      <button onClick={() => void deleteDocument(doc.id, doc.file_name)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#64748b", flexShrink: 0, marginLeft: 8, padding: "4px 8px", borderRadius: 6 }}
                        onMouseEnter={(e) => e.currentTarget.style.color = "#f87171"}
                        onMouseLeave={(e) => e.currentTarget.style.color = "#64748b"}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "white" }}>Type de document</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                {[
                  { type: "protocole" as const, icon: "📋", label: "Protocoles & méthodes", desc: "Articles, plans alimentaires", note: "✓ Indexé tel quel", noteColor: emerald },
                  { type: "patient" as const, icon: "🗂️", label: "Données patients", desc: "Bilans, comptes-rendus", note: "✓ Anonymisé avant indexation", noteColor: "#60a5fa" },
                ].map(({ type, icon, label, desc, note, noteColor }) => (
                  <button key={type} onClick={() => setDocumentType(type)}
                    style={{ borderRadius: 12, border: `2px solid ${documentType === type ? emerald : "rgba(255,255,255,0.1)"}`, background: documentType === type ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.02)", padding: "14px", textAlign: "left", cursor: "pointer" }}>
                    <p style={{ margin: "0 0 6px", fontSize: 22 }}>{icon}</p>
                    <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "white" }}>{label}</p>
                    <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b" }}>{desc}</p>
                    <p style={{ margin: 0, fontSize: 12, color: noteColor, fontWeight: 600 }}>{note}</p>
                  </button>
                ))}
              </div>
            </div>

            <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.csv,.mp3,.wav,.m4a" onChange={handleFileChange} style={{ display: "none" }} />

            <label onClick={() => fileInputRef.current?.click()}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 12, border: "2px dashed rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.01)", padding: "20px", cursor: "pointer", marginBottom: 12 }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(16,185,129,0.4)"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"}>
              <span style={{ fontSize: 32, marginBottom: 8 }}>📄</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#94a3b8" }}>Cliquez pour sélectionner</span>
              <span style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>PDF · DOCX · TXT · JPG · PNG · Excel · CSV · MP3</span>
            </label>

            <div style={{ background: "rgba(16,185,129,0.05)", borderRadius: 12, border: "1.5px solid rgba(16,185,129,0.2)", padding: "14px 16px", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>🎙️</span>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "white" }}>Mémo vocal</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>Transcription automatique.</p>
                </div>
              </div>
              {!audioBlob ? (
                <button onClick={isRecording ? stopRecording : startRecording}
                  style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 20, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: isRecording ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.2)", color: isRecording ? "#f87171" : emerald }}>
                  {isRecording ? <><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f87171" }} />Arrêter — {formatTime(recordingTime)}</> : <>🎙️ Enregistrer</>}
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <p style={{ margin: 0, fontSize: 13, color: emerald }}>✅ {formatTime(recordingTime)}</p>
                  <button onClick={uploadAudioMemo} style={{ borderRadius: 20, padding: "8px 16px", fontSize: 13, fontWeight: 600, background: emerald, border: "none", color: "black", cursor: "pointer" }}>Ajouter</button>
                  <button onClick={() => setAudioBlob(null)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 16 }}>✕</button>
                </div>
              )}
            </div>

            {uploadedFiles.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {uploadedFiles.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: "#94a3b8" }}>{f.name}</span>
                    <button onClick={() => setUploadedFiles((prev) => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}>✕</button>
                  </div>
                ))}
                <button onClick={() => void uploadFiles()} disabled={uploading || !documentType}
                  style={{ width: "100%", height: 48, borderRadius: 24, background: uploading || !documentType ? "rgba(255,255,255,0.05)" : emerald, border: "none", color: uploading || !documentType ? "#64748b" : "black", fontSize: 15, fontWeight: 600, cursor: uploading || !documentType ? "not-allowed" : "pointer" }}>
                  {uploading ? "⏳ Indexation..." : `Indexer ${uploadedFiles.length} fichier${uploadedFiles.length > 1 ? "s" : ""} →`}
                </button>
              </div>
            )}

            {uploadSuccess.length > 0 && (
              <div style={{ background: "rgba(16,185,129,0.08)", borderRadius: 12, border: "1px solid rgba(16,185,129,0.2)", padding: "12px 14px" }}>
                {uploadSuccess.map((s, i) => <p key={i} style={{ margin: "0 0 2px", fontSize: 12, color: emerald }}>✅ {s}</p>)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ MODALE PROFIL PATIENT ═══ */}
      {showProfileModal && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowProfileModal(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 20, padding: 28, width: "100%", maxWidth: 460, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "white" }}>✏️ Profil — {selectedPatient?.firstName}</h2>
              <button onClick={() => setShowProfileModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#94a3b8" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Âge", value: editAge, onChange: setEditAge, placeholder: "Ex: 34", type: "number" },
                { label: "Objectif principal", value: editObjective, onChange: setEditObjective, placeholder: "Ex: Perte de poids", type: "text" },
                { label: "Pathologies", value: editPathologies, onChange: setEditPathologies, placeholder: "Ex: Diabète type 2", type: "text" },
                { label: "Allergies", value: editAllergies, onChange: setEditAllergies, placeholder: "Ex: Gluten, lactose", type: "text" },
              ].map(({ label, value, onChange, placeholder, type }) => (
                <div key={label}>
                  <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>{label}</p>
                  <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
                    style={{ width: "100%", height: 44, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 14px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                    onFocus={(e) => e.target.style.borderColor = emerald}
                    onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                </div>
              ))}
              <div>
                <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>Notes internes</p>
                <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Notes visibles uniquement par vous..." rows={3}
                  style={{ width: "100%", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "12px 14px", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "Inter, sans-serif" }}
                  onFocus={(e) => e.target.style.borderColor = emerald}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
              </div>
            </div>
            <button onClick={() => void saveProfile()} disabled={savingProfile}
              style={{ width: "100%", height: 48, borderRadius: 24, background: profileSaved ? "rgba(16,185,129,0.2)" : emerald, border: profileSaved ? `1px solid ${emerald}` : "none", color: profileSaved ? emerald : "black", fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 20 }}>
              {profileSaved ? "✅ Sauvegardé !" : savingProfile ? "Sauvegarde..." : "Sauvegarder"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ MODALE RAPPORT ═══ */}
      {showReportModal && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowReportModal(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 20, padding: 28, width: "100%", maxWidth: 580, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "white" }}>📊 Rapport — {selectedPatient?.firstName}</h2>
              <button onClick={() => setShowReportModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#94a3b8" }}>×</button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {[{ value: "week", label: "Cette semaine" }, { value: "month", label: "Ce mois" }, { value: "custom", label: "Calendrier" }].map((option) => (
                  <button key={option.value} onClick={() => { setReportPeriod(option.value as ReportPeriod); setReportDateFrom(""); setReportDateTo(""); }}
                    style={{ flex: 1, height: 38, borderRadius: 8, border: `1.5px solid ${reportPeriod === option.value ? emerald : "rgba(255,255,255,0.1)"}`, background: reportPeriod === option.value ? "rgba(16,185,129,0.15)" : "transparent", color: reportPeriod === option.value ? emerald : "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    {option.label}
                  </button>
                ))}
              </div>

              {reportPeriod === "custom" && (
                <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <button onClick={() => setReportMonth(new Date(reportMonth.getFullYear(), reportMonth.getMonth() - 1))}
                      style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: "white", fontSize: 16 }}>←</button>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "white", textTransform: "capitalize" }}>
                      {reportMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                    </span>
                    <button onClick={() => setReportMonth(new Date(reportMonth.getFullYear(), reportMonth.getMonth() + 1))}
                      style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: "white", fontSize: 16 }}>→</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
                    {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                      <div key={i} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "#64748b", padding: "4px 0" }}>{d}</div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                    {getCalendarDays().map((day, i) => {
                      if (!day) return <div key={i} />;
                      const isFuture = day.date > today;
                      const isFrom = day.date === reportDateFrom;
                      const isTo = day.date === reportDateTo;
                      const isInRange = reportDateFrom && reportDateTo && day.date > reportDateFrom && day.date < reportDateTo;
                      return (
                        <button key={i} onClick={() => {
                          if (isFuture) return;
                          if (!reportDateFrom || (reportDateFrom && reportDateTo)) { setReportDateFrom(day.date); setReportDateTo(""); }
                          else if (day.date >= reportDateFrom) setReportDateTo(day.date);
                          else { setReportDateFrom(day.date); setReportDateTo(""); }
                        }}
                          style={{ aspectRatio: "1", borderRadius: 8, border: "none", cursor: isFuture ? "not-allowed" : "pointer", background: isFrom || isTo ? emerald : isInRange ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.03)", color: isFrom || isTo ? "black" : isFuture ? "#374151" : "white", fontSize: 12, fontWeight: isFrom || isTo ? 700 : 400, opacity: isFuture ? 0.3 : 1 }}>
                          {day.day}
                        </button>
                      );
                    })}
                  </div>
                  {reportDateFrom && (
                    <p style={{ margin: "12px 0 0", fontSize: 12, color: emerald, textAlign: "center" }}>
                      {reportDateTo ? `Du ${new Date(reportDateFrom + "T12:00:00").toLocaleDateString("fr-FR")} au ${new Date(reportDateTo + "T12:00:00").toLocaleDateString("fr-FR")}` : `Début : ${new Date(reportDateFrom + "T12:00:00").toLocaleDateString("fr-FR")} — Sélectionnez la fin`}
                    </p>
                  )}
                </div>
              )}
            </div>

            {!reportContent && (
              <button onClick={() => void generateReport()} disabled={reportLoading || (reportPeriod === "custom" && (!reportDateFrom || !reportDateTo))}
                style={{ width: "100%", height: 48, borderRadius: 24, background: reportLoading ? "#1a1a1a" : emerald, border: "none", color: reportLoading ? "#4a4a4a" : "black", fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 16 }}>
                {reportLoading ? "Génération en cours... 🤖" : "Générer le rapport IA"}
              </button>
            )}

            {reportContent && (
              <>
                <div style={{ background: "#0a0a0a", borderRadius: 16, padding: "20px", border: "1px solid rgba(255,255,255,0.06)", fontSize: 14, color: "#e2e8f0", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                  {reportContent}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button onClick={() => setReportContent("")} style={{ flex: 1, height: 44, borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", cursor: "pointer", fontSize: 14 }}>Nouvelle période</button>
                  <button onClick={() => void navigator.clipboard.writeText(reportContent)} style={{ flex: 1, height: 44, borderRadius: 12, background: emerald, border: "none", color: "black", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>📋 Copier</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ MODALE INVITATION ═══ */}
      {showInviteModal && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowInviteModal(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 24, padding: 32, width: "100%", maxWidth: 560, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", maxHeight: "92vh", overflowY: "auto", position: "relative" }}>
            <button onClick={() => { setShowInviteModal(false); resetInviteForm(); setInviteSuccess(false); }}
              style={{ position: "absolute", top: 18, right: 18, background: "rgba(255,255,255,0.05)", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, color: "white" }}>Inviter un patient</h2>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: "#64748b" }}>Votre patient recevra un email pour accéder à son espace personnalisé.</p>

            {inviteSuccess ? (
              <div style={{ background: "rgba(16,185,129,0.15)", border: `1px solid ${emerald}`, borderRadius: 14, padding: "20px", textAlign: "center", color: emerald, fontWeight: 600, fontSize: 16 }}>
                ✅ Invitation envoyée !
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "white" }}>Email *</p>
                  <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@patient.fr"
                    style={{ width: "100%", height: 48, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 16px", fontSize: 15, outline: "none", boxSizing: "border-box" }}
                    onFocus={(e) => e.target.style.borderColor = emerald}
                    onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                </div>

                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20, marginBottom: 16 }}>
                  <p style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "white" }}>Profil du patient</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                    {[{ label: "Âge", value: inviteAge, onChange: setInviteAge, placeholder: "34", type: "number" },
                      { label: "Taille (cm)", value: inviteTaille, onChange: setInviteTaille, placeholder: "168", type: "number" },
                      { label: "Poids (kg)", value: invitePoids, onChange: setInvitePoids, placeholder: "72", type: "number" }
                    ].map(({ label, value, onChange, placeholder, type }) => (
                      <div key={label}>
                        <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{label}</p>
                        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
                          style={{ width: "100%", height: 40, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                          onFocus={(e) => e.target.style.borderColor = emerald}
                          onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                    <div>
                      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Sexe</p>
                      <select value={inviteSexe} onChange={(e) => setInviteSexe(e.target.value)}
                        style={{ width: "100%", height: 40, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: inviteSexe ? "white" : "#64748b", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}>
                        <option value="">—</option>
                        <option value="Femme">Femme</option>
                        <option value="Homme">Homme</option>
                        <option value="Autre">Autre</option>
                      </select>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Activité</p>
                      <select value={inviteNiveauActivite} onChange={(e) => setInviteNiveauActivite(e.target.value)}
                        style={{ width: "100%", height: 40, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: inviteNiveauActivite ? "white" : "#64748b", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}>
                        <option value="">—</option>
                        <option value="Sédentaire">Sédentaire</option>
                        <option value="Légère">Légère</option>
                        <option value="Modérée">Modérée</option>
                        <option value="Intense">Intense</option>
                        <option value="Athlète">Athlète</option>
                      </select>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Régime</p>
                      <select value={inviteRegime} onChange={(e) => setInviteRegime(e.target.value)}
                        style={{ width: "100%", height: 40, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: inviteRegime ? "white" : "#64748b", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}>
                        <option value="">—</option>
                        <option value="Omnivore">Omnivore</option>
                        <option value="Végétarien">Végétarien</option>
                        <option value="Vegan">Vegan</option>
                        <option value="Sans gluten">Sans gluten</option>
                        <option value="Halal">Halal</option>
                        <option value="Méditerranéen">Méditerranéen</option>
                      </select>
                    </div>
                  </div>

                  {[
                    { label: "Pathologies", value: invitePathologies, onChange: setInvitePathologies, placeholder: "Ex: Diabète type 2" },
                    { label: "Allergies", value: inviteAllergies, onChange: setInviteAllergies, placeholder: "Ex: Gluten, lactose" },
                    { label: "Traitements", value: inviteTraitements, onChange: setInviteTraitements, placeholder: "Ex: Metformine 500mg" },
                    { label: "Objectif", value: inviteObjectifClinique, onChange: setInviteObjectifClinique, placeholder: "Ex: Perte de poids" },
                  ].map(({ label, value, onChange, placeholder }) => (
                    <div key={label} style={{ marginBottom: 10 }}>
                      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{label}</p>
                      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
                        style={{ width: "100%", height: 40, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                        onFocus={(e) => e.target.style.borderColor = emerald}
                        onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                    </div>
                  ))}
                </div>

                <div style={{ background: "rgba(16,185,129,0.06)", borderRadius: 16, border: "1.5px solid rgba(16,185,129,0.25)", padding: "18px", marginBottom: 16 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: emerald }}>🎯 Brief pour le jumeau</p>
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: "#94a3b8" }}>Consigne de départ pour personnaliser les réponses.</p>
                  <textarea value={inviteBriefJumeau} onChange={(e) => setInviteBriefJumeau(e.target.value)} placeholder="Ex: Sois très encourageant sur le sport, mais ferme sur l'hydratation." rows={3}
                    style={{ width: "100%", borderRadius: 10, border: "1px solid rgba(16,185,129,0.3)", background: "#161616", color: "white", padding: "12px 14px", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "Inter, sans-serif" }}
                    onFocus={(e) => e.target.style.borderColor = emerald}
                    onBlur={(e) => e.target.style.borderColor = "rgba(16,185,129,0.3)"} />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>Notes internes</p>
                  <textarea value={inviteNotes} onChange={(e) => setInviteNotes(e.target.value)} placeholder="Notes visibles uniquement par vous..." rows={2}
                    style={{ width: "100%", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "Inter, sans-serif" }}
                    onFocus={(e) => e.target.style.borderColor = emerald}
                    onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                </div>

                {inviteError && <p style={{ margin: "0 0 16px", fontSize: 13, color: "#f87171" }}>{inviteError}</p>}

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { setShowInviteModal(false); resetInviteForm(); }}
                    style={{ flex: 1, height: 48, borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", cursor: "pointer", fontSize: 15 }}>Annuler</button>
                  <button onClick={() => void sendInvite()} disabled={inviting || !inviteEmail.trim()}
                    style={{ flex: 2, height: 48, borderRadius: 12, background: inviting || !inviteEmail.trim() ? "#1a1a1a" : emerald, border: "none", color: inviting || !inviteEmail.trim() ? "#4a4a4a" : "black", cursor: "pointer", fontSize: 15, fontWeight: 700 }}>
                    {inviting ? "Envoi..." : "Envoyer l'invitation →"}
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
