"use client";

import { KeyboardEvent, useMemo, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const systemPrompt = useMemo(
    () => "Tu es un assistant nutritionniste.",
    [],
  );

  const send = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || loading) return;

    const newMessages = [...messages, { role: "user", content: trimmedMessage }];
    setMessages(newMessages);
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmedMessage, systemPrompt }),
      });
      const data = (await res.json()) as { response?: string; error?: string };
      const assistantReply =
        typeof data.response === "string" && data.response.trim()
          ? data.response
          : (data.error ?? "Une erreur est survenue.");
      setMessages([...newMessages, { role: "assistant", content: assistantReply }]);
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Impossible de contacter le serveur." },
      ]);
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

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] text-white"
      style={{
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div className="h-[2px] w-full overflow-hidden bg-[#0f0f0f]">
        <div className="h-full w-1/3 animate-pulse bg-[#10b981]" />
      </div>

      <main className="mx-auto flex w-full max-w-5xl flex-col px-5 pb-36 pt-8 sm:px-8">
        <header className="mb-8 border-b border-white/10 pb-6">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#10b981]/20 text-[#10b981]">
              <span className="text-xl">🍃</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">NutriTwin</h1>
          </div>
          <p className="text-sm text-zinc-300">
            Votre assistant nutritionniste personnel
          </p>
        </header>

        <section className="flex flex-1 flex-col gap-4">
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#121212] p-6 text-[15px] text-zinc-400">
              Pose ta premiere question nutrition pour commencer.
            </div>
          ) : null}

          {messages.map((chatMessage, index) => {
            const isUser = chatMessage.role === "user";

            return (
              <div
                key={`${chatMessage.role}-${index}`}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-[84%]">
                  {!isUser ? (
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#10b981] text-xs font-bold text-white">
                        N
                      </div>
                      <span className="text-xs font-medium text-zinc-400">
                        NutriTwin
                      </span>
                    </div>
                  ) : null}

                  <div
                    className={`rounded-[18px] px-4 py-3 text-[15px] leading-relaxed ${
                      isUser
                        ? "bg-[#10b981] text-white"
                        : "border border-white/10 bg-[#1a1a1a] text-zinc-100"
                    }`}
                  >
                    {chatMessage.content}
                  </div>
                </div>
              </div>
            );
          })}

          {loading ? (
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#10b981] text-xs font-bold text-white">
                N
              </div>
              <div className="flex items-center gap-2 rounded-[18px] border border-white/10 bg-[#1a1a1a] px-4 py-3">
                <span
                  className="h-2 w-2 animate-pulse rounded-full bg-[#10b981]"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="h-2 w-2 animate-pulse rounded-full bg-[#10b981]"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="h-2 w-2 animate-pulse rounded-full bg-[#10b981]"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          ) : null}
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#0a0a0a]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-5 py-4 sm:px-8">
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            className="h-12 flex-1 rounded-xl border border-white/15 bg-[#1a1a1a] px-4 text-[15px] text-white outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/25"
            placeholder="Ecris ton message..."
          />
          <button
            onClick={() => void send()}
            disabled={loading || !message.trim()}
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#10b981] text-white transition hover:bg-[#0fb174] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Envoyer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              className="h-5 w-5"
            >
              <path d="M5 12h13" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
