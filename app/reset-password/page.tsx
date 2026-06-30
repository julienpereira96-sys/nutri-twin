"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function ResetPasswordForm() {
 const router = useRouter();
 const searchParams = useSearchParams();
 const isPatient = searchParams.get("type") === "patient";

 const [password, setPassword] = useState("");
 const [confirm, setConfirm] = useState("");
 const [showPassword, setShowPassword] = useState(false);
 const [showConfirm, setShowConfirm] = useState(false);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState("");
 const [ready, setReady] = useState(false);

 useEffect(() => {
  const supabase = createSupabaseBrowserClient();

  const timeout = setTimeout(() => {
    setError("__expired__");
  }, 5000);

  // Détecter le token dans le hash pour Safari
  const hash = window.location.hash;
  if (hash.includes("access_token")) {
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(() => {
        clearTimeout(timeout);
        setReady(true);
      });
    }
  }

  supabase.auth.onAuthStateChange(async (event) => {
    if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
      clearTimeout(timeout);
      setReady(true);
    }
  });

  return () => clearTimeout(timeout);
}, []);


 const handleReset = async () => {
   if (!password || password !== confirm) {
     setError("Les mots de passe ne correspondent pas.");
     return;
   }
   if (password.length < 8) {
     setError("Minimum 8 caractères.");
     return;
   }
   setError("");
   setLoading(true);

   const supabase = createSupabaseBrowserClient();
   const { error: updateError } = await supabase.auth.updateUser({ password });

   if (updateError) {
     if (updateError.message.includes("Auth session missing")) {
       setError("Lien invalide ou expiré. Demandez un nouveau lien depuis la page de connexion.");
     } else {
       setError(updateError.message);
     }
     setLoading(false);
     return;
   }

   router.push(isPatient ? "/chat" : "/dashboard");
 };

 return (
   <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4">
     <div className="w-full max-w-md">

       <div className="mb-8 text-center">
         <div className="relative mx-auto mb-3 w-fit">
           <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-lg" />
           <div style={{ position: "relative", width: 75, height: 75, margin: "0 auto" }}>
             <div style={{ width: 75, height: 75, borderRadius: "50%", background: "transparent", border: "2px solid rgba(16,185,129,0.6)", boxShadow: "0 0 16px rgba(16,185,129,0.3), 0 0 32px rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", animation: "pulse-ring 2s ease-in-out infinite" }}>
               <img src="/logo-new.svg" alt="" style={{ width: 36, height: 36 }} />
             </div>
           </div>
         </div>
         <h1 className="text-[22px] tracking-tight text-white mt-3">Nutri<strong className="font-black" style={{ color: "#10b981" }}>Twin</strong></h1>
         <p className="mt-2 text-sm text-zinc-400">Nouveau mot de passe</p>
       </div>

       <div className="rounded-2xl border border-white/10 bg-[#121212] p-6 sm:p-8">
         {error === "__expired__" ? (
           <div className="py-8 text-center">
             <p style={{ fontSize: 44, marginBottom: 0, lineHeight: 1 }}>⏱</p>
             <p className="text-sm font-semibold text-white mb-2">Lien expiré</p>
             <p className="text-sm text-zinc-400 mb-6">Ce lien de réinitialisation n'est plus valide.<br />Demandez-en un nouveau depuis la page de connexion.</p>
             <button onClick={() => router.push(isPatient ? "/patient-login" : "/login")}
               className="text-sm font-semibold cursor-pointer" style={{ color: "#10b981" }}>
               Retour à la connexion
             </button>
           </div>
         ) : !ready ? (
           <div className="py-8 text-center">
             <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-emerald-500/20 border-t-emerald-500" />
             <p className="text-sm text-zinc-400">Vérification du lien en cours...</p>
           </div>
         ) : (
           <div className="space-y-4">
             <label className="block">
               <span className="text-sm font-medium text-zinc-300">Nouveau mot de passe</span>
               <div className="relative mt-2">
                 <input
                   type={showPassword ? "text" : "password"}
                   value={password}
                   onChange={(e) => setPassword(e.target.value)}
                   placeholder="Minimum 8 caractères"
                   className="w-full rounded-xl border border-white/15 bg-[#1a1a1a] px-4 py-3 pr-12 text-[15px] text-white outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/25"
                 />
                 <button type="button" onClick={() => setShowPassword(!showPassword)}
                   className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition">
                   {showPassword ? (
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
                       <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                     </svg>
                   ) : (
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
                       <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                       <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                     </svg>
                   )}
                 </button>
               </div>
             </label>

             <label className="block">
               <span className="text-sm font-medium text-zinc-300">Confirmer le mot de passe</span>
               <div className="relative mt-2">
                 <input
                   type={showConfirm ? "text" : "password"}
                   value={confirm}
                   onChange={(e) => setConfirm(e.target.value)}
                   placeholder="Répétez votre mot de passe"
                   onKeyDown={(e) => { if (e.key === "Enter") void handleReset(); }}
                   className="w-full rounded-xl border border-white/15 bg-[#1a1a1a] px-4 py-3 pr-12 text-[15px] text-white outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/25"
                 />
                 <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                   className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition">
                   {showConfirm ? (
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
                       <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                     </svg>
                   ) : (
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
                       <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                       <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                     </svg>
                   )}
                 </button>
               </div>
             </label>

             {error && (
               <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
                 <p className="text-sm text-red-400" role="alert">{error}</p>
               </div>
             )}

             <button
               onClick={() => void handleReset()}
               disabled={loading || !password || !confirm}
               className="mt-2 w-full rounded-xl py-3 text-sm font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
               style={{ background: "linear-gradient(135deg, #10b981, #059669)", border: "none", boxShadow: "0 4px 24px rgba(16,185,129,0.25)", transition: "all 0.25s ease" }}
               onMouseEnter={e => { if (!loading && password && confirm) { e.currentTarget.style.boxShadow = "0 8px 32px rgba(16,185,129,0.4)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
               onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 24px rgba(16,185,129,0.25)"; e.currentTarget.style.transform = "translateY(0)"; }}
             >
               {loading ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />Mise à jour</span> : "Enregistrer le nouveau mot de passe"}
             </button>
           </div>
         )}
       </div>
     </div>
   </div>
 );
}

export default function ResetPasswordPage() {
 return (
   <Suspense fallback={
     <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
       <p className="text-zinc-400">Chargement...</p>
     </div>
   }>
     <ResetPasswordForm />
   </Suspense>
 );
}
