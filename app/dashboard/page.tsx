"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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
  objective?: string;
  pathologies?: string;
  allergies?: string;
  notes?: string;
};

type Conversation = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type ReportPeriod = "week" | "month" | "custom";

type Document = {
  id: string;
  file_name: string;
  file_type: string;
  created_at: string;
};

const AVATAR_COLORS = [
  "bg-rose-500", "bg-blue-500", "bg-violet-500",
  "bg-amber-500", "bg-emerald-500", "bg-pink-500",
  "bg-cyan-500", "bg-orange-500",
];

export default function DashboardPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  useEffect(() => {
    window.history.pushState(null, "", window.location.pathname);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.pathname);
    };
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
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [practitionerId, setPractitionerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [practitionerName, setPractitionerName] = useState("");
  const [hasDocuments, setHasDocuments] = useState<boolean | null>(null);

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
  const fidelityColor = hasDocuments === true ? "#10b981" : "#f59e0b";
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
      .select("user_id, first_name, last_name, email, age, objective, pathologies, allergies, notes")
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
          objective: p.objective,
          pathologies: p.pathologies,
          allergies: p.allergies,
          notes: p.notes,
        };
      })
    );

    setPatients(patientsWithStats);
    if (patientsWithStats.length > 0) {
      setSelectedPatientId(patientsWithStats[0].id);
    }
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
      if (practitioner) {
        setPractitionerName(`${practitioner.first_name} ${practitioner.last_name}`);
      }

      const { count } = await supabase
        .from("documents")
        .select("*", { count: "exact", head: true })
        .eq("practitioner_id", pid);
      setHasDocuments((count ?? 0) > 0);

      await loadPatients(pid);
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
      .then(({ data }) => {
        setConversations((data as Conversation[]) ?? []);
      });
  }, [selectedPatientId, practitionerId]);

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

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
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
        const res = await fetch("/api/upload-document", {
          method: "POST",
          body: formData,
        });
        const data = await res.json() as { success?: boolean; error?: string };
        if (res.ok && data.success) {
          setUploadSuccess((prev) => [...prev, file.name]);
        } else {
          setUploadErrors((prev) => [...prev, `${file.name} : ${data.error ?? "Erreur"}`]);
        }
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

    await supabase
      .from("documents")
      .delete()
      .eq("practitioner_id", practitionerId)
      .eq("file_name", fileName);

    await loadDocuments(practitionerId);

    const { count } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("practitioner_id", practitionerId);
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

    await supabase
      .from("patients")
      .update({
        age: editAge ? parseInt(editAge) : null,
        objective: editObjective || null,
        pathologies: editPathologies || null,
        allergies: editAllergies || null,
        notes: editNotes || null,
      })
      .eq("user_id", selectedPatientId);

    setPatients((prev) => prev.map((p) => {
      if (p.id === selectedPatientId) {
        return {
          ...p,
          age: editAge ? parseInt(editAge) : undefined,
          objective: editObjective || undefined,
          pathologies: editPathologies || undefined,
          allergies: editAllergies || undefined,
          notes: editNotes || undefined,
        };
      }
      return p;
    }));

    setSavingProfile(false);
    setProfileSaved(true);
    setTimeout(() => setShowProfileModal(false), 1500);
  };

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);
  const totalMessages = patients.reduce((sum, p) => sum + p.totalMessages, 0);

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
        const topEmotions = Object.entries(emotionCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([em, count]) => `${em} (${count}x)`)
          .join(", ");
        const moodTrend = journalEntries.map((e) =>
          `${e.date}: humeur ${moodLabels[e.mood - 1]}, alimentation ${foodLabels[e.food_rating - 1]}`
        ).join("\n");

        journalSection = `
JOURNAL DE BORD (${journalEntries.length} entrées) :
- Humeur moyenne : ${avgMood}/5
- Alimentation moyenne : ${avgFood}/3
- Émotions dominantes : ${topEmotions || "non renseignées"}
- Évolution :
${moodTrend}`;
      }

      let chatSection = "";
      if (hasChat) {
        const patientMessages = chatMessages
          .filter((m) => m.role === "user")
          .map((m) => m.content)
          .join("\n- ");

        chatSection = `
CONVERSATIONS AVEC LE JUMEAU (${chatMessages.length} messages) :
Messages du patient :
- ${patientMessages}`;
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/10 bg-[#111111]/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                {practitionerName ? `Bonjour ${practitionerName.split(" ")[0]} 👋` : "Dashboard NutriTwin"}
              </h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                {patients.length} patient{patients.length > 1 ? "s" : ""} actif{patients.length > 1 ? "s" : ""} · {totalMessages} messages au total
              </p>
            </div>
            <button
              onClick={() => void openJumeauModal()}
              className="rounded-full bg-[#10b981] px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-[#34d399]"
            >
              Améliorer mon jumeau
            </button>
          </div>

          {/* Jauge de fidélité */}
          {hasDocuments !== null && (
          <div className={`rounded-xl border px-4 py-3 ${hasDocuments !== true ? "border-amber-500/30 bg-amber/5" : "border-white/[0.06] bg-white/[0.02]"}`}>

            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Statut du Jumeau :</span>
                <span className="text-sm font-bold" style={{ color: fidelityColor }}>{fidelityLabel}</span>
              </div>
              <span className="text-sm font-bold" style={{ color: fidelityColor }}>{fidelityScore}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${fidelityScore}%`, backgroundColor: fidelityColor }}
              />
            </div>
            {!hasDocuments && (
              <div className="mt-2.5 flex items-start justify-between gap-4">
                <p className="text-xs text-amber-300 leading-relaxed">
                  ⚠️ Votre jumeau connaît votre philosophie mais pas encore vos protocoles. Il répond de manière générique. Importez au moins un document pour qu'il devienne vraiment vous.
                </p>
                <button
                  onClick={() => void openJumeauModal()}
                  className="shrink-0 rounded-full border border-amber-500/50 px-3 py-1.5 text-xs font-semibold text-amber-400 transition hover:bg-amber-500/10"
                >
                  Importer →
                </button>
              </div>
            )}
            {hasDocuments && (
              <p className="mt-2 text-xs text-emerald-400 font-medium">
                ✅ Votre jumeau est prêt à représenter votre méthode auprès de vos patients.
              </p>
            )}
                    </div>
        )}
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-[280px_minmax(0,1fr)_260px]">

        {/* Sidebar patients */}
        <aside className="flex h-[calc(100vh-200px)] flex-col rounded-2xl border border-white/10 bg-[#121212]">
          <div className="border-b border-white/10 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#10b981]/20">
                <span className="text-lg">🍃</span>
              </div>
              <div>
                <p className="font-semibold text-sm">Mes patients</p>
                <p className="text-xs text-zinc-400">Espace praticien</p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {loading ? (
              <p className="text-center text-xs text-zinc-500 mt-4">Chargement...</p>
            ) : patients.length === 0 ? (
              <div className="mt-6 text-center px-2">
                <p className="text-sm text-zinc-400">Aucun patient pour l'instant</p>
                <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
                  {hasDocuments ? "Invitez votre premier patient !" : "Importez vos protocoles pour débloquer l'invitation de patients."}
                </p>
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
            {hasDocuments ? (
              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="w-full rounded-full bg-[#10b981] px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-[#34d399]"
              >
                + Inviter un patient
              </button>
            ) : (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.08] p-3 text-center">
                <p className="text-xs text-amber-400 font-semibold mb-1">Jumeau incomplet</p>
                <p className="text-xs text-zinc-500 mb-2 leading-relaxed">
                  Importez vos protocoles pour activer l'invitation de patients.
                </p>
                <button
                  onClick={() => void openJumeauModal()}
                  className="inline-block rounded-full border border-amber-500/40 px-4 py-1.5 text-xs font-semibold text-amber-400 transition hover:bg-amber-500/10"
                >
                  Importer mes protocoles →
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Zone conversations */}
        <section className="flex h-[calc(100vh-200px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111111]">
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
                  <p className="text-center text-sm text-zinc-500 mt-8">Aucune conversation pour l'instant</p>
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
              <p className="text-sm text-zinc-500">{loading ? "Chargement..." : "Sélectionnez un patient"}</p>
            </div>
          )}
        </section>

        {/* Fiche patient */}
        <aside className="h-[calc(100vh-200px)] overflow-y-auto rounded-2xl border border-white/10 bg-[#121212] p-4">
          {selectedPatient ? (
            <>
              <div className="mb-4 flex flex-col items-center text-center">
                <div className={`mb-3 flex h-16 w-16 items-center justify-center rounded-full text-sm font-bold text-white ${selectedPatient.avatarColor}`}>
                  {selectedPatient.initials}
                </div>
                <p className="text-lg font-semibold">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                <p className="text-xs text-zinc-400">{selectedPatient.email}</p>
              </div>

              <div className="space-y-3 rounded-xl border border-white/10 bg-[#181818] p-3 text-sm mb-4">
                <InfoRow label="Messages totaux" value={String(selectedPatient.totalMessages)} />
                <InfoRow label="Dernier message" value={selectedPatient.lastMessageTime || "—"} />
                {selectedPatient.age && <InfoRow label="Âge" value={`${selectedPatient.age} ans`} />}
                {selectedPatient.objective && <InfoRow label="Objectif" value={selectedPatient.objective} />}
                {selectedPatient.pathologies && <InfoRow label="Pathologies" value={selectedPatient.pathologies} />}
                {selectedPatient.allergies && <InfoRow label="Allergies" value={selectedPatient.allergies} />}
                {selectedPatient.notes && <InfoRow label="Notes" value={selectedPatient.notes} />}
              </div>

              <button
                onClick={openProfileModal}
                className="w-full rounded-xl border border-white/10 bg-[#181818] px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:border-white/20 hover:text-white mb-3"
              >
                ✏️ Modifier le profil patient
              </button>

              <button
                onClick={() => { setShowReportModal(true); setReportContent(""); }}
                className="w-full rounded-xl bg-[#10b981]/10 border border-[#10b981]/30 px-4 py-3 text-sm font-semibold text-[#10b981] transition hover:bg-[#10b981]/20"
              >
                📊 Générer rapport journal
              </button>
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-zinc-500">Sélectionnez un patient</p>
            </div>
          )}
        </aside>
      </main>

      {/* MODALE MON JUMEAU */}
      {showJumeauModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowJumeauModal(false); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
            zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
        >
          <div style={{
            background: "#0d0d0d", borderRadius: 24, padding: 28,
            width: "100%", maxWidth: 560,
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            maxHeight: "90vh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "white" }}>Améliorer mon jumeau </h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>Gérez les documents qui enrichissent votre jumeau</p>
              </div>
              <button onClick={() => setShowJumeauModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#94a3b8" }}>×</button>
            </div>

            {/* Score de fidélité */}
            <div style={{
              background: hasDocuments ? "rgba(16,185,129,0.05)" : "rgba(245,158,11,0.08)",
              borderRadius: 16,
              border: `1px solid ${hasDocuments ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.3)"}`,
              padding: "16px", marginBottom: 20,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>Score de fidélité</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: fidelityColor }}>{fidelityScore}%</span>
              </div>
              <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4 }}>
                <div style={{ height: "100%", borderRadius: 4, backgroundColor: fidelityColor, width: `${fidelityScore}%`, transition: "width 0.7s" }} />
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 13, color: hasDocuments ? "#10b981" : "#f59e0b", fontWeight: 500 }}>
                {hasDocuments
                  ? "✅ Jumeau Fidèle — Votre jumeau est prêt à vous représenter parfaitement."
                  : "⚠️ Jumeau Personnalisé — Votre jumeau connaît votre philosophie mais répond de manière générique. Importez au moins un document pour qu'il devienne vraiment vous."}
              </p>
            </div>

            {/* Documents existants */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                Documents indexés ({documents.length})
              </p>
              {loadingDocs ? (
                <p style={{ fontSize: 13, color: "#64748b" }}>Chargement...</p>
              ) : documents.length === 0 ? (
                <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px dashed rgba(255,255,255,0.08)", padding: "20px", textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Aucun document indexé</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#475569" }}>Votre jumeau utilise uniquement vos réponses au questionnaire</p>
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
                      <button
                        onClick={() => void deleteDocument(doc.id, doc.file_name)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#64748b", flexShrink: 0, marginLeft: 8, padding: "4px 8px", borderRadius: 6, transition: "color 0.2s" }}
                        onMouseEnter={(e) => e.currentTarget.style.color = "#f87171"}
                        onMouseLeave={(e) => e.currentTarget.style.color = "#64748b"}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Classification document */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "white" }}>Quel type de document uploadez-vous ?</p>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b" }}>Cela détermine si vos documents seront anonymisés ou non.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => setDocumentType("protocole")}
                  style={{
                    borderRadius: 12, border: `2px solid ${documentType === "protocole" ? "#10b981" : "rgba(255,255,255,0.1)"}`,
                    background: documentType === "protocole" ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.02)",
                    padding: "14px", textAlign: "left", cursor: "pointer",
                  }}
                >
                  <p style={{ margin: "0 0 6px", fontSize: 22 }}>📋</p>
                  <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "white" }}>Protocoles & méthodes</p>
                  <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b" }}>Articles, plans alimentaires, guides nutritionnels</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#10b981", fontWeight: 600 }}>✓ Indexé tel quel</p>
                </button>
                <button
                  type="button"
                  onClick={() => setDocumentType("patient")}
                  style={{
                    borderRadius: 12, border: `2px solid ${documentType === "patient" ? "#10b981" : "rgba(255,255,255,0.1)"}`,
                    background: documentType === "patient" ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.02)",
                    padding: "14px", textAlign: "left", cursor: "pointer",
                  }}
                >
                  <p style={{ margin: "0 0 6px", fontSize: 22 }}>🗂️</p>
                  <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "white" }}>Données patients</p>
                  <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b" }}>Bilans, comptes-rendus, fiches patients</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#60a5fa", fontWeight: 600 }}>✓ Anonymisé avant indexation</p>
                </button>
              </div>
              {!documentType && uploadedFiles.length > 0 && (
                <p style={{ margin: 0, fontSize: 12, color: "#f59e0b" }}>⚠️ Veuillez sélectionner le type de document avant d'indexer.</p>
              )}
            </div>

            {/* Zone upload */}
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.csv,.mp3,.wav,.m4a" onChange={handleFileChange} style={{ display: "none" }} />

            <label
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                borderRadius: 12, border: "2px dashed rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.01)",
                padding: "20px", cursor: "pointer", transition: "border-color 0.2s", marginBottom: 12,
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(16,185,129,0.4)"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"}
            >
              <span style={{ fontSize: 32, marginBottom: 8 }}>📄</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#94a3b8" }}>Cliquez pour sélectionner</span>
              <span style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>PDF · DOCX · TXT · JPG · PNG · Excel · CSV · MP3 · WAV · M4A</span>
            </label>

            {/* Mémo vocal */}
            <div style={{ background: "rgba(16,185,129,0.05)", borderRadius: 12, border: "1.5px solid rgba(16,185,129,0.2)", padding: "14px 16px", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>🎙️</span>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "white" }}>Pas de document prêt ?</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>Enregistrez un mémo vocal — transcription automatique.</p>
                </div>
              </div>
              {!audioBlob ? (
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, borderRadius: 20,
                    padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
                    background: isRecording ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.2)",
                    color: isRecording ? "#f87171" : "#10b981",
                  }}
                >
                  {isRecording ? (
                    <><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f87171", animation: "pulse 1s infinite" }} />Arrêter — {formatTime(recordingTime)}</>
                  ) : (
                    <>🎙️ Enregistrer un mémo vocal</>
                  )}
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#10b981" }}>✅ {formatTime(recordingTime)}</p>
                  <button onClick={uploadAudioMemo} style={{ borderRadius: 20, padding: "8px 16px", fontSize: 13, fontWeight: 600, background: "#10b981", border: "none", color: "black", cursor: "pointer" }}>Ajouter</button>
                  <button onClick={() => setAudioBlob(null)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 16 }}>✕</button>
                </div>
              )}
            </div>

            {/* Fichiers sélectionnés */}
            {uploadedFiles.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {uploadedFiles.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    <button onClick={() => setUploadedFiles((prev) => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", marginLeft: 8 }}>✕</button>
                  </div>
                ))}

                <div style={{ background: "rgba(245,158,11,0.08)", borderRadius: 10, border: "1px solid rgba(245,158,11,0.2)", padding: "10px 14px", marginBottom: 10 }}>
                  <p style={{ margin: 0, fontSize: 12, color: "#f59e0b" }}>⏳ L'indexation peut prendre 30 secondes à 2 minutes. Ne fermez pas cette fenêtre.</p>
                </div>

                <button
                  onClick={() => void uploadFiles()}
                  disabled={uploading || !documentType}
                  style={{
                    width: "100%", height: 48, borderRadius: 24,
                    background: uploading ? "rgba(255,255,255,0.05)" : !documentType ? "rgba(255,255,255,0.05)" : "#10b981",
                    border: "none", color: uploading || !documentType ? "#64748b" : "black",
                    fontSize: 15, fontWeight: 600, cursor: uploading || !documentType ? "not-allowed" : "pointer",
                  }}
                >
                  {uploading ? "⏳ Indexation en cours..." : `Indexer ${uploadedFiles.length} fichier${uploadedFiles.length > 1 ? "s" : ""} →`}
                </button>
              </div>
            )}

            {uploadSuccess.length > 0 && (
              <div style={{ background: "rgba(16,185,129,0.08)", borderRadius: 12, border: "1px solid rgba(16,185,129,0.2)", padding: "12px 14px", marginBottom: 8 }}>
                <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: "#10b981" }}>✅ Documents indexés :</p>
                {uploadSuccess.map((s, i) => (
                  <p key={i} style={{ margin: "0 0 2px", fontSize: 12, color: "#10b981" }}>• {s}</p>
                ))}
              </div>
            )}

            {uploadErrors.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                {uploadErrors.map((e, i) => (
                  <p key={i} style={{ margin: "0 0 4px", fontSize: 12, color: "#f87171" }}>❌ {e}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modale profil patient */}
      {showProfileModal && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowProfileModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#121212", borderRadius: 20, padding: 28, width: "100%", maxWidth: 460, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "white" }}>✏️ Profil — {selectedPatient?.firstName}</h2>
              <button onClick={() => setShowProfileModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#94a3b8" }}>×</button>
            </div>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>Ces informations enrichissent les réponses du jumeau numérique pour ce patient.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Âge", value: editAge, onChange: setEditAge, placeholder: "Ex: 34", type: "number" },
                { label: "Objectif principal", value: editObjective, onChange: setEditObjective, placeholder: "Ex: Perte de poids durable", type: "text" },
                { label: "Pathologies", value: editPathologies, onChange: setEditPathologies, placeholder: "Ex: Diabète type 2, hypothyroïdie", type: "text" },
                { label: "Allergies & intolérances", value: editAllergies, onChange: setEditAllergies, placeholder: "Ex: Gluten, lactose, arachides", type: "text" },
              ].map(({ label, value, onChange, placeholder, type }) => (
                <div key={label}>
                  <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>{label}</p>
                  <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
                    style={{ width: "100%", height: 44, borderRadius: 10, border: "1.5px solid rgba(255,255,255,0.1)", background: "#1a1a1a", color: "white", padding: "0 14px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                    onFocus={(e) => e.target.style.borderColor = "#10b981"}
                    onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                </div>
              ))}
              <div>
                <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>Notes personnalisées</p>
                <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Informations importantes sur ce patient..." rows={3}
                  style={{ width: "100%", borderRadius: 10, border: "1.5px solid rgba(255,255,255,0.1)", background: "#1a1a1a", color: "white", padding: "12px 14px", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "'Inter', sans-serif" }}
                  onFocus={(e) => e.target.style.borderColor = "#10b981"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
              </div>
            </div>
            <button onClick={() => void saveProfile()} disabled={savingProfile}
              style={{ width: "100%", height: 48, borderRadius: 24, background: profileSaved ? "rgba(16,185,129,0.2)" : "#10b981", border: profileSaved ? "1px solid #10b981" : "none", color: profileSaved ? "#10b981" : "black", fontSize: 15, fontWeight: 600, cursor: savingProfile ? "not-allowed" : "pointer", marginTop: 20, transition: "all 0.2s" }}>
              {profileSaved ? "✅ Profil sauvegardé !" : savingProfile ? "Sauvegarde..." : "Sauvegarder le profil"}
            </button>
          </div>
        </div>
      )}

      {/* Modale rapport */}
      {showReportModal && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowReportModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#121212", borderRadius: 20, padding: 28, width: "100%", maxWidth: 560, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "white" }}>📊 Rapport — {selectedPatient?.firstName}</h2>
              <button onClick={() => setShowReportModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#94a3b8" }}>×</button>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b" }}>Rapport généré à partir du journal et des conversations. Contenu personnel confidentiel.</p>
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>Période</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {[{ value: "week", label: "Cette semaine" }, { value: "month", label: "Ce mois" }, { value: "custom", label: "Personnalisée" }].map((option) => (
                  <button key={option.value} onClick={() => setReportPeriod(option.value as ReportPeriod)}
                    style={{ flex: 1, height: 36, borderRadius: 8, border: `1.5px solid ${reportPeriod === option.value ? "#10b981" : "rgba(255,255,255,0.1)"}`, background: reportPeriod === option.value ? "rgba(16,185,129,0.15)" : "transparent", color: reportPeriod === option.value ? "#10b981" : "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {option.label}
                  </button>
                ))}
              </div>
              {reportPeriod === "custom" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <p style={{ margin: "0 0 6px", fontSize: 12, color: "#94a3b8" }}>Du</p>
                    <input type="date" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)} style={{ width: "100%", height: 40, borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.1)", background: "#1a1a1a", color: "white", padding: "0 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <p style={{ margin: "0 0 6px", fontSize: 12, color: "#94a3b8" }}>Au</p>
                    <input type="date" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)} style={{ width: "100%", height: 40, borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.1)", background: "#1a1a1a", color: "white", padding: "0 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                  </div>
                </div>
              )}
            </div>
            {!reportContent && (
              <button onClick={() => void generateReport()} disabled={reportLoading || (reportPeriod === "custom" && (!reportDateFrom || !reportDateTo))}
                style={{ width: "100%", height: 48, borderRadius: 24, background: reportLoading ? "#1a1a1a" : "#10b981", border: "none", color: reportLoading ? "#4a4a4a" : "black", fontSize: 15, fontWeight: 600, cursor: reportLoading ? "not-allowed" : "pointer", marginBottom: 16 }}>
                {reportLoading ? "Génération en cours... 🤖" : "Générer le rapport IA"}
              </button>
            )}
            {reportContent && (
              <div style={{ background: "#0f0f0f", borderRadius: 16, padding: "20px", border: "1px solid rgba(255,255,255,0.08)", fontSize: 14, color: "#e2e8f0", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                {reportContent}
              </div>
            )}
            {reportContent && (
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button onClick={() => setReportContent("")} style={{ flex: 1, height: 44, borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#94a3b8", cursor: "pointer", fontSize: 14 }}>Nouvelle période</button>
                <button onClick={() => void navigator.clipboard.writeText(reportContent)} style={{ flex: 1, height: 44, borderRadius: 12, background: "#10b981", border: "none", color: "black", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>📋 Copier</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modale invitation */}
      {showInviteModal && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowInviteModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#121212", borderRadius: 20, padding: 28, width: "100%", maxWidth: 420, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", position: "relative" }}>
            <button onClick={() => { setShowInviteModal(false); setInviteEmail(""); setInviteError(""); setInviteSuccess(false); }} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#94a3b8" }}>×</button>
            <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "white" }}>Inviter un patient</h2>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#94a3b8" }}>Votre patient recevra un email pour accéder à son espace personnalisé.</p>
            {inviteSuccess ? (
              <div style={{ background: "rgba(16,185,129,0.15)", border: "1px solid #10b981", borderRadius: 12, padding: "16px 18px", textAlign: "center", color: "#10b981", fontWeight: 600, fontSize: 15 }}>
                ✅ Invitation envoyée ! La fenêtre se ferme automatiquement...
              </div>
            ) : (
              <>
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void sendInvite(); }} placeholder="email@patient.fr"
                  style={{ width: "100%", height: 48, borderRadius: 12, border: "1.5px solid rgba(255,255,255,0.1)", background: "#1a1a1a", color: "white", padding: "0 16px", fontSize: 15, outline: "none", boxSizing: "border-box" }}
                  onFocus={(e) => e.target.style.borderColor = "#10b981"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                {inviteError && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#f87171" }}>{inviteError}</p>}
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button onClick={() => { setShowInviteModal(false); setInviteEmail(""); setInviteError(""); }} style={{ flex: 1, height: 44, borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#94a3b8", cursor: "pointer", fontSize: 14 }}>Annuler</button>
                  <button onClick={() => void sendInvite()} disabled={inviting || !inviteEmail.trim()}
                    style={{ flex: 1, height: 44, borderRadius: 12, background: inviting || !inviteEmail.trim() ? "#1a1a1a" : "#10b981", border: "none", color: inviting || !inviteEmail.trim() ? "#4a4a4a" : "black", cursor: inviting || !inviteEmail.trim() ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, transition: "all 0.2s" }}>
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
