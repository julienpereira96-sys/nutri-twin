"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const emerald = "#10b981";

function VerifyOTPForm() {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const plan = searchParams.get("plan") || "pro";
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    window.onpopstate = () => {
      window.history.pushState(null, "", window.location.href);
    };
    return () => {
      window.onpopstate = null;
    };
  }, []);  

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(""));
      inputs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    const token = code.join("");
    if (token.length !== 6) {
      setError("Entrez les 6 chiffres du code.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "signup",
      });
      if (error) {
        setError("Code invalide ou expiré. Veuillez réessayer.");
        setLoading(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        router.push(`/checkout?plan=${plan}`);
      }, 1000);
    } catch {
      setError("Une erreur est survenue.");
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError("");
    try {
      await supabase.auth.resend({ type: "signup", email });
      setCountdown(60);
      setError("✅ Nouveau code envoyé !");
    } catch {
      setError("Impossible de renvoyer le code.");
    }
    setResending(false);
  };

  return (
    <div className="min-h-screen bg-[#070707] flex items-center justify-center px-4">
    <div className="w-full max-w-md">  

        <div className="rounded-2xl border border-white/[0.08] bg-[#0d0d0d] p-8">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <span className="text-2xl">✉️</span>
            </div>
            <h1 className="text-[22px] font-bold text-white mb-2">Vérifiez votre email</h1>
            <p className="text-[13px] text-zinc-400">
              Un code à 6 chiffres a été envoyé à
            </p>
            <p className="text-[13px] font-semibold mt-1" style={{ color: emerald }}>
              {email}
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
  <span className="text-sm">⚠️</span>
  <p className="text-[11px] font-medium text-amber-400">Si vous ne le voyez pas, vérifiez vos spams.</p>
</div>
          </div>

          <div className="flex justify-center gap-3 mb-6">
            {code.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onPaste={handlePaste}
                className="w-12 h-14 rounded-xl border text-center text-[20px] font-bold text-white bg-[#161616] outline-none transition-all"
                style={{
                  borderColor: digit ? emerald : "rgba(255,255,255,0.1)",
                  boxShadow: digit ? `0 0 0 1px ${emerald}20` : "none",
                }}
              />
            ))}
          </div>

          {error && (
            <div className={`mb-4 rounded-xl px-4 py-3 text-[13px] text-center border ${error.startsWith("✅") ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-[13px] text-emerald-400 text-center">
              ✓ Email vérifié ! Redirection en cours...
            </div>
          )}

<button
            onClick={handleVerify}
            disabled={loading || success || code.join("").length !== 6}
            className="w-full h-[48px] rounded-xl text-[14px] font-semibold text-black transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            style={{ backgroundColor: emerald }}
            onMouseEnter={e => { if (!loading && !success && code.join("").length === 6) { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(16,185,129,0.5), 0 8px 30px rgba(16,185,129,0.4)"; e.currentTarget.style.transform = "translateY(-2px) scale(1.02)"; } }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0) scale(1)"; }}
          >
            {loading ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />Vérification...</span> : "Confirmer mon email"}
          </button>

          <div className="mt-5 text-center">
            <p className="text-[13px] text-zinc-400">
              Vous n'avez pas reçu le code ?{" "}
              {countdown > 0 ? (
                <span className="text-zinc-500">Renvoyer dans {countdown}s</span>
              ) : (
                <button
                onClick={handleResend}
                disabled={resending}
                className="font-medium transition hover:opacity-80 cursor-pointer disabled:cursor-not-allowed"
                style={{ color: emerald }}
              >
                  {resending ? <span className="flex items-center justify-center gap-2"><span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-500/20 border-t-emerald-500" />Envoi...</span> : "Renvoyer"}
                </button>
              )}
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-zinc-500">
          Le code expire dans 10 minutes
        </p>
      </div>
    </div>
  );
}

export default function VerifyOTPPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#070707] flex items-center justify-center">
        <p className="text-zinc-400">Chargement...</p>
      </div>
    }>
      <VerifyOTPForm />
    </Suspense>
  );
}
