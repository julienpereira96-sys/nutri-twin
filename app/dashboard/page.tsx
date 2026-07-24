"use client";
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { buildMurmureExpiry } from "@/lib/murmure";
import { findClosuresInWindow, closureFeeling, type SosClosureEvent, type SosSummary } from "@/lib/sosClosures";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const emerald = "#10b981";
const amber = "#f59e0b";
const coral = "#f43f5e";

// ═══ DONNÉES DE DÉMO ONBOARDING ═══
const DEMO_PATIENTS_INITIAL = [
  {
    id: "demo-1", firstName: "Sophie", lastName: "M.", initials: "SM",
    avatarColor: "#f43f5e", emotional_status: "red_behavioral", emotional_insight: "Rechute alimentaire ce soir",
    admin_alerts: [{ type: "alert", date: "2026-05-16T21:03:00", seen: false, murmure: "Sois plus doux cette semaine, elle traverse une période difficile au travail." }],
    totalMessages: 34, latest_victory: "A résisté à la cantine le 13 mai",
    age: 32, sexe: "F", taille: 165, poids: 68,
    objective: "Retrouver une relation apaisée avec la nourriture et perdre 5 kg durablement.",
    pathologies: "TCA",
    objectif_clinique: "Réduire les compulsions nocturnes à moins d'une par semaine.",
    niveau_activite: "Modérée", regime_specifique: "Aucun",
    allergies: "Lactose", traitements: "Aucun",
    email: "sophie.m@demo.fr",
    practitioner_instruction: [{ id: "d-m1", text: "Sois plus doux cette semaine, elle traverse une période difficile au travail.", expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), created_at: new Date().toISOString() }],
    private_notes: [{ id: "n1", text: "Tendances émotionnelles fortes le soir. Suggérer un journal alimentaire.", created_at: new Date().toISOString() }],
    lastActive: "Il y a 2h", streak: 5, sosResolved: 2, onboardingCompleted: true,
    lastMessage: "Oui, c'est clair maintenant. Merci. On continue !",
    victory_detected_at: null, // en crise — trophée masqué
  },
  {
    id: "demo-2", firstName: "Julie", lastName: "P.", initials: "JP",
    avatarColor: "#8b5cf6", emotional_status: "green", emotional_insight: "Anxieuse mais motivée",
    admin_alerts: [{ type: "alert", date: "2026-05-17T12:30:00", seen: false, murmure: "Rappelle-lui de prendre soin d'elle malgré la charge de travail." }],
    totalMessages: 18, latest_victory: "A repris sans culpabilité après l'écart",
    age: 28, sexe: "F", taille: 162, poids: 58,
    objective: "Maintenir son poids et améliorer son énergie au quotidien.",
    pathologies: "Aucune",
    objectif_clinique: "Stabiliser 3 repas par jour malgré la charge professionnelle.",
    niveau_activite: "Légère", regime_specifique: "Végétarienne",
    allergies: "Aucune", traitements: "Pilule contraceptive",
    email: "julie.p@demo.fr",
    practitioner_instruction: [{ id: "d-m2", text: "Rappelle-lui de prendre soin d'elle malgré la charge de travail.", expires_at: null, created_at: new Date().toISOString() }],
    private_notes: [],
    lastActive: "Il y a 1j", streak: 3, sosResolved: 0, onboardingCompleted: true,
    lastMessage: "Le lien alimentation-sommeil est réel, continuez sur cette lancée.",
    victory_detected_at: null, // stable — pas de victoire récente
  },
  {
    id: "demo-3", firstName: "Thomas", lastName: "R.", initials: "TR",
    avatarColor: "#3b82f6", emotional_status: "green", emotional_insight: "Poids stable depuis 3 semaines sans restriction",
    totalMessages: 40, latest_victory: "Poids stable depuis 3 semaines sans restriction",
    age: 41, sexe: "M", taille: 178, poids: 82,
    objective: "Maintenir le poids atteint et développer une alimentation intuitive.",
    pathologies: "Hypertension",
    objectif_clinique: "Consolider les habitudes et prévenir les rechutes.",
    niveau_activite: "Intense", regime_specifique: "Aucun",
    allergies: "Fruits à coque", traitements: "Aucun",
    email: "thomas.r@demo.fr",
    practitioner_instruction: [],
    private_notes: [{ id: "n3", text: "Très assidu. Envisager de passer à une consultation mensuelle.", created_at: new Date().toISOString() }],
    lastActive: "Il y a 3h", streak: 12, sosResolved: 1, onboardingCompleted: true,
    lastMessage: "C'est la meilleure preuve que le programme a fonctionné 😊",
    victory_detected_at: "2026-05-18T08:15:00", // correspond à t35 — "Bonne nouvelle : je me suis pesé ce matin, stable depuis 3 semaines !"
  },
];

const DEMO_CONVERSATIONS: { id: string; role: "user" | "assistant"; content: string; created_at: string }[] = [
  // Semaine 1 — premiers échanges
  { id: "d1", role: "user", content: "Bonjour ! Je viens de commencer le programme. Je voulais vous dire que j'ai réussi à petit-déjeuner ce matin 🙂", created_at: "2026-05-02T08:14:00" },
  { id: "d2", role: "assistant", content: "Bonjour Sophie ! C'est un très bon départ. Un petit-déjeuner complet le matin, c'est la base d'une journée sans fringale. Qu'est-ce que vous avez mangé ?", created_at: "2026-05-02T08:15:10" },
  { id: "d3", role: "user", content: "Des œufs brouillés et une tranche de pain complet avec du café. Pas d'autres sucres.", created_at: "2026-05-02T08:16:30" },
  { id: "d4", role: "assistant", content: "Parfait : des protéines, des glucides complexes, pas de pic glycémique. Continuez sur cette lancée cette semaine.", created_at: "2026-05-02T08:17:00" },
  // Semaine 1 — fin de journée difficile
  { id: "d5", role: "user", content: "Ce soir c'était dur. Réunion jusqu'à 20h, je n'ai pas déjeuné et j'ai craqué sur des chips en rentrant.", created_at: "2026-05-05T20:42:00" },
  { id: "d6", role: "assistant", content: "Je comprends, Sophie. Une réunion aussi longue sans repas, c'est une situation impossible à tenir. Ce n'est pas de la faiblesse, c'est de la biologie. Qu'est-ce que vous avez pu faire après ?", created_at: "2026-05-05T20:43:20" },
  { id: "d7", role: "user", content: "J'ai fini par manger une omelette. Mais je me sens coupable quand même.", created_at: "2026-05-05T20:44:10" },
  { id: "d8", role: "assistant", content: "Vous avez bien fait de manger quelque chose de nourrissant après. La culpabilité n'aide pas, ce qui compte, c'est que vous ayez rattrapé la situation. Demain, essayons d'anticiper : est-ce qu'il y a une plage pour déjeuner dans votre agenda ?", created_at: "2026-05-05T20:45:00" },
  { id: "d9", role: "user", content: "Oui, demain j'ai une heure libre à 12h30. Je vais en profiter.", created_at: "2026-05-05T20:45:40" },
  { id: "d10", role: "assistant", content: "Parfait. Bloquez ce créneau comme un rendez-vous médical, on ne l'annule pas. Bonne nuit Sophie 🌙", created_at: "2026-05-05T20:46:00" },
  // Semaine 2 — progrès
  { id: "d11", role: "user", content: "J'ai réussi à déjeuner deux jours de suite ! Avec une vraie pause, assise, sans téléphone.", created_at: "2026-05-08T13:02:00" },
  { id: "d12", role: "assistant", content: "C'est exactement ça l'objectif, Sophie. Deux pauses repas en pleine conscience cette semaine : vous avez ancré une habitude. Comment vous êtes-vous sentie après ?", created_at: "2026-05-08T13:03:00" },
  { id: "d13", role: "user", content: "Moins de fringale le soir. C'est étonnant comme c'est efficace.", created_at: "2026-05-08T13:03:45" },
  { id: "d14", role: "assistant", content: "Ce n'est pas étonnant, c'est de la physiologie. Un déjeuner complet évite le pic de cortisol et la faim émotionnelle du soir. Continuez, vous êtes sur la bonne voie.", created_at: "2026-05-08T13:04:30" },
  // Semaine 2 — situation sociale difficile
  { id: "d15", role: "user", content: "Repas d'entreprise demain midi. Je stresse un peu, c'est souvent un buffet avec beaucoup de tentations.", created_at: "2026-05-12T19:15:00" },
  { id: "d16", role: "assistant", content: "Anticipons ensemble. Dans un buffet, commencez par le tour complet avant de prendre quoi que ce soit, ça permet de faire un choix conscient plutôt que réactif. Que savez-vous du menu ?", created_at: "2026-05-12T19:16:10" },
  { id: "d17", role: "user", content: "Des charcuteries, des salades, des quiches, des desserts. Et du vin bien sûr.", created_at: "2026-05-12T19:16:50" },
  { id: "d18", role: "assistant", content: "Stratégie : commencez par une salade et des protéines (quiche, charcuterie en petite quantité). Laissez la place pour les desserts si vous en avez vraiment envie, mais décidez-le au moment, pas par automatisme. Pour l'alcool, alternez avec de l'eau.", created_at: "2026-05-12T19:17:45" },
  { id: "d19", role: "user", content: "J'ai suivi votre conseil ce midi ! Je n'ai pris qu'une assiette, j'ai résisté au plateau de fromages.", created_at: "2026-05-13T14:22:00" },
  { id: "d20", role: "assistant", content: "Sophie, c'est une vraie victoire. Résister en contexte social, c'est la compétence la plus difficile. Vous avez fait un choix conscient sous pression sociale. C'est exactement ce qu'on travaille. 🌟", created_at: "2026-05-13T14:23:00" },
  // Semaine 3 — rechute
  { id: "d21", role: "user", content: "Mauvaise semaine. Conflit avec mon manager, j'ai mangé n'importe quoi pendant 3 jours.", created_at: "2026-05-16T18:30:00" },
  { id: "d22", role: "assistant", content: "Je suis désolé d'entendre ça, Sophie. Le stress professionnel est un déclencheur puissant. Vous avez quand même pris la peine de m'écrire, c'est déjà bien. Qu'est-ce qui s'est passé exactement ?", created_at: "2026-05-16T18:31:00" },
  { id: "d23", role: "user", content: "Il a remis en cause mon travail devant toute l'équipe. J'étais tellement mal que je n'arrivais plus à penser à manger sainement.", created_at: "2026-05-16T18:32:20" },
  { id: "d24", role: "assistant", content: "Ce que vous décrivez est une réaction émotionnelle tout à fait normale. La nourriture devient un régulateur quand on est blessé. Ce n'est pas de la faiblesse, c'est un mécanisme ancien. L'important, c'est d'identifier ce schéma pour mieux y répondre.", created_at: "2026-05-16T18:33:15" },
  { id: "d25", role: "user", content: "Je comprends mais ça me frustre de régresser après avoir si bien avancé.", created_at: "2026-05-16T18:34:00" },
  { id: "d26", role: "assistant", content: "Le parcours n'est jamais linéaire. Trois semaines de progrès suivies d'une semaine difficile, c'est encore largement positif. La semaine prochaine est une nouvelle page.", created_at: "2026-05-16T18:34:50" },
  // Soir — fringale critique
  { id: "d27", role: "user", content: "Bonsoir, j'ai encore eu une fringale ce soir. Je me sens vraiment nulle 😔", created_at: "2026-05-16T21:03:00" },
  { id: "d28", role: "assistant", content: "Bonsoir Sophie. Un écart ça arrive, et ça ne définit pas votre parcours. Vous aviez mangé quoi ce midi ?", created_at: "2026-05-16T21:03:30" },
  { id: "d29", role: "user", content: "Pas grand chose... un sandwich en vitesse entre deux réunions.", created_at: "2026-05-16T21:04:10" },
  { id: "d30", role: "assistant", content: "Voilà tout s'explique. Ce n'est pas de la faiblesse, c'est de la biologie. Demain on vise un vrai déjeuner avec des protéines. D'accord ?", created_at: "2026-05-16T21:04:45" },
  { id: "d31", role: "user", content: "Oui. Merci, ça me soulage d'avoir quelqu'un à qui écrire 💚", created_at: "2026-05-16T21:05:20" },
  // Lendemain — rebond
  { id: "d32", role: "user", content: "J'ai fait ce qu'on avait dit : vrai déjeuner, assis, 30 minutes. Et ce soir pas de fringale.", created_at: "2026-05-17T20:10:00" },
  { id: "d33", role: "assistant", content: "Sophie ! Voilà, preuve par neuf. Un vrai déjeuner = une soirée apaisée. Vous venez de relier cause et effet. Gardez ça en mémoire pour la prochaine fois que le stress vous fait sauter un repas.", created_at: "2026-05-17T20:11:00" },
  { id: "d34", role: "user", content: "Oui, c'est clair maintenant. Merci. On continue !", created_at: "2026-05-17T20:11:45" },
];

const DEMO_CONVERSATIONS_JULIE: { id: string; role: "user" | "assistant"; content: string; created_at: string }[] = [
  // Semaine 1
  { id: "j1", role: "user", content: "Bonjour ! Mon nutritionniste m'a dit de commencer à noter ce que je mange. Je ne sais pas trop par où commencer.", created_at: "2026-05-05T09:10:00" },
  { id: "j2", role: "assistant", content: "Bonjour Julie ! Pas besoin de tout noter en détail : commencez juste par noter les repas principaux et votre niveau d'énergie à midi et en fin de journée. C'est suffisant pour identifier des tendances.", created_at: "2026-05-05T09:11:00" },
  { id: "j3", role: "user", content: "D'accord, je vais essayer. Hier j'ai mangé une salade à midi et une pizza le soir. Pas idéal je sais.", created_at: "2026-05-05T09:12:00" },
  { id: "j4", role: "assistant", content: "Ce n'est pas si mal, la salade couvre le midi, la pizza le soir apporte des calories et des glucides. Ce qui manque : des protéines et des légumes le soir. Vous ajouteriez quoi à cette pizza pour l'équilibrer ?", created_at: "2026-05-05T09:13:00" },
  // Semaine 2 — période difficile
  { id: "j5", role: "user", content: "Je suis épuisée. Cette semaine c'était trop, pas le temps de manger correctement.", created_at: "2026-05-12T12:30:00" },
  { id: "j6", role: "assistant", content: "Je vous entends Julie. Quand la charge est forte, l'alimentation est souvent la première sacrifiée. Qu'est-ce que vous avez pu manger aujourd'hui ?", created_at: "2026-05-12T12:30:30" },
  { id: "j7", role: "user", content: "Un café le matin et un croissant... et une salade à 15h.", created_at: "2026-05-12T12:31:00" },
  { id: "j8", role: "assistant", content: "C'est insuffisant pour une journée intense. Ce soir, visez quelque chose de nourrissant mais simple : des œufs, du pain complet, des légumes. Pas besoin de faire de grands efforts.", created_at: "2026-05-12T12:31:40" },
  { id: "j9", role: "user", content: "D'accord, je vais essayer. Merci d'être là.", created_at: "2026-05-12T12:32:10" },
  // Semaine 2 suite — retour positif
  { id: "j10", role: "assistant", content: "Comment s'est passée votre soirée hier ? Avez-vous pu manger quelque chose ?", created_at: "2026-05-13T09:00:00" },
  { id: "j11", role: "user", content: "Oui ! J'ai fait des œufs avec des épinards. Simple mais ça m'a bien recentrée.", created_at: "2026-05-13T09:05:00" },
  { id: "j12", role: "assistant", content: "Excellent ! Œufs + épinards, c'est fer, protéines, vitamines. Vous avez fait le bon choix sans y penser longtemps. C'est ça l'alimentation intuitive.", created_at: "2026-05-13T09:06:00" },
  // Semaine 3 — victoire
  { id: "j13", role: "user", content: "Bonne semaine ! J'ai fait 3 repas complets par jour. J'ai même pris le temps de cuisiner samedi.", created_at: "2026-05-17T10:15:00" },
  { id: "j14", role: "assistant", content: "Julie, c'est une vraie victoire : 3 repas complets toute la semaine et du temps dédié à la cuisine le week-end. Vous commencez à vous mettre en priorité.", created_at: "2026-05-17T10:16:00" },
  { id: "j15", role: "user", content: "Oui, j'ai fait un batch cooking : des lentilles, du riz, des légumes rôtis. J'ai mangé des trucs bons toute la semaine.", created_at: "2026-05-17T10:17:00" },
  { id: "j16", role: "assistant", content: "Le batch cooking, c'est exactement la solution pour quelqu'un avec votre rythme. Vous avez trouvé votre format. Est-ce que vous avez ressenti une différence d'énergie ?", created_at: "2026-05-17T10:17:45" },
  { id: "j17", role: "user", content: "Oui, clairement. Moins de coups de pompe à 15h. Et je dors mieux aussi.", created_at: "2026-05-17T10:18:30" },
  { id: "j18", role: "assistant", content: "Le lien alimentation-sommeil est réel : les glucides complexes et le magnésium dans les légumes jouent un rôle. Continuez sur cette lancée, Julie. Vous avez trouvé un rythme qui vous correspond.", created_at: "2026-05-17T10:19:00" },
];

const DEMO_CONVERSATIONS_THOMAS: { id: string; role: "user" | "assistant"; content: string; created_at: string }[] = [
  // Mois 1 — début du suivi
  { id: "t1", role: "user", content: "Bonjour ! Mon médecin m'a recommandé de suivre un programme nutritionnel pour mon hypertension.", created_at: "2026-04-01T08:00:00" },
  { id: "t2", role: "assistant", content: "Bonjour Thomas ! Vous êtes au bon endroit. L'alimentation a un impact direct sur la tension artérielle, notamment la réduction du sel et l'augmentation des potassium. On va travailler ça ensemble progressivement.", created_at: "2026-04-01T08:01:00" },
  { id: "t3", role: "user", content: "J'avoue que je mange beaucoup de plats préparés le midi. Et du fromage le soir.", created_at: "2026-04-01T08:02:00" },
  { id: "t4", role: "assistant", content: "Ce sont deux sources importantes de sel caché. Pas besoin de tout supprimer : commençons par réduire d'un côté : midi ou soir, pas les deux en même temps. Lequel vous semble le plus facile à changer ?", created_at: "2026-04-01T08:03:00" },
  { id: "t5", role: "user", content: "Le midi peut-être. Je pourrais apporter ma gamelle.", created_at: "2026-04-01T08:04:00" },
  { id: "t6", role: "assistant", content: "Parfait. On vise 3 midis par semaine avec un repas fait maison. C'est déjà un changement significatif sur le sel et les calories.", created_at: "2026-04-01T08:05:00" },
  // Mois 1 suite
  { id: "t7", role: "user", content: "J'ai apporté ma gamelle lundi et mercredi. Mardi j'ai craqué sur un kebab.", created_at: "2026-04-07T12:00:00" },
  { id: "t8", role: "assistant", content: "Deux sur trois, c'est une réussite Thomas. Le kebab de mardi n'efface pas les deux autres jours. Comment vous sentiez-vous après le kebab vs après votre gamelle ?", created_at: "2026-04-07T12:01:00" },
  { id: "t9", role: "user", content: "Lourd après le kebab. La gamelle c'était plus léger et j'avais plus d'énergie l'après-midi.", created_at: "2026-04-07T12:02:00" },
  { id: "t10", role: "assistant", content: "Voilà, votre corps vous donne un signal clair. Gardez cette observation en mémoire, elle sera plus efficace que n'importe quelle règle que je pourrais vous donner.", created_at: "2026-04-07T12:03:00" },
  // Mois 2 — progrès poids
  { id: "t11", role: "user", content: "Je me suis pesé : moins 2 kg en un mois. Sans me restreindre vraiment.", created_at: "2026-04-14T07:30:00" },
  { id: "t12", role: "assistant", content: "Thomas, c'est excellent. 2 kg en un mois sans restriction, c'est le signe qu'on a changé de qualité et non de quantité, c'est ce qui tient sur le long terme.", created_at: "2026-04-14T07:31:00" },
  { id: "t13", role: "user", content: "Et ma tension a un peu baissé selon mon médecin. 140/90 contre 148/95 avant.", created_at: "2026-04-14T07:32:00" },
  { id: "t14", role: "assistant", content: "C'est significatif en un mois. La réduction du sel y contribue beaucoup. Continuez, l'objectif de votre médecin est probablement 130/80. On est sur la bonne trajectoire.", created_at: "2026-04-14T07:33:00" },
  // Mois 2 — week-end difficile
  { id: "t15", role: "user", content: "Week-end compliqué. Anniversaire de mariage, beaucoup de vin et de nourriture grasse. Je me sens coupable.", created_at: "2026-04-22T10:00:00" },
  { id: "t16", role: "assistant", content: "Un anniversaire de mariage mérite d'être célébré pleinement. Ce n'est pas un écart alimentaire, c'est de la vie. Un week-end festif sur deux mois de progrès constants, ça ne change rien à la trajectoire.", created_at: "2026-04-22T10:01:00" },
  { id: "t17", role: "user", content: "Merci de le formuler ainsi. Je reprends normalement aujourd'hui.", created_at: "2026-04-22T10:02:00" },
  { id: "t18", role: "assistant", content: "C'est tout ce qu'il faut faire : reprendre sans drama. La flexibilité fait partie d'une alimentation saine.", created_at: "2026-04-22T10:03:00" },
  // Fin avril — semaine de stress + SOS
  { id: "t18b", role: "user", content: "Cette semaine c'était difficile. Réorganisation dans mon service, je dormais mal, j'ai sauté des repas et grignoté le soir.", created_at: "2026-04-26T21:10:00" },
  { id: "t18c", role: "assistant", content: "Je vous entends, Thomas. Le stress professionnel est souvent le premier facteur à faire dérailler les bonnes habitudes. Là, maintenant : nuque, tension, tête, comment vous sentez-vous physiquement ?", created_at: "2026-04-26T21:11:00" },
  { id: "t18d", role: "user", content: "Tendu. Nuque raide, j'ai l'impression que ma tension est remontée. Je me sens un peu submergé.", created_at: "2026-04-26T21:12:00" },
  { id: "t18e", role: "assistant", content: "Ce que vous décrivez, tension physique, sentiment d'être submergé : c'est exactement le bon moment pour l'exercice SOS. Il prend quelques minutes et aide le système nerveux à redescendre. Essayez-le maintenant, je suis là quand vous revenez.", created_at: "2026-04-26T21:12:30" },
  { id: "t18f", role: "user", content: "Je l'ai fait. C'est étrange… je me sens vraiment plus calme. La nuque s'est détendue.", created_at: "2026-04-26T21:25:00" },
  { id: "t18g", role: "assistant", content: "Ce n'est pas étrange, c'est de la physiologie. Vous venez d'activer votre système parasympathique. Gardez ça en mémoire : c'est un outil que vous avez maintenant, pour la prochaine fois que le travail déborde. La semaine prochaine repart comme avant.", created_at: "2026-04-26T21:26:00" },
  // Mois 3 — alimentation intuitive
  { id: "t19", role: "user", content: "J'ai arrêté de compter les calories la semaine dernière. Je mange quand j'ai faim, je m'arrête quand je suis rassasié.", created_at: "2026-05-01T11:00:00" },
  { id: "t20", role: "assistant", content: "Thomas, c'est une étape majeure. L'alimentation intuitive, c'est l'objectif final, quand le corps reprend le pilotage naturel. Comment ça se passe concrètement ?", created_at: "2026-05-01T11:01:00" },
  { id: "t21", role: "user", content: "Bien. Je mange plus lentement. Je reconnais mieux quand je suis vraiment rassasié.", created_at: "2026-05-01T11:02:00" },
  { id: "t22", role: "assistant", content: "Manger lentement est l'une des interventions les plus efficaces : le signal de satiété met 20 minutes à arriver. Vous avez trouvé la clé tout seul. C'est votre victoire.", created_at: "2026-05-01T11:03:00" },
  // Mois 3 — activité physique
  { id: "t23", role: "user", content: "J'ai commencé à marcher 30 minutes chaque matin avant le travail. Ça me change vraiment.", created_at: "2026-05-06T07:45:00" },
  { id: "t24", role: "assistant", content: "Excellent ajout Thomas. La marche matinale régule la glycémie, réduit le cortisol et améliore l'humeur pour toute la journée. En combien de temps avez-vous pris cette habitude ?", created_at: "2026-05-06T07:46:00" },
  { id: "t25", role: "user", content: "Deux semaines. Les premiers jours c'était dur de se lever plus tôt mais maintenant j'ai hâte.", created_at: "2026-05-06T07:47:00" },
  { id: "t26", role: "assistant", content: "Deux semaines, c'est exactement le temps qu'il faut pour ancrer une habitude. Et quand on commence à « avoir hâte », c'est gagné.", created_at: "2026-05-06T07:48:00" },
  // Mois 3 — semaine de maintien
  { id: "t27", role: "user", content: "Deuxième semaine stable. Poids identique à lundi dernier à 200g près.", created_at: "2026-05-10T08:20:00" },
  { id: "t28", role: "assistant", content: "La stabilité, c'est exactement l'objectif en phase de maintien. Pas de yo-yo, pas de fluctuation. Votre corps est en équilibre.", created_at: "2026-05-10T08:21:00" },
  { id: "t29", role: "user", content: "J'ai mangé au restaurant deux fois cette semaine et le poids n'a pas bougé. Avant, ça m'aurait fait prendre 1 kg facilement.", created_at: "2026-05-10T08:22:00" },
  { id: "t30", role: "assistant", content: "Ce que vous décrivez, c'est de la flexibilité métabolique : votre corps sait désormais absorber les variations sans s'emballer. Vous avez développé une vraie résilience alimentaire.", created_at: "2026-05-10T08:23:00" },
  // Semaine récente — résultats
  { id: "t31", role: "user", content: "Consultation avec mon médecin hier : tension à 128/82. Il est très content.", created_at: "2026-05-15T09:00:00" },
  { id: "t32", role: "assistant", content: "Thomas, c'est fantastique. 128/82 depuis 148/95 en deux mois et demi, sans médicament supplémentaire, juste par l'alimentation et l'activité physique. Vous pouvez en être fier.", created_at: "2026-05-15T09:01:00" },
  { id: "t33", role: "user", content: "Il a dit qu'on peut envisager de réduire le Ramipril si ça continue. Ça m'aurait semblé impossible il y a 3 mois.", created_at: "2026-05-15T09:02:00" },
  { id: "t34", role: "assistant", content: "C'est la preuve que les changements d'hygiène de vie ont un impact réel, mesurable, clinique. Vous avez fait ce travail, je n'ai fait que vous accompagner.", created_at: "2026-05-15T09:03:00" },
  // Victoire finale
  { id: "t35", role: "user", content: "Bonne nouvelle : je me suis pesé ce matin, stable depuis 3 semaines !", created_at: "2026-05-18T08:15:00" },
  { id: "t36", role: "assistant", content: "Excellent Thomas ! La stabilité est souvent plus difficile à maintenir que la perte initiale. C'est une vraie victoire.", created_at: "2026-05-18T08:15:30" },
  { id: "t37", role: "user", content: "Oui, je mange mieux sans me priver. J'ai arrêté de compter les calories.", created_at: "2026-05-18T08:16:10" },
  { id: "t38", role: "assistant", content: "C'est exactement l'objectif : une relation apaisée avec la nourriture. Comment vous sentez-vous globalement ?", created_at: "2026-05-18T08:16:50" },
  { id: "t39", role: "user", content: "Bien, vraiment bien. Plus d'énergie, meilleur sommeil. Je recommande à mes collègues.", created_at: "2026-05-18T08:17:20" },
  { id: "t40", role: "assistant", content: "C'est la meilleure preuve que le programme a fonctionné. Et si vos collègues viennent, on s'en occupera aussi bien 😊", created_at: "2026-05-18T08:18:00" },
];

const DEMO_CONVERSATIONS_BY_PATIENT: Record<string, { id: string; role: "user" | "assistant"; content: string; created_at: string }[]> = {
  "demo-1": DEMO_CONVERSATIONS,
  "demo-2": DEMO_CONVERSATIONS_JULIE,
  "demo-3": DEMO_CONVERSATIONS_THOMAS,
};

// Mock bilan questions par patient démo
const DEMO_BILAN_BY_PATIENT: Record<string, { question: string; justification: string; objectif: string }[]> = {
  "demo-1": [
    { question: "Comment avez-vous géré les moments de stress professionnel cette semaine sur le plan alimentaire ?", justification: "Sophie a mentionné ne pas avoir eu le temps de déjeuner correctement entre deux réunions, ce qui a précédé une fringale en soirée.", objectif: "Identifier les déclencheurs situationnels et co-construire une stratégie d'anticipation." },
    { question: "Avez-vous pu mettre en place une routine de petit-déjeuner plus structurée depuis notre dernière séance ?", justification: "L'objectif fixé ensemble était de stabiliser le premier repas de la journée pour réduire les compensations du soir.", objectif: "Évaluer l'adhésion au plan et ajuster si la routine reste difficile à tenir." },
    { question: "Qu'est-ce qui vous a aidée à résister à la cantine la semaine dernière ?", justification: "Sophie a réussi à faire un choix alimentaire cohérent dans un contexte social contraignant : comprendre ce levier est précieux.", objectif: "Renforcer les mécanismes d'auto-efficacité et capitaliser sur les succès." },
  ],
  "demo-2": [
    { question: "Comment se passe l'équilibre entre votre charge de travail et vos repas au quotidien ?", justification: "Julie a indiqué ne manger qu'un croissant le matin et une salade à 15h lors d'une semaine chargée.", objectif: "Identifier des solutions concrètes adaptées à ses contraintes professionnelles." },
    { question: "Avez-vous ressenti une différence d'énergie ou d'humeur les jours où vous avez mieux mangé ?", justification: "Julie est en phase d'apprentissage des connexions alimentation-énergie. Ce lien peut être un fort levier de motivation.", objectif: "Renforcer la conscience intéroceptive et la motivation intrinsèque." },
    { question: "Qu'est-ce qui vous rend le plus difficile de prendre soin de vous quand vous êtes surchargée ?", justification: "La fatigue professionnelle semble être un obstacle majeur à l'alimentation équilibrée chez Julie.", objectif: "Explorer les croyances sous-jacentes et trouver des solutions minimales applicables même en période intense." },
  ],
  "demo-3": [
    { question: "Comment vivez-vous la stabilité actuelle de votre poids : est-ce que cela vous rassure ou est-ce anxiogène ?", justification: "Thomas est stable depuis 3 semaines, ce qui est une réussite, mais la phase de maintien peut générer une vigilance nouvelle.", objectif: "Valider psychologiquement la phase de maintien et prévenir les rechutes liées à la pression de résultats." },
    { question: "Avez-vous envie d'évoluer vos objectifs maintenant que vous avez trouvé votre équilibre ?", justification: "Thomas se dit bien, avec plus d'énergie et un meilleur sommeil. Il est peut-être prêt pour un objectif de nouvelle phase.", objectif: "Explorer l'évolution des motivations et préparer la suite du parcours." },
    { question: "Comment se passent vos repas en contexte social depuis que vous ne comptez plus les calories ?", justification: "Thomas a évoqué l'arrêt du comptage calorique comme une libération : tester cette liberté en situation sociale est l'étape suivante.", objectif: "Consolider la flexibilité alimentaire et préparer à gérer les situations sociales sereinement." },
  ],
};

// Mock rapport par patient démo
const DEMO_RAPPORT_BY_PATIENT: Record<string, { synthese: string; patterns: string; victoires: string; murmures_bilan: string }> = {
  "demo-1": {
    synthese: "Sophie traverse une période de stress professionnel intense qui impacte directement ses comportements alimentaires. Les échanges de la période révèlent un schéma de déjeuners sautés suivi de compensations en soirée, avec une bonne conscience du problème.",
    patterns: "Schéma récurrent : repas insuffisant en journée les jours de forte charge → fringale émotionnelle en soirée. Le stress professionnel est le principal déclencheur identifié. Sophie montre une bonne capacité réflexive post-écart.",
    victoires: "Sophie a résisté à un choix non désiré en contexte social (cantine), ce qui représente un progrès notable. Elle fait preuve d'une bonne communication avec le jumeau en cas de difficulté, signe d'engagement dans son suivi.",
    murmures_bilan: "Explorer des solutions de repas rapides mais nourrissants pour les journées chargées (batch cooking, snacks protéinés). La récurrence des fringales nocturnes mérite d'être abordée en consultation pour identifier si un travail sur l'alimentation émotionnelle est nécessaire.",
  },
  "demo-2": {
    synthese: "Julie est en phase de prise de conscience des liens entre fatigue professionnelle et qualité de son alimentation. Ses échanges montrent une bonne volonté mais des contraintes de temps importantes qui rendent l'organisation difficile.",
    patterns: "Alimentation quasi absente en matinée les jours de forte charge de travail, avec un seul repas tardif dans la journée. La fatigue semble être à la fois cause et conséquence d'une alimentation insuffisante.",
    victoires: "Julie a effectué 3 repas complets sur la semaine où elle a eu un peu moins de pression au travail. C'est un signal positif : quand les conditions le permettent, elle mobilise les bonnes habitudes.",
    murmures_bilan: "Travailler sur des solutions ultra-simples pour les matins chargés (préparation la veille, aliments pratiques). Évoquer avec Julie la possibilité de poser des alertes ou rendez-vous repas dans son agenda professionnel.",
  },
  "demo-3": {
    synthese: "Thomas est en phase de consolidation avec d'excellents résultats : stabilité pondérale depuis 3 semaines, relation apaisée à la nourriture, amélioration de l'énergie et du sommeil. Il est dans la phase la plus fragile du parcours : le maintien.",
    patterns: "Thomas ne compte plus les calories et mange intuitivement, avec succès. Pas de schéma problématique observé sur la période. Bonne régularité des échanges avec le jumeau.",
    victoires: "Stabilité pondérale maintenue 3 semaines consécutives. Meilleure énergie et qualité de sommeil rapportées spontanément. Recommande le programme à son entourage, signe d'adhésion profonde.",
    murmures_bilan: "Préparer Thomas à la gestion des situations de tentation futures (vacances, fêtes). Évoquer la possibilité d'espacer les consultations, tout en maintenant le suivi du jumeau. Proposer des objectifs de maintenance ou de nouvelle phase (activité physique, optimisation).",
  },
};

type OnboardingProps = {
  practitionerName: string;
  onSkip: () => void;
  onTestMode: () => void;
};

const OnboardingTour = ({ practitionerName, onSkip, onTestMode }: OnboardingProps) => {
  const [visible, setVisible] = useState(false);
  const firstName = (practitionerName.split(" ")[0] || practitionerName).trim();

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "relative", zIndex: 1, width: "100%", maxWidth: 480, margin: "0 24px",
        background: "#0d0d0d", borderRadius: 24, padding: "44px 40px",
        border: "1px solid rgba(16,185,129,0.18)",
        boxShadow: "0 40px 120px rgba(0,0,0,0.9), 0 0 80px rgba(16,185,129,0.12), 0 0 200px rgba(16,185,129,0.06)",
        opacity: visible ? 1 : 0, transform: visible ? "scale(1) translateY(0)" : "scale(0.97) translateY(8px)",
        transition: "opacity 0.35s ease, transform 0.35s ease",
        fontFamily: "Inter, sans-serif",
      }}>
        {/* Ligne verte haut */}
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 200, height: 2, background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.6), transparent)", borderRadius: 2 }} />

        {/* Logo — cercle lumineux identique à la page login */}
        <div style={{ position: "relative", width: 96, height: 96, margin: "0 auto 20px" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(16,185,129,0.08)", filter: "blur(16px)" }} />
          <div style={{ position: "relative", width: 96, height: 96, borderRadius: "50%", border: "2px solid rgba(16,185,129,0.6)", boxShadow: "0 0 20px rgba(16,185,129,0.35), 0 0 40px rgba(16,185,129,0.12)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <img src="/logo.png" alt="" style={{ width: 96, height: 96, padding: "18px", objectFit: "contain", boxSizing: "border-box" }} />
          </div>
        </div>

        {/* Titre */}
        <h1 style={{ margin: "0 0 16px", fontSize: 19, fontWeight: 800, color: "white", textAlign: "center", lineHeight: 1.35, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Bienvenue sur votre<br />Dashboard, {firstName}&nbsp;!
        </h1>

        {/* Séparateur */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 0 22px" }} />

        {/* Corps */}
        <p style={{ margin: "0 0 28px", fontSize: 13.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.8, textAlign: "center" }}>
          Avant d&apos;inviter vos premiers patients, découvrez l&apos;expérience de leur point de vue grâce au mode test.<br />
          Échangez avec votre{" "}
          <strong style={{ color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>Jumeau Numérique</strong>{" "}
          comme si vous étiez un patient : vous verrez ses réponses et l&apos;actualisation de votre tableau de bord se synchroniser en temps réel.
        </p>

        {/* Boutons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {/* Bouton mode test — style carte dashboard */}
          <button
            onClick={onTestMode}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 14, padding: "13px 16px", borderRadius: 14, background: "linear-gradient(135deg, rgba(16,185,129,0.14), rgba(16,185,129,0.05))", border: "1px solid rgba(16,185,129,0.22)", cursor: "pointer", transition: "all 0.2s", boxShadow: "0 2px 12px rgba(0,0,0,0.3)", fontFamily: "Inter, sans-serif" }}
            onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.24), rgba(16,185,129,0.10))"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.14), rgba(16,185,129,0.05))"; e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: "transparent", border: "1.5px solid rgba(16,185,129,0.55)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {/* Fiole / beaker — évoque le test */}
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3h6"/><path d="M10 3v7l-5 8.5A1 1 0 0 0 6 20h12a1 1 0 0 0 .9-1.5L14 10V3"/>
                <path d="M8.5 16h7"/>
              </svg>
            </div>
            <div style={{ textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#10b981" }}>Lancer une conversation test</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#475569" }}>Découvrir l&apos;expérience patient</p>
            </div>
          </button>

          {/* ou */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, letterSpacing: "0.04em", fontFamily: "Inter, sans-serif" }}>ou</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
          </div>

          {/* Bouton dashboard — ghost */}
          <button
            onClick={onSkip}
            style={{ width: "100%", height: 46, borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.38)", fontSize: 14, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = "rgba(255,255,255,0.38)"; }}>
            Accéder au dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══ TYPES ═══
type RealPatient = {
  id: string; firstName: string; lastName: string; initials: string; avatarColor: string; email: string;
  lastMessage: string; lastMessageTime: string; lastMessageRole: string; totalMessages: number;
  admin_alerts?: { type: string; date: string; seen: boolean; alert_type?: string; murmure?: string; trigger_message_id?: string; question_snippet?: string }[];
  age?: number; sexe?: string; taille?: number; poids?: number; objective?: string; pathologies?: string;
  allergies?: string; traitements?: string; objectif_clinique?: string; niveau_activite?: string;
  regime_specifique?: string;   practitioner_instruction?: { id: string; text: string; expires_at?: string | null; created_at: string }[];
  emotional_status?: string; emotional_insight?: string;
  latest_victory?: string; victory_detected_at?: string | null; victory_message_id?: string; private_notes?: { id: string; text: string; created_at: string }[]; created_at?: string;
  lastActive?: string | null; streak?: number; sosResolved?: number; sosEvents?: { triggered_at: string; sos_context: string; tool_id?: string; status?: string | null; origin?: string | null; summary_text?: string | null }[]; red_behavioral_until?: string | null; last_patient_message_at?: string | null; onboardingCompleted?: boolean; onboardingStatus?: string | null;
  sharing_status?: string; cabinet_id?: string;
  is_test?: boolean;
  motivation?: string; defi?: string; notes?: string; aliments_detestes?: string;
};

type Conversation = {
  id: string;
  role: "user" | "assistant" | "widget" | "system";
  content: string;
  created_at: string;
  /** role "widget" — carte "Exercice SOS terminé", jamais persistée en base
   * (reconstruite à l'affichage depuis sos_events via lib/sosClosures.ts) */
  sosSummary?: SosSummary;
};

// ═══ CARTE "EXERCICE SOS TERMINÉ" — vue praticien ═══
// Équivalent dashboard de la carte côté patient (app/chat/page.tsx). Dupliquée
// plutôt que partagée car le style diffère (couleurs/conteneur du dashboard),
// mais alimentée par la même donnée brute (sos_events via /api/sos/closures) —
// jamais un résumé généré par LLM, jamais persistée dans `conversations`.
// Contrairement à la carte patient : affiche aussi un indicateur si une
// alerte a été détectée PENDANT cet exercice précis (crisis_level_detected),
// avec un lien "Aller au message" qui réutilise le mécanisme de scroll déjà
// existant pour les victoires/alertes (setPendingScrollMessageId).
function DashboardSosSummaryCard({
  word, feeling, intake, intakeMurmure, crisisLevel, crisisMessageId, onGoToMessage,
}: SosSummary & { onGoToMessage: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const hasCrisis = !!crisisLevel;
  const alertColor = crisisLevel === "red_critical" ? coral : amber;
  const alertBg = crisisLevel === "red_critical" ? "rgba(244,63,94,0.05)" : "rgba(245,158,11,0.05)";
  const alertBorder = crisisLevel === "red_critical" ? "rgba(244,63,94,0.25)" : "rgba(245,158,11,0.25)";
  return (
    <div
      onClick={() => setOpen(o => !o)}
      role="button"
      tabIndex={0}
      style={{
        display: "flex", flexDirection: "column", gap: open ? 8 : 0,
        padding: "10px 14px", borderRadius: 12,
        background: hasCrisis ? alertBg : "rgba(16,185,129,0.04)",
        border: `1px solid ${hasCrisis ? alertBorder : "rgba(16,185,129,0.2)"}`,
        cursor: "pointer", maxWidth: 340, transition: "all 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={hasCrisis ? alertColor : emerald} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9.5" />
          <path d="m8.5 12.5 2.5 2.5 4.5-5" />
        </svg>
        <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>Exercice SOS terminé</span>
        {hasCrisis && (
          <span style={{ fontSize: 10, fontWeight: 700, color: alertColor, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            · Alerte détectée
          </span>
        )}
        <svg
          style={{ marginLeft: "auto", flexShrink: 0, opacity: 0.4, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        ><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      {open && (
        <div style={{ fontSize: 12, lineHeight: 1.7, color: "#94a3b8", paddingLeft: 23 }}>
          {intakeMurmure && (
            <p style={{ margin: "0 0 4px" }}>
              <span style={{ color: "#64748b", fontSize: 11 }}>Interprétation clinique</span>
              <br />
              <span style={{ color: "rgba(255,255,255,0.9)", fontStyle: "italic" }}>« {intakeMurmure} »</span>
            </p>
          )}
          {intake && (
            <p style={{ margin: "0 0 3px" }}>Ce que le patient a exprimé : <span style={{ color: "rgba(255,255,255,0.75)", fontStyle: "italic" }}>« {intake} »</span></p>
          )}
          <p style={{ margin: "0 0 3px" }}>Mot tracé : <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>{word}</span></p>
          <p style={{ margin: hasCrisis ? "0 0 6px" : 0 }}>Ressenti après : <span style={{ color: "rgba(255,255,255,0.85)", fontStyle: "italic" }}>« {feeling} »</span></p>
          {hasCrisis && crisisMessageId && (
            <button
              onClick={(e) => { e.stopPropagation(); onGoToMessage(crisisMessageId); }}
              style={{ fontSize: 11, fontWeight: 600, color: alertColor, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}
            >
              Aller au message qui a déclenché l&apos;alerte
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type ReportPeriod = "week" | "month" | "custom";
type ActiveTab = "patients" | "vue_ensemble";
type Document = { id: string; file_name: string; file_type: string; created_at: string; content?: string; };
type MonthlyStats = { messages_geres: number; crises_nocturnes: number; temps_economise_heures: number; temps_accompagnement_heures: number; taux_retention: number; questions_repetitives_pct: number; sos_resolutions?: number; chat_resolutions?: number; taux_apaisement?: number | null; top_crisis_context?: string | null; };

const AVATAR_COLORS = ["#f43f5e", "#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ec4899", "#06b6d4", "#f97316"];

const CYAN_STATUS = "#06b6d4"; // réservé côté patient (Mon Soutien)
const ORANGE_BEHAVIORAL = "#f59e0b"; // red_behavioral côté praticien → amber (spec clinique)
const SLATE_BLUE = "#60a5fa"; // identity_correction — administratif, non-urgent
const RED_CRITICAL_COLOR = "#ef4444";
function getStatusColor(status?: string) {
  if (status === "red_critical") return RED_CRITICAL_COLOR;
  if (status === "red_behavioral") return ORANGE_BEHAVIORAL;
  if (status === "green") return emerald;
  return "#94a3b8"; // gris — jamais évalué (null en DB)
}
function getStatusEmoji(status?: string) {
  if (status === "red_critical") return "🔴";
  if (status === "red_behavioral") return "🟠";
  if (status === "green") return "🟢";
  return "⚪"; // en attente de données
}

// ═══ SVG ICONS ═══
const AlertIcon = ({ size = 16, color = coral }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const InfoCircleIcon = ({ size = 13, color = "#64748b" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);
const TrophyIcon = ({ size = 12, color = emerald }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
    <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
  </svg>
);
const ZapIcon = ({ size = 12, color = coral }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill={color} fillOpacity="0.15"/>
  </svg>
);
const ShieldIcon = ({ size = 12, color = "#818cf8" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const ClockIcon = ({ size = 12, color = amber }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const TrendDownIcon = ({ size = 12, color = emerald }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>
  </svg>
);
const MicIcon = ({ size = 13, color = emerald }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);
const CheckCircleSent = () => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
    <span style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(5,150,105,0.18)", border: "1.5px solid #059669", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#059669" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </span>
    <span style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>Envoyé !</span>
  </span>
);

function LeverAlerteCritique({ alert, patientId, practitionerId, onResolved }: { alert: { type: string; alert_type?: string; murmure?: string; date?: string; trigger_message_id?: string }; patientId: string; practitionerId?: string; onResolved: () => void }) {
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const resolve = async () => {
    setLoading(true);
    const resolvedAt = new Date().toISOString();
    // Piste d'audit immuable — obligations légales (responsabilité praticien)
    const auditEntry = {
      ...alert,
      archived: true,
      resolved_at: resolvedAt,
      resolved_by: practitionerId ?? "unknown",
      practitioner_signature: true,
      resolution: "practitioner_certified",
    };
    const { data: cur } = await supabase.from("patients").select("admin_alerts, archived_alerts").eq("user_id", patientId).single();
    const existingAlerts = (cur as { admin_alerts?: object[] } | null)?.admin_alerts ?? [];
    const existingArchived = (cur as { archived_alerts?: object[] } | null)?.archived_alerts ?? [];
    // Marquer l'alerte spécifique comme seen: true — NE PAS effacer la liste (audit immutable)
    const updatedAlerts = existingAlerts.map((a: object) => {
      const al = a as { trigger_message_id?: string; date?: string };
      const matches = alert.trigger_message_id
        ? al.trigger_message_id === alert.trigger_message_id
        : al.date === alert.date;
      return matches ? { ...a, seen: true } : a;
    });
    await supabase.from("patients").update({
      emotional_status: "green",
      admin_alerts: updatedAlerts,
      red_behavioral_until: null,
      emotional_insight: null, // vider la note clinique — sinon réinjectée au classifieur de crise (faux positif au message suivant)
      archived_alerts: [...existingArchived, auditEntry],
    }).eq("user_id", patientId);
    await fetch("/api/invalidate-cache", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId }) });
    onResolved();
    setLoading(false);
  };

  return (
    <div style={{ background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 8, padding: "10px 12px" }}>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", marginBottom: 10 }}>
        <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} style={{ marginTop: 2, accentColor: "#f43f5e", flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>Je certifie avoir pris contact avec le patient et mis en place les mesures de sécurité nécessaires.</span>
      </label>
      <button onClick={resolve} disabled={!checked || loading}
        style={{ width: "100%", height: 32, borderRadius: 8, background: checked ? "rgba(244,63,94,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${checked ? "rgba(244,63,94,0.3)" : "rgba(255,255,255,0.06)"}`, color: checked ? "#f87171" : "#64748b", fontSize: 11, fontWeight: 600, cursor: checked ? "pointer" : "not-allowed", transition: "all 0.2s" }}>
        {loading ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />Chargement</span> : "Confirmer et lever l'alerte"}
      </button>
    </div>
  );
}

// ─── Composant interne pour mise à jour de carte (nécessite les hooks Stripe) ─
function CardUpdateForm({ onSuccess }: { onSuccess: (last4: string, brand: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);
    const result = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });
    if (result.error) {
      setError(result.error.message ?? "Erreur lors de la mise à jour.");
      setLoading(false);
      return;
    }
    const setupIntent = result.setupIntent;
    if (setupIntent?.payment_method) {
      const pmId = typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method.id;
      const res = await fetch("/api/billing/update-payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId: pmId }),
      });
      if (res.ok) {
        // Récupérer les infos de la nouvelle carte
        const pm = typeof setupIntent.payment_method === "object" ? setupIntent.payment_method : null;
        const last4 = (pm as { card?: { last4?: string } } | null)?.card?.last4 ?? "****";
        const brand = (pm as { card?: { brand?: string } } | null)?.card?.brand ?? "carte";
        onSuccess(last4, brand);
      } else {
        setError("Erreur lors de la sauvegarde de la carte.");
      }
    }
    setLoading(false);
  };

  return (
    <form onSubmit={e => void handleSubmit(e)}>
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <p style={{ margin: "10px 0 0", fontSize: 12, color: "#ef4444" }}>{error}</p>}
      <button type="submit" disabled={!stripe || loading}
        style={{ width: "100%", height: 40, borderRadius: 10, background: loading ? "rgba(16,185,129,0.05)" : "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981", fontSize: 13, fontWeight: 600, cursor: loading ? "default" : "pointer", marginTop: 14, transition: "all 0.15s", opacity: loading ? 0.7 : 1 }}>
        {loading ? "Enregistrement…" : "Enregistrer la carte"}
      </button>
    </form>
  );
}

function DashboardInner() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // ═══ ONBOARDING ═══
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingDemoMode, setOnboardingDemoMode] = useState(false);
  type DemoPatient = Omit<typeof DEMO_PATIENTS_INITIAL[0], "practitioner_instruction"> & {
    practitioner_instruction: { id: string; text: string; expires_at?: string | null; created_at: string }[];
    private_notes: { id: string; text: string; created_at: string }[];
  };
  const [demoPatients, setDemoPatients] = useState<DemoPatient[]>(DEMO_PATIENTS_INITIAL as unknown as DemoPatient[]);

  // ═══ MODE TEST ═══
  const [testMode, setTestMode] = useState(false);
  // chatPanelWidth : largeur du panneau chat (redimensionnable par drag)
  const [chatPanelWidth, setChatPanelWidth] = useState(() =>
    typeof window !== "undefined" ? Math.round(window.innerWidth * 0.5) : 500
  );
  const testDrag = useRef({ active: false, startX: 0, startW: 0 });
  const [testDragHover, setTestDragHover] = useState(false);
  const [testDragging, setTestDragging] = useState(false);
  // realPatientsRef : sauvegarde des vrais patients quand on entre en mode test
  const realPatientsRef = useRef<RealPatient[]>([]);
  const realSelectedIdRef = useRef<string | null>(null);
  const [testIframeKey, setTestIframeKey] = useState("test-chat-0");
  const [testPatientsLoading, setTestPatientsLoading] = useState(false);
  // Modal ajout patient test (3 étapes)
  const [showAddTestPatientModal, setShowAddTestPatientModal] = useState(false);
  const [addTestPatientStep, setAddTestPatientStep] = useState(1);
  const [addTestPatientSaving, setAddTestPatientSaving] = useState(false);
  const [addTestPatientForm, setAddTestPatientForm] = useState({
    firstName: "", lastName: "", age: "", taille: "", poids: "", sexe: "",
    pathologies: "", allergies: "", traitements: "", objectifClinique: "", activite: "", regime: "",
    sommeil: "", humeur: "", defiPrincipal: "", alimentsDetestes: "",
  });
  const [addTestPatientDigestif, setAddTestPatientDigestif] = useState<string[]>([]);
  const [addTestPatientAlimentsDetestes, setAddTestPatientAlimentsDetestes] = useState<string[]>([]);
  const [addTestPatientCustomAliments, setAddTestPatientCustomAliments] = useState<string[]>([]);

  // Drag global mouse events (resize du chat panel)
  useEffect(() => {
    if (!testMode) return;
    const onMove = (e: MouseEvent) => {
      if (!testDrag.current.active) return;
      // Si le bouton est relâché hors de la fenêtre, on annule le drag
      if (e.buttons === 0) {
        testDrag.current.active = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setTestDragging(false);
        return;
      }
      // Glisser gauche = chat plus large, glisser droite = chat plus étroit
      const dx = testDrag.current.startX - e.clientX;
      const raw = testDrag.current.startW + dx;
      setChatPanelWidth(Math.max(320, Math.min(raw, window.innerWidth - 400)));
    };
    const onUp = () => {
      if (!testDrag.current.active) return;
      testDrag.current.active = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setTestDragging(false);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [testMode]);

  // ─── Test mode : mise à jour du dernier message dans la sidebar ──────────
  // Quand l'iframe /chat?test=true envoie un postMessage après chaque réponse
  // IA, on met à jour lastMessage du patient concerné en state local, sans
  // aucun appel API ni refresh complet.
  useEffect(() => {
    if (!testMode) return;
    const handleTestMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (!e.data || (e.data as { type?: string }).type !== "nutri-twin:new-message") return;
      const { patientId: pid, content } = e.data as { patientId: string; content: string };
      if (!pid || !content) return;
      setPatients(prev => prev.map(p => p.id === pid ? { ...p, lastMessage: content } : p));
    };
    window.addEventListener("message", handleTestMessage);
    return () => window.removeEventListener("message", handleTestMessage);
  }, [testMode]);

  const router = useRouter();
  const searchParams = useSearchParams();

  // ═══ ÉTATS PRINCIPAUX ═══
  const [activeTab, setActiveTab] = useState<ActiveTab>("patients");

  // Lire le tab au montage — URL en priorité, localStorage en fallback.
  // localStorage couvre le cas où le refresh arrive avant que window.history.replaceState
  // ait été appelé (très rare, mais possible sur des machines lentes).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get("tab") as ActiveTab | null;
    const tabFromStorage = localStorage.getItem("dashboard_active_tab") as ActiveTab | null;
    const tab = tabFromUrl ?? tabFromStorage;
    if (tab === "patients" || tab === "vue_ensemble") setActiveTab(tab);
  }, []);

  // Pré-charger la photo depuis le cache local pour éviter le flash au refresh
  useEffect(() => {
    const cached = localStorage.getItem("nutri_practitioner_avatar");
    if (cached) setPractitionerPhoto(cached);
  }, []);

  // Helper : change le tab ET met à jour l'URL sans rechargement.
  // On utilise window.history.replaceState (synchrone) plutôt que router.replace
  // (asynchrone — passe par la machinerie Next.js) pour que l'URL soit garantie
  // à jour même si l'utilisateur refreshe immédiatement après le changement de tab.
  const navigateTab = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    window.history.replaceState(null, "", `/dashboard?tab=${tab}`);
    localStorage.setItem("dashboard_active_tab", tab);
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [discretMode, setDiscretMode] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [savedPin, setSavedPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [practitionerEmail, setPractitionerEmail] = useState("");
  const [practitionerSpecialty, setPractitionerSpecialty] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [showDeletePinModal, setShowDeletePinModal] = useState(false);
  const [deletePinInput, setDeletePinInput] = useState("");
  const [settingsScreen, setSettingsScreen] = useState<"main"|"profil"|"motdepasse"|"discret"|"abonnement"|"notifications">("main");
  const [notifyBehavioral, setNotifyBehavioral] = useState(false);
  const [notifyCritical, setNotifyCritical] = useState(true);
  const [showDisableCriticalConfirm, setShowDisableCriticalConfirm] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPasswordField, setNewPasswordField] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [showOldPwd, setShowOldPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);
  const [emailChangeSent, setEmailChangeSent] = useState(false);
  const [emailChangeError, setEmailChangeError] = useState("");
  const [showEmailConfirmModal, setShowEmailConfirmModal] = useState(false);
  const [deletePinError, setDeletePinError] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(0);
  const [practitionerPhoto, setPractitionerPhoto] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [practitionerPlan, setPractitionerPlan] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [extraPatients, setExtraPatients] = useState<number>(0);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);
  const [planUpdateError, setPlanUpdateError] = useState("");
  const [planUpdateSuccess, setPlanUpdateSuccess] = useState(false);
  const [pendingPlanSwitch, setPendingPlanSwitch] = useState<{ plan: string; label: string; price: string } | null>(null);
  const [isPurchasingPack, setIsPurchasingPack] = useState(false);
  const [packError, setPackError] = useState("");
  // ─── Billing étendu ───────────────────────────────────────────────────────────
  const [billingTab, setBillingTab] = useState<"facturation"|"plan">("plan");
  const [billingLoading, setBillingLoading] = useState(false);
  const [invoices, setInvoices] = useState<Array<{ id: string; number: string | null; amount_paid: number; currency: string; status: string | null; created: number; invoice_pdf: string | null; hosted_invoice_url: string | null }>>([]);
  const [billingSubscription, setBillingSubscription] = useState<{ id: string; status: string; cancel_at_period_end: boolean; current_period_end: number; cancel_at: number | null } | null>(null);
  const [cardLast4, setCardLast4] = useState<string | null>(null);
  const [cardBrand, setCardBrand] = useState<string | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardSetupClientSecret, setCardSetupClientSecret] = useState<string | null>(null);
  const [cardUpdateSuccess, setCardUpdateSuccess] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteRequestLoading, setDeleteRequestLoading] = useState(false);
  const [deleteRequestSent, setDeleteRequestSent] = useState(false);
  const [reportError, setReportError] = useState("");
  const [showBilanModal, setShowBilanModal] = useState(false);
  const [bilanContent, setBilanContent] = useState("");
  const [bilanLoading, setBilanLoading] = useState(false);
  const [inviteStep, setInviteStep] = useState(1);
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteMurmureDuration, setInviteMurmureDuration] = useState<string>("permanent");

  const AVATARS = [
    <svg key={0} width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M13 3C13 3 4 8 4 15C4 19.4 8.1 23 13 23C17.9 23 22 19.4 22 15C22 8 13 3 13 3Z" stroke={emerald} strokeWidth="1.4" strokeLinejoin="round"/><path d="M13 23V13" stroke={emerald} strokeWidth="1.4" strokeLinecap="round"/><path d="M13 13C13 13 9 10 9 7" stroke={emerald} strokeWidth="1.4" strokeLinecap="round"/><path d="M13 13C13 13 17 10 17 7" stroke={emerald} strokeWidth="1.4" strokeLinecap="round"/></svg>,
    <svg key={1} width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M3 20L10 8L14 14L17 10L23 20H3Z" stroke={emerald} strokeWidth="1.4" strokeLinejoin="round"/></svg>,
    <svg key={2} width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M3 13C5.5 10 8.5 10 11 13C13.5 16 16.5 16 19 13C20.2 11.5 21.5 11 23 11" stroke={emerald} strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>,
    <svg key={3} width="26" height="26" viewBox="0 0 26 26" fill="none"><circle cx="13" cy="13" r="4" stroke={emerald} strokeWidth="1.4"/><path d="M13 4V6M13 20V22M4 13H6M20 13H22" stroke={emerald} strokeWidth="1.4" strokeLinecap="round"/></svg>,
    <svg key={4} width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M13 22V12" stroke={emerald} strokeWidth="1.4" strokeLinecap="round"/><path d="M13 16C13 16 8 14 7 9C7 9 12 8 15 12" stroke={emerald} strokeWidth="1.4" strokeLinejoin="round"/></svg>,
    <svg key={5} width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M13 22C13 22 6 17 6 11C6 7.7 9.1 5 13 5C13 5 13 10 13 22Z" stroke={emerald} strokeWidth="1.4" strokeLinejoin="round"/><path d="M13 22C13 22 20 17 20 11C20 7.7 16.9 5 13 5C13 5 13 10 13 22Z" stroke={emerald} strokeWidth="1.4" strokeLinejoin="round"/></svg>,
    <svg key={6} width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M13 4C13 4 6 12 6 16.5C6 19.5 9.1 22 13 22C16.9 22 20 19.5 20 16.5C20 12 13 4 13 4Z" stroke={emerald} strokeWidth="1.4" strokeLinejoin="round"/></svg>,
    <svg key={7} width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M20 14C18.5 17.5 15 20 11 20C6.6 20 3 16.4 3 12C3 7.6 6.6 4 11 4C9.5 6.5 9.5 11.5 13 14C15.5 15.5 18 14.5 20 14Z" stroke={emerald} strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  ];

  useEffect(() => {
    window.history.pushState(null, "", window.location.pathname);
    const handlePopState = () => window.history.pushState(null, "", window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // ═══ DEEPLINK ?settings=abonnement ═══
  useEffect(() => {
    const target = searchParams.get("settings");
    if (target === "abonnement") {
      setShowSettingsModal(true);
      setSettingsScreen("abonnement");
      setBillingTab("facturation");
      // Nettoyer le param de l'URL sans recharger la page
      const url = new URL(window.location.href);
      url.searchParams.delete("settings");
      window.history.replaceState(null, "", url.toString());
    }
  }, [searchParams]);

  const [patients, setPatients] = useState<RealPatient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [sosClosures, setSosClosures] = useState<SosClosureEvent[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showJumeauModal, setShowJumeauModal] = useState(false);
  const [jumeauText, setJumeauText] = useState("");
  const [jumeauTextUploading, setJumeauTextUploading] = useState(false);
  const [editingNote, setEditingNote] = useState<Document | null>(null);
  const [showMurmureModal, setShowMurmureModal] = useState(false);
  const [practitionerId, setPractitionerId] = useState<string | null>(null);

  const completeOnboarding = useCallback(async (pid: string) => {
    await supabase.from("practitioners").update({ dashboard_tour_done: true }).eq("user_id", pid);
    setShowOnboarding(false);
    // onboardingDemoMode reste actif tant qu'il n'y a pas de vrais patients
  }, [supabase]);

  const handleOnboardingSkip = useCallback(() => {
    if (practitionerId) void completeOnboarding(practitionerId);
    else setShowOnboarding(false);
  }, [practitionerId, completeOnboarding]);

  const [loading, setLoading] = useState(true);
  const [practitionerName, setPractitionerName] = useState("");
  const [hasDocuments, setHasDocuments] = useState<boolean | null>(null);
  const [showFidelity, setShowFidelity] = useState(true);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null);
  const [murmureText, setMurmureText] = useState("");
  const [savingMurmure, setSavingMurmure] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [sendingVictory, setSendingVictory] = useState<string | null>(null);
  const [victorySent, setVictorySent] = useState<string | null>(null);
  const [alertBannerDismissed, setAlertBannerDismissed] = useState<Record<string, boolean>>({});
  const [showInterventionBubble, setShowInterventionBubble] = useState(false);
  const [docsCollapsed, setDocsCollapsed] = useState(false);
  const [murmuresCollapsed, setMurmuresCollapsed] = useState(false);
  const [notesCollapsed, setNotesCollapsed] = useState(false);
  const [replyMode, setReplyMode] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyIsFromJumeau, setReplyIsFromJumeau] = useState(false);
  const [replyGenerating, setReplyGenerating] = useState(false);
  const [replySending, setReplySending] = useState(false);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const patientsRef = useRef<RealPatient[]>([]);
  const testModeRef = useRef(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  // Scroll déterministe cross-tab : ID exact du message cible (alerte ou victoire)
  const [pendingScrollMessageId, setPendingScrollMessageId] = useState<string | null>(null);
  const [vueEnsembleFilter, setVueEnsembleFilter] = useState<"tous" | "alertes" | "victoires" | "ras" | "partages">("tous");
  const [practitionerCabinetId, setPractitionerCabinetId] = useState<string | null>(null);
  const [cabinetSharedPatients, setCabinetSharedPatients] = useState<RealPatient[]>([]);
  const [bravoState, setBravoState] = useState<Record<string, { expanded: boolean; text: string; editing: boolean; loading: boolean; sending: boolean; sent: boolean }>>({});
  const [outOfScopeReply, setOutOfScopeReply] = useState<Record<string, { expanded: boolean; text: string; sending: boolean }>>({}); // keyed by `${patientId}-${alertDate}`
  const conversationContainerRef = useRef<HTMLDivElement>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [inviteExistingUnactivated, setInviteExistingUnactivated] = useState(false);
  const [inviteResentLoading, setInviteResentLoading] = useState(false);
  const [inviteResentSuccess, setInviteResentSuccess] = useState(false);
  const [resentInvite, setResentInvite] = useState(false);
  const [resentInviteLoading, setResentInviteLoading] = useState(false);
  const [showDeletePatientModal, setShowDeletePatientModal] = useState(false);
  const [deletingPatient, setDeletingPatient] = useState(false);
  const [showDeleteTestPatientModal, setShowDeleteTestPatientModal] = useState(false);
  const [deletingTestPatient, setDeletingTestPatient] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [editingMurmureId, setEditingMurmureId] = useState<string | null>(null);
  const [editingMurmureText, setEditingMurmureText] = useState("");
  const [openSosModal, setOpenSosModal] = useState<string | null>(null); // patientId ou null — modale crises désamorcées
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
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
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [documentType, setDocumentType] = useState<"protocole" | "patient" | null>(null);
  const [showPatientDocModal, setShowPatientDocModal] = useState(false);
  const [patientDocFiles, setPatientDocFiles] = useState<File[]>([]);
  const [patientDocUploading, setPatientDocUploading] = useState(false);
  const [patientDocErrors, setPatientDocErrors] = useState<string[]>([]);
  const [patientDocSuccess, setPatientDocSuccess] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [continueFromSecs, setContinueFromSecs] = useState(0);
  const [editingAudioDoc, setEditingAudioDoc] = useState<Document | null>(null);
  const [docsExpanded, setDocsExpanded] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fidelityScore = documents.length === 0 ? 70 : documents.length === 1 ? 85 : documents.length === 2 ? 95 : 100;
  const fidelityColor = documents.length === 0 ? amber : documents.length >= 3 ? emerald : "#06b6d4";
  const firstNameInputRef = useRef<HTMLInputElement>(null);
  const [focusFirstNameOnOpen, setFocusFirstNameOnOpen] = useState(false);
  const [pendingCorrections, setPendingCorrections] = useState<{ field: string; correction: string }[]>([]);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editAge, setEditAge] = useState("");
  const [editTaille, setEditTaille] = useState("");
  const [editPoids, setEditPoids] = useState("");
  const [editSexe, setEditSexe] = useState("");
  const [murmureDuration, setMurmureDuration] = useState("permanent");
  const [editObjective, setEditObjective] = useState("");
  const [editPathologies, setEditPathologies] = useState("");
  const [editAllergies, setEditAllergies] = useState("");
  const [editTraitements, setEditTraitements] = useState("");
  const [editObjectifClinique, setEditObjectifClinique] = useState("");
  const [editNiveauActivite, setEditNiveauActivite] = useState("");
  const [editRegime, setEditRegime] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSommeil, setEditSommeil] = useState("");
  const [editHumeur, setEditHumeur] = useState("");
  const [editDefiPrincipal, setEditDefiPrincipal] = useState("");
  const [editDigestif, setEditDigestif] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [visionText, setVisionText] = useState("");
  const [signatureText, setSignatureText] = useState("");
  const [savingVision, setSavingVision] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const [visionSaved, setVisionSaved] = useState(false);
  const [signatureSaved, setSignatureSaved] = useState(false);
  const [editingVision, setEditingVision] = useState(false);
  const [editingSignature, setEditingSignature] = useState(false);
  const [visionDraft, setVisionDraft] = useState("");
  const [signatureDraft, setSignatureDraft] = useState("");

  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("month");
  const [reportDateFrom, setReportDateFrom] = useState("");
  const [reportDateTo, setReportDateTo] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportContent, setReportContent] = useState("");
  const [reportMonth, setReportMonth] = useState(new Date());

  const loadDocuments = async (pid: string) => {
    setLoadingDocs(true);
    const { data } = await supabase.from("documents").select("id, file_name, file_type, created_at, content").eq("practitioner_id", pid).order("created_at", { ascending: false });
    const seen = new Set<string>();
    const unique = (data as Document[] ?? []).filter((d) => { if (seen.has(d.file_name)) return false; seen.add(d.file_name); return true; });
    setDocuments(unique);
    setLoadingDocs(false);
  };

  const loadMonthlyStats = async (pid: string) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Messages du mois (avec contenu pour le calcul du temps libéré)
    const { data: monthMessages } = await supabase.from("conversations")
      .select("role, content")
      .eq("practitioner_id", pid)
      .gte("created_at", startOfMonth);

    const msgs = (monthMessages ?? []).length;

    // Temps libéré — basé sur le volume de mots échangés
    // Hypothèse : le praticien aurait mis ~40 mots/min à l'oral pour répondre,
    // et ~200 mots/min à lire les messages patients.
    const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
    const totalMotsIA = (monthMessages ?? [])
      .filter(m => m.role === "assistant")
      .reduce((sum, m) => sum + countWords((m.content as string) ?? ""), 0);
    const totalMotsPatient = (monthMessages ?? [])
      .filter(m => m.role === "user")
      .reduce((sum, m) => sum + countWords((m.content as string) ?? ""), 0);
    const tempsLibereMinutes = (totalMotsIA / 40) + (totalMotsPatient / 200);
    const tempsLibere = Math.round(tempsLibereMinutes / 60 * 10) / 10; // → heures, 1 décimale

    // Sessions pour le temps d'accompagnement
    const { data: sessions } = await supabase.from("conversations_sessions").select("created_at, last_message_at").eq("practitioner_id", pid);
    const tempsAccompagnement = Math.round(
      (sessions ?? []).reduce((sum, s) => {
        if (!s.last_message_at) return sum;
        const dur = (new Date(s.last_message_at).getTime() - new Date(s.created_at).getTime()) / 1000 / 60;
        return sum + Math.min(dur, 60);
      }, 0) / 60 * 10
    ) / 10;

    // sos_events — source de vérité pour taux d'apaisement et crises apaisées
    // Couvre toutes les origines : SOS vocal, exercices (breathing, ancrage, restructuration, manger)
    const { data: crisisSosEvents } = await supabase.from("sos_events")
      .select("triggered_at, status")
      .eq("practitioner_id", pid)
      .eq("origin", "crise")
      .gte("triggered_at", startOfMonth);
    const triggered = (crisisSosEvents ?? []).length;
    const resolved = (crisisSosEvents ?? []).filter(e => e.status === "success").length;
    const tauxApaisement = triggered > 0 ? Math.round((resolved / triggered) * 100) : null;

    // Contexte de crise le plus fréquent → météo émotionnelle "Avant"
    const { data: sosEvents } = await supabase
      .from("sos_events").select("sos_context").eq("practitioner_id", pid).limit(100);
    const contextCounts: Record<string, number> = {};
    (sosEvents ?? []).forEach((e: { sos_context?: string }) => {
      if (e.sos_context) contextCounts[e.sos_context] = (contextCounts[e.sos_context] || 0) + 1;
    });
    const topContext = Object.entries(contextCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const contextMeteo: Record<string, string> = {
      fringale: "Fringale / Pulsion",
      stress: "Submergé(e)",
      culpabilite: "Coupable / Honteux(se)",
      culpabilité: "Coupable / Honteux(se)",
      "coup de mou": "Découragé(e)",
    };
    const topCrisisContext = topContext ? (contextMeteo[topContext] ?? "En détresse") : null;

    setMonthlyStats({
      messages_geres: msgs,
      crises_nocturnes: 0,
      temps_economise_heures: tempsLibere,
      temps_accompagnement_heures: tempsAccompagnement,
      taux_retention: 85,
      questions_repetitives_pct: 72,
      sos_resolutions: resolved, // crises apaisées ce mois
      chat_resolutions: triggered, // crises déclenchées ce mois
      taux_apaisement: tauxApaisement,
      top_crisis_context: topCrisisContext,
    });
  };

  const loadPatients = async (pid: string): Promise<boolean> => {
    const { data: relations, error: relError } = await supabase.from("patient_practitioner").select("patient_id").eq("practitioner_id", pid);
    if (relError || !relations || relations.length === 0) { setLoading(false); if (!testModeRef.current) setOnboardingDemoMode(true); return true; }
    const patientIds = relations.map((r) => r.patient_id as string);

    const baseSelect = "user_id, first_name, last_name, email, age, sexe, taille, poids, objective, pathologies, allergies, traitements, objectif_clinique, niveau_activite, regime_specifique, practitioner_instruction, emotional_status, emotional_insight, red_behavioral_until, last_patient_message_at, latest_victory, victory_detected_at, victory_message_id, private_notes, admin_alerts, created_at, onboarding_completed, onboarding_status, sharing_status, cabinet_id, last_seen_at";
    let { data: patientsData, error: patientsError } = await supabase.from("patients").select(baseSelect).in("user_id", patientIds).or("is_test.is.null,is_test.eq.false");
    if (patientsError || !patientsData) {
      // Fallback : requête sans le filtre is_test (migration non encore appliquée)
      const { data: fallbackData } = await supabase.from("patients").select(baseSelect).in("user_id", patientIds);
      if (!fallbackData) { setLoading(false); return false; }
      patientsData = fallbackData;
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // 3 requêtes batch au lieu de 4 × N requêtes individuelles
    const [
      { data: allConvs },
      { data: allRecentConvs },
      { data: allSosEvents },
    ] = await Promise.all([
      supabase.from("conversations")
        .select("patient_id, role, content, created_at")
        .in("patient_id", patientIds)
        .or(`practitioner_id.eq.${pid},practitioner_id.is.null`)
        .order("created_at", { ascending: false }),
      supabase.from("conversations")
        .select("patient_id, created_at")
        .in("patient_id", patientIds)
        .or(`practitioner_id.eq.${pid},practitioner_id.is.null`)
        .eq("role", "user")
        .gte("created_at", thirtyDaysAgo),
      supabase.from("sos_events")
        .select("patient_id, triggered_at, sos_context, raw_response, status, origin, summary_text")
        .in("patient_id", patientIds)
        .gte("triggered_at", startOfCurrentMonth)
        .order("triggered_at", { ascending: false }),
    ]);

    // Construire les maps de lookup (agrégation côté client, une seule passe)
    const lastConvByPatient = new Map<string, { role: string; content: string; created_at: string }>();
    const totalCountByPatient = new Map<string, number>();
    for (const conv of (allConvs ?? [])) {
      const p = conv.patient_id as string;
      if (!lastConvByPatient.has(p) && (conv.role as string) === "user") lastConvByPatient.set(p, conv as { role: string; content: string; created_at: string });
      totalCountByPatient.set(p, (totalCountByPatient.get(p) ?? 0) + 1);
    }

    const streakDaysByPatient = new Map<string, Set<string>>();
    for (const conv of (allRecentConvs ?? [])) {
      const p = conv.patient_id as string;
      const day = (conv.created_at as string).split("T")[0];
      if (!streakDaysByPatient.has(p)) streakDaysByPatient.set(p, new Set());
      streakDaysByPatient.get(p)!.add(day);
    }

    type SosEventItem = { triggered_at: string; sos_context: string; tool_id?: string; status?: string | null; origin?: string | null; summary_text?: string | null };
    const sosCountByPatient = new Map<string, number>();
    const sosEventsByPatient = new Map<string, SosEventItem[]>();
    for (const sos of (allSosEvents ?? [])) {
      const p = sos.patient_id as string;
      sosCountByPatient.set(p, (sosCountByPatient.get(p) ?? 0) + 1);
      const toolId = (sos.raw_response as { tool_id?: string } | null)?.tool_id;
      const item: SosEventItem = {
        triggered_at: sos.triggered_at as string,
        sos_context: (sos.sos_context as string) ?? "",
        tool_id: toolId,
        status: (sos.status as string | null) ?? null,
        // Historique (avant migration) : pas de colonne origin → traité comme "crise" par défaut
        origin: (sos.origin as string | null) ?? "crise",
        summary_text: (sos.summary_text as string | null) ?? null,
      };
      if (!sosEventsByPatient.has(p)) sosEventsByPatient.set(p, []);
      sosEventsByPatient.get(p)!.push(item);
    }

    const patientsWithStats = patientsData.map((p, i) => {
      const lastConv = lastConvByPatient.get(p.user_id);
      const initials = `${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`.toUpperCase();
      return {
        id: p.user_id, firstName: p.first_name ?? "Patient", lastName: p.last_name ?? "", initials,
        avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length], email: p.email ?? "",
        lastMessage: lastConv?.content ?? "Aucun message pour l'instant",
        lastMessageTime: lastConv?.created_at ? new Date(lastConv.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
        lastMessageRole: lastConv?.role ?? "", totalMessages: totalCountByPatient.get(p.user_id) ?? 0,
        // "Dernière connexion" : max entre dernier message chat, heartbeat de présence
        // (last_seen_at) et horodatage du dernier message patient (last_patient_message_at).
        // Les trois sources doivent être incluses pour éviter le jitter lors des reloads.
        lastActive: [
          lastConv?.created_at,
          (p as { last_seen_at?: string | null }).last_seen_at,
          (p as { last_patient_message_at?: string | null }).last_patient_message_at,
        ].filter((d): d is string => !!d).sort().pop() ?? null,
        // Série de jours consécutifs : on part d'aujourd'hui (ou hier si pas encore
        // actif aujourd'hui) et on compte en arrière tant qu'il y a une activité
        // chaque jour. Dès qu'il y a un trou, la série est brisée → 0.
        streak: (() => {
          const daySet = streakDaysByPatient.get(p.user_id);
          if (!daySet || daySet.size === 0) return 0;
          const today = new Date().toISOString().split("T")[0];
          const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
          // La série est encore "vivante" si le patient était là aujourd'hui ou hier
          const anchor = daySet.has(today) ? today : daySet.has(yesterday) ? yesterday : null;
          if (!anchor) return 0;
          let count = 0;
          let d = new Date(anchor + "T12:00:00Z");
          while (daySet.has(d.toISOString().split("T")[0])) {
            count++;
            d = new Date(d.getTime() - 86400000);
          }
          return count;
        })(),
        sosResolved: (sosEventsByPatient.get(p.user_id) ?? []).filter(e => e.status === "success" && e.origin === "crise").length,
        sosEvents: sosEventsByPatient.get(p.user_id) ?? [],
        red_behavioral_until: (p as { red_behavioral_until?: string | null }).red_behavioral_until ?? null,
        last_patient_message_at: (p as { last_patient_message_at?: string | null }).last_patient_message_at ?? null,
        age: p.age, sexe: p.sexe, taille: p.taille, poids: p.poids, traitements: p.traitements,
        objectif_clinique: p.objectif_clinique, niveau_activite: p.niveau_activite, regime_specifique: p.regime_specifique,
        objective: p.objective, pathologies: p.pathologies, allergies: p.allergies,
        practitioner_instruction: (p.practitioner_instruction as { id: string; text: string; expires_at?: string | null; created_at: string }[] | null) ?? [],
        private_notes: (p.private_notes as { id: string; text: string; created_at: string }[] | null) ?? [],
        emotional_status: p.emotional_status ?? undefined, emotional_insight: p.emotional_insight ?? "",
        created_at: p.created_at,
        latest_victory: p.latest_victory ?? "",
        victory_detected_at: (p as { victory_detected_at?: string | null }).victory_detected_at ?? null,
        onboardingCompleted: p.onboarding_completed ?? false,
        onboardingStatus: p.onboarding_status ?? null,
        admin_alerts: (p.admin_alerts as { type: string; date: string; seen: boolean }[] | null) ?? [],
        sharing_status: (p as { sharing_status?: string }).sharing_status ?? "private",
        cabinet_id: (p as { cabinet_id?: string | null }).cabinet_id ?? undefined,
      };
    });
    // LEGACY-1 — SUPPRIMÉ : l'auto-expiry qui repassait le statut au vert après 12h.
    // Le statut praticien ne s'auto-clear PLUS : il reste red_behavioral jusqu'à apaisement
    // réel (piloté par Gemini) ou action manuelle du praticien. Le champ red_behavioral_until
    // ne sert désormais qu'à borner le mode ancrage du Jumeau côté serveur (voir /api/chat).
    // Le "Sans nouvelles depuis Xh" gère déjà le cas du patient silencieux.
    // Si le mode test a été activé pendant le chargement, ne pas écraser l'état test.
    // On stocke les vrais patients dans realPatientsRef pour la restauration à la sortie.
    if (testModeRef.current) {
      realPatientsRef.current = patientsWithStats;
      setLoading(false);
      return false;
    }
    setPatients(patientsWithStats);
    const isDemo = patientsWithStats.length === 0;
    setOnboardingDemoMode(isDemo);
    if (patientsWithStats.length > 0) setSelectedPatientId(patientsWithStats[0].id);
    else setSelectedPatientId("demo-1");
    setLoading(false);
    return isDemo;
  };

  const loadSharedCabinetPatients = async (cabinetId: string, ownPatientIds: string[]) => {
    const { data } = await supabase
      .from("patients")
      .select("user_id, first_name, last_name, email, emotional_status, emotional_insight, latest_victory, victory_detected_at, sharing_status, cabinet_id, created_at")
      .eq("cabinet_id", cabinetId)
      .eq("sharing_status", "shared")
      .not("user_id", "in", `(${ownPatientIds.join(",") || "00000000-0000-0000-0000-000000000000"})`);
    if (!data) return;
    const shared: RealPatient[] = data.map((p, i) => ({
      id: p.user_id, firstName: p.first_name ?? "Patient", lastName: p.last_name ?? "",
      initials: `${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`.toUpperCase(),
      avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length], email: p.email ?? "",
      lastMessage: "", lastMessageTime: "", lastMessageRole: "", totalMessages: 0,
      emotional_status: p.emotional_status ?? undefined, emotional_insight: p.emotional_insight ?? "",
      latest_victory: p.latest_victory ?? "", victory_detected_at: p.victory_detected_at ?? null,
      sharing_status: "shared", cabinet_id: cabinetId, created_at: p.created_at,
    }));
    setCabinetSharedPatients(shared);
  };

  // ═══ LOAD TEST PATIENTS ═══
  const loadTestPatients = useCallback(async (pid: string) => {
    const { data: practData } = await supabase
      .from("practitioners")
      .select("test_patient_user_id")
      .eq("user_id", pid)
      .single();
    const activeTestUserId = (practData as { test_patient_user_id?: string | null } | null)?.test_patient_user_id;

    // Récupérer les IDs patients via patient_practitioner (même pattern que loadPatients)
    const { data: relations } = await supabase
      .from("patient_practitioner")
      .select("patient_id")
      .eq("practitioner_id", pid);

    if (!relations || relations.length === 0) { setPatients([]); setSelectedPatientId(null); setTestPatientsLoading(false); return; }
    const patientIds = relations.map(r => r.patient_id as string);

    const baseSelect = "user_id, first_name, last_name, email, age, sexe, taille, poids, objective, pathologies, allergies, traitements, objectif_clinique, niveau_activite, regime_specifique, practitioner_instruction, emotional_status, emotional_insight, red_behavioral_until, last_patient_message_at, latest_victory, victory_detected_at, victory_message_id, private_notes, admin_alerts, created_at, onboarding_completed, onboarding_status, sharing_status, cabinet_id, is_test, motivation, defi, notes, aliments_detestes";
    let { data: testPatients, error: testError } = await supabase
      .from("patients")
      .select(baseSelect)
      .in("user_id", patientIds)
      .eq("is_test", true);

    if (testError) {
      // Fallback si la colonne is_test n'existe pas encore (migration non appliquée)
      const { data: fallback } = await supabase.from("patients").select(baseSelect).in("user_id", patientIds);
      testPatients = (fallback ?? []).filter(p => (p as { is_test?: boolean }).is_test === true);
    }

    if (!testPatients || testPatients.length === 0) {
      setPatients([]);
      setSelectedPatientId(null);
      setTestPatientsLoading(false);
      return;
    }

    // Charger le dernier message pour chaque patient test
    const testPatientIds = testPatients.map(p => p.user_id as string);
    const { data: lastConvs } = await supabase
      .from("conversations")
      .select("patient_id, role, content, created_at")
      .in("patient_id", testPatientIds)
      .eq("practitioner_id", pid)
      .order("created_at", { ascending: false });
    const lastConvByTestPatient = new Map<string, { role: string; content: string; created_at: string }>();
    for (const conv of (lastConvs ?? [])) {
      const patId = conv.patient_id as string;
      if (!lastConvByTestPatient.has(patId) && (conv.role as string) === "user") lastConvByTestPatient.set(patId, conv as { role: string; content: string; created_at: string });
    }

    const mapped: RealPatient[] = testPatients.map(p => ({
      id: p.user_id as string,
      firstName: (p.first_name as string) ?? "Patient",
      lastName: (p.last_name as string) ?? "Test",
      initials: `${((p.first_name as string) ?? "P")[0]}${((p.last_name as string) ?? "T")[0]}`.toUpperCase(),
      avatarColor: emerald,
      email: (p.email as string) ?? "",
      age: (p.age as number) ?? undefined,
      sexe: (p.sexe as string) ?? undefined,
      taille: (p.taille as number) ?? undefined,
      poids: (p.poids as number) ?? undefined,
      objective: (p.objective as string) ?? "",
      pathologies: (p.pathologies as string) ?? "",
      allergies: (p.allergies as string) ?? "",
      traitements: (p.traitements as string) ?? "",
      objectif_clinique: (p.objectif_clinique as string) ?? "",
      niveau_activite: (p.niveau_activite as string) ?? "",
      regime_specifique: (p.regime_specifique as string) ?? "",
      practitioner_instruction: (p.practitioner_instruction as RealPatient["practitioner_instruction"]) ?? [],
      private_notes: (p.private_notes as RealPatient["private_notes"]) ?? [],
      admin_alerts: (p.admin_alerts as RealPatient["admin_alerts"]) ?? [],
      emotional_status: (p.emotional_status as string) ?? undefined,
      emotional_insight: (p.emotional_insight as string) ?? "",
      red_behavioral_until: (p.red_behavioral_until as string) ?? null,
      last_patient_message_at: (p.last_patient_message_at as string) ?? null,
      latest_victory: (p.latest_victory as string) ?? "",
      victory_detected_at: (p.victory_detected_at as string) ?? null,
      lastMessage: lastConvByTestPatient.get(p.user_id as string)?.content ?? "",
      lastMessageTime: lastConvByTestPatient.get(p.user_id as string)?.created_at
        ? new Date(lastConvByTestPatient.get(p.user_id as string)!.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
        : "",
      lastMessageRole: lastConvByTestPatient.get(p.user_id as string)?.role ?? "",
      totalMessages: 0,
      streak: 0,
      sosResolved: 0,
      onboardingCompleted: true,
      onboardingStatus: "completed",
      is_test: true,
      motivation: (p.motivation as string) ?? "",
      defi: (p.defi as string) ?? "",
      notes: (p.notes as string) ?? "",
      aliments_detestes: (p.aliments_detestes as string) ?? "",
      created_at: (p.created_at as string) ?? new Date().toISOString(),
    }));

    setPatients(mapped);
    // Sélectionner le patient actif ou le premier de la liste
    const activeId = activeTestUserId ?? mapped[0]?.id ?? null;
    setSelectedPatientId(activeId);
    if (activeId) setTestIframeKey(`test-chat-${activeId}`);
    setTestPatientsLoading(false);
  }, [supabase]);

  // Swap patients quand testMode change
  useEffect(() => {
    if (!practitionerId) return;
    if (testMode) {
      realPatientsRef.current = patients;
      realSelectedIdRef.current = selectedPatientId;
      // Effacer immédiatement les vrais patients + sortir du mode démo
      setPatients([]);
      setSelectedPatientId(null);
      setOnboardingDemoMode(false);
      setTestPatientsLoading(true);
      void loadTestPatients(practitionerId);
    } else {
      // Restaurer les vrais patients
      setTestPatientsLoading(false);
      setPatients(realPatientsRef.current);
      setSelectedPatientId(realSelectedIdRef.current ?? (realPatientsRef.current[0]?.id ?? null));
      // Remettre le mode démo si aucun vrai patient n'existait avant
      if (realPatientsRef.current.length === 0) setOnboardingDemoMode(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testMode]);

  useEffect(() => {
    // Écouter l'expiration de session en cours d'utilisation
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        window.location.href = "/login?reason=session_expired";
      }
    });

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        window.location.href = "/login?reason=session_expired";
        return;
      }
      const pid = data.user.id;
      setPractitionerId(pid);
      // Requête principale — colonnes garanties existantes
      const { data: practitioner, error: practError } = await supabase.from("practitioners").select("first_name, last_name, email, specialty, discrete_pin, cabinet_id, avatar_url").eq("user_id", pid).single();
      console.log("[Dashboard] practitioners query →", { practitioner, practError, authEmail: data.user.email });
      if (practitioner) {
        const p = practitioner as { first_name: string; last_name: string; email?: string; specialty?: string; discrete_pin?: string; cabinet_id?: string | null; avatar_url?: string | null };
        setPractitionerName(`${p.first_name} ${p.last_name}`);
        setPractitionerEmail(p.email ?? data.user.email ?? "");
        setPractitionerSpecialty(p.specialty ?? "");
        setSavedPin(p.discrete_pin ?? "");
        if (p.cabinet_id) setPractitionerCabinetId(p.cabinet_id);
        if (p.avatar_url) {
          setPractitionerPhoto(p.avatar_url);
          localStorage.setItem("nutri_practitioner_avatar", p.avatar_url);
        } else {
          localStorage.removeItem("nutri_practitioner_avatar");
        }
      } else {
        // Fallback email auth si la query practitioners échoue
        if (data.user.email) setPractitionerEmail(data.user.email);
      }
      // Colonnes billing — requête séparée (plan/subscription_status ajoutés par Stripe webhook)
      const { data: billingData, error: billingError } = await supabase.from("practitioners").select("plan, subscription_status, extra_patients").eq("user_id", pid).single();
      console.log("[Dashboard] billing query →", { billingData, billingError });
      if (!billingError && billingData) {
        const b = billingData as { plan?: string | null; subscription_status?: string | null; extra_patients?: number | null };
        setPractitionerPlan(b.plan ?? null);
        setSubscriptionStatus(b.subscription_status ?? null);
        setExtraPatients(b.extra_patients ?? 0);
      }
      // Colonnes notify_* — requête séparée car nécessitent la migration SQL
      const { data: notifyData, error: notifyError } = await supabase.from("practitioners").select("notify_behavioral, notify_critical").eq("user_id", pid).single();
      console.log("[Dashboard] notify query →", { notifyData, notifyError });
      if (!notifyError && notifyData) {
        const n = notifyData as { notify_behavioral?: boolean; notify_critical?: boolean };
        if (n.notify_behavioral !== undefined) setNotifyBehavioral(n.notify_behavioral ?? true);
        if (n.notify_critical !== undefined) setNotifyCritical(n.notify_critical ?? true);
      }
      // Tour check séparé pour ne pas bloquer le chargement si la colonne n'existe pas encore
      const { data: tourData, error: tourError } = await supabase.from("practitioners").select("dashboard_tour_done").eq("user_id", pid).single();
      if (!tourError && tourData) {
        const tourDone = (tourData as { dashboard_tour_done?: boolean }).dashboard_tour_done;
        if (!tourDone) setTimeout(() => { setShowOnboarding(true); setOnboardingDemoMode(true); }, 800);
      } else if (tourError) {
        // Colonne absente (migration non encore lancée) → afficher le tour quand même
        setTimeout(() => { setShowOnboarding(true); setOnboardingDemoMode(true); }, 800);
      }
      const { count } = await supabase.from("documents").select("*", { count: "exact", head: true }).eq("practitioner_id", pid);
      setHasDocuments((count ?? 0) > 0);
      if ((count ?? 0) > 0) { const hidden = localStorage.getItem("fidelity_hidden"); if (hidden === "true") setShowFidelity(false); }
      const isDemo = await loadPatients(pid);
      if (!isDemo) {
        await Promise.all([loadMonthlyStats(pid), loadDocuments(pid)]);
        // Charger les dossiers partagés du cabinet si le praticien appartient à un
        const { data: pracData } = await supabase.from("practitioners").select("cabinet_id").eq("user_id", pid).single();
        const cid = (pracData as { cabinet_id?: string | null } | null)?.cabinet_id;
        if (cid) {
          const { data: rels } = await supabase.from("patient_practitioner").select("patient_id").eq("practitioner_id", pid);
          const ownIds = (rels ?? []).map(r => r.patient_id as string);
          await loadSharedCabinetPatients(cid, ownIds);
        }
      }
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  // Sync patientsRef / testModeRef pour éviter les stale closures dans les intervals
  useEffect(() => { patientsRef.current = patients; }, [patients]);
  useEffect(() => { testModeRef.current = testMode; }, [testMode]);

  // Charger les données billing dès que l'onglet Abonnement est ouvert
  useEffect(() => {
    if (settingsScreen === "abonnement" && billingTab === "facturation" && invoices.length === 0 && !billingLoading) {
      void loadBillingData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsScreen]);

  // ═══ EMAIL COMPORTEMENTAL 12H ═══
  // Sur chaque changement de la liste patients (polling 10s), on vérifie si un patient
  // est en red_behavioral depuis > 12h — si oui on envoie une alerte email unique.
  useEffect(() => {
    if (!notifyBehavioral || !practitionerId) return;
    const behavioralPatients = patients.filter(p => p.emotional_status === "red_behavioral");
    if (behavioralPatients.length === 0) return;
    for (const patient of behavioralPatients) {
      const alerts = (patient.admin_alerts ?? []) as { alert_type?: string; date: string; email_sent?: boolean }[];
      const latest = alerts
        .filter(a => a.alert_type === "behavioral" || a.alert_type === "behavioral_sos_intake")
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      if (!latest || latest.email_sent) continue;
      const ageMs = Date.now() - new Date(latest.date).getTime();
      if (ageMs < 12 * 60 * 60 * 1000) continue;
      // Envoi silencieux — pas de re-déclenchement même si l'useEffect tourne à nouveau
      // (le backend marque email_sent: true dans admin_alerts)
      void (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;
          await fetch("/api/send-behavioral-alert", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
            body: JSON.stringify({ patientId: patient.id, practitionerId }),
          });
        } catch { /* silencieux */ }
      })();
    }
  }, [patients, notifyBehavioral, practitionerId]);

  // ═══ CONVERSATIONS — chargement initial + polling incrémental 10s ═══
  useEffect(() => {
    if (!selectedPatientId || !practitionerId || onboardingDemoMode) return;
    let lastTs: string | null = null;

    // Chargement initial complet
    supabase.from("conversations").select("id, role, content, created_at")
      .eq("patient_id", selectedPatientId)
      .eq("practitioner_id", practitionerId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) {
          setConversations(data as Conversation[]);
          lastTs = (data as Conversation[]).at(-1)?.created_at ?? null;
        }
      });

    // Clôtures d'exercice SOS (sos_events.closing_message rempli) — fusionnées
    // par horodatage dans displayedConversations, jamais écrites dans
    // `conversations` (voir lib/sosClosures.ts). Rechargées aussi dans le
    // polling ci-dessous pour que le widget apparaisse sans rechargement manuel
    // quand l'exercice se termine pendant que le praticien a le dashboard ouvert.
    const loadSosClosures = () =>
      fetch(`/api/sos/closures?patientId=${selectedPatientId}&practitionerId=${practitionerId}`)
        .then(res => res.ok ? res.json() as Promise<{ events?: SosClosureEvent[] }> : null)
        .then(data => { if (data) setSosClosures(data.events ?? []); })
        .catch(() => { /* silencieux */ });
    void loadSosClosures();

    // Polling incrémental : seulement les nouveaux messages (quasi 0 octet si rien de nouveau)
    const interval = setInterval(async () => {
      if (!lastTs) return;
      const { data: newMsgs } = await supabase.from("conversations")
        .select("id, role, content, created_at")
        .eq("patient_id", selectedPatientId)
        .eq("practitioner_id", practitionerId)
        .gt("created_at", lastTs)
        .order("created_at", { ascending: true });
      if (newMsgs && newMsgs.length > 0) {
        setConversations(prev => [...prev, ...(newMsgs as Conversation[])]);
        lastTs = (newMsgs as Conversation[]).at(-1)!.created_at;
      }
      // Re-fetch des clôtures SOS à chaque cycle — détecte les exercices qui
      // se terminent pendant la session ouverte du praticien (coût négligeable :
      // la requête est légère et les données ne changent qu'en cas de nouvel exercice)
      void loadSosClosures();
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedPatientId, practitionerId, onboardingDemoMode]);

  // ═══ ALERTES — window.focus + polling 30s ═══
  useEffect(() => {
    if (!practitionerId || onboardingDemoMode) return;
    const handleFocus = () => { if (testModeRef.current) return; void loadPatients(practitionerId); };
    window.addEventListener("focus", handleFocus);
    const alertInterval = setInterval(async () => {
      const ids = patientsRef.current.map(p => p.id);
      if (ids.length === 0) return;
      const startOfCurrentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const [{ data: fresh }, { data: freshSos }] = await Promise.all([
        supabase
          .from("patients")
          .select("user_id, admin_alerts, emotional_status, emotional_insight, latest_victory, victory_detected_at, victory_message_id, last_seen_at, last_patient_message_at")
          .in("user_id", ids),
        supabase
          .from("sos_events")
          .select("patient_id, status, origin")
          .in("patient_id", ids)
          .gte("triggered_at", startOfCurrentMonth)
          .eq("status", "success"),
      ]);
      if (!fresh) return;
      // Crises désamorcées ce mois par patient (recompte depuis la BDD)
      const sosResolvedMap = new Map<string, number>();
      for (const e of (freshSos ?? [])) {
        if ((e.origin as string | null) !== "crise") continue;
        const pid = e.patient_id as string;
        sosResolvedMap.set(pid, (sosResolvedMap.get(pid) ?? 0) + 1);
      }
      setPatients(prev => prev.map(p => {
        const f = (fresh as { user_id: string; admin_alerts?: object[]; emotional_status?: string; emotional_insight?: string; latest_victory?: string; victory_detected_at?: string | null; victory_message_id?: string | null; last_seen_at?: string | null; last_patient_message_at?: string | null }[]).find(d => d.user_id === p.id);
        if (!f) return p;
        // Recalculer lastActive : max entre valeur existante + nouvelles colonnes temps-réel
        const candidates = [p.lastActive, f.last_seen_at, f.last_patient_message_at].filter((d): d is string => !!d);
        const newLastActive = candidates.length > 0 ? [...candidates].sort().pop()! : p.lastActive;
        return { ...p,
          admin_alerts: (f.admin_alerts ?? p.admin_alerts) as typeof p.admin_alerts,
          emotional_status: (f.emotional_status ?? p.emotional_status) as typeof p.emotional_status,
          emotional_insight: f.emotional_insight ?? p.emotional_insight,
          latest_victory: f.latest_victory ?? p.latest_victory,
          victory_detected_at: f.victory_detected_at ?? p.victory_detected_at,
          victory_message_id: f.victory_message_id ?? p.victory_message_id,
          lastActive: newLastActive ?? p.lastActive,
          sosResolved: sosResolvedMap.has(p.id) ? sosResolvedMap.get(p.id)! : p.sosResolved,
        };
      }));
    }, 30000);
    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(alertInterval);
    };
  }, [practitionerId, onboardingDemoMode]);

  // Fusionne les clôtures SOS (sos_events) dans le fil par horodatage —
  // jamais persistées dans `conversations` (voir lib/sosClosures.ts).
  const mergedConversations = useMemo(() => {
    if (conversations.length === 0 || sosClosures.length === 0) return conversations;
    const inWindow = findClosuresInWindow(conversations.map(c => c.created_at), sosClosures);
    if (inWindow.length === 0) return conversations;
    const widgetRows: Conversation[] = inWindow.map(e => ({
      id: `sos-${e.triggered_at}`,
      role: "widget",
      content: "",
      created_at: e.triggered_at,
      sosSummary: {
        word: e.traced_word || "—",
        feeling: closureFeeling(e.closing_message),
        intake: e.intake_message?.trim() || null,
        intakeMurmure: e.intake_murmure?.trim() || null,
        crisisLevel: e.crisis_level_detected,
        crisisMessageId: e.crisis_trigger_message_id,
      },
    }));
    return [...conversations, ...widgetRows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [conversations, sosClosures]);

  const displayedConversations = onboardingDemoMode ? (DEMO_CONVERSATIONS_BY_PATIENT[selectedPatientId ?? "demo-1"] ?? DEMO_CONVERSATIONS) : mergedConversations;
  const displayedPatients = onboardingDemoMode ? demoPatients as unknown as RealPatient[] : patients;

  useEffect(() => {
    if (conversationContainerRef.current && displayedConversations.length > 0) {
      conversationContainerRef.current.scrollTop = conversationContainerRef.current.scrollHeight;
    }
  }, [displayedConversations, selectedPatientId]);

  // Scroll déterministe cross-tab : scroller pixel-perfect vers l'ID exact du message cible
  useEffect(() => {
    if (pendingScrollMessageId === null || displayedConversations.length === 0) return;
    const targetId = pendingScrollMessageId;
    setPendingScrollMessageId(null);
    setTimeout(() => {
      const el = document.querySelector(`[data-message-id="${targetId}"]`);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); }
      setHighlightedMessageId(targetId);
      setTimeout(() => setHighlightedMessageId(null), 2500);
    }, 80);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedConversations, pendingScrollMessageId]);
  const displayedSelectedPatient = onboardingDemoMode
    ? demoPatients.find(p => p.id === (selectedPatientId ?? "demo-1")) as unknown as RealPatient ?? demoPatients[0] as unknown as RealPatient
    : patients.find((p) => p.id === selectedPatientId);

  const filteredPatients = displayedPatients.filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const redPatients = displayedPatients.filter((p) => p.emotional_status === "red_critical");
  const orangePatients = displayedPatients.filter((p) => p.emotional_status === "orange");
  const isVictoryFresh = (p: { latest_victory?: string; victory_detected_at?: string | null }) =>
    !!(p.latest_victory && p.victory_detected_at
      && (Date.now() - new Date(p.victory_detected_at).getTime()) < 48 * 60 * 60 * 1000);
  const victoryPatients = displayedPatients.filter(isVictoryFresh);

  const openMurmureModal = () => {
    setMurmureText("");
    setMurmureDuration("permanent");
    setShowMurmureModal(true);
  };

  const saveMurmure = async () => {
    if (!selectedPatientId || !murmureText.trim()) return;
    setSavingMurmure(true);
    // Mode démo : ajouter localement
    if (onboardingDemoMode) {
      await new Promise(r => setTimeout(r, 600));
      const newMurmure = { id: crypto.randomUUID(), text: murmureText.trim(), expires_at: null, created_at: new Date().toISOString() };
      setDemoPatients(prev => prev.map(p => p.id === selectedPatientId
        ? { ...p, practitioner_instruction: [...((p.practitioner_instruction as typeof newMurmure[]) ?? []), newMurmure] }
        : p));
      setSavingMurmure(false); setShowMurmureModal(false); setMurmureText("");
      return;
    }
    try {
      const expiresAt = buildMurmureExpiry(murmureDuration);
      const patient = patients.find(p => p.id === selectedPatientId);
      const currentMurmures = (patient?.practitioner_instruction as { id: string; text: string; expires_at?: string | null; created_at: string }[]) ?? [];
      const newMurmure = { id: crypto.randomUUID(), text: murmureText.trim(), expires_at: expiresAt, created_at: new Date().toISOString() };
      const updatedMurmures = [...currentMurmures, newMurmure];
      const res = await fetch("/api/save-murmure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: selectedPatientId, practitionerId, murmures: updatedMurmures }),
      });
      if (!res.ok) throw new Error("save-murmure failed");
      await fetch("/api/invalidate-cache", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId: selectedPatientId }) });
      setPatients(prev => prev.map(p => p.id === selectedPatientId ? { ...p, practitioner_instruction: updatedMurmures } : p));
      setMurmureDuration("permanent");
      setMurmureText("");
      setShowMurmureModal(false);
    } catch {
      alert("Une erreur est survenue lors de la sauvegarde du murmure. Veuillez réessayer.");
    } finally {
      setSavingMurmure(false);
    }
  };

  const addNote = async () => {
    if (!selectedPatientId || !newNoteText.trim()) return;
    setSavingNote(true);
    // Mode démo : ajouter localement
    if (onboardingDemoMode) {
      await new Promise(r => setTimeout(r, 400));
      const newNote = { id: crypto.randomUUID(), text: newNoteText.trim(), created_at: new Date().toISOString() };
      setDemoPatients(prev => prev.map(p => p.id === selectedPatientId
        ? { ...p, private_notes: [...((p.private_notes as typeof newNote[]) ?? []), newNote] }
        : p));
      setNewNoteText(""); setSavingNote(false); setShowNoteModal(false);
      return;
    }
    const patient = patients.find(p => p.id === selectedPatientId);
    const currentNotes = (patient?.private_notes as { id: string; text: string; created_at: string }[]) ?? [];
    const newNote = { id: crypto.randomUUID(), text: newNoteText.trim(), created_at: new Date().toISOString() };
    const updatedNotes = [...currentNotes, newNote];
    await fetch("/api/save-private-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: selectedPatientId, practitionerId, notes: updatedNotes }),
    });
    setPatients(prev => prev.map(p => p.id === selectedPatientId ? { ...p, private_notes: updatedNotes } : p));
    setNewNoteText("");
    setSavingNote(false);
    setShowNoteModal(false);
  };

  const deleteNote = async (noteId: string) => {
    if (!selectedPatientId) return;
    if (onboardingDemoMode) {
      setDemoPatients(prev => prev.map(p => p.id === selectedPatientId
        ? { ...p, private_notes: ((p.private_notes as { id: string; text: string; created_at: string }[]) ?? []).filter(n => n.id !== noteId) }
        : p));
      return;
    }
    const patient = patients.find(p => p.id === selectedPatientId);
    const currentNotes = (patient?.private_notes as { id: string; text: string; created_at: string }[]) ?? [];
    const updatedNotes = currentNotes.filter(n => n.id !== noteId);
    await fetch("/api/save-private-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: selectedPatientId, practitionerId, notes: updatedNotes }),
    });
    setPatients(prev => prev.map(p => p.id === selectedPatientId ? { ...p, private_notes: updatedNotes } : p));
  };

  const updateNote = async (noteId: string, newText: string) => {
    if (!selectedPatientId || !newText.trim()) return;
    if (onboardingDemoMode) {
      setDemoPatients(prev => prev.map(p => p.id === selectedPatientId
        ? { ...p, private_notes: ((p.private_notes as { id: string; text: string; created_at: string }[]) ?? []).map(n => n.id === noteId ? { ...n, text: newText.trim() } : n) }
        : p));
      setEditingNoteId(null); setEditingNoteText("");
      return;
    }
    const patient = patients.find(p => p.id === selectedPatientId);
    const currentNotes = (patient?.private_notes as { id: string; text: string; created_at: string }[]) ?? [];
    const updatedNotes = currentNotes.map(n => n.id === noteId ? { ...n, text: newText.trim() } : n);
    await fetch("/api/save-private-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId: selectedPatientId, practitionerId, notes: updatedNotes }) });
    setPatients(prev => prev.map(p => p.id === selectedPatientId ? { ...p, private_notes: updatedNotes } : p));
    setEditingNoteId(null); setEditingNoteText("");
  };

  const updateMurmure = async (murmureId: string, newText: string) => {
    if (!selectedPatientId || !newText.trim()) return;
    if (onboardingDemoMode) {
      setDemoPatients(prev => prev.map(p => p.id === selectedPatientId
        ? { ...p, practitioner_instruction: ((p.practitioner_instruction as { id: string; text: string; expires_at?: string | null; created_at: string }[]) ?? []).map(m => m.id === murmureId ? { ...m, text: newText.trim() } : m) }
        : p));
      setEditingMurmureId(null); setEditingMurmureText("");
      return;
    }
    const patient = patients.find(p => p.id === selectedPatientId);
    const currentMurmures = (patient?.practitioner_instruction as { id: string; text: string; expires_at?: string | null; created_at: string }[]) ?? [];
    const updatedMurmures = currentMurmures.map(m => m.id === murmureId ? { ...m, text: newText.trim() } : m);
    try {
      const res = await fetch("/api/save-murmure", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId: selectedPatientId, practitionerId, murmures: updatedMurmures }) });
      if (!res.ok) throw new Error();
      await fetch("/api/invalidate-cache", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId: selectedPatientId }) });
      setPatients(prev => prev.map(p => p.id === selectedPatientId ? { ...p, practitioner_instruction: updatedMurmures } : p));
      setEditingMurmureId(null); setEditingMurmureText("");
    } catch { alert("Erreur lors de la mise à jour du murmure."); }
  };

  const removePatient = async (patientId: string) => {
    if (!practitionerId) return;
    setDeletingPatient(true);
    try {
      const res = await fetch("/api/remove-patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, practitionerId }),
      });
      if (res.ok) {
        setPatients(prev => prev.filter(p => p.id !== patientId));
        setSelectedPatientId(null);
        setShowDeletePatientModal(false);
      } else {
        alert("Une erreur est survenue lors de la suppression du patient.");
      }
    } catch {
      alert("Erreur réseau lors de la suppression du patient.");
    }
    setDeletingPatient(false);
  };

  const removeTestPatient = async (testPatientUserId: string) => {
    setDeletingTestPatient(true);
    try {
      const res = await fetch("/api/test-mode/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testPatientUserId }),
      });
      if (res.ok) {
        // Retirer de la liste locale
        setPatients(prev => prev.filter(p => p.id !== testPatientUserId));
        // Si c'était le patient sélectionné, vider la sélection
        if (selectedPatientId === testPatientUserId) setSelectedPatientId(null);
        // Si la liste devient vide, réinitialiser la clé iframe
        setTestIframeKey("test-chat-empty");
        setShowDeleteTestPatientModal(false);
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string };
        alert(data.error ?? "Une erreur est survenue lors de la suppression du patient test.");
      }
    } catch {
      alert("Erreur réseau lors de la suppression du patient test.");
    }
    setDeletingTestPatient(false);
  };

  const deleteMurmure = async (murmureId: string) => {
    if (!selectedPatientId) return;
    if (onboardingDemoMode) {
      setDemoPatients(prev => prev.map(p => p.id === selectedPatientId
        ? { ...p, practitioner_instruction: ((p.practitioner_instruction as { id: string; text: string; expires_at?: string | null; created_at: string }[]) ?? []).filter(m => m.id !== murmureId) }
        : p));
      return;
    }
    try {
      const patient = patients.find(p => p.id === selectedPatientId);
      const currentMurmures = (patient?.practitioner_instruction as { id: string; text: string; expires_at?: string | null; created_at: string }[]) ?? [];
      const updatedMurmures = currentMurmures.filter(m => m.id !== murmureId);
      const res = await fetch("/api/save-murmure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: selectedPatientId, practitionerId, murmures: updatedMurmures }),
      });
      if (!res.ok) throw new Error("delete-murmure failed");
      await fetch("/api/invalidate-cache", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId: selectedPatientId }) });
      setPatients(prev => prev.map(p => p.id === selectedPatientId ? { ...p, practitioner_instruction: updatedMurmures } : p));
    } catch {
      alert("Une erreur est survenue lors de la suppression du murmure. Veuillez réessayer.");
    }
  };

  const dismissAlertFromHeader = async (patientId: string) => {
    setAlertBannerDismissed(prev => ({ ...prev, [patientId]: true }));
    if (!onboardingDemoMode) {
      // Archiver les alertes actives avant de les effacer (traçabilité comportementale)
      const patient = patients.find(p => p.id === patientId);
      const activeAlerts = patient?.admin_alerts ?? [];
      if (activeAlerts.length > 0) {
        const { data: cur } = await supabase.from("patients").select("archived_alerts").eq("user_id", patientId).single();
        const existingArchived = (cur as { archived_alerts?: object[] } | null)?.archived_alerts ?? [];
        const newArchived = activeAlerts.map(a => ({ ...a, archived: true, archived_at: new Date().toISOString(), resolution: "practitioner_dismissed" }));
        await supabase.from("patients").update({
          emotional_status: "green", admin_alerts: [], red_behavioral_until: null, emotional_insight: null,
          archived_alerts: [...existingArchived, ...newArchived],
        }).eq("user_id", patientId);
      } else {
        await supabase.from("patients").update({ emotional_status: "green", admin_alerts: [], red_behavioral_until: null, emotional_insight: null }).eq("user_id", patientId);
      }
      await fetch("/api/invalidate-cache", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId }) });
    }
    setPatients(prev => prev.map(p => p.id === patientId ? { ...p, emotional_status: "green", admin_alerts: [], emotional_insight: undefined } : p));
    setDemoPatients(prev => prev.map(p => p.id === patientId ? { ...p, emotional_status: "green", admin_alerts: [] } as typeof p : p));
    setShowInterventionBubble(false);
  };

  const dismissVictory = async (patientId: string) => {
    setPatients(prev => prev.map(p => p.id === patientId ? { ...p, latest_victory: undefined, victory_detected_at: undefined } : p));
    setDemoPatients(prev => prev.map(p => p.id === patientId ? { ...p, latest_victory: "", victory_detected_at: null } : p));
    if (!onboardingDemoMode) {
      await supabase.from("patients").update({ latest_victory: null, victory_detected_at: null }).eq("user_id", patientId);
    }
  };

  const scrollToVictoryMessage = (date?: string) => {
    const conversations = displayedConversations;
    if (!conversations.length) return;
    const targetDate = date ? new Date(date).getTime() : Date.now();
    let closestMsg = conversations[conversations.length - 1];
    let closestDiff = Infinity;
    for (const msg of conversations) {
      if (msg.role === "user") {
        const diff = Math.abs(new Date(msg.created_at).getTime() - targetDate);
        if (diff < closestDiff) { closestDiff = diff; closestMsg = msg; }
      }
    }
    if (closestMsg) {
      setTimeout(() => {
        const el = document.querySelector(`[data-message-id="${closestMsg.id}"]`);
        if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); }
        setHighlightedMessageId(closestMsg.id);
        setTimeout(() => setHighlightedMessageId(null), 2000);
      }, 50);
    }
  };

  const scrollToAlertMessage = (alert: { date?: string; trigger_message_id?: string }) => {
    if (alert.trigger_message_id) { setPendingScrollMessageId(alert.trigger_message_id); return; }
    const conversations = displayedConversations;
    if (!conversations.length) return;
    const alertDate = alert.date ? new Date(alert.date).getTime() : Date.now();
    let closestMsg = conversations[conversations.length - 1];
    let closestDiff = Infinity;
    for (const msg of conversations) {
      if (msg.role === "user") {
        const diff = Math.abs(new Date(msg.created_at).getTime() - alertDate);
        if (diff < closestDiff) { closestDiff = diff; closestMsg = msg; }
      }
    }
    if (closestMsg) {
      setTimeout(() => {
        const el = document.querySelector(`[data-message-id="${closestMsg.id}"]`);
        if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); }
        setHighlightedMessageId(closestMsg.id);
        setTimeout(() => setHighlightedMessageId(null), 2000);
      }, 50);
    }
    setShowInterventionBubble(true);
  };

  const generateBravo = async (patientId: string, victoryText: string) => {
    setBravoState(prev => ({ ...prev, [patientId]: { expanded: false, text: "", editing: false, loading: true, sending: false, sent: false } }));
    if (onboardingDemoMode) {
      await new Promise(r => setTimeout(r, 900));
      setBravoState(prev => ({ ...prev, [patientId]: { expanded: true, text: "Bravo pour cette belle victoire ! C'est exactement ce genre de progrès qui fait toute la différence. Continuez sur cette lancée 🌿", editing: false, loading: false, sending: false, sent: false } }));
      return;
    }
    try {
      const res = await fetch("/api/generate-bravo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, practitionerId, victoryText }),
      });
      const data = await res.json() as { message?: string };
      setBravoState(prev => ({ ...prev, [patientId]: { expanded: true, text: data.message ?? "", editing: false, loading: false, sending: false, sent: false } }));
    } catch {
      setBravoState(prev => ({ ...prev, [patientId]: { ...prev[patientId], loading: false, sending: false } }));
    }
  };

  const sendBravoMessage = async (patientId: string, text: string) => {
    if (onboardingDemoMode) {
      setBravoState(prev => ({ ...prev, [patientId]: { expanded: false, text: "", editing: false, loading: false, sending: false, sent: true } }));
      setDemoPatients(prev => prev.map(p => p.id === patientId ? { ...p, latest_victory: "" } : p));
      setTimeout(() => setBravoState(prev => ({ ...prev, [patientId]: { ...prev[patientId], sent: false } })), 3000);
      return;
    }
    setBravoState(prev => ({ ...prev, [patientId]: { ...prev[patientId], sending: true } }));
    try {
      await fetch("/api/send-bravo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId, practitionerId, messageText: text }) });
      setBravoState(prev => ({ ...prev, [patientId]: { expanded: false, text: "", editing: false, loading: false, sending: false, sent: true } }));
      setPatients(prev => prev.map(p => p.id === patientId ? { ...p, latest_victory: undefined } : p));
      setTimeout(() => setBravoState(prev => ({ ...prev, [patientId]: { ...prev[patientId], sent: false } })), 3000);
    } catch {
      setBravoState(prev => ({ ...prev, [patientId]: { ...prev[patientId], sending: false } }));
    }
  };

  const supabaseDashboard = useMemo(() => createSupabaseBrowserClient(), []);

  const markOutOfScopeSeen = async (patientId: string, alertDate: string) => {
    const { data: cur } = await supabaseDashboard.from("patients").select("admin_alerts").eq("user_id", patientId).single();
    const existing = (cur as { admin_alerts?: object[] } | null)?.admin_alerts ?? [];
    const updated = existing.map((a: object) => {
      const al = a as { type?: string; date?: string; seen?: boolean };
      return al.type === "out_of_scope" && al.date === alertDate ? { ...a, seen: true } : a;
    });
    await supabaseDashboard.from("patients").update({ admin_alerts: updated }).eq("user_id", patientId);
    setPatients(prev => prev.map(p => p.id === patientId
      ? { ...p, admin_alerts: p.admin_alerts?.map(a => a.type === "out_of_scope" && a.date === alertDate ? { ...a, seen: true } : a) }
      : p));
  };

  const sendOutOfScopeReply = async (patientId: string, alertDate: string, text: string) => {
    const key = `${patientId}-${alertDate}`;
    setOutOfScopeReply(prev => ({ ...prev, [key]: { ...prev[key], sending: true } }));
    try {
      await fetch("/api/send-bravo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId, practitionerId, messageText: text }) });
      setOutOfScopeReply(prev => ({ ...prev, [key]: { expanded: false, text: "", sending: false } }));
      // Also mark as seen after reply
      await markOutOfScopeSeen(patientId, alertDate);
    } catch {
      setOutOfScopeReply(prev => ({ ...prev, [key]: { ...prev[key], sending: false } }));
    }
  };

  const sendVictory = async (patientId: string, victoryText: string) => {
    setSendingVictory(patientId);
    if (onboardingDemoMode) {
      await new Promise(r => setTimeout(r, 800));
      setDemoPatients(prev => prev.map(p => p.id === patientId ? { ...p, latest_victory: "" } : p));
      setVictorySent(patientId);
      setTimeout(() => setVictorySent(null), 3000);
      setSendingVictory(null);
      return;
    }
    if (!practitionerId) { setSendingVictory(null); return; }
    try {
      await fetch("/api/send-victory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId, practitionerId, victoryText }) });
      setPatients((prev) => prev.map((p) => p.id === patientId ? { ...p, latest_victory: "" } : p));
      setVictorySent(patientId);
      setTimeout(() => setVictorySent(null), 3000);
    } catch { /* silencieux */ }
    setSendingVictory(null);
  };

  const exportPDF = async () => {
    if (!displayedSelectedPatient || !reportContent) return;
    const res = await fetch("/api/generate-pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId: displayedSelectedPatient.id, practitionerId, reportContent, patientName: `${displayedSelectedPatient.firstName} ${displayedSelectedPatient.lastName}`, practitionerName }) });
    const html = await res.text();
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.addEventListener("load", () => {
      printWindow.focus();
      printWindow.print();
    });
  };

  const openJumeauModal = async () => {
    setShowJumeauModal(true); setUploadedFiles([]); setUploadSuccess([]); setUploadErrors([]); setDocumentType(null); setEditingNote(null); setJumeauText("");
    setAudioBlob(null); setEditingAudioDoc(null); setContinueFromSecs(0); setAudioUploading(false); setUploadProgress(null);
    setVisionSaved(false); setSignatureSaved(false);
    if (practitionerId) {
      void loadDocuments(practitionerId);
      // Charger vision et signature depuis practitioner_profiles
      const { data } = await supabase.from("practitioner_profiles").select("vision, signature").eq("user_id", practitionerId).single();
      if (data) {
        setVisionText(data.vision ?? "");
        setSignatureText(data.signature ?? "");
      }
    }
  };

  const saveVisionOrSignature = async (field: "vision" | "signature", value: string) => {
    if (!practitionerId) return;
    const setSaving = field === "vision" ? setSavingVision : setSavingSignature;
    const setSaved = field === "vision" ? setVisionSaved : setSignatureSaved;
    setSaving(true);
    try {
      await fetch("/api/save-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: { [field]: value }, userId: practitionerId }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* silencieux */ }
    setSaving(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const valid = files.filter((f) => { const ext = f.name.split(".").pop()?.toLowerCase(); return ["pdf","docx","txt","jpg","jpeg","png","xlsx","csv","mp3","wav","m4a"].includes(ext ?? ""); });
    setUploadedFiles((prev) => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => { const blob = new Blob(chunks, { type: "audio/mp3" }); setAudioBlob(blob); stream.getTracks().forEach((t) => t.stop()); };
      mediaRecorderRef.current = mediaRecorder; mediaRecorder.start(); setIsRecording(true); setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
    } catch { alert("Impossible d'accéder au microphone."); }
  };

  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current); };

  const uploadAudioDirect = async (blob: Blob, existingDoc?: Document | null) => {
    let pid = practitionerId;
    if (!pid) { const { data: { user } } = await supabase.auth.getUser(); pid = user?.id ?? null; }
    if (!pid) return;
    setAudioUploading(true); setUploadErrors([]);
    if (onboardingDemoMode) {
      await new Promise(r => setTimeout(r, 1800));
      const fakeName = existingDoc ? existingDoc.file_name : `memo_vocal_demo_${Date.now()}.mp3`;
      const fakeAudio: Document = { id: `demo-audio-${Date.now()}`, file_name: fakeName, file_type: "mp3", created_at: new Date().toISOString() };
      setHasDocuments(true);
      setAudioBlob(null); setEditingAudioDoc(null); setContinueFromSecs(0);
      // Injecter le faux doc dans la liste locale sans appel API
      if (existingDoc) {
        setDocuments(prev => prev.map(d => d.id === existingDoc.id ? fakeAudio : d));
      } else {
        setDocuments(prev => [fakeAudio, ...prev]);
      }
      setAudioUploading(false);
      return;
    }
    try {
      // Supprimer l'ancien document si on est en mode remplacement
      if (existingDoc) {
        await supabase.from("documents").delete().eq("practitioner_id", pid).eq("file_name", existingDoc.file_name);
      }
      const fileName = existingDoc ? existingDoc.file_name : `memo_vocal_${Date.now()}.mp3`;
      const file = new File([blob], fileName, { type: "audio/mp3" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("practitionerId", pid);
      formData.append("documentType", "protocole");
      const res = await fetch("/api/upload-document", { method: "POST", body: formData });
      const data = await res.json() as { success?: boolean; error?: string };
      if (res.ok && data.success) {
        setAudioBlob(null); setEditingAudioDoc(null); setContinueFromSecs(0);
        setHasDocuments(true);
        await loadDocuments(pid);
      } else {
        setUploadErrors([data.error ?? "Erreur lors de l'indexation du mémo"]);
      }
    } catch { setUploadErrors(["Erreur réseau lors de l'upload audio"]); }
    setAudioUploading(false);
  };

  const uploadFiles = async () => {
    if (uploadedFiles.length === 0 || !documentType) return;
    let pid = practitionerId;
    if (!pid) { const { data: { user } } = await supabase.auth.getUser(); pid = user?.id ?? null; }
    if (!pid) return;
    setUploading(true); setUploadErrors([]); setUploadSuccess([]); setUploadProgress({ current: 0, total: uploadedFiles.length });
    for (let idx = 0; idx < uploadedFiles.length; idx++) {
      const file = uploadedFiles[idx];
      setUploadProgress({ current: idx + 1, total: uploadedFiles.length });
      const formData = new FormData(); formData.append("file", file); formData.append("practitionerId", pid); formData.append("documentType", documentType);
      try {
        const res = await fetch("/api/upload-document", { method: "POST", body: formData });
        const data = await res.json() as { success?: boolean; error?: string };
        if (res.ok && data.success) setUploadSuccess((prev) => [...prev, file.name]);
        else setUploadErrors((prev) => [...prev, `${file.name} : ${data.error ?? "Erreur"}`]);
      } catch { setUploadErrors((prev) => [...prev, `${file.name} : Erreur réseau`]); }
    }
    setUploading(false); setUploadProgress(null);
    if (uploadErrors.length === 0) { setUploadedFiles([]); setDocumentType(null); }
    else { setUploadedFiles(prev => prev.filter(f => !uploadSuccess.includes(f.name))); }
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

  const openProfileModal = (focusFirst = false) => {
    const patient = onboardingDemoMode
      ? demoPatients.find(p => p.id === (selectedPatientId ?? "demo-1")) as unknown as RealPatient
      : patients.find((p) => p.id === selectedPatientId);
    if (!patient) return;
    setEditFirstName(patient.firstName ?? "");
    setEditLastName(patient.lastName ?? "");
    setEditAge(patient.age ? String(patient.age) : "");
    setEditTaille(patient.taille ? String(patient.taille) : "");
    setEditPoids(patient.poids ? String(patient.poids) : "");
    setEditSexe(patient.sexe ?? "");
    setEditObjective(patient.objective ?? "");
    setEditPathologies(patient.pathologies ?? "");
    setEditAllergies(patient.allergies ?? "");
    setEditTraitements(patient.traitements ?? "");
    setEditObjectifClinique(patient.objectif_clinique ?? "");
    setEditNiveauActivite(patient.niveau_activite ?? "");
    setEditRegime(patient.regime_specifique ?? "");
    setEditNotes("");
    // Champs profil patient (étape 3) — uniquement pour les patients test
    const notesStr = patient.notes ?? "";
    const sommeilMatch = notesStr.match(/Sommeil:\s*([^;]+)/);
    const digestifMatch = notesStr.match(/Digestif:\s*([^;]+)/);
    setEditSommeil(sommeilMatch?.[1]?.trim() ?? "");
    setEditDigestif(digestifMatch?.[1]?.trim() ?? "");
    setEditHumeur(patient.motivation ?? "");
    setEditDefiPrincipal(patient.defi ?? "");
    setProfileSaved(false);
    setFocusFirstNameOnOpen(focusFirst);
    // Extraire les corrections en attente pour les afficher dans la modale
    const corrections = ((patient.admin_alerts ?? []) as { type?: string; alert_type?: string; seen?: boolean; field?: string; correction?: string }[])
      .filter(a => !a.seen && a.type === "admin_alert" && a.alert_type === "rectification_request" && a.field)
      .map(a => ({ field: a.field!, correction: a.correction ?? "" }));
    setPendingCorrections(corrections);
    setShowProfileModal(true);
    if (focusFirst) setTimeout(() => firstNameInputRef.current?.focus(), 120);
  };

  const saveProfile = async () => {
    if (!selectedPatientId) return;
    setSavingProfile(true);
    // Mode démo : mise à jour locale uniquement
    if (onboardingDemoMode) {
      await new Promise(r => setTimeout(r, 600));
      setDemoPatients(prev => prev.map(p => p.id === selectedPatientId ? {
        ...p,
        firstName: editFirstName || p.firstName, lastName: editLastName || p.lastName,
        age: editAge ? parseInt(editAge) : p.age, taille: editTaille ? parseInt(editTaille) : p.taille,
        poids: editPoids ? parseFloat(editPoids) : p.poids, sexe: editSexe || p.sexe,
        objective: editObjective || p.objective, pathologies: editPathologies || p.pathologies,
        allergies: editAllergies || p.allergies, traitements: editTraitements || p.traitements,
        objectif_clinique: editObjectifClinique || p.objectif_clinique,
        niveau_activite: editNiveauActivite || p.niveau_activite, regime_specifique: editRegime || p.regime_specifique,
      } : p));
      setSavingProfile(false);
      setShowProfileModal(false);
      return;
    }
    if (!practitionerId) { setSavingProfile(false); return; }
    try {
      // Construire les champs de base
      const isTestPatient = patients.find(p => p.id === selectedPatientId)?.is_test === true;
      // Pour les patients test : reconstruire notes depuis sommeil + digestif
      // Sanitize "__autre__" sentinel (user selected Autre but didn't type yet)
      const cleanDigestif = editDigestif === "__autre__" ? "" : editDigestif;
      const cleanHumeur = editHumeur === "__autre__" ? "" : editHumeur;
      const cleanDefi = editDefiPrincipal === "__autre__" ? "" : editDefiPrincipal;
      const notesParts: string[] = [];
      if (cleanDigestif) notesParts.push(`Digestif: ${cleanDigestif}`);
      if (editSommeil) notesParts.push(`Sommeil: ${editSommeil}`);
      const notesForSave = isTestPatient
        ? (notesParts.length > 0 ? notesParts.join("; ") : null)
        : (editNotes || null);

      const res = await fetch("/api/save-patient-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatientId,
          practitionerId,
          fields: {
            first_name: editFirstName || null,
            last_name: editLastName || null,
            age: editAge ? parseInt(editAge) : null,
            taille: editTaille ? parseInt(editTaille) : null,
            poids: editPoids ? parseFloat(editPoids) : null,
            sexe: editSexe || null,
            objective: editObjective || null,
            pathologies: editPathologies || null,
            allergies: editAllergies || null,
            traitements: editTraitements || null,
            objectif_clinique: editObjectifClinique || null,
            niveau_activite: editNiveauActivite || null,
            regime_specifique: editRegime || null,
            notes: notesForSave,
            ...(isTestPatient && {
              motivation: cleanHumeur || null,
              defi: cleanDefi || null,
            }),
          },
          clearIdentityAlert: true,
        }),
      });
      if (!res.ok) throw new Error("save-patient-profile failed");
      setPatients((prev) => prev.map((p) => {
        if (p.id !== selectedPatientId) return p;
        return {
          ...p,
          firstName: editFirstName || p.firstName,
          lastName: editLastName || p.lastName,
          age: editAge ? parseInt(editAge) : p.age,
          taille: editTaille ? parseInt(editTaille) : p.taille,
          poids: editPoids ? parseFloat(editPoids) : p.poids,
          sexe: editSexe || p.sexe,
          objective: editObjective || p.objective,
          pathologies: editPathologies || p.pathologies,
          allergies: editAllergies || p.allergies,
          traitements: editTraitements || p.traitements,
          objectif_clinique: editObjectifClinique || p.objectif_clinique,
          niveau_activite: editNiveauActivite || p.niveau_activite,
          regime_specifique: editRegime || p.regime_specifique,
          admin_alerts: (p.admin_alerts ?? []).filter((a: { alert_type?: string }) => a.alert_type !== "identity_correction" && a.alert_type !== "rectification_request"),
        };
      }));
      setShowProfileModal(false);
    } catch {
      alert("Une erreur est survenue lors de la sauvegarde. Veuillez réessayer.");
    } finally {
      setSavingProfile(false);
    }
  };

  const saveSettings = async () => {
    if (!practitionerId) return;
    setSavingSettings(true);
    await supabase.from("practitioners").update({ discrete_pin: newPin || null }).eq("user_id", practitionerId);
    if (newPin) setSavedPin(newPin); setNewPin("");
    setSavingSettings(false); setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  // ─── Chargement données billing ──────────────────────────────────────────────
  const loadBillingData = async () => {
    if (billingLoading) return;
    setBillingLoading(true);
    try {
      const res = await fetch("/api/billing/invoices");
      if (res.ok) {
        const data = await res.json() as {
          invoices: typeof invoices;
          subscription: typeof billingSubscription;
          cardLast4: string | null;
          cardBrand: string | null;
        };
        setInvoices(data.invoices ?? []);
        setBillingSubscription(data.subscription ?? null);
        setCardLast4(data.cardLast4);
        setCardBrand(data.cardBrand);
      }
    } finally {
      setBillingLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    try {
      const res = await fetch("/api/billing/cancel-subscription", { method: "POST" });
      if (res.ok) {
        const data = await res.json() as { current_period_end: number };
        setCancelSuccess(true);
        // modal reste ouverte pour afficher l'état de succès
        setBillingSubscription(prev => prev ? { ...prev, cancel_at_period_end: true, cancel_at: data.current_period_end } : prev);
      }
    } finally {
      setCancelLoading(false);
    }
  };

  const handleResumeSubscription = async () => {
    const res = await fetch("/api/billing/resume-subscription", { method: "POST" });
    if (res.ok) {
      setBillingSubscription(prev => prev ? { ...prev, cancel_at_period_end: false, cancel_at: null } : prev);
      setCancelSuccess(false);
    }
  };

  const handleDeleteAccountRequest = async () => {
    setDeleteRequestLoading(true);
    try {
      const res = await fetch("/api/billing/delete-account-request", { method: "POST" });
      if (res.ok) {
        setDeleteRequestSent(true);
      }
    } finally {
      setDeleteRequestLoading(false);
    }
  };

  // ─── Changement de plan abonnement ───────────────────────────────────────────
  const handlePlanSwitch = async (newPlan: string) => {
    setPlanUpdateError("");

    // Guard mode démo — simulation locale sans appel API
    if (onboardingDemoMode) {
      setPractitionerPlan(newPlan);
      setPlanUpdateSuccess(true);
      setShowBillingModal(false);
      setTimeout(() => setPlanUpdateSuccess(false), 3000);
      return;
    }

    setIsUpdatingPlan(true);
    try {
      const res = await fetch("/api/billing/update-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPlan }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) {
        setPlanUpdateError(json.error ?? "Erreur lors du changement de plan.");
      } else {
        setPractitionerPlan(newPlan);
        setPlanUpdateSuccess(true);
        setShowBillingModal(false);
        setTimeout(() => setPlanUpdateSuccess(false), 3000);
      }
    } catch {
      setPlanUpdateError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  const handlePurchasePack = () => {
    window.location.assign("/checkout-pack");
  };

  const handleDiscretClick = () => {
    if (discretMode) { if (savedPin) { setPinInput(""); setPinError(""); setShowPinModal(true); } else { setDiscretMode(false); } }
    else { setDiscretMode(true); }
  };

  const verifyPin = () => {
    if (pinInput === savedPin) { setDiscretMode(false); setShowPinModal(false); setPinInput(""); setPinError(""); }
    else { setPinError("Code incorrect"); setPinInput(""); }
  };

  const selectedPatient = displayedSelectedPatient;
  const totalMessages = onboardingDemoMode ? 131 : patients.reduce((sum, p) => sum + p.totalMessages, 0);

  const getCalendarDays = () => {
    const year = reportMonth.getFullYear(); const month = reportMonth.getMonth();
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

  const generateSoutien = async () => {
    if (!selectedPatientId || !practitionerId) return;
    setShowInterventionBubble(false);
    setReplyMode(true);
    setReplyText("");
    setReplyIsFromJumeau(true);
    setReplyGenerating(true);
    // Mode démo : texte simulé
    if (onboardingDemoMode) {
      await new Promise(r => setTimeout(r, 1800));
      const demoMsg = displayedSelectedPatient?.firstName === "Sophie"
        ? "Sophie, je voulais juste vous dire que je pense à vous en ce moment. Ce que vous traversez au travail est épuisant, et c'est tout à fait normal que ça déborde sur le reste. N'hésitez pas à m'écrire, je suis là."
        : displayedSelectedPatient?.firstName === "Julie"
        ? "Julie, je sais que cette semaine a été lourde. Prenez soin de vous, même à petites doses : un vrai repas, une vraie pause. Vous comptez."
        : "Je voulais prendre un instant pour vous dire que votre parcours est remarquable. Continuez à vous faire confiance.";
      setReplyText(demoMsg);
      setReplyGenerating(false);
      setTimeout(() => replyInputRef.current?.focus(), 50);
      return;
    }
    try {
      const p = displayedSelectedPatient as RealPatient | null;
      const murmures = (p?.practitioner_instruction as { text: string }[] | undefined)?.map(m => m.text) ?? [];
      const res = await fetch("/api/generate-soutien", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatientId,
          practitionerId,
          emotionalInsight: p?.emotional_insight ?? "",
          lastMessages: displayedConversations.slice(-8).map(m => ({ role: m.role, content: m.content })),
          murmures,
        }),
      });
      const data = await res.json() as { message?: string };
      setReplyText(data.message ?? "");
    } catch { setReplyText(""); }
    setReplyGenerating(false);
    setTimeout(() => replyInputRef.current?.focus(), 50);
  };

  const sendSoutien = async () => {
    if (!replyText.trim() || !selectedPatientId || !practitionerId || replySending) return;
    setReplySending(true);
    const msgContent = replyText.trim();
    const newMsg = { id: `local-${Date.now()}`, role: "assistant" as const, content: msgContent, created_at: new Date().toISOString() };
    // Mise à jour locale — marque les alertes comme vues mais NE change PAS emotional_status
    // (le retour à green n'est déclenché que par Gemini via signal d'apaisement patient)
    if (onboardingDemoMode) {
      setPatients(prev => prev.map(p => p.id === selectedPatientId
        ? { ...p, admin_alerts: p.admin_alerts?.map(a => ({ ...a, seen: true })) } : p));
    } else {
      try {
        await fetch("/api/send-soutien", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patientId: selectedPatientId, practitionerId, messageText: msgContent }),
        });
        setPatients(prev => prev.map(p => p.id === selectedPatientId
          ? { ...p, admin_alerts: p.admin_alerts?.map(a => ({ ...a, seen: true })) } : p));
      } catch { /* silencieux */ }
    }
    // Ajouter le message à la conversation locale
    setConversations(prev => [...prev, newMsg]);
    setReplyMode(false);
    setReplyText("");
    setReplyIsFromJumeau(false);
    setReplySending(false);
    // Scroller en bas
    setTimeout(() => {
      if (conversationContainerRef.current) {
        conversationContainerRef.current.scrollTop = conversationContainerRef.current.scrollHeight;
      }
    }, 50);
  };

  const generateReport = async () => {
    if (!selectedPatientId || !practitionerId) return;
    setReportLoading(true); setReportContent(""); setReportError("");
    // Mode démo : mock instantané
    if (onboardingDemoMode) {
      await new Promise(r => setTimeout(r, 2000));
      const mockRapport = DEMO_RAPPORT_BY_PATIENT[selectedPatientId] ?? DEMO_RAPPORT_BY_PATIENT["demo-1"];
      setReportContent(JSON.stringify(mockRapport));
      setReportLoading(false);
      return;
    }
    try {
      const now = new Date(); let dateFrom = ""; let dateTo = now.toISOString().split("T")[0];
      if (reportPeriod === "week") { const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7); dateFrom = weekAgo.toISOString().split("T")[0]; }
      else if (reportPeriod === "month") { const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1); dateFrom = monthAgo.toISOString().split("T")[0]; }
      else { dateFrom = reportDateFrom; dateTo = reportDateTo; }
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: selectedPatientId, practitionerId, dateFrom, dateTo }),
      });
      const data = await res.json() as { report?: { synthese: string; patterns: string; victoires: string; murmures_bilan: string }; lowData?: boolean; message?: string; error?: string };
      if (data.lowData && data.message) {
        setReportContent(JSON.stringify({ lowData: true, message: data.message }));
      } else if (data.report) {
        setReportContent(JSON.stringify(data.report));
      } else {
        setReportError(data.error ?? "Impossible de générer le rapport.");
      }
    } catch { setReportError("La génération a échoué. Vérifiez votre connexion et réessayez."); }
    finally { setReportLoading(false); }
  };

  const resetInviteForm = () => {
    setInviteEmail(""); setInviteFirstName(""); setInviteLastName(""); setInviteAge(""); setInviteSexe(""); setInviteTaille(""); setInvitePoids("");
    setInvitePathologies(""); setInviteAllergies(""); setInviteTraitements(""); setInviteObjectifClinique("");
    setInviteBriefJumeau(""); setInviteNotes(""); setInviteNiveauActivite(""); setInviteRegime(""); setInviteError("");
    setInviteMurmureDuration("permanent");
    setInviteExistingUnactivated(false); setInviteResentLoading(false); setInviteResentSuccess(false);
    setInviteStep(1);
  };

  const resendFromModal = async () => {
    if (!practitionerId || !inviteEmail) return;
    setInviteResentLoading(true);
    setInviteError("");
    try {
      const res = await fetch("/api/invite-patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), practitionerId }),
      });
      if (!res.ok) throw new Error();
      setInviteResentSuccess(true);
      if (practitionerId) { await new Promise(r => setTimeout(r, 500)); await loadPatients(practitionerId); }
    } catch {
      setInviteError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setInviteResentLoading(false);
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true); setInviteError("");
    try {
      const res = await fetch("/api/invite-patient", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail.trim(), practitionerId: practitionerId ?? "", first_name: inviteFirstName || null, last_name: inviteLastName || null, age: inviteAge ? parseInt(inviteAge) : null, sexe: inviteSexe || null, taille: inviteTaille ? parseInt(inviteTaille) : null, poids: invitePoids ? parseFloat(invitePoids) : null, pathologies: invitePathologies || null, allergies: inviteAllergies || null, traitements: inviteTraitements || null, objectif_clinique: inviteObjectifClinique || null, brief_jumeau: inviteBriefJumeau || null, notes: inviteNotes || null, niveau_activite: inviteNiveauActivite || null, regime_specifique: inviteRegime || null, murmure_duration: inviteMurmureDuration }) });
      const data = await res.json() as { error?: string };
      if (!res.ok) setInviteError(data.error ?? "Une erreur est survenue.");
      else { const savedFirstName = inviteFirstName; resetInviteForm(); setInviteFirstName(savedFirstName); setInviteSuccess(true); if (practitionerId) { await new Promise(r => setTimeout(r, 500)); await loadPatients(practitionerId); } }
    } catch { setInviteError("Impossible d'envoyer l'invitation."); }
    finally { setInviting(false); }
  };

  const formatTime = (seconds: number) => { const m = Math.floor(seconds / 60).toString().padStart(2, "0"); const s = (seconds % 60).toString().padStart(2, "0"); return `${m}:${s}`; };
  const fileTypeIcon = (type: string): React.ReactElement => {
    if (["jpg","jpeg","png"].includes(type)) return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="#60a5fa" stroke="none"/><polyline points="21 15 16 10 5 21"/></svg>;
    if (["mp3","wav","m4a"].includes(type)) return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
    if (["xlsx","csv"].includes(type)) return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={emerald} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>;
    if (type === "pdf") return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/></svg>;
    if (type === "docx") return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
  };
  const today = new Date().toISOString().split("T")[0];

  const generateBilan = async () => {
    if (!selectedPatientId || !practitionerId) return;
    setBilanLoading(true); setBilanContent("");
    // Mode démo : mock instantané
    if (onboardingDemoMode) {
      await new Promise(r => setTimeout(r, 1800));
      const mockQuestions = DEMO_BILAN_BY_PATIENT[selectedPatientId] ?? DEMO_BILAN_BY_PATIENT["demo-1"];
      setBilanContent(JSON.stringify(mockQuestions));
      setBilanLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/generate-bilan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: selectedPatientId, practitionerId }),
      });
      const data = await res.json() as { questions?: { question: string; justification: string; objectif: string }[]; lowData?: boolean; message?: string; error?: string };
      if (data.lowData && data.message) {
        setBilanContent(JSON.stringify({ lowData: true, message: data.message }));
      } else if (data.questions) {
        setBilanContent(JSON.stringify(data.questions));
      } else {
        setBilanContent(JSON.stringify({ isError: true, message: data.error ?? "Impossible de générer les questions." }));
      }
    } catch (e) { setBilanContent(JSON.stringify({ isError: true, message: e instanceof Error ? e.message : "Erreur réseau." })); }
    setBilanLoading(false);
  };

  return (
    <div style={{ display: "flex", height: "100dvh", background: "#070B09", overflow: "hidden" }}>
    {/* ═══ Dashboard (gauche) ═══ */}
    <div style={{
      flex: 1,
      minWidth: 0,
      overflow: "hidden",
      overflowY: "auto",
      minHeight: "100dvh",
      background: "#070B09",
      color: "white",
      fontFamily: "Inter, sans-serif",
    }}>

      {showOnboarding && (
        <OnboardingTour
          practitionerName={practitionerName}
          onSkip={handleOnboardingSkip}
          onTestMode={() => { handleOnboardingSkip(); testModeRef.current = true; setTestMode(true); }}
        />
      )}

      {/* ═══ HEADER ═══ */}
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(7,7,7,0.8)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 40, padding: "0 24px" }}>
        <div style={{ maxWidth: 1600, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowAccountMenu(prev => !prev)}
              style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "4px 8px", borderRadius: 10, transition: "background 0.2s", display: "flex", alignItems: "center", gap: 10 }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", border: `1.5px solid ${emerald}`, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                {practitionerPhoto ? <img src={practitionerPhoto} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : AVATARS[selectedAvatar]}
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "white", filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>
                  Dashboard
                  <span style={{ fontSize: 11, color: "#64748b", marginLeft: 6 }}>▾</span>
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                  {onboardingDemoMode ? "3 patients" : `${patients.length} patient${patients.length > 1 ? "s" : ""}`}
                </p>
              </div>
            </button>

            {showAccountMenu && (
              <>
                <div onClick={() => setShowAccountMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 50, background: "#0d0d0d", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", padding: "6px", minWidth: 230 }}>
                  <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 4 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "white", filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>{practitionerName}</p>
                  </div>
                  <button onClick={() => { handleDiscretClick(); setShowAccountMenu(false); }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: discretMode ? "rgba(245,158,11,0.08)" : "transparent", border: "none", cursor: "pointer", transition: "all 0.15s", marginBottom: 2 }}
                    onMouseEnter={e => { if (!discretMode) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = discretMode ? "rgba(245,158,11,0.08)" : "transparent"; }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: discretMode ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.06)", border: `1px solid ${discretMode ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.08)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="12" rx="10" ry="6" stroke={discretMode ? amber : "#94a3b8"} strokeWidth="1.8"/><circle cx="12" cy="12" r="2.5" stroke={discretMode ? amber : "#94a3b8"} strokeWidth="1.8"/>{discretMode && <line x1="3" y1="3" x2="21" y2="21" stroke={amber} strokeWidth="1.8" strokeLinecap="round"/>}</svg>
                    </div>
                    <div style={{ textAlign: "left", flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: discretMode ? amber : "white" }}>Mode discret</p>
                      <p style={{ margin: 0, fontSize: 10, color: "#64748b" }}>{discretMode ? "Actif - cliquer pour désactiver" : "Masquer les données patients"}</p>
                    </div>
                    {discretMode && <div style={{ width: 8, height: 8, borderRadius: "50%", background: amber, flexShrink: 0 }} />}
                  </button>
                  {/* ─── Mode test ─── */}
                  <button onClick={() => {
                    if (testMode) { testModeRef.current = false; setTestMode(false); setShowAccountMenu(false); }
                    else { testModeRef.current = true; setTestMode(true); setShowAccountMenu(false); }
                  }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: testMode ? "rgba(16,185,129,0.08)" : "transparent", border: "none", cursor: "pointer", transition: "all 0.15s", marginBottom: 2 }}
                    onMouseEnter={e => { if (!testMode) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = testMode ? "rgba(16,185,129,0.08)" : "transparent"; }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: testMode ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)", border: `1px solid ${testMode ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.08)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={testMode ? emerald : "#94a3b8"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/></svg>
                    </div>
                    <div style={{ textAlign: "left", flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: testMode ? emerald : "white" }}>Mode test</p>
                      <p style={{ margin: 0, fontSize: 10, color: "#64748b" }}>{testMode ? "Actif - cliquer pour quitter" : "Tester l'expérience patient"}</p>
                    </div>
                    {testMode && <div style={{ width: 8, height: 8, borderRadius: "50%", background: emerald, flexShrink: 0 }} />}
                  </button>
                  <button onClick={() => { setShowSettingsModal(true); setShowAccountMenu(false); }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "transparent", border: "none", cursor: "pointer", transition: "all 0.15s", marginBottom: 2 }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="#94a3b8" strokeWidth="1.8"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="#94a3b8" strokeWidth="1.8"/></svg>
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "white" }}>Paramètres</p>
                      <p style={{ margin: 0, fontSize: 10, color: "#64748b" }}>Compte, PIN, sécurité</p>
                    </div>
                  </button>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />
                  <button onClick={() => { setShowLogoutModal(true); setShowAccountMenu(false); }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "transparent", border: "none", cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(244,63,94,0.08)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round"/><polyline points="16,17 21,12 16,7" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="21" y1="12" x2="9" y2="12" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round"/></svg>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#f87171" }}>Se déconnecter</p>
                  </button>
                </div>
              </>
            )}
          </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {(["patients", "vue_ensemble"] as ActiveTab[]).map((tab) => {
              const labels: Record<ActiveTab, string> = { patients: "Suivi", vue_ensemble: "Vue d'ensemble" };
              const isActive = activeTab === tab;
              return (
                <button key={tab} onClick={() => navigateTab(tab)}
                  style={{ height: 36, borderRadius: 8, padding: "0 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: isActive ? "1px solid rgba(16,185,129,0.18)" : "1px solid transparent", background: isActive ? "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))" : "transparent", color: isActive ? emerald : "#64748b", transition: "all 0.2s", boxShadow: isActive ? "0 2px 12px rgba(0,0,0,0.3)" : "none" }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = "#64748b"; e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; } }}>
                  {labels[tab]}
                </button>
              );
            })}
            <button onClick={() => void openJumeauModal()}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 12, background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))", border: "1px solid rgba(16,185,129,0.18)", cursor: "pointer", transition: "all 0.2s", boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.22), rgba(16,185,129,0.08))"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))"; }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: emerald, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM17.5 14v7M14 17.5h7" stroke="black" strokeWidth="2" strokeLinecap="round"/></svg>
              </div>
              <div style={{ textAlign: "left" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: emerald }}>Mon Jumeau</p>
                <p style={{ margin: 0, fontSize: 10, color: "#64748b" }}>Gérer mes documents</p>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* ═══ BANNIÈRE PAIEMENT ÉCHOUÉ (past_due) ═══ */}
      {subscriptionStatus === "past_due" && (
        <div style={{ background: "rgba(245,158,11,0.08)", borderBottom: "1px solid rgba(245,158,11,0.25)", padding: "12px 24px" }}>
          <div style={{ maxWidth: 1600, margin: "0 auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span style={{ fontSize: 13, color: "#f59e0b" }}>
                Votre paiement a échoué. Mettez à jour votre moyen de paiement pour continuer à accéder à NutriTwin.
              </span>
            </div>
            <button
              onClick={() => { setShowSettingsModal(true); setSettingsScreen("abonnement"); }}
              style={{ background: "#f59e0b", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, color: "#000", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>
              Mettre à jour ma carte
            </button>
          </div>
        </div>
      )}

      {/* ═══ OVERLAY BLOQUANT — ABONNEMENT SUSPENDU (canceled) ═══ */}
      {(subscriptionStatus === "canceled" || subscriptionStatus === "cancelled") && (
        <div style={{ position: "fixed", inset: 0, zIndex: 45, background: "rgba(7,11,9,0.96)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h2 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 700, color: "white" }}>Accès suspendu</h2>
          <p style={{ margin: "0 0 28px", fontSize: 14, color: "#94a3b8", maxWidth: 360, lineHeight: 1.6 }}>
            Votre abonnement a été suspendu suite à l&apos;échec des tentatives de paiement. Mettez à jour votre carte pour réactiver votre accès à NutriTwin.
          </p>
          <button
            onClick={() => { setShowSettingsModal(true); setSettingsScreen("abonnement"); setBillingTab("facturation"); }}
            style={{ height: 44, paddingInline: 28, borderRadius: 12, background: "#ef4444", border: "none", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Mettre à jour ma carte
          </button>
        </div>
      )}

      <main style={{ maxWidth: 1600, margin: "0 auto", padding: "24px" }}>

        {/* ═══ Bannière mode démo ═══ */}
        {activeTab === "patients" && onboardingDemoMode && !testMode && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, height: 38, borderRadius: 10, background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)", padding: "0 20px" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#8b5cf6", flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", letterSpacing: "0.06em", textTransform: "uppercase" }}>Mode démo</span>
              <span style={{ fontSize: 11, color: "#c4b5fd" }}>Aperçu simulé de l&apos;expérience praticien. Invitez votre premier patient pour commencer.</span>
            </div>
          </div>
        )}

        {/* ═══ VUE SUIVI ═══ */}
        {activeTab === "patients" && (
          <div style={{ display: "grid", gridTemplateColumns: testMode ? "300px minmax(0,1fr)" : "300px minmax(0,1fr) 330px", gap: 16, height: onboardingDemoMode && !testMode ? "calc(100vh - 165px)" : "calc(100vh - 113px)" }}>

            {/* Sidebar patients */}
            <div data-tour="patients" style={{ display: "flex", flexDirection: "column", background: "#060908", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <input type="text" placeholder="Rechercher..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: "100%", height: 36, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "white", padding: "0 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
                {loading && !onboardingDemoMode ? (
                  <p style={{ textAlign: "center", fontSize: 13, color: "#64748b", marginTop: 20 }}>Chargement...</p>
                ) : filteredPatients.length === 0 ? (
                  <p style={{ textAlign: "center", fontSize: 13, color: "#64748b", marginTop: 20 }}>Aucun patient</p>
                ) : filteredPatients.map((patient) => {
                  const isSelected = patient.id === (selectedPatientId ?? (onboardingDemoMode ? "demo-1" : null));
                  const isCritical = patient.emotional_status === "red_critical";
                  const isRed = isCritical;
                  const isBehavioralList = patient.emotional_status === "red_behavioral";
                  const hasAlert = isRed || isBehavioralList;
                  const alertDismissed = alertBannerDismissed[patient.id];
                  const activeAlert = hasAlert && !alertDismissed;
                  // Alerte administrative : correction d'identité non traitée
                  const hasIdentityAlert = !activeAlert && (patient.admin_alerts ?? []).some((a: { type?: string; alert_type?: string; seen?: boolean }) => !a.seen && a.type === "admin_alert" && (a.alert_type === "identity_correction" || a.alert_type === "rectification_request"));
                  // Victoire récente : seulement si < 48h — déclarée avant les styles de carte
                  const victoryFresh = !!(patient.latest_victory && patient.victory_detected_at
                    && (Date.now() - new Date(patient.victory_detected_at).getTime()) < 48 * 60 * 60 * 1000);
                  // Couleurs des cartes — red_behavioral → amber, vert sans victoire → neutre
                  const alertColor2 = isRed ? coral : amber; // behavioral = amber
                  let cardBg = "transparent";
                  let cardBorder = "transparent";
                  let cardShadow = "none";
                  if (isSelected) {
                    if (isCritical) { cardBg = "rgba(244,63,94,0.07)"; cardBorder = "rgba(244,63,94,0.4)"; cardShadow = "0 0 16px rgba(244,63,94,0.1)"; }
                    else if (isBehavioralList) { cardBg = "rgba(245,158,11,0.04)"; cardBorder = "rgba(245,158,11,0.28)"; cardShadow = "0 4px 16px rgba(0,0,0,0.4)"; }
                    else if (hasIdentityAlert) { cardBg = "rgba(96,165,250,0.05)"; cardBorder = "rgba(96,165,250,0.28)"; cardShadow = "0 4px 16px rgba(0,0,0,0.4)"; }
                    else if (victoryFresh) {
                      cardBg = "rgba(16,185,129,0.04)"; cardBorder = "rgba(16,185,129,0.22)"; cardShadow = "0 0 12px rgba(16,185,129,0.12)";
                    } else {
                      cardBg = "rgba(255,255,255,0.04)"; cardBorder = "rgba(255,255,255,0.08)"; cardShadow = "0 4px 16px rgba(0,0,0,0.4)";
                    }
                  } else if (hasIdentityAlert) {
                    cardBg = "rgba(96,165,250,0.03)"; cardBorder = "rgba(96,165,250,0.18)"; cardShadow = "none";
                  }
                  // Sous-texte : alerte > victoire (cause, en vert) > dernier message
                  const subText = activeAlert
                    ? (patient.emotional_insight || "Alerte en cours…")
                    : (victoryFresh && patient.latest_victory)
                    ? patient.latest_victory
                    : (patient.lastMessage || "Aucun message");
                  const subColor = activeAlert
                    ? (isRed ? "rgba(244,63,94,0.9)" : "rgba(245,158,11,0.9)")
                    : (victoryFresh && patient.latest_victory ? emerald : "#475569");
                  return (
                    <button key={patient.id} onClick={() => {
                      setSelectedPatientId(patient.id);
                      setShowInterventionBubble(false);
                      setReplyMode(false);
                      setReplyText("");
                      setReplyIsFromJumeau(false);
                      if (testMode) {
                        // Attendre que le patient actif soit mis à jour en BDD avant de
                        // recharger l'iframe — évite la race condition où session/route.ts
                        // lirait encore l'ancien test_patient_user_id.
                        fetch("/api/test-mode/active", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ testPatientUserId: patient.id }),
                        }).then(() => {
                          setTestIframeKey(`test-chat-${patient.id}`);
                        }).catch(() => {
                          // En cas d'erreur réseau, recharger quand même pour ne pas bloquer l'UX
                          setTestIframeKey(`test-chat-${patient.id}`);
                        });
                      }
                    }}
                      style={{ width: "100%", borderRadius: 12, padding: "10px 12px", textAlign: "left", cursor: "pointer", marginBottom: 6, background: cardBg, border: `1px solid ${cardBorder}`, transition: "all 0.2s", boxShadow: cardShadow }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: patient.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "white", flexShrink: 0, filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>
                          {patient.initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "white", filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>{patient.firstName} {patient.lastName}</p>
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: subColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s", display: "flex", alignItems: "center", gap: 4 }}>
                            {!activeAlert && victoryFresh && (
                              <span
                                style={{ fontSize: 11, flexShrink: 0, cursor: "pointer" }}
                                title={patient.latest_victory}
                                onClick={(e) => { e.stopPropagation(); if (patient.victory_message_id) setPendingScrollMessageId(patient.victory_message_id); else if (patient.victory_detected_at) setPendingScrollMessageId(patient.victory_detected_at); }}>
                                🏆
                              </span>
                            )}
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: "italic" }}>{subText}</span>
                          </p>
                        </div>
                        {activeAlert && <div style={{ width: 7, height: 7, borderRadius: "50%", background: alertColor2, flexShrink: 0 }} />}
                        {!activeAlert && hasIdentityAlert && <div style={{ width: 7, height: 7, borderRadius: "50%", background: SLATE_BLUE, flexShrink: 0 }} title="Correction de nom demandée" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div data-tour="invite" style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <button
                  onClick={testMode
                    ? () => { setShowAddTestPatientModal(true); setAddTestPatientStep(1); }
                    : () => { setShowInviteModal(true); setInviteSuccess(false); setInviteStep(1); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 12, background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))", border: "1px solid rgba(16,185,129,0.18)", cursor: "pointer", transition: "all 0.2s", boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.22), rgba(16,185,129,0.08))"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))"; e.currentTarget.style.transform = "translateY(0)"; }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: emerald, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: emerald }}>{testMode ? "Ajouter un patient test" : "Inviter un patient"}</p>
                    <p style={{ margin: 0, fontSize: 10, color: "#64748b" }}>{testMode ? "Créer un nouveau profil de test" : "Envoyer un accès personnalisé"}</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Zone conversation — masquée en mode test (remplacée par l'iframe) */}
            {!testMode && <div style={{ display: "flex", flexDirection: "column", background: "rgba(255,255,255,0.02)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
              {selectedPatient ? (
                <>
                  <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: selectedPatient.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "white", flexShrink: 0, filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>
                        {selectedPatient.initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "white", filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>{selectedPatient.firstName} {selectedPatient.lastName}</p>
                        {!(selectedPatient as RealPatient).is_test && (
                          <p style={{ margin: 0, fontSize: 12, color: "#64748b", filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>{onboardingDemoMode ? "patient@email.fr" : (selectedPatient as RealPatient).email}</p>
                        )}
                      </div>
                    </div>
                    {/* Bandeau alerte contextuel */}
                    {(() => {
                      const alerts = (selectedPatient.admin_alerts?.filter(a => !a.seen) ?? [])
                        .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());
                      const isCritical = selectedPatient.emotional_status === "red_critical";
                      const isRed = isCritical;
                      const isBehavioralBanner = selectedPatient.emotional_status === "red_behavioral";
                      const hasAlert = isRed || isBehavioralBanner;
                      if (!hasAlert || alertBannerDismissed[selectedPatient.id]) return null;
                      const alertText = alerts.length > 0 ? (
                        alerts[0].type === "crisis" ? (
                          alerts[0].alert_type === "suicide" ? "Idéation suicidaire exprimée" :
                          alerts[0].alert_type === "medical" ? "Urgence médicale signalée" :
                          alerts[0].alert_type === "threat" ? "Menace envers autrui" : "Crise détectée"
                        ) : selectedPatient.emotional_insight || "Comportement sensible détecté"
                      ) : selectedPatient.emotional_insight || "Comportement sensible détecté";
                      const alertColor = isRed ? coral : amber;
                      const alertBg = isRed ? "rgba(244,63,94,0.08)" : "rgba(245,158,11,0.06)";
                      const alertBorder = isRed ? "rgba(244,63,94,0.25)" : "rgba(245,158,11,0.2)";
                      return (
                        <div style={{ background: alertBg, borderTop: `1px solid ${alertBorder}`, padding: "8px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <AlertIcon size={13} color={alertColor} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: alertColor, flex: 1, minWidth: 0 }}>
                            {selectedPatient.firstName} · {alertText}
                          </span>
                          {isBehavioralBanner && (() => {
                            const lastMsg = (selectedPatient as RealPatient).last_patient_message_at;
                            if (!lastMsg) return null;
                            const hoursSilent = (Date.now() - new Date(lastMsg).getTime()) / 3_600_000;
                            if (hoursSilent <= 24) return null;
                            return <span style={{ fontSize: 11, color: amber, whiteSpace: "nowrap", fontWeight: 500 }}>· Sans nouvelles depuis {Math.round(hoursSilent)}h</span>;
                          })()}
                          {/* red_critical : seulement "Aller au message" — résolution formelle via LeverAlerteCritique uniquement */}
                          {isCritical && alerts.length > 0 && (
                            <button onClick={() => scrollToAlertMessage(alerts[0])}
                              style={{ fontSize: 11, fontWeight: 600, color: alertColor, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0, whiteSpace: "nowrap" }}>
                              Aller au message
                            </button>
                          )}
                          {/* red_behavioral : "Aller au message" uniquement si ce n'est pas un intake SOS
                              (behavioral_sos_intake n'a pas de message correspondant dans conversations) */}
                          {isBehavioralBanner && alerts.length > 0 && alerts[0].alert_type !== "behavioral_sos_intake" && (
                            <button onClick={() => scrollToAlertMessage(alerts[0])}
                              style={{ fontSize: 11, fontWeight: 600, color: alertColor, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0, whiteSpace: "nowrap" }}>
                              Aller au message
                            </button>
                          )}
                          {isBehavioralBanner && alerts.length > 0 && alerts[0].alert_type === "behavioral_sos_intake" && (
                            <span style={{ fontSize: 11, color: amber, whiteSpace: "nowrap" }}>· Détecté pendant l&apos;exercice SOS</span>
                          )}
                          {isBehavioralBanner && alerts.length > 0 && alerts[0].alert_type !== "behavioral_sos_intake" && <span style={{ color: "#4b5563", fontSize: 11 }}>·</span>}
                          {isBehavioralBanner && (
                            <button onClick={() => void dismissAlertFromHeader(selectedPatient.id)}
                              style={{ fontSize: 11, color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: 0, whiteSpace: "nowrap" }}
                              onMouseEnter={e => e.currentTarget.style.color = "#94a3b8"}
                              onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
                              Marquer comme vu
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    {/* Bandeau victoire HAUT — texte + "Aller au message" uniquement */}
                    {(() => {
                      const hasActiveAlert = (selectedPatient.emotional_status === "red_critical" || selectedPatient.emotional_status === "red_behavioral") && !alertBannerDismissed[selectedPatient.id];
                      const victoryFreshBanner = !!(selectedPatient.latest_victory && selectedPatient.victory_detected_at && (Date.now() - new Date(selectedPatient.victory_detected_at).getTime()) < 48 * 60 * 60 * 1000);
                      if (!victoryFreshBanner || hasActiveAlert) return null;
                      return (
                        <div style={{ background: "rgba(16,185,129,0.06)", borderTop: "1px solid rgba(16,185,129,0.22)", padding: "8px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: emerald, flex: 1, minWidth: 0 }}>
                            🏆 {selectedPatient.firstName} · {selectedPatient.latest_victory}
                          </span>
                          <button
                            onClick={() => { if (selectedPatient.victory_message_id) { setPendingScrollMessageId(selectedPatient.victory_message_id); } else { scrollToVictoryMessage(selectedPatient.victory_detected_at ?? undefined); } }}
                            style={{ fontSize: 11, fontWeight: 600, color: emerald, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0, whiteSpace: "nowrap" }}>
                            Aller au message
                          </button>
                          <span style={{ color: "#4b5563", fontSize: 11 }}>·</span>
                          <button
                            onClick={() => void dismissVictory(selectedPatient.id)}
                            style={{ fontSize: 11, color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: 0, whiteSpace: "nowrap" }}
                            onMouseEnter={e => e.currentTarget.style.color = "#94a3b8"}
                            onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
                            Marquer comme vu
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                  <div ref={conversationContainerRef} style={{ flex: 1, overflowY: "auto", padding: "16px 20px", background: "#0b0f0d", display: "flex", flexDirection: "column", gap: 12 }}>
                    {displayedConversations.length === 0 ? (
                      <p style={{ textAlign: "center", fontSize: 13, color: "#64748b", marginTop: 40 }}>Aucune conversation</p>
                    ) : displayedConversations.map((message, idx) => {
                      const isPatient = message.role === "user";
                      const isHighlighted = message.id === highlightedMessageId;
                      const selIsRed = selectedPatient.emotional_status === "red_critical";
                      const selIsVictory = !selIsRed && !!(selectedPatient.latest_victory && selectedPatient.victory_detected_at && (Date.now() - new Date(selectedPatient.victory_detected_at).getTime()) < 48 * 60 * 60 * 1000);
                      const highlightColor = selIsRed ? "rgba(244,63,94,0.22)" : selIsVictory ? "rgba(16,185,129,0.22)" : "rgba(245,158,11,0.18)";
                      const highlightOutline = selIsRed ? "rgba(244,63,94,0.5)" : selIsVictory ? "rgba(16,185,129,0.5)" : "rgba(245,158,11,0.4)";
                      const d = new Date(message.created_at);
                      const now = new Date();
                      const msgDay = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                      const prevMsg = idx > 0 ? displayedConversations[idx - 1] : null;
                      const prevD = prevMsg ? new Date(prevMsg.created_at) : null;
                      const prevDay = prevD ? `${prevD.getFullYear()}-${prevD.getMonth()}-${prevD.getDate()}` : null;
                      const showDateSep = msgDay !== prevDay;
                      const todayDay = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
                      const yest = new Date(now); yest.setDate(now.getDate() - 1);
                      const yesterdayDay = `${yest.getFullYear()}-${yest.getMonth()}-${yest.getDate()}`;
                      const sameYear = d.getFullYear() === now.getFullYear();
                      const dateSepLabel = msgDay === todayDay ? "Aujourd'hui" : msgDay === yesterdayDay ? "Hier" : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", ...(!sameYear ? { year: "numeric" } : {}) });
                      const msgDateLabel = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
                      const dateSep = showDateSep && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0" }}>
                          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
                          <span style={{ fontSize: 10, color: "#4b5563", fontWeight: 500, whiteSpace: "nowrap" }}>{dateSepLabel}</span>
                          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
                        </div>
                      );
                      if (message.role === "widget" && message.sosSummary) {
                        return (
                          <Fragment key={message.id}>
                            {dateSep}
                            <div data-message-id={message.id} data-message-date={message.created_at}
                              style={{ display: "flex", justifyContent: "flex-start" }}>
                              <DashboardSosSummaryCard {...message.sosSummary} onGoToMessage={setPendingScrollMessageId} />
                            </div>
                          </Fragment>
                        );
                      }
                      if (message.role === "system") {
                        // Résumé praticien généré par /api/exercise/log (practitioner_only=true)
                        // Format : "[EXERCICE : Nom]\n\nContexte...\n\nIssue : ..."
                        const sysLines = message.content.split("\n");
                        const sysFirstLine = sysLines[0];
                        const exMatch = sysFirstLine.match(/\[EXERCICE : (.+?)\]/);
                        const exLabel = exMatch?.[1] ?? "Exercice";
                        const sysBody = sysLines.slice(1).join("\n").trim();
                        const issueMatch = sysBody.match(/Issue : (.+)/);
                        const issue = issueMatch?.[1]?.trim() ?? "";
                        const isCriseOk = issue === "Crise désamorcée";
                        const isPositif = issue === "Séance positive";
                        const accentColor = isCriseOk ? "rgba(16,185,129,0.7)" : isPositif ? "rgba(99,102,241,0.6)" : "rgba(100,116,139,0.35)";
                        const bgColor = isCriseOk ? "rgba(16,185,129,0.05)" : isPositif ? "rgba(99,102,241,0.06)" : "rgba(255,255,255,0.02)";
                        const issueTextColor = isCriseOk ? "#10b981" : isPositif ? "#818cf8" : "#64748b";
                        return (
                          <Fragment key={message.id}>
                            {dateSep}
                            <div data-message-id={message.id} data-message-date={message.created_at}
                              style={{ display: "flex", justifyContent: "flex-start" }}>
                              <div style={{ maxWidth: "100%", borderLeft: `3px solid ${accentColor}`, background: bgColor, borderRadius: "0 10px 10px 0", padding: "10px 14px", filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.08em" }}>Résumé exercice</span>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>{exLabel}</span>
                                </div>
                                <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.75, color: "rgba(255,255,255,0.72)", whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                                  {sysBody.replace(/\nIssue : .+/, "").trim()}
                                </pre>
                                {issue && (
                                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: issueTextColor }}>→ {issue}</span>
                                  </div>
                                )}
                                <p style={{ margin: "6px 0 0", fontSize: 10, color: "#4b5563" }}>{msgDateLabel}</p>
                              </div>
                            </div>
                          </Fragment>
                        );
                      }
                      return (
                        <Fragment key={message.id}>
                          {dateSep}
                          <div data-message-id={message.id} data-message-date={message.created_at}
                            style={{ display: "flex", justifyContent: isPatient ? "flex-end" : "flex-start", transition: "all 0.3s" }}>
                            <div style={{ maxWidth: isPatient ? "78%" : "100%" }}>
                              <div style={{ borderRadius: isPatient ? 22 : (isHighlighted ? 14 : 0), padding: isPatient ? "12px 16px" : (isHighlighted ? "4px 14px" : "4px 0"), fontSize: isPatient ? 13 : 14, lineHeight: isPatient ? 1.6 : 1.8, background: isHighlighted ? highlightColor : isPatient ? "rgba(16,185,129,0.12)" : "transparent", border: isPatient ? "none" : (isHighlighted ? `1px solid ${highlightOutline}` : "none"), color: "rgba(255,255,255,0.95)", filter: discretMode ? "blur(4px)" : "none", transition: "background 0.3s, filter 0.2s", outline: "none" }}>
                                {message.content}
                              </div>
                              <p style={{ margin: "4px 0 0", fontSize: 10, color: "#4b5563", textAlign: isPatient ? "right" : "left" }}>
                                {msgDateLabel}
                              </p>
                            </div>
                          </div>
                        </Fragment>
                      );
                    })}
                  </div>
                  {/* Bloc Action — intervention bubble */}
                  {/* Footer "Accompagner … / Écrire un message" — réservé à red_behavioral.
                      red_critical n'a QUE le header "Aller au message" (résolution formelle
                      via LeverAlerteCritique). */}
                  {selectedPatient.emotional_status === "red_behavioral"
                    && (showInterventionBubble || !alertBannerDismissed[selectedPatient.id])
                    && !replyMode && (() => {
                    // Footer réservé à red_behavioral → palette orange uniquement.
                    const actionColor = ORANGE_BEHAVIORAL;
                    const actionBorder = "rgba(245,158,11,0.2)";
                    const actionBtnBorder = "rgba(245,158,11,0.35)";
                    const actionBtnHover = "rgba(245,158,11,0.22)";
                    const actionBtnSolidBg = "rgba(245,158,11,0.14)";
                    return (
                      <div style={{ borderTop: `1px solid ${actionBorder}`, background: "rgba(10,10,12,0.97)", backdropFilter: "blur(12px)", padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, color: "#64748b", flex: 1, minWidth: 140 }}>
                          {`Accompagner ${selectedPatient.firstName} dans ce moment`}
                        </span>
                        {/* Soutien en crise : réponse humaine uniquement — pas de génération IA */}
                        <button onClick={() => { setShowInterventionBubble(false); setReplyMode(true); setReplyText(""); setReplyIsFromJumeau(false); setTimeout(() => replyInputRef.current?.focus(), 50); }}
                          style={{ height: 30, borderRadius: 8, padding: "0 14px", fontSize: 11, fontWeight: 600, cursor: "pointer", background: actionBtnSolidBg, border: `1px solid ${actionBtnBorder}`, color: actionColor, transition: "all 0.2s", whiteSpace: "nowrap" }}
                          onMouseEnter={e => { e.currentTarget.style.background = actionBtnHover; }}
                          onMouseLeave={e => { e.currentTarget.style.background = actionBtnSolidBg; }}>
                          Écrire un message de soutien
                        </button>
                      </div>
                    );
                  })()}

                  {/* Bloc Action — zone bravo victoire (bas Suivi) */}
                  {(() => {
                    const hasActiveAlert = (selectedPatient.emotional_status === "red_critical" || selectedPatient.emotional_status === "red_behavioral") && !alertBannerDismissed[selectedPatient.id];
                    const victoryFreshBottom = !!(selectedPatient.latest_victory && selectedPatient.victory_detected_at && (Date.now() - new Date(selectedPatient.victory_detected_at).getTime()) < 48 * 60 * 60 * 1000);
                    if (!victoryFreshBottom || hasActiveAlert || replyMode) return null;
                    const bState = bravoState[selectedPatient.id];
                    return (
                      <div style={{ borderTop: "1px solid rgba(16,185,129,0.22)", background: "rgba(10,10,12,0.97)", backdropFilter: "blur(12px)", padding: "12px 20px" }}>
                        {bState?.sent ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <CheckCircleSent />
                            <span style={{ fontSize: 12, color: emerald }}>Bravo envoyé à {selectedPatient.firstName} ✓</span>
                          </div>
                        ) : bState?.expanded ? (
                          <>
                            {bState.editing ? (
                              <textarea
                                value={bState.text}
                                onChange={e => setBravoState(prev => ({ ...prev, [selectedPatient.id]: { ...prev[selectedPatient.id], text: e.target.value } }))}
                                rows={3}
                                autoFocus
                                style={{ width: "100%", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "white", padding: "10px 14px", fontSize: 13, outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif", lineHeight: 1.6, marginBottom: 8 }}
                              />
                            ) : (
                              <p
                                style={{ margin: "0 0 8px", fontSize: 13, color: "#d4d4d8", lineHeight: 1.6, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 14px", cursor: "default", transition: "background 0.15s" }}
                                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
                                onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                              >{bState.text}</p>
                            )}
                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                              <button
                                onClick={() => bState.editing
                                  ? setBravoState(prev => ({ ...prev, [selectedPatient.id]: { ...prev[selectedPatient.id], editing: false } }))
                                  : setBravoState(prev => ({ ...prev, [selectedPatient.id]: { ...prev[selectedPatient.id], expanded: false } }))}
                                style={{ height: 34, borderRadius: 10, padding: "0 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}
                                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                                onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}>
                                Retour
                              </button>
                              {!bState.editing && !bState.sending && (
                                <button onClick={() => setBravoState(prev => ({ ...prev, [selectedPatient.id]: { ...prev[selectedPatient.id], editing: true } }))}
                                  style={{ height: 34, borderRadius: 10, padding: "0 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", fontSize: 11, cursor: "pointer", transition: "background 0.15s" }}
                                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                                  onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}>
                                  Modifier
                                </button>
                              )}
                              <button
                                onClick={() => { if (!bState.sending) void sendBravoMessage(selectedPatient.id, bState.text); }}
                                disabled={bState.sending}
                                style={{ height: 34, borderRadius: 10, padding: "0 16px", background: bState.sending ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.15)", border: `1px solid ${bState.sending ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.4)"}`, color: bState.sending ? "#64748b" : emerald, fontSize: 11, fontWeight: 700, cursor: bState.sending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" }}
                                onMouseEnter={e => { if (!bState.sending) e.currentTarget.style.background = "rgba(16,185,129,0.25)"; }}
                                onMouseLeave={e => { if (!bState.sending) e.currentTarget.style.background = "rgba(16,185,129,0.15)"; }}>
                                {bState.sending ? (
                                  <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-emerald-400" style={{ flexShrink: 0 }} />Envoi</>
                                ) : "Envoyer"}
                              </button>
                            </div>
                          </>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 12, color: "#64748b", flex: 1 }}>
                              Féliciter {selectedPatient.firstName} pour cette victoire
                            </span>
                            <button
                              onClick={() => void generateBravo(selectedPatient.id, selectedPatient.latest_victory ?? "")}
                              disabled={bState?.loading}
                              style={{ height: 34, borderRadius: 10, padding: "0 14px", fontSize: 11, fontWeight: 700, cursor: bState?.loading ? "not-allowed" : "pointer", border: "1px solid rgba(16,185,129,0.35)", background: bState?.loading ? "rgba(16,185,129,0.06)" : "rgba(16,185,129,0.1)", color: bState?.loading ? "#64748b" : emerald, display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s", whiteSpace: "nowrap" }}
                              onMouseEnter={e => { if (!bState?.loading) e.currentTarget.style.background = "rgba(16,185,129,0.2)"; }}
                              onMouseLeave={e => { if (!bState?.loading) e.currentTarget.style.background = "rgba(16,185,129,0.1)"; }}>
                              {bState?.loading ? (
                                <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-emerald-400" style={{ flexShrink: 0 }} />Génération</>
                              ) : "Générer un Bravo ✦"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Zone de réponse praticien */}
                  {replyMode && (() => {
                    const patIsRed = selectedPatient.emotional_status === "red_critical";
                    const accentColor = patIsRed ? coral : amber;
                    const accentBorder = patIsRed ? "rgba(244,63,94,0.2)" : "rgba(245,158,11,0.18)";
                    return (
                      <div style={{ borderTop: `1px solid ${accentBorder}`, background: "rgba(10,10,12,0.97)", backdropFilter: "blur(12px)", padding: "12px 20px" }}>
                        {replyIsFromJumeau && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: emerald, animation: "breathe 2s ease-in-out infinite" }} />
                            <span style={{ fontSize: 10, fontWeight: 700, color: emerald, textTransform: "uppercase", letterSpacing: "0.1em" }}>Rédigé par le Jumeau · À relire avant envoi</span>
                          </div>
                        )}
                        {replyGenerating ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0", color: "#64748b", fontSize: 12 }}>
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-emerald-400" style={{ flexShrink: 0 }} />
                            Le Jumeau rédige un message de soutien…
                          </div>
                        ) : (
                          <textarea
                            ref={replyInputRef}
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendSoutien(); } }}
                            placeholder="Écrivez votre message de soutien…"
                            rows={3}
                            style={{ width: "100%", borderRadius: 10, border: `1px solid ${replyIsFromJumeau ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.1)"}`, background: replyIsFromJumeau ? "rgba(16,185,129,0.04)" : "rgba(255,255,255,0.03)", color: "white", padding: "10px 14px", fontSize: 13, outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif", lineHeight: 1.6, marginBottom: 8 }}
                            onFocus={e => { e.target.style.borderColor = replyIsFromJumeau ? "rgba(16,185,129,0.45)" : "rgba(255,255,255,0.2)"; }}
                            onBlur={e => { e.target.style.borderColor = replyIsFromJumeau ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.1)"; }}
                          />
                        )}
                        {!replyGenerating && (
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button onClick={() => { setReplyMode(false); setReplyText(""); setReplyIsFromJumeau(false); }}
                              style={{ height: 30, borderRadius: 8, padding: "0 14px", fontSize: 11, fontWeight: 600, cursor: "pointer", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#64748b", transition: "all 0.2s" }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = "#94a3b8"; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#64748b"; }}>
                              Annuler
                            </button>
                            <button onClick={() => { if (!onboardingDemoMode) void sendSoutien(); }} disabled={!replyText.trim() || replySending || onboardingDemoMode}
                              style={{ height: 30, borderRadius: 8, padding: "0 16px", fontSize: 11, fontWeight: 700, cursor: replyText.trim() && !replySending && !onboardingDemoMode ? "pointer" : "not-allowed", background: replyText.trim() && !replySending && !onboardingDemoMode ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.03)", border: `1px solid ${replyText.trim() && !replySending && !onboardingDemoMode ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.06)"}`, color: replyText.trim() && !replySending && !onboardingDemoMode ? emerald : "#374151", transition: "all 0.2s" }}
                              onMouseEnter={e => { if (replyText.trim() && !replySending && !onboardingDemoMode) e.currentTarget.style.background = "rgba(16,185,129,0.25)"; }}
                              onMouseLeave={e => { if (replyText.trim() && !replySending && !onboardingDemoMode) e.currentTarget.style.background = "rgba(16,185,129,0.15)"; }}>
                              {onboardingDemoMode ? "Indisponible en démo" : replySending ? "Envoi" : "Envoyer →"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <p style={{ fontSize: 14, color: "#4b5563" }}>{loading ? "Chargement..." : "Sélectionnez un patient"}</p>
                </div>
              )}
            </div>}

            {/* Fiche patient */}
            <div style={{ overflowY: "auto", background: "#060908", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 16 }}>
              {selectedPatient ? (
                <>
                  {/* Identité */}
                  <div style={{ textAlign: "center", marginBottom: 16 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>{selectedPatient.firstName} {selectedPatient.lastName}</p>
                    {!(selectedPatient as RealPatient).is_test && (
                      <p style={{ margin: "2px 0 4px", fontSize: 12, color: "#64748b", filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>{onboardingDemoMode ? "patient@email.fr" : (selectedPatient as RealPatient).email}</p>
                    )}
                    <button onClick={() => openProfileModal()}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#4b5563", padding: "0 0 8px", display: "flex", alignItems: "center", gap: 4, margin: "0 auto", transition: "color 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.color = "#94a3b8"}
                      onMouseLeave={e => e.currentTarget.style.color = "#4b5563"}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Modifier le profil
                    </button>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 20, padding: "4px 12px", background: `${getStatusColor(selectedPatient.emotional_status)}15`, border: `1px solid ${getStatusColor(selectedPatient.emotional_status)}30` }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: getStatusColor(selectedPatient.emotional_status), display: "inline-block", flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: getStatusColor(selectedPatient.emotional_status), filter: discretMode ? "blur(4px)" : "none" }}>
                        {selectedPatient.emotional_insight || (!selectedPatient.emotional_status ? "En attente de données" : selectedPatient.emotional_status === "green" ? "Adhésion positive" : selectedPatient.emotional_status === "orange" ? "Vigilance modérée" : "Attention requise")}
                      </span>
                    </div>
                  </div>

                  {/* Métriques */}
                  <div style={{ marginBottom: 10, padding: "2px 0" }}>
                    {(() => {
                      const p = selectedPatient as RealPatient;
                      const isTest = p.is_test === true;
                      const lastActiveStr = onboardingDemoMode
                        ? ((p as unknown as { lastActive?: string }).lastActive ?? "Jamais")
                        : p.lastActive ? (() => {
                          const diff = Date.now() - new Date(p.lastActive).getTime();
                          const mins = Math.floor(diff / 60000);
                          const hours = Math.floor(diff / 3600000);
                          const days = Math.floor(diff / 86400000);
                          if (mins < 1) return "À l'instant";
                          if (mins < 60) return `Il y a ${mins}min`;
                          if (hours < 24) return `Il y a ${hours}h`;
                          return `Il y a ${days}j`;
                        })() : "Jamais";
                      const streak = p.streak ?? 0;
                      const sos = p.sosResolved ?? 0;
                      const sosEvts = p.sosEvents ?? [];
                      const toolNames: Record<string, string> = {
                        breathing: "Cohérence cardiaque", ancrage: "Ancrage sensoriel",
                        marche: "Marche consciente", manger: "Pleine conscience alimentaire",
                        body_scan: "Body scan", defusion: "Défusion cognitive",
                        ecriture: "Écriture cathartique", adaptive_coaching: "Coaching personnalisé",
                      };
                      return (
                        <>
                          {!isTest && [
                            { label: "Dernière connexion", value: lastActiveStr },
                            { label: "Assiduité", value: streak > 0 ? `${streak} jour${streak > 1 ? "s" : ""} actif${streak > 1 ? "s" : ""}` : "Aucune activité" },
                          ].map((item) => (
                            <div key={item.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                              <span style={{ fontSize: 11, color: "#64748b" }}>{item.label}</span>
                              <span style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 500 }}>{item.value}</span>
                            </div>
                          ))}
                          {/* Crises désamorcées ce mois + (i) popover */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 0, position: "relative" }}>
                            <span style={{ fontSize: 11, color: "#64748b" }}>Crises désamorcées</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <span style={{ fontSize: 11, color: sos > 0 ? emerald : "#e2e8f0", fontWeight: 500 }}>
                                {sos > 0 ? `${sos} ce mois` : "Aucune"}
                              </span>
                              {(() => {
                                // Popover : uniquement les crises réellement désamorcées (success + non pratique)
                                const resolvedCrisisEvts = sosEvts.filter(ev => ev.status === "success" && ev.origin === "crise");
                                if (resolvedCrisisEvts.length === 0) return null;
                                const renderRow = (ev: typeof sosEvts[number], idx: number, list: typeof sosEvts) => {
                                  const date = new Date(ev.triggered_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
                                  const context = ev.sos_context?.split(" | ")[0] ?? "–";
                                  const exercise = ev.tool_id ? (toolNames[ev.tool_id] ?? ev.tool_id) : "–";
                                  return (
                                    <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: idx < list.length - 1 ? 6 : 0, paddingBottom: idx < list.length - 1 ? 6 : 0, borderBottom: idx < list.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                                      <span style={{ fontSize: 9, marginTop: 2, color: emerald, flexShrink: 0 }}>●</span>
                                      <span style={{ fontSize: 10, color: "#64748b", whiteSpace: "nowrap", paddingTop: 1 }}>{date}</span>
                                      <span style={{ fontSize: 10, color: "#94a3b8", flex: 1 }}>
                                        <span style={{ color: "#cbd5e1", textTransform: "capitalize" }}>{context}</span>
                                        {exercise !== "–" && <><span style={{ color: "#475569" }}> → </span><span style={{ color: emerald }}>{exercise}</span></>}
                                      </span>
                                    </div>
                                  );
                                };
                                return (
                                  <div style={{ position: "relative" }}>
                                    <div className="sos-modal-trigger" style={{ position: "relative", display: "inline-block" }}>
                                      <button
                                        onClick={() => setOpenSosModal(p.id)}
                                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 0, opacity: 0.7, transition: "opacity 0.15s" }}
                                        onMouseEnter={e => { e.currentTarget.style.opacity = "1"; (e.currentTarget.nextElementSibling as HTMLElement | null)?.style && ((e.currentTarget.nextElementSibling as HTMLElement).style.opacity = "1"); }}
                                        onMouseLeave={e => { e.currentTarget.style.opacity = "0.7"; (e.currentTarget.nextElementSibling as HTMLElement | null)?.style && ((e.currentTarget.nextElementSibling as HTMLElement).style.opacity = "0"); }}
                                      >
                                        <InfoCircleIcon size={13} color={emerald} />
                                      </button>
                                      {/* Tooltip hover */}
                                      <div style={{ position: "absolute", right: 0, bottom: "calc(100% + 5px)", background: "#0f172a", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 6, padding: "4px 8px", fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap", pointerEvents: "none", opacity: 0, transition: "opacity 0.15s", zIndex: 100 }}>
                                        Voir le détail
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Alerte admin — uniquement les alertes nécessitant une action manuelle praticien.
                      Exclure :
                        - type "alert"                                   → behavioral ancien format, auto-expire via red_behavioral_until
                        - type "admin_alert" + alert_type "behavioral"   → behavioral nouveau format LLM, même règle
                        - type "admin_alert" + alert_type "behavioral_sos_intake" → détection comportementale intake vocal SOS,
                          signalée par la couleur ambre de la colonne gauche (pas besoin d'action manuelle supplémentaire)
                      Inclure : type "crisis" et type "admin_alert" + alert_type "identity_correction" / "critical_llm" / "rectification_request" */}
                  {/* ── Bloc rouge : alertes cliniques critiques (red_critical / critical_llm) ── */}
                  {(selectedPatient.admin_alerts?.filter(a => !a.seen && (a.type === "crisis" || (a.type === "admin_alert" && a.alert_type === "critical_llm"))).length ?? 0) > 0 && !onboardingDemoMode && (
                    <div style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.25)", borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <AlertIcon size={13} color={coral} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: coral }}>Action requise</span>
                      </div>
                      {selectedPatient.admin_alerts?.filter(a => !a.seen && (a.type === "crisis" || (a.type === "admin_alert" && a.alert_type === "critical_llm"))).map((alert, i) => (
                        <div key={i} style={{ marginBottom: 8 }}>
                          <p style={{ margin: "0 0 6px", fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                            {alert.type === "crisis" && alert.alert_type === "suicide" && "Le patient a exprimé des idées suicidaires."}
                            {alert.type === "crisis" && alert.alert_type === "medical" && "Urgence médicale signalée par le patient."}
                            {alert.type === "crisis" && alert.alert_type === "threat" && "Le patient a exprimé une menace envers autrui."}
                            {alert.type === "crisis" && alert.alert_type === "critical" && "Urgence vitale détectée (mots-clés)."}
                            {alert.type === "admin_alert" && alert.alert_type === "critical_llm" && "Détresse critique détectée par analyse IA, vérification recommandée."}
                          </p>
                          <LeverAlerteCritique alert={alert} patientId={selectedPatient.id} practitionerId={practitionerId ?? undefined} onResolved={() => {
                            setPatients(prev => prev.map(p => p.id === selectedPatient.id ? { ...p, emotional_status: "green", emotional_insight: undefined, admin_alerts: p.admin_alerts?.map(a => a === alert ? { ...a, seen: true } : a) } : p));
                          }} />
                        </div>
                      ))}
                    </div>
                  )}
                  {/* ── Bloc bleu : questions hors périmètre ── */}
                  {(selectedPatient.admin_alerts?.filter(a => !a.seen && a.type === "out_of_scope").length ?? 0) > 0 && !onboardingDemoMode && (
                    <div style={{ background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.22)", borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={SLATE_BLUE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <span style={{ fontSize: 11, fontWeight: 700, color: SLATE_BLUE }}>Question hors périmètre</span>
                      </div>
                      {selectedPatient.admin_alerts?.filter(a => !a.seen && a.type === "out_of_scope").map((alert, i) => {
                        const alertKey = `${selectedPatient.id}-${alert.date}`;
                        const replyS = outOfScopeReply[alertKey] ?? { expanded: false, text: "", sending: false };
                        return (
                          <div key={i} style={{ marginBottom: i < (selectedPatient.admin_alerts?.filter(a => !a.seen && a.type === "out_of_scope").length ?? 1) - 1 ? 10 : 0, paddingBottom: i < (selectedPatient.admin_alerts?.filter(a => !a.seen && a.type === "out_of_scope").length ?? 1) - 1 ? 10 : 0, borderBottom: i < (selectedPatient.admin_alerts?.filter(a => !a.seen && a.type === "out_of_scope").length ?? 1) - 1 ? "1px solid rgba(96,165,250,0.12)" : "none" }}>
                            {alert.question_snippet && (
                              <p style={{ margin: "0 0 5px", fontSize: 11, color: "#94a3b8", lineHeight: 1.5, fontStyle: "italic" }}>
                                &ldquo;{alert.question_snippet}{alert.question_snippet.length >= 150 ? "…" : ""}&rdquo;
                              </p>
                            )}
                            <p style={{ margin: "0 0 6px", fontSize: 10, color: "#4b5563" }}>
                              {new Date(alert.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </p>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              {alert.trigger_message_id && (
                                <button onClick={() => scrollToAlertMessage(alert)}
                                  style={{ fontSize: 11, fontWeight: 600, color: SLATE_BLUE, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
                                  Aller au message
                                </button>
                              )}
                              <button onClick={() => void markOutOfScopeSeen(selectedPatient.id, alert.date)}
                                style={{ fontSize: 11, color: "#64748b", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
                                Marquer comme vu
                              </button>
                              <button onClick={() => setOutOfScopeReply(prev => ({ ...prev, [alertKey]: { ...replyS, expanded: !replyS.expanded } }))}
                                style={{ fontSize: 11, fontWeight: 600, color: SLATE_BLUE, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
                                {replyS.expanded ? "Annuler" : "Répondre au patient"}
                              </button>
                            </div>
                            {replyS.expanded && (
                              <div style={{ marginTop: 8 }}>
                                <textarea
                                  value={replyS.text}
                                  onChange={e => setOutOfScopeReply(prev => ({ ...prev, [alertKey]: { ...replyS, text: e.target.value } }))}
                                  placeholder="Votre message au patient…"
                                  rows={2}
                                  style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(96,165,250,0.3)", background: "rgba(255,255,255,0.03)", color: "white", padding: "6px 8px", fontSize: 11, outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}
                                />
                                <button
                                  onClick={() => void sendOutOfScopeReply(selectedPatient.id, alert.date, replyS.text)}
                                  disabled={!replyS.text.trim() || replyS.sending}
                                  style={{ marginTop: 4, width: "100%", height: 28, borderRadius: 7, background: replyS.text.trim() ? "rgba(96,165,250,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${replyS.text.trim() ? "rgba(96,165,250,0.3)" : "rgba(255,255,255,0.06)"}`, color: replyS.text.trim() ? SLATE_BLUE : "#4b5563", fontSize: 11, fontWeight: 600, cursor: replyS.text.trim() ? "pointer" : "not-allowed", transition: "all 0.2s" }}>
                                  {replyS.sending ? "Envoi…" : "Envoyer"}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── Correction(s) en attente — discrète, intégrée dans "Modifier le profil" ── */}
                  {(selectedPatient.admin_alerts?.filter(a => !a.seen && a.type === "admin_alert" && (a.alert_type === "identity_correction" || a.alert_type === "rectification_request")).length ?? 0) > 0 && !onboardingDemoMode && (
                    <p style={{ margin: "0 0 10px", fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 5 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      <span style={{ color: "#f59e0b" }}>{selectedPatient.admin_alerts!.filter(a => !a.seen && a.type === "admin_alert" && (a.alert_type === "identity_correction" || a.alert_type === "rectification_request")).length} correction{(selectedPatient.admin_alerts!.filter(a => !a.seen && a.type === "admin_alert" && (a.alert_type === "identity_correction" || a.alert_type === "rectification_request")).length) > 1 ? "s" : ""} en attente</span>
                      <button onClick={() => openProfileModal()} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", textDecoration: "underline", fontSize: 11, padding: 0, marginLeft: 2 }}>Voir</button>
                    </p>
                  )}

                  {/* Murmures */}
                  <div data-tour="murmure" style={{ marginBottom: 16 }}>
                  <button onClick={() => setMurmuresCollapsed(p => !p)} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: emerald }}>Murmures</span>
                    <span style={{ fontSize: 10, color: emerald, opacity: 0.6, transition: "transform 0.2s", display: "inline-block", transform: murmuresCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>▾</span>
                  </button>
                  {!murmuresCollapsed && <div style={{ background: "rgba(16,185,129,0.05)", borderRadius: 10, border: "1px solid rgba(16,185,129,0.2)", padding: "10px 12px" }}>
                    {(() => {
                      const p = selectedPatient as RealPatient;
                      const murmures = (p.practitioner_instruction as { id: string; text: string; expires_at?: string | null; created_at: string }[]) ?? [];
                        if (murmures.length === 0) return <p style={{ margin: 0, fontSize: 11, color: "#4b5563" }}>Aucune consigne active</p>; 
                      return murmures.map(m => {
                        const isExpired = m.expires_at && new Date(m.expires_at) < new Date();
                        const isEditingThis = editingMurmureId === m.id;
                        return (
                          <div key={m.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                            {isEditingThis ? (
                              <>
                                <textarea value={editingMurmureText} onChange={e => setEditingMurmureText(e.target.value)} rows={2} autoFocus
                                  style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(255,255,255,0.03)", color: "white", padding: "6px 8px", fontSize: 11, outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }} />
                                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                                  <button onClick={() => void updateMurmure(m.id, editingMurmureText)}
                                    style={{ flex: 1, height: 24, borderRadius: 6, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: emerald, fontSize: 10, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.22)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; }}>Sauvegarder</button>
                                  <button onClick={() => { setEditingMurmureId(null); setEditingMurmureText(""); }}
                                    style={{ height: 24, borderRadius: 6, padding: "0 10px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b", fontSize: 10, cursor: "pointer", transition: "all 0.15s" }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "#94a3b8"; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#64748b"; }}>Annuler</button>
                                </div>
                              </>
                            ) : (
                              <p style={{ margin: "0 0 3px", fontSize: 11, color: isExpired ? "#64748b" : "#94a3b8", lineHeight: 1.5, textDecoration: isExpired ? "line-through" : "none", filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>{m.text}</p>
                            )}
                            {!isEditingThis && (
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <p style={{ margin: 0, fontSize: 10, color: isExpired ? "#f59e0b" : "#4b5563" }}>
                                  {isExpired ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><AlertIcon size={11} color="#f59e0b" />Expiré</span> : m.expires_at ? `Expire le ${new Date(m.expires_at).toLocaleDateString("fr-FR")}` : "Permanent"}
                                </p>
                                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                                    <button onClick={() => { if (!onboardingDemoMode) { setEditingMurmureId(m.id); setEditingMurmureText(m.text); } }}
                                      style={{ background: "none", border: "none", cursor: onboardingDemoMode ? "not-allowed" : "pointer", color: onboardingDemoMode ? "#2d3748" : "#4b5563", padding: 2, transition: "color 0.2s" }}
                                      onMouseEnter={e => { if (!onboardingDemoMode) e.currentTarget.style.color = "#94a3b8"; }}
                                      onMouseLeave={e => { if (!onboardingDemoMode) e.currentTarget.style.color = "#4b5563"; }}>
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                    </button>
                                    <button onClick={() => { if (!onboardingDemoMode) void deleteMurmure(m.id); }}
                                      style={{ background: "none", border: "none", cursor: onboardingDemoMode ? "not-allowed" : "pointer", color: onboardingDemoMode ? "#2d3748" : "#4b5563", padding: "0 2px", transition: "color 0.2s", fontSize: 18, lineHeight: 1 }}
                                      onMouseEnter={e => { if (!onboardingDemoMode) e.currentTarget.style.color = "#f87171"; }}
                                      onMouseLeave={e => { if (!onboardingDemoMode) e.currentTarget.style.color = "#4b5563"; }}>
                                      ×
                                    </button>
                                  </div>
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                      <button onClick={() => openMurmureModal()}
                        style={{ width: 28, height: 28, borderRadius: "50%", cursor: "pointer", border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.08)", color: emerald, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", flexShrink: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.08)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </button>
                    </div>
                    </div>}
                  </div>

                  {/* Notes privées */}
                  <div style={{ marginBottom: 16 }}>
                  <button onClick={() => setNotesCollapsed(p => !p)} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#94a3b8" }}>Notes privées</span>
                    <span style={{ fontSize: 10, color: "#94a3b8", opacity: 0.6, transition: "transform 0.2s", display: "inline-block", transform: notesCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>▾</span>
                  </button>
                  {!notesCollapsed && <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", padding: "10px 12px" }}>
                        {(() => {
                          const p = selectedPatient as RealPatient;
                          const notes = (p.private_notes as { id: string; text: string; created_at: string }[]) ?? [];
                          if (notes.length === 0) return <p style={{ margin: 0, fontSize: 11, color: "#4b5563" }}>Aucune note</p>;
                          return notes.map(n => {
                            const isEditingThis = editingNoteId === n.id;
                            return (
                              <div key={n.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                {isEditingThis ? (
                                  <>
                                    <textarea value={editingNoteText} onChange={e => setEditingNoteText(e.target.value)} rows={2} autoFocus
                                      style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.03)", color: "white", padding: "6px 8px", fontSize: 11, outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }} />
                                    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                                      <button onClick={() => void updateNote(n.id, editingNoteText)}
                                        style={{ flex: 1, height: 24, borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#94a3b8", fontSize: 10, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)"; e.currentTarget.style.color = "white"; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#94a3b8"; }}>Sauvegarder</button>
                                      <button onClick={() => { setEditingNoteId(null); setEditingNoteText(""); }}
                                        style={{ height: 24, borderRadius: 6, padding: "0 10px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b", fontSize: 10, cursor: "pointer", transition: "all 0.15s" }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "#94a3b8"; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#64748b"; }}>Annuler</button>
                                    </div>
                                  </>
                                ) : (
                                  <p style={{ margin: "0 0 3px", fontSize: 11, color: "#94a3b8", lineHeight: 1.5, filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>{n.text}</p>
                                )}
                                {!isEditingThis && (
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <p style={{ margin: 0, fontSize: 10, color: "#4b5563" }}>{new Date(n.created_at).toLocaleDateString("fr-FR")}</p>
                                    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                                      <button onClick={() => { if (!onboardingDemoMode) { setEditingNoteId(n.id); setEditingNoteText(n.text); } }}
                                        style={{ background: "none", border: "none", cursor: onboardingDemoMode ? "not-allowed" : "pointer", color: onboardingDemoMode ? "#2d3748" : "#4b5563", padding: 2, transition: "color 0.2s" }}
                                        onMouseEnter={e => { if (!onboardingDemoMode) e.currentTarget.style.color = "#94a3b8"; }}
                                        onMouseLeave={e => { if (!onboardingDemoMode) e.currentTarget.style.color = "#4b5563"; }}>
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                      </button>
                                      <button onClick={() => { if (!onboardingDemoMode) void deleteNote(n.id); }}
                                        style={{ background: "none", border: "none", cursor: onboardingDemoMode ? "not-allowed" : "pointer", color: onboardingDemoMode ? "#2d3748" : "#4b5563", padding: "0 2px", transition: "color 0.2s", fontSize: 18, lineHeight: 1 }}
                                        onMouseEnter={e => { if (!onboardingDemoMode) e.currentTarget.style.color = "#f87171"; }}
                                        onMouseLeave={e => { if (!onboardingDemoMode) e.currentTarget.style.color = "#4b5563"; }}>
                                        ×
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          });
                        })()}
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                          <button onClick={() => { setNewNoteText(""); setShowNoteModal(true); }}
                            style={{ width: 28, height: 28, borderRadius: "50%", cursor: "pointer", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", flexShrink: 0 }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.13)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.30)"; e.currentTarget.style.color = "white"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "#94a3b8"; }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          </button>
                        </div>
                      </div>}
                  </div>

                  {/* Documents */}
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ margin: "0 0 6px", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#60a5fa" }}>Documents</p>
                    <button onClick={() => { setPatientDocFiles([]); setPatientDocErrors([]); setPatientDocSuccess([]); setShowPatientDocModal(true); }}
                        style={{ width: "100%", height: 36, borderRadius: 8, background: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.18)", color: "#60a5fa", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(96,165,250,0.1)"; e.currentTarget.style.borderColor = "rgba(96,165,250,0.35)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(96,165,250,0.04)"; e.currentTarget.style.borderColor = "rgba(96,165,250,0.18)"; }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                        Gérer mes documents
                      </button>
                  </div>

                  {/* Analyses IA */}
                  <div data-tour="rapport" style={{ marginBottom: 16 }}>
                    <p style={{ margin: "0 0 8px", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#818cf8" }}>Analyses IA</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button onClick={() => { setBilanContent(""); setShowBilanModal(true); }}
                        style={{ height: 36, borderRadius: 8, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)", color: "#818cf8", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.15)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.4)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(99,102,241,0.08)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.25)"; }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                        Préparer ma séance
                      </button>
                      <button onClick={() => { setShowReportModal(true); setReportContent(""); }}
                        style={{ height: 36, borderRadius: 8, background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.15)", color: "#818cf8", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.12)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.3)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(99,102,241,0.04)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.15)"; }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        Rapport IA
                      </button>
                    </div>
                  </div>

                  {/* Renvoyer invitation */}
                  {!onboardingDemoMode && selectedPatient && !(selectedPatient as RealPatient).email?.includes("demo") && (
                    (() => {
                      const p = selectedPatient as RealPatient;
                      // Bouton visible uniquement si le patient n'a pas encore créé son mot de passe
                      const notActivated = !p.onboardingCompleted && p.onboardingStatus !== "password_set";
                      if (!notActivated) return null;
                      if (resentInvite) return (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", margin: "8px auto 0" }}>
                          <CheckCircleSent />
                        </div>
                      );
                      return (
                        <button onClick={async () => {
                          if (!p.email || !practitionerId || resentInviteLoading) return;
                          setResentInviteLoading(true);
                          await fetch("/api/invite-patient", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: p.email, practitionerId }) });
                          setResentInviteLoading(false);
                          setResentInvite(true);
                          setTimeout(() => setResentInvite(false), 5000);
                        }}
                          style={{ background: "none", border: "none", cursor: resentInviteLoading ? "not-allowed" : "pointer", fontSize: 11, color: "#4b5563", textDecoration: "underline", padding: "4px 0", display: "flex", alignItems: "center", gap: 6, margin: "8px auto 0", transition: "color 0.2s", opacity: resentInviteLoading ? 0.7 : 1 }}
                          onMouseEnter={e => { if (!resentInviteLoading) e.currentTarget.style.color = "#94a3b8"; }}
                          onMouseLeave={e => { if (!resentInviteLoading) e.currentTarget.style.color = "#4b5563"; }}>
                          {resentInviteLoading && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" style={{ flexShrink: 0 }} />}
                          {resentInviteLoading ? "Envoi en cours" : "Renvoyer le lien d'invitation"}
                        </button>
                      );
                    })()
                  )}

                  {/* Supprimer le patient — masqué pour les patients test (ils ont leur propre flux de suppression dans le panneau mode test) */}
                  {!onboardingDemoMode && selectedPatient && !(selectedPatient as RealPatient).email?.includes("demo") && !(selectedPatient as RealPatient).is_test && (
                    <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                      <button
                        onClick={() => setShowDeletePatientModal(true)}
                        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#f87171", padding: "4px 0", display: "flex", alignItems: "center", justifyContent: "center", transition: "color 0.2s" }}
                        onMouseEnter={e => { e.currentTarget.style.color = "#fca5a5"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "#f87171"; }}
                      >
                        Supprimer le patient
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                  <p style={{ fontSize: 13, color: "#4b5563" }}>Sélectionnez un patient</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "vue_ensemble" && (
          <div>
            {onboardingDemoMode && !testMode && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, height: 38, borderRadius: 10, background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)", padding: "0 20px" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#8b5cf6", flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", letterSpacing: "0.06em", textTransform: "uppercase" }}>Mode démo</span>
                  <span style={{ fontSize: 11, color: "#c4b5fd" }}>Aperçu simulé de l&apos;expérience praticien. Invitez votre premier patient pour commencer.</span>
                </div>
              </div>
            )}
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>Vue d'ensemble</h2>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>Suivi en cours · Statut IA mis à jour à chaque message</p>

              {/* KPI blocks */}
              {(() => {
                const crises = onboardingDemoMode ? 3 : (monthlyStats?.sos_resolutions ?? 0);
                const messages = onboardingDemoMode ? 92 : (monthlyStats?.messages_geres ?? 0);
                const heures = onboardingDemoMode ? 14 : (monthlyStats?.temps_economise_heures ?? 0);
                const totalMinutes = Math.round(heures * 60);
                const displayTime = totalMinutes < 60
                  ? `${totalMinutes} min`
                  : `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60 > 0 ? `${totalMinutes % 60}min` : ""}`.trim();
                const tauxApaisement = onboardingDemoMode ? 85 : (monthlyStats?.taux_apaisement ?? null);
                const crisisAvant = onboardingDemoMode ? "Submergé(e)" : (monthlyStats?.top_crisis_context ?? null);
                return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
                <div style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 16, padding: 20 }}>
                  <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Taux d'Apaisement Moyen</p>
                  {tauxApaisement !== null ? (
                    <>
                      <p style={{ margin: "0 0 14px", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                        <span style={{ fontSize: 48, fontWeight: 900, color: emerald }}>{tauxApaisement}</span>
                        <span style={{ fontSize: 22, fontWeight: 700, color: emerald }}>%</span>
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, background: "rgba(244,63,94,0.08)", borderRadius: 8, padding: "7px 10px" }}>
                          <p style={{ margin: "0 0 3px", fontSize: 10, color: "#64748b" }}>Avant</p>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: coral, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {crisisAvant || "En détresse"}
                          </p>
                        </div>
                        <span style={{ color: "#475569", fontSize: 14, flexShrink: 0 }}>→</span>
                        <div style={{ flex: 1, background: "rgba(16,185,129,0.08)", borderRadius: 8, padding: "7px 10px" }}>
                          <p style={{ margin: "0 0 3px", fontSize: 10, color: "#64748b" }}>Après</p>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: emerald }}>Apaisé(e)</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: "0 0 14px", lineHeight: 1 }}>
                        <span style={{ fontSize: 36, fontWeight: 900, color: "#475569" }}>—</span>
                      </p>
                      <div style={{ background: "rgba(16,185,129,0.08)", borderRadius: 8, padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, color: "#64748b" }}>Données insuffisantes</span>
                      </div>
                    </>
                  )}
                </div>
                <div style={{ background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 16, padding: 20 }}>
                  <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Crises apaisées</p>
                  <p style={{ margin: "0 0 4px", fontSize: 48, fontWeight: 900, color: "#818cf8", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{crises}</p>
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b" }}>En toute autonomie</p>
                  <div style={{ background: "rgba(99,102,241,0.08)", borderRadius: 8, padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <ShieldIcon size={13} color="#818cf8" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8" }}>Sans votre intervention</span>
                  </div>
                </div>
                <div style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 16, padding: 20 }}>
                  <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Messages traités par votre Jumeau</p>
                  <p style={{ margin: "0 0 4px", fontSize: 48, fontWeight: 900, color: amber, lineHeight: 1 }}>{messages}</p>
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b" }}>messages gérés</p>
                  <div style={{ background: "rgba(245,158,11,0.08)", borderRadius: 8, padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <ClockIcon size={13} color={amber} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: amber }}>{displayTime} libérées</span>
                  </div>
                </div>
              </div>
                );
              })()}
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 20 }} />

              {/* Barre de filtres */}
              <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "#64748b", alignSelf: "center", marginRight: 4 }}>Filtrer par :</span>
                {([
                  { key: "tous", label: "Tous" },
                  { key: "alertes", label: "Alertes" },
                  { key: "victoires", label: "Victoires" },
                  { key: "ras", label: "RAS" },
                ] as { key: "tous" | "alertes" | "victoires" | "ras"; label: string }[]).map(f => (
                  <button key={f.key} onClick={() => setVueEnsembleFilter(f.key)}
                    style={{ height: 28, borderRadius: 20, padding: "0 14px", fontSize: 11, fontWeight: 600, cursor: "pointer", border: vueEnsembleFilter === f.key ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.06)", background: vueEnsembleFilter === f.key ? "rgba(255,255,255,0.08)" : "transparent", color: vueEnsembleFilter === f.key ? "white" : "#64748b", transition: "all 0.2s" }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {displayedPatients.length === 0 ? (
              <p style={{ textAlign: "center", color: "#64748b", marginTop: 60 }}>Aucun patient</p>
            ) : (() => {
              // Tri : red_critical > red_behavioral > green > en attente (null)
              const sorted = [...displayedPatients].sort((a, b) => {
                const order: Record<string, number> = { red_critical: 0, red_behavioral: 1, green: 2 };
                const ao = a.emotional_status ? (order[a.emotional_status] ?? 3) : 3;
                const bo = b.emotional_status ? (order[b.emotional_status] ?? 3) : 3;
                if (ao !== bo) return ao - bo;
                // À égalité de statut, ceux avec victoire fraîche avant ceux sans
                if (isVictoryFresh(a) && !isVictoryFresh(b)) return -1;
                if (!isVictoryFresh(a) && isVictoryFresh(b)) return 1;
                return 0;
              });

              // Filtre — "partages" injecte les dossiers partagés du cabinet
              const filtered = vueEnsembleFilter === "partages"
                ? cabinetSharedPatients
                : sorted.filter(p => {
                    if (vueEnsembleFilter === "tous") return true;
                    if (vueEnsembleFilter === "alertes") return p.emotional_status === "red_critical" || p.emotional_status === "red_behavioral";
                    if (vueEnsembleFilter === "victoires") return isVictoryFresh(p) && p.emotional_status === "green";
                    if (vueEnsembleFilter === "ras") return (!p.emotional_status || p.emotional_status === "green") && !isVictoryFresh(p);
                    return true;
                  });

              if (filtered.length === 0) return <p style={{ textAlign: "center", color: "#64748b", marginTop: 40 }}>{vueEnsembleFilter === "partages" ? "Aucun dossier partagé dans votre cabinet pour l'instant." : "Aucun patient dans cette catégorie"}</p>;

              return (
                <div data-tour="radar" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                  {filtered.map((patient) => {
                    const isCritical = patient.emotional_status === "red_critical";
                    const isBehavioral = patient.emotional_status === "red_behavioral";
                    const hasAlert = isCritical || isBehavioral;
                    const hasVictory = isVictoryFresh(patient) && !hasAlert;
                    const hasIdentityAlertGrid = !hasAlert && (patient.admin_alerts ?? []).some((a: { type?: string; alert_type?: string; seen?: boolean }) => !a.seen && a.type === "admin_alert" && (a.alert_type === "identity_correction" || a.alert_type === "rectification_request"));
                    const bState = bravoState[patient.id];

                    // Couleurs de la carte
                    let cardBg = "rgba(255,255,255,0.02)";
                    let cardBorder = "rgba(255,255,255,0.07)";
                    let cardShadow = "none";
                    if (isCritical) { cardBg = "rgba(239,68,68,0.04)"; cardBorder = "rgba(239,68,68,0.25)"; cardShadow = "0 0 16px rgba(239,68,68,0.10)"; }
                    else if (isBehavioral) { cardBg = "rgba(245,158,11,0.03)"; cardBorder = "rgba(245,158,11,0.22)"; cardShadow = "0 0 12px rgba(245,158,11,0.08)"; }
                    else if (hasIdentityAlertGrid) { cardBg = "rgba(96,165,250,0.03)"; cardBorder = "rgba(96,165,250,0.18)"; }
                    else if (hasVictory) { cardBg = "rgba(16,185,129,0.02)"; cardBorder = "rgba(16,185,129,0.15)"; }

                    const alertColor = isCritical ? RED_CRITICAL_COLOR : ORANGE_BEHAVIORAL;

                    return (
                      <div key={patient.id}
                        style={{ borderRadius: 16, padding: "18px 20px", background: cardBg, border: `1px solid ${cardBorder}`, boxShadow: cardShadow, transition: "all 0.3s", animation: isCritical ? "criticalPulse 2s ease-in-out infinite" : "none", cursor: "pointer" }}
                        onClick={(e) => {
                          // Clic sur la carte → aller au patient dans Suivi (sauf si clic sur un bouton enfant)
                          if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("textarea")) return;
                          setSelectedPatientId(patient.id); navigateTab("patients"); setShowInterventionBubble(false);
                        }}>
                        {/* Header carte */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: hasAlert || hasVictory ? 12 : 0 }}>
                          <div style={{ width: 38, height: 38, borderRadius: "50%", background: patient.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "white", flexShrink: 0, filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>{patient.initials}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "white", filter: discretMode ? "blur(4px)" : "none" }}>{patient.firstName} {patient.lastName}</p>
                            {patient.emotional_insight && (
                              <p style={{ margin: "2px 0 0", fontSize: 11, color: hasAlert ? alertColor : "#94a3b8", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", filter: discretMode ? "blur(4px)" : "none" }}>
                                {patient.emotional_insight}
                              </p>
                            )}
                          </div>
                          {hasVictory && <span style={{ fontSize: 14, flexShrink: 0, alignSelf: "flex-start" }} title={patient.latest_victory}>🏆</span>}
                          {hasIdentityAlertGrid && <span style={{ fontSize: 10, fontWeight: 600, color: SLATE_BLUE, background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 6, padding: "2px 6px", flexShrink: 0, alignSelf: "flex-start", whiteSpace: "nowrap" }}>Correction nom</span>}
                        </div>

                        {/* Contenu selon statut */}
                        {hasAlert && (
                          <>
                            {/* Motif de crise — cliquable pour les behavioral → scroll vers message déclencheur */}
                            <p
                              onClick={isBehavioral ? (e) => {
                                e.stopPropagation();
                                const alert = patient.admin_alerts?.[0];
                                setSelectedPatientId(patient.id);
                                navigateTab("patients");
                                setShowInterventionBubble(false);
                                if (alert?.trigger_message_id) setPendingScrollMessageId(alert.trigger_message_id);
                                else if (alert?.date) setPendingScrollMessageId(alert.date);
                              } : undefined}
                              style={{ margin: "0 0 10px", fontSize: 12, color: alertColor, lineHeight: 1.5, filter: discretMode ? "blur(4px)" : "none", cursor: isBehavioral ? "pointer" : "default", textDecoration: isBehavioral ? "underline dotted" : "none" }}>
                              {patient.emotional_insight || (isCritical ? "Intervention immédiate requise" : "Point de vigilance détecté")}
                            </p>
                            <button onClick={(e) => { e.stopPropagation(); setSelectedPatientId(patient.id); navigateTab("patients"); setShowInterventionBubble(false); }}
                              style={{ height: 30, borderRadius: 8, padding: "0 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", border: `1px solid ${isCritical ? "rgba(244,63,94,0.4)" : "rgba(245,158,11,0.4)"}`, background: isCritical ? "rgba(244,63,94,0.12)" : "rgba(245,158,11,0.1)", color: alertColor, transition: "all 0.2s" }}
                              onMouseEnter={e => { e.currentTarget.style.background = isCritical ? "rgba(244,63,94,0.22)" : "rgba(245,158,11,0.2)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = isCritical ? "rgba(244,63,94,0.12)" : "rgba(245,158,11,0.1)"; }}>
                              {isCritical ? "Traiter l'urgence →" : "Prendre des nouvelles →"}
                            </button>
                          </>
                        )}

                        {hasVictory && (
                          <>
                            {/* Victoire — cliquable → scroll vers le message du succès */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPatientId(patient.id);
                                navigateTab("patients");
                                if (patient.victory_message_id) setPendingScrollMessageId(patient.victory_message_id);
                                else if (patient.victory_detected_at) setPendingScrollMessageId(patient.victory_detected_at);
                              }}
                              style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, cursor: "pointer" }}>
                              <p style={{ margin: 0, fontSize: 12, color: emerald, lineHeight: 1.5, filter: discretMode ? "blur(4px)" : "none", textDecoration: "underline dotted" }}>{patient.latest_victory}</p>
                            </div>

                            {bState?.sent ? (
                              <CheckCircleSent />
                            ) : bState?.expanded ? (
                              /* Zone bravo inline */
                              <div onClick={e => e.stopPropagation()} style={{ marginTop: 8 }}>
                                {bState.editing ? (
                                  <textarea
                                    value={bState.text}
                                    onChange={e => setBravoState(prev => ({ ...prev, [patient.id]: { ...prev[patient.id], text: e.target.value } }))}
                                    rows={3}
                                    autoFocus
                                    style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "white", padding: "8px 10px", fontSize: 12, outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif", lineHeight: 1.5, marginBottom: 6 }}
                                  />
                                ) : (
                                  <p
                                    style={{ margin: "0 0 8px", fontSize: 12, color: "#d4d4d8", lineHeight: 1.6, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 10px", transition: "background 0.15s", cursor: "default" }}
                                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
                                    onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                                  >{bState.text}</p>
                                )}
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    onClick={() => bState.editing
                                      ? setBravoState(prev => ({ ...prev, [patient.id]: { ...prev[patient.id], editing: false } }))
                                      : setBravoState(prev => ({ ...prev, [patient.id]: { ...prev[patient.id], expanded: false } }))}
                                    style={{ flex: 1, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}
                                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                                    onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}>
                                    Retour
                                  </button>
                                  {!bState.editing && !bState.sending && (
                                    <button onClick={() => setBravoState(prev => ({ ...prev, [patient.id]: { ...prev[patient.id], editing: true } }))}
                                      style={{ flex: 1, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", fontSize: 11, cursor: "pointer", transition: "background 0.15s" }}
                                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                                      onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}>
                                      Modifier
                                    </button>
                                  )}
                                  <button
                                    onClick={() => { if (!bState.sending) void sendBravoMessage(patient.id, bState.text); }}
                                    disabled={bState.sending}
                                    style={{ flex: 2, height: 34, borderRadius: 10, background: bState.sending ? "rgba(16,185,129,0.5)" : emerald, border: "none", color: "black", fontSize: 11, fontWeight: 700, cursor: bState.sending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "background 0.15s" }}>
                                    {bState.sending ? (
                                      <><span className="h-3 w-3 animate-spin rounded-full border-2 border-black/20 border-t-black/60" style={{ flexShrink: 0 }} />Envoi</>
                                    ) : "Envoyer"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); void generateBravo(patient.id, patient.latest_victory ?? ""); }}
                                disabled={bState?.loading}
                                style={{ height: 34, borderRadius: 10, padding: "0 14px", fontSize: 11, fontWeight: 700, cursor: bState?.loading ? "not-allowed" : "pointer", border: "1px solid rgba(16,185,129,0.35)", background: bState?.loading ? "rgba(16,185,129,0.06)" : "rgba(16,185,129,0.1)", color: bState?.loading ? "#64748b" : emerald, display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" }}
                                onMouseEnter={e => { if (!bState?.loading) e.currentTarget.style.background = "rgba(16,185,129,0.2)"; }}
                                onMouseLeave={e => { if (!bState?.loading) e.currentTarget.style.background = "rgba(16,185,129,0.1)"; }}>
                                {bState?.loading ? (
                                  <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-emerald-400" style={{ flexShrink: 0 }} />Génération</>
                                ) : "Générer un Bravo ✦"}
                              </button>
                            )}
                          </>
                        )}

                        {/* RAS — métriques légères uniquement */}
                        {!hasAlert && !hasVictory && (
                          <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                            <div>
                              <p style={{ margin: 0, fontSize: 10, color: "#4b5563" }}>Messages cette semaine</p>
                              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#94a3b8" }}>{patient.totalMessages}</p>
                            </div>
                            {(patient as RealPatient).objectif_clinique &&
                              (patient as RealPatient).objectif_clinique !== "Aucune" && (
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: 10, color: "#4b5563" }}>Objectif clinique</p>
                                <p style={{ margin: 0, fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(patient as RealPatient).objectif_clinique}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <style>{`
              @keyframes criticalPulse {
                0%, 100% { box-shadow: 0 0 28px rgba(244,63,94,0.2); }
                50% { box-shadow: 0 0 44px rgba(244,63,94,0.45); }
              }
            `}</style>
          </div>
        )}
      </main>

      {/* ═══ MODALES ═══ */}

      {/* ── Modale : Crises désamorcées ── */}
      {openSosModal && (() => {
        const modalPatient = patients.find(p => p.id === openSosModal);
        const modalSosEvts = (modalPatient?.sosEvents ?? []).filter(ev => ev.status === "success" && ev.origin === "crise");
        const toolNames: Record<string, string> = {
          breathing: "Cohérence cardiaque", ancrage: "Ancrage sensoriel",
          manger: "Pleine conscience alimentaire", restructuration: "Restructuration cognitive",
          defusion: "Défusion cognitive", ecriture: "Écriture cathartique",
        };
        return (
          <div
            onClick={e => { if (e.target === e.currentTarget) setOpenSosModal(null); }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          >
            <div style={{ background: "#0d0d0d", borderRadius: 20, width: "100%", maxWidth: 520, border: "1px solid rgba(16,185,129,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.8)", overflow: "hidden" }}>
              {/* Header */}
              <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={emerald} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "white" }}>Crises désamorcées</p>
                    <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>{modalPatient?.firstName} {modalPatient?.lastName} · Ce mois</p>
                  </div>
                </div>
                <button onClick={() => setOpenSosModal(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#64748b", transition: "color 0.15s" }} onMouseEnter={e => { e.currentTarget.style.color = "white"; }} onMouseLeave={e => { e.currentTarget.style.color = "#64748b"; }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              {/* Corps */}
              <div style={{ maxHeight: "60vh", overflowY: "auto", padding: "8px 0" }}>
                {modalSosEvts.length === 0 ? (
                  <p style={{ textAlign: "center", fontSize: 13, color: "#64748b", padding: "32px 24px" }}>Aucune crise désamorcée ce mois.</p>
                ) : modalSosEvts.map((ev, idx) => {
                  const date = new Date(ev.triggered_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
                  const time = new Date(ev.triggered_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                  const context = ev.sos_context?.split(" | ")[0]?.trim() ?? "–";
                  const exercise = ev.tool_id ? (toolNames[ev.tool_id] ?? ev.tool_id) : "Exercice SOS vocal";
                  const hasSummary = !!ev.summary_text;
                  return (
                    <div key={idx} style={{ padding: "16px 24px", borderBottom: idx < modalSosEvts.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                      {/* En-tête de l'événement */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: hasSummary ? 10 : 0 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: emerald, flexShrink: 0, marginTop: 1 }} />
                        <span style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" }}>{date} à {time}</span>
                        <span style={{ fontSize: 11, color: emerald, fontWeight: 600, marginLeft: "auto", whiteSpace: "nowrap" }}>{exercise}</span>
                      </div>
                      {/* Note clinique narrative */}
                      {hasSummary ? (
                        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.82)", lineHeight: 1.7, paddingLeft: 14 }}>{ev.summary_text}</p>
                      ) : (
                        // Fallback pré-summary_text : contexte brut
                        <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.6, paddingLeft: 14, fontStyle: "italic" }}>
                          {context !== "–" ? `Contexte : ${context}` : "Détail non disponible pour cette session."}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {showPinModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowPinModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 20, padding: 32, width: "100%", maxWidth: 360, border: `1px solid rgba(245,158,11,0.3)`, boxShadow: "0 20px 60px rgba(0,0,0,0.8)", textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke={amber} strokeWidth="1.8"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke={amber} strokeWidth="1.8" strokeLinecap="round"/></svg>
            </div>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "white" }}>Mode discret</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>Entrez votre code PIN pour désactiver</p>
            <input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") verifyPin(); }} placeholder="Code PIN" maxLength={6} autoFocus
              style={{ width: "100%", height: 52, borderRadius: 12, border: `1px solid ${pinError ? "rgba(244,63,94,0.5)" : "rgba(255,255,255,0.1)"}`, background: "#161616", color: "white", padding: "0 16px", fontSize: 20, outline: "none", boxSizing: "border-box", textAlign: "center", letterSpacing: "0.3em", fontFamily: "monospace", marginBottom: 8 }} />
            {pinError && <p style={{ margin: "0 0 12px", fontSize: 13, color: "#f87171" }}>{pinError}</p>}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setShowPinModal(false)} style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500 }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>Annuler</button>
              <button onClick={verifyPin} style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: amber, fontSize: 14, fontWeight: 600, cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,158,11,0.2)"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(245,158,11,0.12)"; }}>Déverrouiller</button>
            </div>
          </div>
        </div>
      )}

      {showLogoutModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowLogoutModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, border: "1px solid rgba(244,63,94,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round"/><polyline points="16,17 21,12 16,7" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="21" y1="12" x2="9" y2="12" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: "white" }}>Se déconnecter ?</h2>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "#64748b" }}>Vous devrez vous reconnecter pour accéder à votre dashboard.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowLogoutModal(false)} style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500 }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>Annuler</button>
              <button onClick={async (e) => { e.currentTarget.innerHTML = '<span class="flex items-center justify-center gap-2"><span class="h-4 w-4 animate-spin rounded-full border-2 border-red-500/20 border-t-red-400"></span>Déconnexion</span>'; const s = createSupabaseBrowserClient(); await s.auth.signOut(); window.location.href = "/login"; }} style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#f87171", fontSize: 14, fontWeight: 600, cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(244,63,94,0.15)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.35)"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(244,63,94,0.08)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.2)"; }}>Se déconnecter</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale suppression compte (globale) ── */}
      {showDeleteConfirm && (
        <div onClick={() => setShowDeleteConfirm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 65, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0d0d0d", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, border: "1px solid rgba(244,63,94,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: "white" }}>Supprimer mon compte ?</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b", lineHeight: 1.7 }}>
              Cette action est <strong style={{ color: "white" }}>irréversible</strong>.<br />
              Votre abonnement sera résilié et votre compte ainsi que vos données supprimés sous <strong style={{ color: "white" }}>30 jours</strong>.
            </p>
            {deleteRequestSent ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <p style={{ margin: 0, fontSize: 13, color: "#10b981", fontWeight: 600 }}>Demande envoyée</p>
                </div>
                <p style={{ margin: "0 0 18px", fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>Un email de confirmation vous a été envoyé. Votre compte sera supprimé sous 30 jours.</p>
                <button onClick={() => setShowDeleteConfirm(false)}
                  style={{ width: "100%", height: 42, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500 }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>
                  Fermer
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowDeleteConfirm(false)}
                  style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500 }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>
                  Annuler
                </button>
                <button onClick={() => void handleDeleteAccountRequest()} disabled={deleteRequestLoading}
                  style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#f87171", fontSize: 14, fontWeight: 600, cursor: deleteRequestLoading ? "default" : "pointer", opacity: deleteRequestLoading ? 0.7 : 1 }}
                  onMouseEnter={e => { if (!deleteRequestLoading) { e.currentTarget.style.background = "rgba(244,63,94,0.15)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.35)"; } }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(244,63,94,0.08)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.2)"; }}>
                  {deleteRequestLoading ? "Envoi…" : "Confirmer"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showEmailConfirmModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowEmailConfirmModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: "white" }}>Modifier votre adresse email ?</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
              Un lien de confirmation sera envoyé à <strong style={{ color: "white" }}>{newEmail}</strong>. Cliquez dessus pour valider le changement.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowEmailConfirmModal(false)}
                style={{ flex: 1, height: 42, borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Annuler
              </button>
              <button onClick={async () => {
                setShowEmailConfirmModal(false);
                setChangingEmail(true);
                try {
                  const s = createSupabaseBrowserClient();
                  const { error } = await s.auth.updateUser({ email: newEmail });
                  if (error) { setEmailChangeError(error.message); setChangingEmail(false); return; }
                  setEmailChangeSent(true);
                  setShowEmailChange(false);
                } catch { setEmailChangeError("Une erreur est survenue."); }
                setChangingEmail(false);
              }} style={{ flex: 1, height: 42, borderRadius: 12, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Mettre à jour
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeletePatientModal && selectedPatientId && (
        <div onClick={e => { if (e.target === e.currentTarget && !deletingPatient) setShowDeletePatientModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, border: "1px solid rgba(244,63,94,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><polyline points="3,6 5,6 21,6" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: "white" }}>{(selectedPatient as RealPatient)?.is_test ? "Supprimer ce patient test ?" : "Retirer ce patient ?"}</h2>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>L'accès au chat sera désactivé et le patient disparaîtra de votre liste.</p>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 14px", marginBottom: 20, textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
                <span style={{ color: "#94a3b8", fontWeight: 600 }}>Données conservées.</span> Conformément au RGPD, l'historique du suivi est conservé. Si le patient demande explicitement la suppression de ses données, contactez-nous par email.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowDeletePatientModal(false)} disabled={deletingPatient} style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: deletingPatient ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 500, opacity: deletingPatient ? 0.5 : 1, transition: "all 0.2s" }} onMouseEnter={e => { if (!deletingPatient) { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "white"; } }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#94a3b8"; }}>Annuler</button>
              <button onClick={() => void removePatient(selectedPatientId)} disabled={deletingPatient} style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#f87171", fontSize: 14, fontWeight: 600, cursor: deletingPatient ? "not-allowed" : "pointer", opacity: deletingPatient ? 0.7 : 1, transition: "all 0.2s" }} onMouseEnter={e => { if (!deletingPatient) { e.currentTarget.style.background = "rgba(244,63,94,0.15)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.35)"; } }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(244,63,94,0.08)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.2)"; }}>
                {deletingPatient ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-red-500/20 border-t-red-400" />Suppression</span> : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Modale suppression patient test ═══ */}
      {showDeleteTestPatientModal && selectedPatientId && (
        <div onClick={e => { if (e.target === e.currentTarget && !deletingTestPatient) setShowDeleteTestPatientModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, border: "1px solid rgba(244,63,94,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><polyline points="3,6 5,6 21,6" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: "white" }}>Supprimer ce profil de test ?</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
              Le compte, le profil et l'historique de conversation seront définitivement supprimés.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowDeleteTestPatientModal(false)}
                disabled={deletingTestPatient}
                style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: deletingTestPatient ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 500, opacity: deletingTestPatient ? 0.5 : 1, transition: "all 0.2s" }}
                onMouseEnter={e => { if (!deletingTestPatient) { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; } }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}
              >Annuler</button>
              <button
                onClick={() => void removeTestPatient(selectedPatientId)}
                disabled={deletingTestPatient}
                style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#f87171", fontSize: 14, fontWeight: 600, cursor: deletingTestPatient ? "not-allowed" : "pointer", opacity: deletingTestPatient ? 0.7 : 1, transition: "all 0.2s" }}
                onMouseEnter={e => { if (!deletingTestPatient) { e.currentTarget.style.background = "rgba(244,63,94,0.15)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.35)"; } }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(244,63,94,0.08)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.2)"; }}
              >
                {deletingTestPatient
                  ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-red-500/20 border-t-red-400" />Suppression</span>
                  : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeletePinModal && (
        <div onClick={e => { if (e.target === e.currentTarget) { setShowDeletePinModal(false); setDeletePinInput(""); setDeletePinError(""); } }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, border: "1px solid rgba(244,63,94,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="#f87171" strokeWidth="1.8"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </div>
            <h2 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700, color: "white" }}>Supprimer le PIN</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>Entrez votre PIN actuel pour confirmer</p>
            <input type="password" value={deletePinInput} onChange={e => setDeletePinInput(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" maxLength={6} autoFocus
              style={{ width: "100%", height: 48, borderRadius: 12, border: `1px solid ${deletePinError ? "rgba(244,63,94,0.5)" : "rgba(255,255,255,0.1)"}`, background: "#161616", color: "white", padding: "0 16px", fontSize: 18, outline: "none", boxSizing: "border-box", textAlign: "center", letterSpacing: "0.3em", fontFamily: "Inter, sans-serif", marginBottom: 8 }} />
            {deletePinError && <p style={{ margin: "0 0 8px", fontSize: 13, color: "#f87171" }}>{deletePinError}</p>}
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button onClick={() => { setShowDeletePinModal(false); setDeletePinInput(""); setDeletePinError(""); }} style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500 }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>Annuler</button>
              <button onClick={async () => { if (deletePinInput === savedPin) { await supabase.from("practitioners").update({ discrete_pin: null }).eq("user_id", practitionerId!); setSavedPin(""); setShowDeletePinModal(false); setDeletePinInput(""); setDeletePinError(""); } else { setDeletePinError("Code incorrect"); setDeletePinInput(""); } }} style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#f87171", fontSize: 14, fontWeight: 600, cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(244,63,94,0.15)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.35)"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(244,63,94,0.08)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.2)"; }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div onClick={e => { if (e.target === e.currentTarget) { setShowPasswordModal(false); setPasswordResetSent(false); } }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 20, padding: 28, width: "100%", maxWidth: 400, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "white" }}>Changer le mot de passe</h2>
              <button onClick={() => { setShowPasswordModal(false); setPasswordResetSent(false); }} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", flexShrink: 0, transition: "all 0.15s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.13)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "#e2e8f0"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "#64748b"; }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            {passwordResetSent ? (
              <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 14, padding: "20px", textAlign: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(5,150,105,0.15)", border: "2px solid #059669", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "white" }}>Email envoyé !</p>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>Vérifiez votre boîte mail à <strong style={{ color: emerald }}>{practitionerEmail}</strong></p>
                <button onClick={() => { setShowPasswordModal(false); setPasswordResetSent(false); }} style={{ marginTop: 16, height: 40, borderRadius: 20, padding: "0 20px", background: emerald, border: "none", color: "black", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Fermer</button>
              </div>
            ) : (
              <>
                <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>Un lien de réinitialisation sera envoyé à <strong style={{ color: "white" }}>{practitionerEmail}</strong></p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setShowPasswordModal(false)} style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500 }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>Annuler</button>
                  <button onClick={async () => { setPasswordResetLoading(true); await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: practitionerEmail }) }); setPasswordResetLoading(false); setPasswordResetSent(true); setTimeout(() => setPasswordResetSent(false), 5000); }} disabled={passwordResetLoading} style={{ flex: 2, height: 44, borderRadius: 10, background: passwordResetLoading ? "rgba(255,255,255,0.05)" : "rgba(16,185,129,0.12)", border: `1px solid ${passwordResetLoading ? "rgba(255,255,255,0.08)" : "rgba(16,185,129,0.3)"}`, color: passwordResetLoading ? "#64748b" : emerald, fontSize: 14, fontWeight: 600, cursor: passwordResetLoading ? "not-allowed" : "pointer" }} onMouseEnter={e => { if (!passwordResetLoading) e.currentTarget.style.background = "rgba(16,185,129,0.2)"; }} onMouseLeave={e => { if (!passwordResetLoading) e.currentTarget.style.background = "rgba(16,185,129,0.12)"; }}>{passwordResetLoading ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 13, height: 13, border: "2px solid rgba(100,116,139,0.3)", borderTopColor: "#64748b", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />Envoi</span> : "Envoyer le lien"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showSettingsModal && (() => {
        const closeSettings = () => { setShowSettingsModal(false); setSettingsScreen("main"); setPasswordResetSent(false); };
        const SBtn: React.CSSProperties = { width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", flexShrink: 0, transition: "all 0.15s" };
        const SBtnIn  = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = "rgba(255,255,255,0.13)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "#e2e8f0"; };
        const SBtnOut = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "#64748b"; };
        const XIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
        const BackIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>;
        const SubHeader = ({ title }: { title: string }) => (
          <div style={{ display: "flex", alignItems: "center", padding: "18px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, gap: 8 }}>
            <button onClick={() => setSettingsScreen("main")} style={SBtn} onMouseEnter={SBtnIn} onMouseLeave={SBtnOut}><BackIcon /></button>
            <span style={{ flex: 1, textAlign: "center", fontSize: 17, fontWeight: 700, color: "rgba(255,255,255,0.90)", letterSpacing: "-0.01em" }}>{title}</span>
            <button onClick={closeSettings} style={SBtn} onMouseEnter={SBtnIn} onMouseLeave={SBtnOut}><XIcon /></button>
          </div>
        );
        const Row = ({ icon, label, badge, onClick }: { icon: React.ReactNode; label: string; badge?: React.ReactNode; onClick: () => void }) => (
          <button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "0", minHeight: 54, background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", transition: "background 0.12s", textAlign: "left" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>
            <span style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", flexShrink: 0 }}>{icon}</span>
            <span style={{ flex: 1, fontSize: 15, color: "rgba(255,255,255,0.88)", textAlign: "left" }}>{label}</span>
            {badge}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
          </button>
        );
        return (
        <div onClick={e => { if (e.target === e.currentTarget) closeSettings(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.80)", backdropFilter: "blur(12px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#060a08", borderRadius: 20, width: "100%", maxWidth: 420, maxHeight: "90dvh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 0 0 1px rgba(255,255,255,0.10), 0 24px 64px rgba(0,0,0,0.60), 0 0 52px rgba(16,185,129,0.06)" }}>

          {/* ══ ÉCRAN PRINCIPAL ══ */}
          {settingsScreen === "main" && (<>
            <div style={{ display: "flex", alignItems: "center", padding: "18px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, gap: 8 }}>
              <div style={{ width: 36, height: 36, flexShrink: 0 }} />
              <span style={{ flex: 1, textAlign: "center", fontSize: 17, fontWeight: 700, color: "rgba(255,255,255,0.90)", letterSpacing: "-0.01em" }}>Mes paramètres</span>
              <button onClick={closeSettings} style={SBtn} onMouseEnter={SBtnIn} onMouseLeave={SBtnOut}><XIcon /></button>
            </div>
            <div style={{ padding: "6px 20px", overflowY: "auto", flex: 1 }}>
              <Row icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} label="Profil" onClick={() => setSettingsScreen("profil")} />
              <Row icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>} label="Mot de passe" onClick={() => setSettingsScreen("motdepasse")} />
              <Row icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>} label="Mode discret"
                badge={savedPin ? <span style={{ fontSize: 10, fontWeight: 600, color: amber, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "2px 8px", marginRight: 4 }}>PIN actif</span> : undefined}
                onClick={() => setSettingsScreen("discret")} />
              <Row icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>} label="Abonnement"
                badge={<span style={{ fontSize: 12, color: practitionerPlan ? emerald : "#64748b", marginRight: 4 }}>{practitionerPlan === "essentiel" ? "Essentiel" : practitionerPlan === "pro" ? "Pro" : "–"}</span>}
                onClick={() => setSettingsScreen("abonnement")} />
              <Row icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>} label="Notifications" onClick={() => setSettingsScreen("notifications")} />
            </div>
          </>)}

          {/* ══ PROFIL ══ */}
          {settingsScreen === "profil" && (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
              <SubHeader title="Profil" />
              <div style={{ overflowY: "auto", flex: 1, padding: "24px 20px" }}>
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <div style={{ position: "relative", width: 72, height: 72, margin: "0 auto 12px" }}>
                    <div style={{ width: 72, height: 72, borderRadius: "50%", border: `2px solid ${emerald}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {practitionerPhoto ? <img src={practitionerPhoto} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : AVATARS[selectedAvatar]}
                    </div>
                    <button onClick={() => avatarInputRef.current?.click()} style={{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: "50%", background: emerald, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </button>
                    <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingAvatar(true);
                      const img = new window.Image();
                      const objectUrl = URL.createObjectURL(file);
                      img.onload = async () => {
                        URL.revokeObjectURL(objectUrl);
                        // Redimensionner à max 400×400
                        const maxSize = 400;
                        let { width, height } = img;
                        if (width > height) {
                          if (width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; }
                        } else {
                          if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize; }
                        }
                        const canvas = document.createElement("canvas");
                        canvas.width = width; canvas.height = height;
                        const ctx = canvas.getContext("2d");
                        if (!ctx) { setUploadingAvatar(false); return; }
                        ctx.drawImage(img, 0, 0, width, height);
                        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
                        // Aperçu immédiat + cache local
                        setPractitionerPhoto(dataUrl);
                        localStorage.setItem("nutri_practitioner_avatar", dataUrl);
                        // Sauvegarde en DB (base64 → TEXT, pas de Storage)
                        try {
                          const res = await fetch("/api/practitioner/save-avatar", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ avatarDataUrl: dataUrl }),
                          });
                          const json = await res.json() as { ok?: boolean; error?: string };
                          if (!json.ok) console.error("[Avatar] Erreur sauvegarde:", json.error);
                        } catch (err) { console.error("[Avatar] Erreur réseau:", err); }
                        setUploadingAvatar(false);
                        if (avatarInputRef.current) avatarInputRef.current.value = "";
                      };
                      img.onerror = () => { URL.revokeObjectURL(objectUrl); setUploadingAvatar(false); };
                      img.src = objectUrl;
                    }} />
                  </div>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "white" }}>{practitionerName}</p>
                  <div style={{ marginTop: 6, padding: "6px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>{practitionerEmail || "—"}</p>
                    {!showEmailChange && !emailChangeSent && (
                      <button onClick={() => { setShowEmailChange(true); setEmailChangeError(""); setNewEmail(""); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#475569", transition: "color 0.15s" }} onMouseEnter={e => e.currentTarget.style.color = "#94a3b8"} onMouseLeave={e => e.currentTarget.style.color = "#475569"} title="Modifier l'adresse email">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                    )}
                  </div>
                  {practitionerPhoto && (
                    <button onClick={async () => {
                      setPractitionerPhoto(null);
                      localStorage.removeItem("nutri_practitioner_avatar");
                      try {
                        await fetch("/api/practitioner/save-avatar", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "delete" }),
                        });
                      } catch { /* silencieux */ }
                    }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#f87171", textDecoration: "underline", padding: 0, marginTop: 8, display: "block", width: "100%", textAlign: "center" }}>
                      Supprimer la photo
                    </button>
                  )}
                  {emailChangeSent && (
                    <p style={{ margin: "8px 0 0", fontSize: 12, color: emerald, lineHeight: 1.5 }}>
                      Un lien de confirmation a été envoyé à <strong>{newEmail}</strong>. Cliquez dessus pour valider le changement.
                    </p>
                  )}
                  {showEmailChange && !emailChangeSent && (
                    <div style={{ marginTop: 12, width: "100%", textAlign: "left" }}>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Nouvelle adresse email</label>
                      <input type="email" value={newEmail} onChange={e => { setNewEmail(e.target.value); setEmailChangeError(""); }} placeholder="nouvelle@adresse.fr" autoComplete="email"
                        style={{ width: "100%", height: 42, borderRadius: 10, border: `1px solid ${emailChangeError ? "rgba(244,63,94,0.5)" : "rgba(255,255,255,0.1)"}`, background: "#161616", color: "white", padding: "0 14px", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif" }} />
                      {emailChangeError && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#f87171" }}>{emailChangeError}</p>}
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button onClick={() => { setShowEmailChange(false); setNewEmail(""); setEmailChangeError(""); }}
                          style={{ height: 38, borderRadius: 10, padding: "0 14px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b", fontSize: 13, cursor: "pointer" }}>
                          Annuler
                        </button>
                        <button onClick={() => {
                          if (!newEmail.includes("@")) { setEmailChangeError("Adresse email invalide."); return; }
                          if (newEmail === practitionerEmail) { setEmailChangeError("C'est déjà votre adresse actuelle."); return; }
                          setShowEmailConfirmModal(true);
                        }} disabled={changingEmail || !newEmail}
                          style={{ flex: 1, height: 38, borderRadius: 10, background: changingEmail || !newEmail ? "rgba(255,255,255,0.04)" : "rgba(16,185,129,0.12)", border: `1px solid ${changingEmail || !newEmail ? "rgba(255,255,255,0.06)" : "rgba(16,185,129,0.3)"}`, color: changingEmail || !newEmail ? "#64748b" : emerald, fontSize: 13, fontWeight: 600, cursor: changingEmail || !newEmail ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
                          {changingEmail ? "Mise à jour…" : "Mettre à jour"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 16 }}>
                    <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Choisir un avatar</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", justifyContent: "center" }}>
                      {AVATARS.slice(0, 7).map((avatar, i) => (
                        <button key={i} onClick={() => { setSelectedAvatar(i); setPractitionerPhoto(null); }} style={{ width: 40, height: 40, borderRadius: "50%", border: `2px solid ${!practitionerPhoto && selectedAvatar === i ? emerald : "rgba(255,255,255,0.08)"}`, background: !practitionerPhoto && selectedAvatar === i ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s", flexShrink: 0 }}>
                          {avatar}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Supprimer mon compte */}
                  <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
                    <button onClick={() => setShowDeleteConfirm(true)}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "rgba(255,255,255,0.28)", textDecoration: "underline", padding: "4px 0" }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#f87171"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.28)"; }}>
                      Supprimer mon compte
                    </button>
                  </div>
              </div>
            </div>
          )}

          {/* ══ MOT DE PASSE ══ */}
          {settingsScreen === "motdepasse" && (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
              <SubHeader title="Mot de passe" />
              <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
                {passwordChanged ? (
                  <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 14, padding: "28px 20px", textAlign: "center" }}>
                    <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(5,150,105,0.15)", border: "2px solid #059669", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "white" }}>Mot de passe modifié !</p>
                    <p style={{ margin: "6px 0 20px", fontSize: 13, color: "#64748b" }}>Votre nouveau mot de passe est actif.</p>
                    <button onClick={() => { setPasswordChanged(false); setOldPassword(""); setNewPasswordField(""); setConfirmPassword(""); setPasswordError(""); setSettingsScreen("main"); }} style={{ height: 40, borderRadius: 20, padding: "0 24px", background: emerald, border: "none", color: "black", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Retour</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Mot de passe actuel</label>
                      <div style={{ position: "relative" }}>
                        <input type={showOldPwd ? "text" : "password"} value={oldPassword} onChange={e => { setOldPassword(e.target.value); setPasswordError(""); }} placeholder="••••••••" autoComplete="current-password"
                          style={{ width: "100%", height: 44, borderRadius: 10, border: `1px solid ${passwordError && passwordError.includes("actuel") ? "rgba(244,63,94,0.5)" : "rgba(255,255,255,0.1)"}`, background: "#161616", color: "white", padding: "0 44px 0 14px", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif" }} />
                        <button type="button" onClick={() => setShowOldPwd(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 0, display: "flex", alignItems: "center" }}>
                          {showOldPwd ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Nouveau mot de passe</label>
                      <div style={{ position: "relative" }}>
                        <input type={showNewPwd ? "text" : "password"} value={newPasswordField} onChange={e => { setNewPasswordField(e.target.value); setPasswordError(""); }} placeholder="8 caractères minimum" autoComplete="new-password"
                          style={{ width: "100%", height: 44, borderRadius: 10, border: `1px solid ${passwordError && passwordError.includes("8") ? "rgba(244,63,94,0.5)" : "rgba(255,255,255,0.1)"}`, background: "#161616", color: "white", padding: "0 44px 0 14px", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif" }} />
                        <button type="button" onClick={() => setShowNewPwd(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 0, display: "flex", alignItems: "center" }}>
                          {showNewPwd ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Confirmer le nouveau mot de passe</label>
                      <div style={{ position: "relative" }}>
                        <input type={showConfirmPwd ? "text" : "password"} value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setPasswordError(""); }} placeholder="••••••••" autoComplete="new-password"
                          style={{ width: "100%", height: 44, borderRadius: 10, border: `1px solid ${passwordError && passwordError.includes("correspondent") ? "rgba(244,63,94,0.5)" : "rgba(255,255,255,0.1)"}`, background: "#161616", color: "white", padding: "0 44px 0 14px", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif" }} />
                        <button type="button" onClick={() => setShowConfirmPwd(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 0, display: "flex", alignItems: "center" }}>
                          {showConfirmPwd ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                        </button>
                      </div>
                    </div>
                    {passwordError && <p style={{ margin: 0, fontSize: 13, color: "#f87171", lineHeight: 1.5 }}>{passwordError}</p>}
                    <button
                      disabled={changingPassword || !oldPassword || !newPasswordField || !confirmPassword}
                      onClick={async () => {
                        if (newPasswordField.length < 8) { setPasswordError("Le nouveau mot de passe doit faire au moins 8 caractères."); return; }
                        if (newPasswordField !== confirmPassword) { setPasswordError("Les mots de passe ne correspondent pas."); return; }
                        setChangingPassword(true);
                        setPasswordError("");
                        try {
                          // Vérifier l'ancien mot de passe en se reconnectant
                          const s = createSupabaseBrowserClient();
                          const { error: signInErr } = await s.auth.signInWithPassword({ email: practitionerEmail, password: oldPassword });
                          if (signInErr) { setPasswordError("Mot de passe actuel incorrect."); setChangingPassword(false); return; }
                          // Mettre à jour avec le nouveau mot de passe
                          const { error: updateErr } = await s.auth.updateUser({ password: newPasswordField });
                          if (updateErr) { setPasswordError("Erreur lors du changement : " + updateErr.message); setChangingPassword(false); return; }
                          setPasswordChanged(true);
                          setOldPassword(""); setNewPasswordField(""); setConfirmPassword("");
                        } catch { setPasswordError("Une erreur est survenue. Réessayez."); }
                        setChangingPassword(false);
                      }}
                      style={{ width: "100%", height: 46, borderRadius: 12, background: changingPassword || !oldPassword || !newPasswordField || !confirmPassword ? "rgba(255,255,255,0.04)" : "rgba(16,185,129,0.12)", border: `1px solid ${changingPassword || !oldPassword || !newPasswordField || !confirmPassword ? "rgba(255,255,255,0.06)" : "rgba(16,185,129,0.3)"}`, color: changingPassword || !oldPassword || !newPasswordField || !confirmPassword ? "#64748b" : emerald, fontSize: 14, fontWeight: 600, cursor: changingPassword || !oldPassword || !newPasswordField || !confirmPassword ? "not-allowed" : "pointer", transition: "all 0.2s", marginTop: 4 }}
                      onMouseEnter={e => { if (!changingPassword && oldPassword && newPasswordField && confirmPassword) e.currentTarget.style.background = "rgba(16,185,129,0.20)"; }}
                      onMouseLeave={e => { if (!changingPassword && oldPassword && newPasswordField && confirmPassword) e.currentTarget.style.background = "rgba(16,185,129,0.12)"; }}>
                      {changingPassword ? "Modification en cours…" : "Modifier le mot de passe"}
                    </button>
                    <div style={{ textAlign: "center" }}>
                      <button onClick={async () => {
                        setPasswordResetLoading(true);
                        await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: practitionerEmail }) });
                        setPasswordResetLoading(false);
                        setPasswordResetSent(true);
                        setTimeout(() => setPasswordResetSent(false), 5000);
                      }} disabled={passwordResetLoading} style={{ background: "none", border: "none", cursor: passwordResetLoading ? "not-allowed" : "pointer", fontSize: 12, color: "#64748b", textDecoration: "underline", padding: 0, display: "inline-flex", alignItems: "center", gap: 5 }}>
                        {passwordResetLoading && <span style={{ width: 10, height: 10, border: "1.5px solid rgba(100,116,139,0.3)", borderTopColor: "#64748b", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />}
                        {passwordResetLoading ? "Envoi" : "Mot de passe oublié ?"}
                      </button>
                    </div>
                    {passwordResetSent && <p style={{ margin: 0, fontSize: 12, color: emerald, textAlign: "center" }}>Lien envoyé à {practitionerEmail}</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ MODE DISCRET ══ */}
          {settingsScreen === "discret" && (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
              <SubHeader title="Mode discret" />
              <div style={{ padding: "24px" }}>
                <p style={{ margin: "0 0 18px", fontSize: 13, color: "#64748b", lineHeight: 1.7 }}>{savedPin ? "Un PIN est défini. Entrez un nouveau code pour le modifier." : "Définissez un code PIN pour sécuriser la sortie du mode discret."}</p>
                <input type="password" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder={savedPin ? "Nouveau PIN (4-6 chiffres)" : "Créer un PIN (4-6 chiffres)"} maxLength={6}
                  style={{ width: "100%", height: 46, borderRadius: 12, border: "1px solid rgba(245,158,11,0.3)", background: "#161616", color: "white", padding: "0 14px", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif", marginBottom: 12 }} />
                <button onClick={() => void saveSettings()} disabled={savingSettings || !newPin || newPin.length < 4}
                  style={{ width: "100%", height: 46, borderRadius: 12, background: savingSettings || !newPin || newPin.length < 4 ? "rgba(255,255,255,0.04)" : "rgba(245,158,11,0.08)", border: `1px solid ${savingSettings || !newPin || newPin.length < 4 ? "rgba(255,255,255,0.06)" : "rgba(245,158,11,0.2)"}`, color: savingSettings || !newPin || newPin.length < 4 ? "#64748b" : amber, fontSize: 14, fontWeight: 500, cursor: savingSettings || !newPin || newPin.length < 4 ? "not-allowed" : "pointer", transition: "all 0.2s", marginBottom: 10 }}
                  onMouseEnter={e => { if (!savingSettings && newPin && newPin.length >= 4) e.currentTarget.style.background = "rgba(245,158,11,0.15)"; }}
                  onMouseLeave={e => { if (!savingSettings && newPin && newPin.length >= 4) e.currentTarget.style.background = "rgba(245,158,11,0.08)"; }}>
                  {settingsSaved ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke={emerald} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>PIN sauvegardé</span> : savingSettings ? "Sauvegarde…" : "Sauvegarder le PIN"}
                </button>
                {savedPin && <div style={{ textAlign: "center" }}><button onClick={() => setShowDeletePinModal(true)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#f87171", textDecoration: "underline", padding: 0 }}>Supprimer le PIN</button></div>}
              </div>
            </div>
          )}

          {/* ══ ABONNEMENT ══ */}
          {settingsScreen === "abonnement" && (() => {
            const periodEnd = billingSubscription?.current_period_end
              ? new Date(billingSubscription.current_period_end * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
              : null;
            const isCancelling = billingSubscription?.cancel_at_period_end === true;
            const planLabel = practitionerPlan === "essentiel" ? "Essentiel" : practitionerPlan === "pro" ? "Professionnel" : "–";
            return (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
              <SubHeader title="Abonnement" />
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 32px" }}>

                {/* ── Tabs ── */}
                <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 4, marginBottom: 20 }}>
                  {(["plan", "facturation"] as const).map(tab => (
                    <button key={tab} onClick={() => { setBillingTab(tab); if (tab === "facturation" && invoices.length === 0) void loadBillingData(); }}
                      style={{ flex: 1, height: 32, borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                        background: billingTab === tab ? "rgba(255,255,255,0.09)" : "transparent",
                        color: billingTab === tab ? "white" : "#64748b" }}>
                      {tab === "facturation" ? "Facturation" : "Plan actuel"}
                    </button>
                  ))}
                </div>

                {/* ══ ALERTE PAIEMENT (past_due / canceled) ══ */}
                {(subscriptionStatus === "past_due" || subscriptionStatus === "canceled" || subscriptionStatus === "cancelled") && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: subscriptionStatus === "past_due" ? "rgba(245,158,11,0.07)" : "rgba(239,68,68,0.07)", border: `1px solid ${subscriptionStatus === "past_due" ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)"}`, borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={subscriptionStatus === "past_due" ? "#f59e0b" : "#ef4444"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                      {subscriptionStatus === "past_due"
                        ? <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>
                        : <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>
                      }
                    </svg>
                    <div>
                      <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: subscriptionStatus === "past_due" ? "#f59e0b" : "#ef4444", lineHeight: 1.4 }}>
                        {subscriptionStatus === "past_due" ? "Paiement en échec" : "Abonnement suspendu"}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                        {subscriptionStatus === "past_due"
                          ? "Votre dernier paiement a échoué. Mettez à jour votre carte ci-dessous pour éviter l'interruption de service."
                          : "Votre accès a été suspendu suite à plusieurs tentatives de paiement échouées. Mettez à jour votre carte pour réactiver votre compte."}
                      </p>
                    </div>
                  </div>
                )}

                {/* ══ TAB FACTURATION ══ */}
                {billingTab === "facturation" && (
                  <div>
                    {/* Carte */}
                    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", padding: "16px 18px", marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showCardForm ? 16 : 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                          <span style={{ fontSize: 13, color: cardLast4 ? "white" : "#64748b" }}>
                            {cardLast4
                              ? <>{cardBrand ? cardBrand.charAt(0).toUpperCase() + cardBrand.slice(1) : "Carte"} <span style={{ color: "#94a3b8" }}>•••• {cardLast4}</span></>
                              : billingLoading ? "Chargement…" : "Aucune carte enregistrée"}
                          </span>
                        </div>
                        <button onClick={async () => {
                          if (!showCardForm) {
                            const res = await fetch("/api/billing/card-setup-intent", { method: "POST" });
                            if (res.ok) {
                              const { clientSecret } = await res.json() as { clientSecret: string };
                              setCardSetupClientSecret(clientSecret);
                            }
                          }
                          setShowCardForm(v => !v);
                          setCardUpdateSuccess(false);
                        }}
                          style={{ fontSize: 12, fontWeight: 600, color: showCardForm ? "#64748b" : emerald, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                          {showCardForm ? "Annuler" : "Modifier"}
                        </button>
                      </div>
                      {showCardForm && cardSetupClientSecret && (
                        <Elements stripe={stripePromise} options={{ clientSecret: cardSetupClientSecret, appearance: { theme: "night", variables: { colorPrimary: emerald, colorBackground: "#0d0d0d", colorText: "#ffffff", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", borderRadius: "10px" }, rules: { ".Input": { border: "1px solid rgba(255,255,255,0.1)", boxShadow: "none", backgroundColor: "#161616" }, ".Input:focus": { border: `1px solid ${emerald}`, boxShadow: `0 0 0 2px ${emerald}25` }, ".Label": { color: "#9ca3af", fontSize: "12px" } } } }}>
                          <CardUpdateForm
                            onSuccess={(last4, brand) => { setCardLast4(last4); setCardBrand(brand); setShowCardForm(false); setCardUpdateSuccess(true); }}
                          />
                        </Elements>
                      )}
                      {cardUpdateSuccess && (
                        <p style={{ margin: "10px 0 0", fontSize: 12, color: emerald }}>✓ Carte mise à jour avec succès.</p>
                      )}
                    </div>

                    {/* Factures */}
                    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
                      <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>Factures</p>
                      </div>
                      {billingLoading ? (
                        <p style={{ margin: 0, padding: "20px 18px", fontSize: 13, color: "#64748b" }}>Chargement…</p>
                      ) : invoices.length === 0 ? (
                        <p style={{ margin: 0, padding: "20px 18px", fontSize: 13, color: "#64748b" }}>Aucune facture pour le moment.</p>
                      ) : invoices.map((inv, i) => {
                        const date = new Date(inv.created * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
                        const amount = (inv.amount_paid / 100).toLocaleString("fr-FR", { style: "currency", currency: inv.currency.toUpperCase() });
                        return (
                          <div key={inv.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: i < invoices.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                            <div>
                              <p style={{ margin: "0 0 1px", fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>{amount}</p>
                              <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>{date}{inv.number ? ` · ${inv.number}` : ""}</p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: inv.status === "paid" ? emerald : "#f97316", background: inv.status === "paid" ? "rgba(16,185,129,0.1)" : "rgba(249,115,22,0.1)", borderRadius: 6, padding: "2px 8px" }}>
                                {inv.status === "paid" ? "Payée" : "En attente"}
                              </span>
                              {inv.invoice_pdf && (
                                <a href={inv.invoice_pdf} target="_blank" rel="noreferrer"
                                  style={{ fontSize: 11, color: "#64748b", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                  PDF
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Zone danger */}
                    {!isCancelling && subscriptionStatus !== "canceled" && subscriptionStatus !== "cancelled" && (
                      <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <button onClick={() => setShowCancelConfirm(true)}
                          style={{ width: "100%", height: 40, borderRadius: 10, background: "transparent", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.15s" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.06)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                          Résilier mon abonnement
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ══ TAB PLAN ACTUEL ══ */}
                {billingTab === "plan" && (
                  <div>
                    {/* Infos plan */}
                    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", padding: "18px 18px", marginBottom: 14 }}>
                      <p style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "white" }}>{planLabel}</p>

                      {isCancelling ? (
                        <>
                          <p style={{ margin: "0 0 16px", fontSize: 13, color: amber, lineHeight: 1.6 }}>
                            Résiliation programmée. Votre accès reste néanmoins actif jusqu&apos;au {periodEnd}
                          </p>
                          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginBottom: 14 }} />
                          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 500, color: "#64748b" }}>Vous avez changé d&apos;avis ?</p>
                          <button onClick={() => void handleResumeSubscription()}
                            style={{ height: 36, paddingInline: 16, borderRadius: 9, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: emerald, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.15)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.08)"; }}>
                            Annuler la résiliation
                          </button>
                        </>
                      ) : (
                        <>
                          <p style={{ margin: "0 0 4px", fontSize: 12, color: subscriptionStatus === "active" ? emerald : subscriptionStatus === "trialing" ? amber : "#64748b" }}>
                            {subscriptionStatus === "active" ? "Actif" : subscriptionStatus === "trialing" ? "Période d'essai" : subscriptionStatus === "past_due" ? "Paiement en retard" : "–"}
                          </p>
                          {periodEnd && (
                            <p style={{ margin: 0, fontSize: 12, color: "#475569" }}>
                              Renouvellement le <span style={{ color: "#94a3b8" }}>{periodEnd}</span>
                            </p>
                          )}
                        </>
                      )}

                      {deleteRequestSent && (
                        <p style={{ margin: "12px 0 0", fontSize: 12, color: "#94a3b8" }}>
                          ✓ Votre demande de suppression a été envoyée. Traitement sous 30 jours.
                        </p>
                      )}
                    </div>

                    {/* CTA changer de plan */}
                    {!isCancelling && (
                      <button onClick={() => { setPlanUpdateError(""); setShowBillingModal(true); }}
                        style={{ width: "100%", height: 42, borderRadius: 12, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: emerald, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", marginBottom: 12 }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.15)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.08)"; }}>
                        Voir les plans disponibles
                      </button>
                    )}
                    {planUpdateSuccess && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", background: "rgba(16,185,129,0.06)", borderRadius: 10, border: "1px solid rgba(16,185,129,0.12)" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke={emerald} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <span style={{ fontSize: 12, color: emerald }}>Plan mis à jour avec succès.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Modal confirmation résiliation ── */}
              {showCancelConfirm && (
                <div onClick={() => { if (!cancelSuccess) setShowCancelConfirm(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                  <div onClick={e => e.stopPropagation()} style={{ background: "#0d0d0d", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, border: `1px solid ${cancelSuccess ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`, boxShadow: "0 20px 60px rgba(0,0,0,0.6)", textAlign: "center" }}>

                    {cancelSuccess ? (
                      /* ── État succès ── */
                      <>
                        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke={emerald} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                        <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 700, color: "white" }}>Résiliation confirmée</h2>
                        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b", lineHeight: 1.65 }}>
                          Un email de confirmation vous a été envoyé.<br />
                          Votre accès reste actif jusqu'au <strong style={{ color: "white" }}>{periodEnd ?? "fin de la période"}</strong>. Vous pouvez annuler votre résiliation à tout moment avant cette date.
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <button onClick={() => { void handleResumeSubscription(); setShowCancelConfirm(false); }}
                            style={{ width: "100%", height: 42, borderRadius: 10, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: emerald, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.15)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.08)"; }}>
                            Annuler la résiliation
                          </button>
                          <button onClick={() => { setShowCancelConfirm(false); }}
                            style={{ width: "100%", height: 42, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500 }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>
                            Fermer
                          </button>
                        </div>
                      </>
                    ) : (
                      /* ── État confirmation ── */
                      <>
                        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        </div>
                        <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: "white" }}>Résilier mon abonnement ?</h2>
                        <p style={{ margin: "0 0 24px", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
                          Votre accès restera actif jusqu'au <strong style={{ color: "white" }}>{periodEnd ?? "fin de la période"}</strong>. Aucun montant ne sera prélevé après cette date. Un email de confirmation vous sera envoyé.
                        </p>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button onClick={() => setShowCancelConfirm(false)}
                            style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500 }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>
                            Annuler
                          </button>
                          <button onClick={() => void handleCancelSubscription()} disabled={cancelLoading}
                            style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 14, fontWeight: 600, cursor: cancelLoading ? "default" : "pointer", opacity: cancelLoading ? 0.7 : 1 }}
                            onMouseEnter={e => { if (!cancelLoading) { e.currentTarget.style.background = "rgba(239,68,68,0.15)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.35)"; } }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)"; }}>
                            {cancelLoading
                              ? <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></path></svg>
                                  Confirmation
                                </span>
                              : "Confirmer"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            );
          })()}

          {/* ══ NOTIFICATIONS ══ */}
          {settingsScreen === "notifications" && (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
              <SubHeader title="Notifications" />
              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.7 }}>
                  Les alertes sont envoyées à{" "}
                  <strong style={{ color: "rgba(255,255,255,0.80)" }}>{practitionerEmail || "votre adresse email"}</strong>
                </p>

                {/* Toggle alertes comportementales */}
                <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", padding: "16px 18px", display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>Alertes comportementales</p>
                    <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>Recevez une alerte par mail lorsqu'une crise est détectée dans le chat pour un de vos patients</p>
                  </div>
                  <button
                    onClick={async () => {
                      const next = !notifyBehavioral;
                      setNotifyBehavioral(next);
                      if (practitionerId) await supabase.from("practitioners").update({ notify_behavioral: next }).eq("user_id", practitionerId);
                    }}
                    style={{ flexShrink: 0, width: 42, height: 24, borderRadius: 12, background: notifyBehavioral ? `${amber}d9` : "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", marginTop: 2 }}>
                    <span style={{ position: "absolute", top: 2, left: notifyBehavioral ? 20 : 2, width: 20, height: 20, borderRadius: "50%", background: "white", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }} />
                  </button>
                </div>

                {/* Toggle alertes d'urgence clinique */}
                <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 14, border: `1px solid ${notifyCritical ? "rgba(244,63,94,0.18)" : "rgba(255,255,255,0.07)"}`, padding: "16px 18px", display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>Alertes d'urgence clinique</p>
                    <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>Recevez une alerte par mail lorsque le patient exprime des propos à risque ou lorsque le chat détecte une mise en danger nécessitant une prise en charge humaine</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (notifyCritical) {
                        // Désactiver → popup de confirmation
                        setShowDisableCriticalConfirm(true);
                      } else {
                        // Réactiver directement
                        setNotifyCritical(true);
                        if (practitionerId) await supabase.from("practitioners").update({ notify_critical: true }).eq("user_id", practitionerId);
                      }
                    }}
                    style={{ flexShrink: 0, width: 42, height: 24, borderRadius: 12, background: notifyCritical ? `${coral}d9` : "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", marginTop: 2 }}>
                    <span style={{ position: "absolute", top: 2, left: notifyCritical ? 20 : 2, width: 20, height: 20, borderRadius: "50%", background: "white", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }} />
                  </button>
                </div>
              </div>

              {/* Popup de confirmation désactivation alertes critiques */}
              {showDisableCriticalConfirm && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 10 }}>
                  <div style={{ background: "#0d0d0d", borderRadius: 16, padding: "28px 24px", border: "1px solid rgba(244,63,94,0.25)", maxWidth: 320, width: "100%" }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={coral} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </div>
                    <p style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: "white", textAlign: "center" }}>Désactiver les alertes d'urgence ?</p>
                    <p style={{ margin: "0 0 22px", fontSize: 13, color: "#94a3b8", lineHeight: 1.6, textAlign: "center" }}>En désactivant, vous ne recevrez plus d'email lors d'une alerte critique. Les alertes resteront néanmoins visibles sur votre dashboard, veillez à le consulter régulièrement. Cette décision peut engager votre responsabilité professionnelle. Êtes-vous sûr ?</p>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => setShowDisableCriticalConfirm(false)}
                        style={{ flex: 1, height: 42, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500 }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "white"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#94a3b8"; }}>
                        Annuler
                      </button>
                      <button onClick={async () => {
                          setShowDisableCriticalConfirm(false);
                          setNotifyCritical(false);
                          if (practitionerId) await supabase.from("practitioners").update({ notify_critical: false }).eq("user_id", practitionerId);
                        }}
                        style={{ flex: 1, height: 42, borderRadius: 10, background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.25)", color: coral, cursor: "pointer", fontSize: 14, fontWeight: 600 }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(244,63,94,0.18)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(244,63,94,0.10)"; }}>
                        Confirmer
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          </div>
        </div>
        );
      })()}

      {/* ── Modale changement de plan ── */}
      {showBillingModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowBillingModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ position: "relative", background: "#0d0d0d", borderRadius: 24, padding: 28, width: "100%", maxWidth: 1030, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", maxHeight: "90vh", overflowY: "auto" }}>
            {/* Header — titre centré absolu, boutons symétriques */}
            <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
              <button onClick={() => setShowBillingModal(false)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", color: "#94a3b8", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "#e2e8f0"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "#94a3b8"; }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              </button>
              <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", textAlign: "center", pointerEvents: "none" }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "white" }}>Choisissez votre plan</h2>
                <p style={{ margin: "3px 0 0", fontSize: 13, color: "#64748b" }}>
                  Plan actuel&nbsp;:&nbsp;<span style={{ color: emerald, fontWeight: 600 }}>{practitionerPlan === "essentiel" ? "Essentiel" : practitionerPlan === "pro" ? "Professionnel" : "–"}</span>
                </p>
              </div>
              <button onClick={() => setShowBillingModal(false)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", color: "#94a3b8", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "#e2e8f0"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "#94a3b8"; }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Cards plans */}
            <div style={{ display: "flex", flexDirection: "row", gap: 12, alignItems: "stretch", flexWrap: "wrap", marginTop: 32, justifyContent: "center" }}>
              {([
                {
                  plan: "essentiel", label: "Essentiel", price: "89€",
                  desc: "Pour démarrer et accompagner vos patients prioritaires.",
                  footnoteMark: null as string | null,
                  features: [
                    { text: "Jusqu'à 10 patients suivis en simultané", included: true },
                    { text: "Votre Jumeau personnalisé (calqué sur votre approche et vos consignes)", included: true },
                    { text: "Analyse en temps réel (détection des comportements et alertes de crises)", included: true },
                    { text: "Préparation automatisée de vos consultations et bilans", included: true },
                    { text: "Espace de stockage sécurisé pour vos protocoles et documents", included: true },
                    { text: "Vision IA : Analyse de photos (repas, étiquettes, bilans…)", included: false },
                    { text: "Mémoire clinique long terme (synthèse permanente de tout le parcours)", included: false },
                  ],
                  badge: null as string | null,
                },
                {
                  plan: "pro", label: "Professionnel", price: "199€",
                  desc: "Idéal pour les praticiens indépendants qui gèrent un suivi actif au quotidien.",
                  footnoteMark: null as string | null,
                  features: [
                    { text: "Jusqu'à 25 patients suivis en simultané", included: true },
                    { text: "Votre Jumeau personnalisé (calqué sur votre approche et vos consignes)", included: true },
                    { text: "Analyse en temps réel (détection des comportements et alertes de crises)", included: true },
                    { text: "Préparation automatisée de vos consultations et bilans", included: true },
                    { text: "Espace de stockage sécurisé pour vos protocoles et documents", included: true },
                    { text: "Vision IA : Analyse de photos envoyées par vos patients (repas, étiquettes, bilans…)", included: true },
                    { text: "Mémoire clinique long terme (synthèse permanente de tout le parcours)", included: true },
                    { text: "Plafond d'échanges quotidien étendu par patient (1)", included: true },
                  ],
                  badge: "Recommandé" as string | null,
                },
              ]).map(({ plan, label, price, desc, features, badge, footnoteMark }) => {
                const isCurrent = plan === practitionerPlan;
                const isFeatured = badge === "Recommandé";
                return (
                  <div key={plan}
                    style={{ position: "relative", flex: "1 1 240px", borderRadius: 16, border: isCurrent ? `1px solid ${emerald}` : isFeatured ? "1px solid rgba(16,185,129,0.30)" : "1px solid rgba(255,255,255,0.08)", background: isCurrent ? "rgba(16,185,129,0.06)" : isFeatured ? "linear-gradient(180deg, rgba(16,185,129,0.07), #080808)" : "#0d0d0d", padding: "20px 18px", transition: "all 0.2s", display: "flex", flexDirection: "column" }}
                    onMouseEnter={e => { if (!isCurrent) { e.currentTarget.style.border = `1px solid ${isFeatured ? "rgba(16,185,129,0.6)" : "rgba(255,255,255,0.25)"}` ; e.currentTarget.style.transform = "translateY(-2px)"; } }}
                    onMouseLeave={e => { e.currentTarget.style.border = isCurrent ? `1px solid ${emerald}` : isFeatured ? "1px solid rgba(16,185,129,0.30)" : "1px solid rgba(255,255,255,0.08)"; e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    {badge && !isCurrent && (
                      <span style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: emerald, color: "black", fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "2px 10px", whiteSpace: "nowrap" }}>{badge}</span>
                    )}
                    {/* Nom + badge actuel */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: isCurrent ? emerald : "white" }}>{label}</span>
                      {isCurrent && <span style={{ fontSize: 10, fontWeight: 700, color: emerald, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 4, padding: "1px 7px", letterSpacing: "0.06em", textTransform: "uppercase" }}>Actuel</span>}
                    </div>
                    {/* Prix */}
                    <div style={{ marginBottom: 8, display: "flex", alignItems: "baseline", gap: 2 }}>
                      <span style={{ fontSize: 28, fontWeight: 800, color: "white", lineHeight: 1 }}>{price}</span>
                      {footnoteMark && <sup style={{ fontSize: 11, color: "#64748b", marginLeft: 2 }}>({footnoteMark})</sup>}
                      <span style={{ fontSize: 12, color: "#64748b", marginLeft: 2 }}>/mois</span>
                    </div>
                    {/* Description */}
                    <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b", lineHeight: 1.5, minHeight: 36 }}>{desc}</p>
                    {/* Features */}
                    <ul style={{ margin: "0 0 16px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
                      {features.map((f, i) => (
                        <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: f.included ? (i < 5 ? "#e4e4e7" : "#71717a") : "#52525b" }}>
                          {f.included ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginTop: 1, flexShrink: 0 }}><path d="M4.5 12.75l6 6 9-13.5" stroke={emerald} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginTop: 1, flexShrink: 0 }}><path d="M6 18L18 6M6 6l12 12" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          )}
                          <span>
                            {f.text.split(/(\([123]\))/).map((part, j) =>
                              /^\([123]\)$/.test(part) ? <sup key={j} style={{ fontSize: "0.75em" }}>{part}</sup> : part
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {/* CTA */}
                    {isCurrent ? (
                      <div style={{ textAlign: "center", padding: "9px 0", borderRadius: 10, border: `1px solid rgba(16,185,129,0.25)`, fontSize: 12, color: emerald, fontWeight: 600 }}>Plan actuel</div>
                    ) : (
                      <button
                        disabled={isUpdatingPlan}
                        onClick={() => setPendingPlanSwitch({ plan, label, price })}
                        style={{ width: "100%", height: 38, borderRadius: 10, background: isFeatured ? emerald : "rgba(16,185,129,0.1)", border: isFeatured ? "none" : `1px solid rgba(16,185,129,0.25)`, color: isFeatured ? "black" : emerald, fontSize: 13, fontWeight: 600, cursor: isUpdatingPlan ? "not-allowed" : "pointer", opacity: isUpdatingPlan ? 0.6 : 1, transition: "all 0.2s" }}
                        onMouseEnter={e => { if (!isUpdatingPlan) e.currentTarget.style.opacity = "0.85"; }}
                        onMouseLeave={e => { if (!isUpdatingPlan) e.currentTarget.style.opacity = "1"; }}
                      >
                        {isUpdatingPlan ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
                            En cours
                          </span>
                        ) : "Choisir ce plan"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Erreur */}
            {planUpdateError && (
              <p style={{ margin: "14px 0 0", fontSize: 12, color: "#f87171", textAlign: "center" }}>{planUpdateError}</p>
            )}

            {/* ── Bloc pack patients upsell ── */}
            {(practitionerPlan === "essentiel" || practitionerPlan === "pro") && (() => {
              const PLAN_BASES: Record<string, number> = { essentiel: 10, pro: 25 };
              const PACK_SIZES: Record<string, number> = { essentiel: 5, pro: 10 };
              const PACK_PRICES: Record<string, number> = { essentiel: 39, pro: 59 };
              const MAX_PACKS: Record<string, number> = { essentiel: 1, pro: 2 };
              const baseLimit = PLAN_BASES[practitionerPlan] ?? 10;
              const packSize = PACK_SIZES[practitionerPlan] ?? 5;
              const packPrice = PACK_PRICES[practitionerPlan] ?? 39;
              const maxPacks = MAX_PACKS[practitionerPlan] ?? 1;
              const currentPacks = Math.floor(extraPatients / packSize);
              const effectiveLimit = baseLimit + extraPatients;
              const patientCount = patients.length;
              const pct = Math.min(100, Math.round((patientCount / effectiveLimit) * 100));
              const atMaxPacks = currentPacks >= maxPacks;

              return (
                <div style={{ marginTop: 20, padding: "16px 18px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Capacité patients</span>
                    <span style={{ fontSize: 12, color: pct >= 90 ? "#f87171" : pct >= 70 ? "#fb923c" : "#94a3b8", fontWeight: 600 }}>
                      {patientCount} / {effectiveLimit}
                    </span>
                  </div>
                  {/* Barre de progression */}
                  <div style={{ height: 5, borderRadius: 99, background: "rgba(255,255,255,0.07)", marginBottom: 14, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: pct >= 90 ? "#f87171" : pct >= 70 ? "#fb923c" : emerald, transition: "width 0.4s ease" }} />
                  </div>
                  {/* CTA pack */}
                  {atMaxPacks ? (
                    <p style={{ margin: 0, fontSize: 11, color: "#64748b", textAlign: "center" }}>
                      Limite de packs atteinte ({currentPacks}/{maxPacks}). Passez au plan supérieur pour accueillir davantage de patients.
                    </p>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "white" }}>
                          Ajouter +{packSize} patients
                        </p>
                        <p style={{ margin: "2px 0 1px", fontSize: 14, fontWeight: 700, color: "white" }}>{packPrice}€<span style={{ fontSize: 11, fontWeight: 400, color: "#64748b" }}>/mois</span></p>
                        <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>{currentPacks}/{maxPacks} pack{maxPacks > 1 ? "s" : ""} utilisé{currentPacks !== 1 ? "s" : ""}</p>
                      </div>
                      <button
                        onClick={() => void handlePurchasePack()}
                        disabled={isPurchasingPack}
                        style={{ flexShrink: 0, padding: "8px 16px", borderRadius: 10, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: emerald, fontSize: 12, fontWeight: 600, cursor: isPurchasingPack ? "not-allowed" : "pointer", opacity: isPurchasingPack ? 0.6 : 1, transition: "all 0.2s" }}
                      >
                        {isPurchasingPack ? "Chargement…" : "Ajouter ce pack"}
                      </button>
                    </div>
                  )}
                  {packError && <p style={{ margin: "8px 0 0", fontSize: 11, color: "#f87171" }}>{packError}</p>}
                </div>
              );
            })()}

            {/* Notes légales */}
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 6 }}>
              <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", textAlign: "center", lineHeight: 1.5 }}>
                Sans engagement · Résiliable à tout moment · Le changement est effectif immédiatement.
                {onboardingDemoMode && <span style={{ display: "block", color: amber, marginTop: 4 }}>Mode démo · aucun paiement réel.</span>}
              </p>
              <div style={{ marginTop: 6, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 5 }}>
                {[
                  "(1) L'enveloppe de messages est fixée à 30 messages/jour sur le plan Essentiel et élargie à 100 messages/jour sur le plan Professionnel. Conformément à la réglementation, toutes vos données cliniques sont chiffrées, hébergées sur des serveurs sécurisés en Europe, et ne sont jamais utilisées pour entraîner des modèles d'IA publics.",
                ].map((note, i) => (
                  <p key={i} style={{ margin: 0, fontSize: 10, color: "#64748b", lineHeight: 1.6 }}>{note}</p>
                ))}
              </div>
            </div>

            {/* Popup confirmation changement de plan */}
            {pendingPlanSwitch && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.80)", backdropFilter: "blur(6px)", borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
                <div style={{ background: "#0d0d0d", borderRadius: 18, padding: "28px 24px", border: "1px solid rgba(255,255,255,0.1)", width: "100%", maxWidth: 320, textAlign: "center" }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  </div>
                  <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "white" }}>Passer au plan {pendingPlanSwitch.label} ?</p>
                  <p style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, color: emerald }}>{pendingPlanSwitch.price}<span style={{ fontSize: 13, fontWeight: 400, color: "#64748b" }}>/mois</span></p>
                  <p style={{ margin: "0 0 22px", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>Le changement est effectif immédiatement. Le prorata sera calculé sur votre prochaine facture.</p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setPendingPlanSwitch(null)}
                      style={{ flex: 1, height: 42, borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "white"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748b"; }}>
                      Annuler
                    </button>
                    <button onClick={() => { const p = pendingPlanSwitch; setPendingPlanSwitch(null); void handlePlanSwitch(p.plan); }}
                      style={{ flex: 1, height: 42, borderRadius: 12, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: emerald, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; }}>
                      Confirmer
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showMurmureModal && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowMurmureModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 20, padding: 28, width: "100%", maxWidth: 480, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: emerald, textTransform: "uppercase", letterSpacing: "0.12em" }}>Murmure</p>
                <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: "white", lineHeight: 1.4 }}>Dictez des consignes qui seront traitées en priorité absolue pour ce patient</h2>
                <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>Choisissez la durée appropriée pour cette consigne.</p>
              </div>
              <button onClick={() => setShowMurmureModal(false)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", flexShrink: 0, transition: "all 0.15s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.13)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "#e2e8f0"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "#64748b"; }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <textarea value={murmureText} onChange={(e) => setMurmureText(e.target.value)} placeholder="Exemple: Sois plus doux cette semaine, elle traverse une période difficile au travail." rows={5}
              style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "14px", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "Inter, sans-serif", lineHeight: 1.6 }} />
            <div style={{ marginBottom: 16, marginTop: 14 }}>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b" }}>Durée du murmure</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {[
                  { value: "permanent", label: "Permanent" },
                  { value: "24h", label: "24h" },
                  { value: "3j", label: "3 jours" },
                  { value: "7j", label: "7 jours" },
                  { value: "30j", label: "30 jours" },
                  { value: "custom", label: "Personnalisé" },
                ].map(({ value, label }) => (
                  <button key={value} onClick={() => setMurmureDuration(value)}
                    style={{ height: 32, borderRadius: 8, padding: "0 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", border: murmureDuration === value || (value === "custom" && murmureDuration.startsWith("custom_")) ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.08)", background: murmureDuration === value || (value === "custom" && murmureDuration.startsWith("custom_")) ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.02)", color: murmureDuration === value || (value === "custom" && murmureDuration.startsWith("custom_")) ? emerald : "#64748b", transition: "all 0.2s" }}
                    onMouseEnter={e => { if (murmureDuration !== value) { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "#94a3b8"; } }}
                    onMouseLeave={e => { if (murmureDuration !== value) { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#64748b"; } }}>
                    {label}
                  </button>
                ))}
                {murmureDuration.startsWith("custom_") || murmureDuration === "custom" ? (
                  <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
                    <input type="number" min={1} max={365} placeholder="Ex: 5"
                      value={murmureDuration.startsWith("custom_") ? murmureDuration.split("_")[1] : ""}
                      onChange={e => setMurmureDuration(`custom_${e.target.value}_${murmureDuration.startsWith("custom_") ? murmureDuration.split("_")[2] : "jours"}`)}
                      style={{ width: 70, height: 32, borderRadius: 8, border: "1px solid rgba(16,185,129,0.3)", background: "#161616", color: "white", padding: "0 10px", fontSize: 13, outline: "none" }} />
                    <select
                      value={murmureDuration.startsWith("custom_") ? murmureDuration.split("_")[2] : "jours"}
                      onChange={e => setMurmureDuration(`custom_${murmureDuration.startsWith("custom_") ? murmureDuration.split("_")[1] : ""}_${e.target.value}`)}
                      style={{ height: 32, borderRadius: 8, border: "1px solid rgba(16,185,129,0.3)", background: "#161616", color: "white", padding: "0 10px", fontSize: 13, outline: "none", cursor: "pointer" }}>
                      <option value="jours">jours</option>
                      <option value="semaines">semaines</option>
                      <option value="mois">mois</option>
                    </select>
                  </div>
                ) : null}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setShowMurmureModal(false)}
                style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500, transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>
                Annuler
              </button>
              <button onClick={() => void saveMurmure()} disabled={savingMurmure || !murmureText.trim()}
                style={{ flex: 2, height: 44, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: savingMurmure || !murmureText.trim() ? "not-allowed" : "pointer", border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.12)", color: emerald, opacity: savingMurmure || !murmureText.trim() ? 0.6 : 1, transition: "all 0.2s" }}
                onMouseEnter={e => { if (!savingMurmure && murmureText.trim()) { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; } }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; }}>
                {savingMurmure ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500/20 border-t-emerald-500" />Sauvegarde</span> : "Ajouter ce murmure"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showJumeauModal && (
        <div onClick={(e) => { e.stopPropagation(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 24, padding: 28, width: "100%", maxWidth: 560, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: emerald, textTransform: "uppercase", letterSpacing: "0.1em" }}>Votre expertise</p>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "white" }}>Mon Jumeau</h2>
              </div>
              <button onClick={() => setShowJumeauModal(false)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", flexShrink: 0, transition: "all 0.15s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.13)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "#e2e8f0"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "#64748b"; }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>

            {/* MA VISION ET MA SIGNATURE */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>Ma Vision et Ma Signature</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {/* Vision card */}
                {editingVision ? (
                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em" }}>Ma Vision</p>
                    <textarea value={visionDraft} onChange={e => setVisionDraft(e.target.value)} autoFocus
                      placeholder="Exemple : Je crois que la santé commence dans l'intestin et que l'alimentation doit être un levier de vitalité, jamais une source d'anxiété..."
                      rows={4} style={{ width: "100%", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "#1a1a1a", color: "white", padding: "10px 12px", fontSize: 13, outline: "none", resize: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box" }} />
                    <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                      <button onClick={() => setEditingVision(false)} style={{ height: 32, padding: "0 12px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#6b7280", fontSize: 12, cursor: "pointer" }}>Annuler</button>
                      <button onClick={() => { void saveVisionOrSignature("vision", visionDraft); setVisionText(visionDraft); setEditingVision(false); }} disabled={savingVision || !visionDraft.trim()}
                        style={{ height: 32, padding: "0 14px", borderRadius: 8, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: emerald, fontSize: 12, fontWeight: 600, cursor: !visionDraft.trim() ? "not-allowed" : "pointer", opacity: !visionDraft.trim() ? 0.5 : 1 }}>
                        Mettre à jour
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={emerald} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      <span style={{ fontSize: 12, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>
                        {visionText ? "Ma Vision" : <span style={{ color: "#4b5563" }}>Ma Vision (non renseignée)</span>}
                      </span>
                    </div>
                    <button onClick={() => { if (!onboardingDemoMode) { setVisionDraft(visionText); setEditingVision(true); } }}
                      style={{ background: "none", border: "none", cursor: onboardingDemoMode ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, color: onboardingDemoMode ? "#374151" : emerald, padding: "0 0 0 8px", flexShrink: 0 }}
                      onMouseEnter={e => { if (!onboardingDemoMode) e.currentTarget.style.opacity = "0.7"; }}
                      onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                      Modifier
                    </button>
                  </div>
                )}

                {/* Signature card */}
                {editingSignature ? (
                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em" }}>Ma Signature</p>
                    <textarea value={signatureDraft} onChange={e => setSignatureDraft(e.target.value)} autoFocus
                      placeholder={'Exemple : Je compare souvent le métabolisme à un feu de camp. Mon expression fétiche : "Un repas ne fait pas le moine, on tourne la page"...'}
                      rows={4} style={{ width: "100%", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "#1a1a1a", color: "white", padding: "10px 12px", fontSize: 13, outline: "none", resize: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box" }} />
                    <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                      <button onClick={() => setEditingSignature(false)} style={{ height: 32, padding: "0 12px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#6b7280", fontSize: 12, cursor: "pointer" }}>Annuler</button>
                      <button onClick={() => { void saveVisionOrSignature("signature", signatureDraft); setSignatureText(signatureDraft); setEditingSignature(false); }} disabled={savingSignature || !signatureDraft.trim()}
                        style={{ height: 32, padding: "0 14px", borderRadius: 8, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: emerald, fontSize: 12, fontWeight: 600, cursor: !signatureDraft.trim() ? "not-allowed" : "pointer", opacity: !signatureDraft.trim() ? 0.5 : 1 }}>
                        Mettre à jour
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={emerald} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      <span style={{ fontSize: 12, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>
                        {signatureText ? "Ma Signature" : <span style={{ color: "#4b5563" }}>Ma Signature (non renseignée)</span>}
                      </span>
                    </div>
                    <button onClick={() => { if (!onboardingDemoMode) { setSignatureDraft(signatureText); setEditingSignature(true); } }}
                      style={{ background: "none", border: "none", cursor: onboardingDemoMode ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, color: onboardingDemoMode ? "#374151" : emerald, padding: "0 0 0 8px", flexShrink: 0 }}
                      onMouseEnter={e => { if (!onboardingDemoMode) e.currentTarget.style.opacity = "0.7"; }}
                      onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                      Modifier
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* AJOUTER DES DOCUMENTS */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>Ajouter des documents</p>
              <div style={{ marginBottom: 12 }}>
                <label style={{ borderRadius: 12, border: `2px dashed ${onboardingDemoMode ? "rgba(255,255,255,0.07)" : documentType === "protocole" ? emerald : "rgba(255,255,255,0.15)"}`, background: onboardingDemoMode ? "rgba(255,255,255,0.01)" : documentType === "protocole" ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)", padding: "16px", textAlign: "left", cursor: onboardingDemoMode ? "not-allowed" : "pointer", transition: "all 0.2s", display: "block", opacity: onboardingDemoMode ? 0.4 : 1 }}
                  onMouseEnter={e => { if (!onboardingDemoMode) { e.currentTarget.style.borderColor = "rgba(16,185,129,0.6)"; e.currentTarget.style.background = "rgba(16,185,129,0.05)"; } }}
                  onMouseLeave={e => { if (!onboardingDemoMode) { e.currentTarget.style.borderColor = documentType === "protocole" ? emerald : "rgba(255,255,255,0.15)"; e.currentTarget.style.background = documentType === "protocole" ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)"; } }}>
                  <input type="file" multiple accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.csv,.mp3,.wav,.m4a" onChange={e => { if (!onboardingDemoMode) { setDocumentType("protocole"); handleFileChange(e); } }} style={{ display: "none" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={emerald} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
                    <div>
                      <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: "white" }}>Protocoles & méthodes</p>
                      <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Articles, plans alimentaires, guides nutritionnels</p>
                    </div>
                  </div>
                  <div style={{ borderRadius: 8, border: "1px dashed rgba(255,255,255,0.12)", padding: "8px 12px", textAlign: "center" }}>
                    <span style={{ fontSize: 11, color: "#64748b" }}>Cliquez pour sélectionner · PDF, DOCX, TXT, MP3...</span>
                  </div>
                </label>
              </div>

              {uploadedFiles.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  {uploadedFiles.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <span style={{ fontSize: 13, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                      </div>
                      <button onClick={() => setUploadedFiles(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "0 4px", flexShrink: 0, fontSize: 18, lineHeight: 1 }}
                        onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
                        onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
                        ×
                      </button>
                    </div>
                  ))}
                  {uploadErrors.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      {uploadErrors.map((e, i) => (
                        <p key={i} style={{ margin: "0 0 4px", fontSize: 12, color: "#f87171", display: "flex", alignItems: "center", gap: 6 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>{e}
                        </p>
                      ))}
                    </div>
                  )}
                  {uploadSuccess.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      {uploadSuccess.map((name, i) => (
                        <p key={i} style={{ margin: "0 0 4px", fontSize: 12, color: emerald, display: "flex", alignItems: "center", gap: 6 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>{name} indexé
                        </p>
                      ))}
                    </div>
                  )}
                  <button onClick={async () => { await uploadFiles(); }} disabled={uploading || !documentType}
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 12px", borderRadius: 12, background: uploading || !documentType ? "rgba(255,255,255,0.04)" : "rgba(16,185,129,0.12)", border: `1px solid ${uploading || !documentType ? "rgba(255,255,255,0.06)" : "rgba(16,185,129,0.3)"}`, color: uploading || !documentType ? "#64748b" : emerald, fontSize: 14, fontWeight: 600, cursor: uploading || !documentType ? "not-allowed" : "pointer", transition: "all 0.2s" }}
                    onMouseEnter={e => { if (!uploading && documentType) { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; } }}
                    onMouseLeave={e => { e.currentTarget.style.background = uploading || !documentType ? "rgba(255,255,255,0.04)" : "rgba(16,185,129,0.12)"; e.currentTarget.style.borderColor = uploading || !documentType ? "rgba(255,255,255,0.06)" : "rgba(16,185,129,0.3)"; }}>
                    {uploading ? <><svg style={{ animation: "spin 1s linear infinite" }} width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>{uploadProgress ? `Indexation ${uploadProgress.current}/${uploadProgress.total}` : "Indexation en cours"}</> : `Indexer ${uploadedFiles.length} fichier${uploadedFiles.length > 1 ? "s" : ""}`}
                  </button>
                  {uploading && <p style={{ fontSize: 12, color: "#f59e0b", textAlign: "center", marginTop: 6 }}>Patientez, l'indexation peut prendre quelques instants.</p>}
                </div>
              )}
            </div>

            {/* DOCUMENTS INDEXÉS */}
            {documents.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>Documents indexés</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {documents.map((doc) => {
                    const isAudio = doc.file_type?.startsWith("audio") || doc.file_name?.endsWith(".mp3") || doc.file_name?.endsWith(".wav") || doc.file_name?.endsWith(".m4a");
                    const isNote = doc.file_name?.startsWith("note_praticien_");
                    return (
                      <div key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          {isAudio ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                            </svg>
                          ) : isNote ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={emerald} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                            </svg>
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                            </svg>
                          )}
                          <span style={{ fontSize: 12, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }}>
                            {isNote ? "Note praticien" : isAudio ? "Mémo vocal" : doc.file_name}
                          </span>
                          <span style={{ fontSize: 11, color: "#475569", flexShrink: 0 }}>
                            {new Date(doc.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          </span>
                        </div>
                        <button
                          onClick={async () => {
                            await supabase.from("documents").delete().eq("id", doc.id);
                            if (practitionerId) await loadDocuments(practitionerId);
                          }}
                          style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", padding: "0 4px", flexShrink: 0, transition: "color 0.2s", fontSize: 18, lineHeight: 1 }}
                          onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
                          onMouseLeave={e => e.currentTarget.style.color = "#475569"}>
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

{/* Modale upload document patient */}
      {showPatientDocModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowPatientDocModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 20, padding: 24, width: "100%", maxWidth: 460, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.12em" }}>Mes documents</p>
                <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: "white" }}>Enrichissez la base de connaissances de votre Jumeau</h2>
                <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>Importez comptes-rendus, bilans ou documents de référence pour ce patient.</p>
              </div>
              <button onClick={() => setShowPatientDocModal(false)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", color: "#94a3b8", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "#e2e8f0"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "#94a3b8"; }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 10 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <p style={{ margin: 0, fontSize: 12, color: "#93c5fd", lineHeight: 1.5 }}>Les documents sont automatiquement anonymisés par l'IA dès l'importation pour garantir la confidentialité des données.</p>
            </div>

            {/* Zone de sélection */}
            <label style={{ display: "block", borderRadius: 12, border: `2px dashed ${patientDocFiles.length > 0 ? "rgba(96,165,250,0.5)" : "rgba(255,255,255,0.15)"}`, background: patientDocFiles.length > 0 ? "rgba(96,165,250,0.06)" : "rgba(255,255,255,0.02)", padding: "16px", cursor: "pointer", transition: "all 0.2s", marginBottom: 12, textAlign: "center" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(96,165,250,0.5)"; e.currentTarget.style.background = "rgba(96,165,250,0.05)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = patientDocFiles.length > 0 ? "rgba(96,165,250,0.5)" : "rgba(255,255,255,0.15)"; e.currentTarget.style.background = patientDocFiles.length > 0 ? "rgba(96,165,250,0.06)" : "rgba(255,255,255,0.02)"; }}>
              <input type="file" multiple accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.csv" onChange={e => {
                const files = Array.from(e.target.files ?? []).filter(f => {
                  const ext = f.name.split(".").pop()?.toLowerCase();
                  return ["pdf","docx","txt","jpg","jpeg","png","xlsx","csv"].includes(ext ?? "");
                });
                setPatientDocFiles(prev => [...prev, ...files]);
                e.target.value = "";
              }} style={{ display: "none" }} />
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 8px" }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: "white" }}>Cliquez pour sélectionner</p>
              <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>PDF, DOCX, TXT, images, Excel · max 10MB</p>
            </label>

            {patientDocFiles.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {patientDocFiles.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <span style={{ fontSize: 12, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    </div>
                    <button onClick={() => setPatientDocFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 2 }} onMouseEnter={e => e.currentTarget.style.color = "#f87171"} onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {patientDocErrors.length > 0 && patientDocErrors.map((e, i) => (
              <p key={i} style={{ margin: "0 0 4px", fontSize: 12, color: "#f87171" }}>{e}</p>
            ))}
            {patientDocSuccess.length > 0 && patientDocSuccess.map((name, i) => (
              <p key={i} style={{ margin: "0 0 4px", fontSize: 12, color: "#60a5fa", display: "flex", alignItems: "center", gap: 5 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>{name} indexé
              </p>
            ))}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowPatientDocModal(false)} style={{ flex: 1, height: 44, borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button
                onClick={async () => {
                  if (patientDocFiles.length === 0) return;
                  setPatientDocUploading(true); setPatientDocErrors([]); setPatientDocSuccess([]);
                  // Mode démo : simulation 2s + ajout d'un faux document local
                  if (onboardingDemoMode) {
                    await new Promise(r => setTimeout(r, 2000));
                    const fakeDoc: Document = {
                      id: `demo-doc-${Date.now()}`,
                      file_name: "Bilan_Demo_Anonymise.pdf",
                      file_type: "pdf",
                      created_at: new Date().toISOString(),
                    };
                    setDocuments(prev => [fakeDoc, ...prev]);
                    setPatientDocSuccess(["Bilan_Demo_Anonymise.pdf"]);
                    setPatientDocUploading(false);
                    setPatientDocFiles([]);
                    setHasDocuments(true);
                    return;
                  }
                  if (!practitionerId || !selectedPatientId) return;
                  for (const file of patientDocFiles) {
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("practitionerId", practitionerId);
                    formData.append("patientId", selectedPatientId);
                    formData.append("documentType", "patient");
                    try {
                      const res = await fetch("/api/upload-document", { method: "POST", body: formData });
                      const data = await res.json() as { success?: boolean; error?: string };
                      if (res.ok && data.success) setPatientDocSuccess(prev => [...prev, file.name]);
                      else setPatientDocErrors(prev => [...prev, `${file.name} : ${data.error ?? "Erreur"}`]);
                    } catch { setPatientDocErrors(prev => [...prev, `${file.name} : Erreur réseau`]); }
                  }
                  setPatientDocUploading(false);
                  setPatientDocFiles([]);
                  setHasDocuments(true);
                  if (practitionerId) await loadDocuments(practitionerId);
                }}
                disabled={patientDocUploading || patientDocFiles.length === 0 || onboardingDemoMode}
                style={{ flex: 2, height: 44, borderRadius: 10, background: patientDocUploading || patientDocFiles.length === 0 || onboardingDemoMode ? "rgba(96,165,250,0.05)" : "rgba(96,165,250,0.15)", border: `1px solid ${patientDocUploading || patientDocFiles.length === 0 || onboardingDemoMode ? "rgba(96,165,250,0.1)" : "rgba(96,165,250,0.35)"}`, color: patientDocUploading || patientDocFiles.length === 0 || onboardingDemoMode ? "#4b5563" : "#60a5fa", fontSize: 13, fontWeight: 600, cursor: patientDocUploading || patientDocFiles.length === 0 || onboardingDemoMode ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
                {patientDocUploading ? "Anonymisation & indexation..." : `Indexer ${patientDocFiles.length > 0 ? patientDocFiles.length + " fichier" + (patientDocFiles.length > 1 ? "s" : "") : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfileModal && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowProfileModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 24, padding: 28, width: "100%", maxWidth: 760, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: emerald, textTransform: "uppercase", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 8 }}>
                  Modifier le profil
                  {selectedPatient?.is_test && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: emerald, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 4, padding: "2px 7px", letterSpacing: "0.08em", textTransform: "uppercase" }}>Test</span>
                  )}
                </p>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "white" }}>{selectedPatient?.firstName} {selectedPatient?.lastName}</h2>
              </div>
              <button onClick={() => setShowProfileModal(false)}
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", color: "#94a3b8", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "#e2e8f0"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "#94a3b8"; }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {pendingCorrections.length > 0 && (
              <div style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 20, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                <div>
                  <p style={{ margin: "0 0 5px", fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>{pendingCorrections.length} correction{pendingCorrections.length > 1 ? "s" : ""} demandée{pendingCorrections.length > 1 ? "s" : ""} par le patient</p>
                  {pendingCorrections.map((c, i) => (
                    <p key={i} style={{ margin: "0 0 2px", fontSize: 11, color: "#94a3b8" }}><strong style={{ color: "#e2e8f0" }}>{c.field}</strong>{c.correction ? ` : ${c.correction}` : ""}</p>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              {/* Colonne gauche - Informations patient */}
              <div>
                <p style={{ margin: "0 0 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b" }}>Informations patient</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Email</p>
                    <input type="email" value={
                      selectedPatient?.is_test
                        ? `test_${(selectedPatient.firstName ?? "").toLowerCase().replace(/\s+/g, "")}${(selectedPatient.lastName ?? "").toLowerCase().replace(/\s+/g, "")}@nutritwin.fr`
                        : ((selectedPatient as RealPatient)?.email ?? "")
                    } disabled
                      style={{ width: "100%", height: 42, borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", color: "#64748b", padding: "0 14px", fontSize: 13, outline: "none", boxSizing: "border-box", cursor: "not-allowed" }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Prénom</p>
                      <input ref={firstNameInputRef} type="text" value={editFirstName} onChange={e => setEditFirstName(e.target.value)} placeholder="Sophie"
                        style={{ width: "100%", height: 42, borderRadius: 10, border: focusFirstNameOnOpen ? `1.5px solid ${SLATE_BLUE}` : "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 12px", fontSize: 13, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
                        onFocus={e => { e.target.style.borderColor = emerald; setFocusFirstNameOnOpen(false); }} onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                    </div>
                    <div>
                      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Nom</p>
                      <input type="text" value={editLastName} onChange={e => setEditLastName(e.target.value)} placeholder="Martin"
                        style={{ width: "100%", height: 42, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                        onFocus={e => e.target.style.borderColor = emerald} onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                    {[
                      { label: "Âge", value: editAge, setter: setEditAge, placeholder: "34", min: 0, max: 110 },
                      { label: "Taille (cm)", value: editTaille, setter: setEditTaille, placeholder: "168", min: 0, max: 250 },
                      { label: "Poids (kg)", value: editPoids, setter: setEditPoids, placeholder: "72", min: 0, max: 500 },
                    ].map(({ label, value, setter, placeholder, min, max }) => {
                      const pending = pendingCorrections.some(c => { const cl = (c.field ?? "").toLowerCase(); const dl = label.toLowerCase().split(" ")[0]; return cl === dl || cl.startsWith(dl) || dl.startsWith(cl); });
                      return (
                        <div key={label}>
                          <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: pending ? "#f59e0b" : "#94a3b8" }}>{label}{pending && <span style={{ marginLeft: 5, fontSize: 8 }}>●</span>}</p>
                          <input type="number" value={value}
                            onChange={e => { const val = parseInt(e.target.value); if (e.target.value === "" || (val >= min && val <= max)) setter(e.target.value); }}
                            placeholder={placeholder} min={min} max={max}
                            style={{ width: "100%", height: 42, borderRadius: 10, border: pending ? "1.5px solid rgba(245,158,11,0.45)" : "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box", MozAppearance: "textfield" } as React.CSSProperties}
                            onFocus={e => { e.target.style.borderColor = pending ? "#f59e0b" : emerald; }} onBlur={e => { e.target.style.borderColor = pending ? "rgba(245,158,11,0.45)" : "rgba(255,255,255,0.1)"; }} />
                        </div>
                      );
                    })}
                    <div>
                      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: pendingCorrections.some(c => (c.field ?? "").toLowerCase() === "sexe") ? "#f59e0b" : "#94a3b8" }}>Sexe{pendingCorrections.some(c => (c.field ?? "").toLowerCase() === "sexe") && <span style={{ marginLeft: 5, fontSize: 8 }}>●</span>}</p>
                      <select value={editSexe} onChange={e => setEditSexe(e.target.value)}
                        style={{ width: "100%", height: 42, borderRadius: 10, border: pendingCorrections.some(c => (c.field ?? "").toLowerCase() === "sexe") ? "1.5px solid rgba(245,158,11,0.45)" : "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}>
                        <option value="">Choisir</option>
                        <option value="Femme">Femme</option>
                        <option value="Homme">Homme</option>
                        <option value="Autre">Autre</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Colonne droite - Contexte médical */}
              <div>
                <p style={{ margin: "0 0 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b" }}>Contexte médical</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[
                    { label: "Pathologies", value: editPathologies, setter: setEditPathologies, id: "path", options: ["Diabète type 2", "Hypertension", "Hypothyroïdie", "SOPK", "Cholestérol", "TCA", "Surpoids"] },
                    { label: "Allergies", value: editAllergies, setter: setEditAllergies, id: "allerg", options: ["Gluten", "Lactose", "Fruits à coque", "Œufs", "Fruits de mer"] },
                    { label: "Traitements", value: editTraitements, setter: setEditTraitements, id: "trait", options: ["Metformine", "Lévothyrox", "Pilule contraceptive", "Antidépresseurs", "Insuline"] },
                    { label: "Objectif", value: editObjectifClinique, setter: setEditObjectifClinique, id: "obj", options: ["Perte de poids", "Prise de masse", "Équilibre glycémique", "Bien-être général", "Grossesse"] },
                    { label: "Activité", value: editNiveauActivite, setter: setEditNiveauActivite, id: "activ", options: ["Sédentaire", "Légère", "Modérée", "Intense", "Athlète"] },
                    { label: "Régime", value: editRegime, setter: setEditRegime, id: "regime", options: ["Végétarien", "Vegan", "Sans gluten", "Halal", "Méditerranéen"] },
                  ].map(({ label, value, setter, id, options }) => {
                    const isAutre = value !== "" && !options.includes(value) && value !== "Aucune" && value !== "Aucun";
                    const pending = pendingCorrections.some(c => { const cl = (c.field ?? "").toLowerCase(); const dl = label.toLowerCase(); return cl.startsWith(dl) || dl.startsWith(cl); });
                    return (
                      <div key={id}>
                        <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: pending ? "#f59e0b" : "#94a3b8" }}>{label}{pending && <span style={{ marginLeft: 5, fontSize: 8 }}>●</span>}</p>
                        <select value={isAutre ? "Autre" : value} onChange={e => { if (e.target.value === "Autre") setter("__autre__"); else setter(e.target.value); }}
                          style={{ width: "100%", height: 42, borderRadius: 8, border: pending ? "1.5px solid rgba(245,158,11,0.45)" : "1px solid rgba(255,255,255,0.08)", background: "#161616", color: "white", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box", cursor: "pointer" }}>
                          <option value="">Choisir</option>
                          <option value="Aucune">{["Pathologies", "Allergies", "Activité"].includes(label) ? "Aucune" : "Aucun"}</option>
                          {options.map(o => <option key={o} value={o}>{o}</option>)}
                          <option value="Autre">Autre</option>
                        </select>
                        {(value === "__autre__" || isAutre) && (
                          <input type="text" value={value === "__autre__" ? "" : value} onChange={e => setter(e.target.value)} placeholder="Précisez..." autoFocus
                            style={{ width: "100%", height: 38, borderRadius: 8, border: "1px solid rgba(16,185,129,0.3)", background: "#161616", color: "white", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box", marginTop: 6 }}
                            onFocus={e => e.target.style.borderColor = emerald} onBlur={e => e.target.style.borderColor = "rgba(16,185,129,0.3)"} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Étape 3 : Profil patient — uniquement pour les patients test ── */}
            {selectedPatient?.is_test && (
              <>
                <div style={{ margin: "24px 0 20px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b" }}>Profil patient</p>
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {([
                      { label: "Sommeil", key: "sommeil" as const, value: editSommeil, setter: setEditSommeil, options: ["Moins de 6h", "6 à 7h", "7 à 8h", "Plus de 8h"], hasAutre: false },
                      { label: "État d'esprit", key: "humeur" as const, value: editHumeur, setter: setEditHumeur, options: ["Très motivé(e)", "Optimiste", "Un peu anxieux(se)", "Complètement perdu(e)", "Volontaire mais fatigué(e)", "Aucun"], hasAutre: true },
                      { label: "Défi principal", key: "defi" as const, value: editDefiPrincipal, setter: setEditDefiPrincipal, options: ["Manque de temps", "Pulsions sucrées", "Repas au restaurant", "Manque de motivation", "Organisation en cuisine", "Manger sous le stress", "Aucun"], hasAutre: true },
                      { label: "Inconforts digestifs", key: "digestif" as const, value: editDigestif, setter: setEditDigestif, options: ["Ballonnements fréquents", "Transit lent", "Transit rapide", "Reflux / brûlures", "Aucun inconfort"], hasAutre: true },
                    ] as { label: string; key: string; value: string; setter: (v: string) => void; options: string[]; hasAutre: boolean }[]).map(({ label, key, value, setter, options, hasAutre }) => {
                      const isAutre = hasAutre && value !== "" && value !== "__autre__" && !options.includes(value);
                      return (
                        <div key={key}>
                          <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{label}</p>
                          <select value={isAutre ? "Autre" : value} onChange={e => { if (e.target.value === "Autre") setter("__autre__"); else setter(e.target.value); }}
                            style={{ width: "100%", height: 42, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#161616", color: "white", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box", cursor: "pointer" }}>
                            <option value="">Choisir</option>
                            {options.map(o => <option key={o} value={o}>{o}</option>)}
                            {hasAutre && <option value="Autre">Autre</option>}
                          </select>
                          {hasAutre && (value === "__autre__" || isAutre) && (
                            <input type="text" value={value === "__autre__" ? "" : value} onChange={e => setter(e.target.value)} placeholder="Précisez..." autoFocus
                              style={{ width: "100%", height: 38, borderRadius: 8, border: "1px solid rgba(16,185,129,0.3)", background: "#161616", color: "white", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box", marginTop: 6 }}
                              onFocus={e => e.target.style.borderColor = emerald} onBlur={e => e.target.style.borderColor = "rgba(16,185,129,0.3)"} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: selectedPatient?.is_test ? 4 : 24 }}>
              <button onClick={() => setShowProfileModal(false)}
                style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500, transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>
                Annuler
              </button>
              <button onClick={() => { if (!onboardingDemoMode) void saveProfile(); }} disabled={savingProfile || onboardingDemoMode}
                style={{ flex: 2, height: 44, borderRadius: 10, background: onboardingDemoMode ? "rgba(255,255,255,0.04)" : "rgba(16,185,129,0.12)", border: `1px solid ${onboardingDemoMode ? "rgba(255,255,255,0.06)" : "rgba(16,185,129,0.3)"}`, color: onboardingDemoMode ? "#374151" : emerald, cursor: savingProfile || onboardingDemoMode ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, opacity: savingProfile ? 0.7 : 1, transition: "all 0.2s" }}
                onMouseEnter={e => { if (!savingProfile && !onboardingDemoMode) { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; } }}
                onMouseLeave={e => { if (!onboardingDemoMode) { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; } }}>
                {onboardingDemoMode ? "Indisponible en mode démo" : savingProfile ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500/20 border-t-emerald-500" />Sauvegarde</span> : "Mettre à jour les informations"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportModal && (
        <div onClick={(e) => { if (e.target === e.currentTarget) { setShowReportModal(false); setReportContent(""); setReportError(""); } }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 20, padding: 28, width: "100%", maxWidth: 560, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "white" }}>Rapport - {selectedPatient?.firstName}</h2>
              </div>
              <button onClick={() => { setShowReportModal(false); setReportContent(""); setReportError(""); }}
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", color: "#94a3b8", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "#e2e8f0"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "#94a3b8"; }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.1)", borderRadius: 10, padding: "11px 14px", marginBottom: 18 }}>
              <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>L'IA génère un compte rendu professionnel basé sur les conversations de votre patient sur la période choisie.</p>
            </div>
            {!reportContent && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {[{ value: "week", label: "Cette semaine" }, { value: "month", label: "Ce mois" }, { value: "custom", label: "Personnalisé" }].map((option) => (
                    <button key={option.value} onClick={() => { setReportPeriod(option.value as ReportPeriod); setReportDateFrom(""); setReportDateTo(""); }}
                      style={{ flex: 1, height: 34, borderRadius: 8, border: `1px solid ${reportPeriod === option.value ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)"}`, background: reportPeriod === option.value ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.02)", color: reportPeriod === option.value ? "#818cf8" : "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
                      onMouseEnter={e => { if (reportPeriod !== option.value) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#94a3b8"; } }}
                      onMouseLeave={e => { if (reportPeriod !== option.value) { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#64748b"; } }}>
                      {option.label}
                    </button>
                  ))}
                </div>
                {reportPeriod === "custom" && (
                  <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: "12px 12px 10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <button onClick={() => setReportMonth(new Date(reportMonth.getFullYear(), reportMonth.getMonth() - 1))}
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.10)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "white"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#94a3b8"; }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                      </button>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "white", textTransform: "capitalize" }}>{reportMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</span>
                      <button onClick={() => setReportMonth(new Date(reportMonth.getFullYear(), reportMonth.getMonth() + 1))}
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.10)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "white"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#94a3b8"; }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
                      {["L","M","M","J","V","S","D"].map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "#475569", padding: "3px 0" }}>{d}</div>)}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
                      {getCalendarDays().map((day, i) => {
                        if (!day) return <div key={i} />;
                        const isFuture = day.date > today;
                        const isFrom = day.date === reportDateFrom;
                        const isTo = day.date === reportDateTo;
                        const isInRange = reportDateFrom && reportDateTo && day.date > reportDateFrom && day.date < reportDateTo;
                        return (
                          <button key={i} onClick={() => { if (isFuture) return; if (!reportDateFrom || (reportDateFrom && reportDateTo)) { setReportDateFrom(day.date); setReportDateTo(""); } else if (day.date >= reportDateFrom) setReportDateTo(day.date); else { setReportDateFrom(day.date); setReportDateTo(""); } }}
                            style={{ aspectRatio: "1", borderRadius: 5, border: isFrom || isTo ? "1.5px solid #818cf8" : "1px solid transparent", cursor: isFuture ? "not-allowed" : "pointer", background: isInRange ? "rgba(99,102,241,0.1)" : "transparent", color: isFrom || isTo ? "#818cf8" : isFuture ? "#374151" : "#cbd5e1", fontSize: 10, fontWeight: isFrom || isTo ? 700 : 400, opacity: isFuture ? 0.25 : 1, padding: "3px 0" }}>
                            {day.day}
                          </button>
                        );
                      })}
                    </div>
                    {reportDateFrom && <p style={{ margin: "10px 0 0", fontSize: 11, color: "#818cf8", textAlign: "center" }}>{reportDateTo ? `Du ${new Date(reportDateFrom + "T12:00:00").toLocaleDateString("fr-FR")} au ${new Date(reportDateTo + "T12:00:00").toLocaleDateString("fr-FR")}` : `Début : ${new Date(reportDateFrom + "T12:00:00").toLocaleDateString("fr-FR")}, sélectionnez la date de fin`}</p>}
                  </div>
                )}
              </div>
            )}
            {reportError && (
              <div style={{ background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.18)", borderRadius: 10, padding: "11px 14px", marginBottom: 14, fontSize: 13, color: "#f87171" }}>
                {reportError}
              </div>
            )}
            {!reportContent && !reportLoading && (
              <button onClick={() => { if (!onboardingDemoMode) void generateReport(); }} disabled={onboardingDemoMode || (reportPeriod === "custom" && (!reportDateFrom || !reportDateTo))}
                style={{ width: "100%", height: 44, borderRadius: 10, background: (onboardingDemoMode || (reportPeriod === "custom" && (!reportDateFrom || !reportDateTo))) ? "rgba(255,255,255,0.02)" : "rgba(99,102,241,0.1)", border: `1px solid ${(onboardingDemoMode || (reportPeriod === "custom" && (!reportDateFrom || !reportDateTo))) ? "rgba(255,255,255,0.06)" : "rgba(99,102,241,0.3)"}`, color: (onboardingDemoMode || (reportPeriod === "custom" && (!reportDateFrom || !reportDateTo))) ? "#374151" : "#818cf8", fontSize: 14, fontWeight: 600, cursor: (onboardingDemoMode || (reportPeriod === "custom" && (!reportDateFrom || !reportDateTo))) ? "not-allowed" : "pointer", marginBottom: 4, transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                onMouseEnter={e => { if (!onboardingDemoMode && !(reportPeriod === "custom" && (!reportDateFrom || !reportDateTo))) { e.currentTarget.style.background = "rgba(99,102,241,0.18)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; } }}
                onMouseLeave={e => { if (!onboardingDemoMode && !(reportPeriod === "custom" && (!reportDateFrom || !reportDateTo))) { e.currentTarget.style.background = "rgba(99,102,241,0.1)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.3)"; } }}>
                {onboardingDemoMode ? "Indisponible en mode démo" : "Générer le rapport"}
              </button>
            )}
            {reportLoading && (
              <div style={{ textAlign: "center", padding: "44px 0" }}>
                <svg style={{ animation: "spin 1s linear infinite", marginBottom: 14, display: "block", margin: "0 auto 14px" }} width="26" height="26" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="rgba(99,102,241,0.2)" strokeWidth="3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#818cf8" strokeWidth="3" strokeLinecap="round"/></svg>
                <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Génération du rapport en cours</p>
              </div>
            )}
            {reportContent && (() => {
              try {
                const parsed = JSON.parse(reportContent) as { lowData?: boolean; message?: string; synthese?: string; patterns?: string; victoires?: string; murmures_bilan?: string };
                if (parsed.lowData) {
                  return (
                    <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.18)", borderRadius: 14, padding: "20px", textAlign: "center", marginBottom: 16 }}>
                      <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>{parsed.message}</p>
                    </div>
                  );
                }
                const sections = [
                  { key: "synthese", label: "Synthèse", color: "#818cf8", borderColor: "rgba(99,102,241,0.2)", bg: "rgba(99,102,241,0.04)" },
                  { key: "patterns", label: "Patterns observés", color: "#60a5fa", borderColor: "rgba(96,165,250,0.2)", bg: "rgba(96,165,250,0.04)" },
                  { key: "victoires", label: "Victoires de la période", color: emerald, borderColor: "rgba(16,185,129,0.2)", bg: "rgba(16,185,129,0.04)" },
                  { key: "murmures_bilan", label: "Points à approfondir", color: "#f59e0b", borderColor: "rgba(245,158,11,0.2)", bg: "rgba(245,158,11,0.04)" },
                ];
                return (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                      {sections.map(({ key, label, color, borderColor, bg }) => (
                        <div key={key} style={{ background: bg, border: `1px solid ${borderColor}`, borderRadius: 12, padding: "14px 16px" }}>
                          <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</p>
                          <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>{parsed[key as keyof typeof parsed] as string ?? "—"}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => { setReportContent(""); setReportError(""); }}
                        style={{ flex: 1, height: 40, borderRadius: 9, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", color: "#64748b", cursor: "pointer", fontSize: 13, fontWeight: 500, transition: "all 0.2s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#94a3b8"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#64748b"; }}>Nouvelle période</button>
                      <button onClick={() => void navigator.clipboard.writeText([parsed.synthese, parsed.patterns, parsed.victoires, parsed.murmures_bilan].filter(Boolean).join("\n\n"))}
                        style={{ flex: 1, height: 40, borderRadius: 9, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", color: "#64748b", cursor: "pointer", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.2s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#94a3b8"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#64748b"; }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        Copier
                      </button>
                      <button onClick={() => void exportPDF()}
                        style={{ flex: 1, height: 40, borderRadius: 9, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", color: "#64748b", cursor: "pointer", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.2s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#94a3b8"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#64748b"; }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        PDF
                      </button>
                    </div>
                  </>
                );
              } catch {
                return (
                  <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.18)", borderRadius: 12, padding: "16px 18px", textAlign: "center" }}>
                    <p style={{ margin: "0 0 6px", fontSize: 13, color: "#f59e0b", fontWeight: 600 }}>Erreur de lecture du rapport</p>
                    <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Le rapport n'a pas pu être analysé. Veuillez réessayer.</p>
                    <button onClick={() => { setReportContent(""); setReportError(""); }} style={{ marginTop: 12, height: 34, padding: "0 16px", borderRadius: 8, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "#f59e0b", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Réessayer</button>
                  </div>
                );
              }
            })()}
          </div>
        </div>
      )}

      {showInviteModal && (
        <div onClick={(e) => { e.stopPropagation(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 24, padding: 28, width: "100%", maxWidth: 500, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", position: "relative" }}>
            {!inviteSuccess && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: emerald, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  {`Étape ${inviteStep} sur 3`}
                </p>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "white" }}>
                  {inviteStep === 1 ? "Nouveau patient" : inviteStep === 2 ? "Contexte médical" : "Murmure"}
                </h2>
              </div>
              <button onClick={() => { setShowInviteModal(false); resetInviteForm(); setInviteStep(1); }} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", color: "#94a3b8", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "#e2e8f0"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "#94a3b8"; }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            )}

            {!inviteSuccess && (
              <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= inviteStep ? emerald : "rgba(255,255,255,0.08)", transition: "background 0.3s" }} />
                ))}
              </div>
            )}

            {inviteSuccess ? (
              <div style={{ textAlign: "center", padding: "16px 0 20px" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke={emerald} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: emerald }}>Invitation envoyée</p>
                <p style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 800, color: "white" }}>C'est parti !</p>
                <p style={{ margin: "0 0 28px", fontSize: 13, color: "#64748b" }}>{inviteFirstName ? `${inviteFirstName} va recevoir son invitation.` : `${inviteEmail} va recevoir son invitation.`}</p>
                <button onClick={() => { setShowInviteModal(false); resetInviteForm(); }}
                  style={{ height: 44, borderRadius: 10, padding: "0 24px", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: emerald, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; }}>
                  Fermer
                </button>
              </div>
            ) : inviteStep === 1 ? (
              <>
                {inviteExistingUnactivated ? (
                  /* ── Patient existant non activé - UI bloquante ── */
                  <>
                    <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: "16px 18px", marginBottom: 20 }}>
                      <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "#fbbf24", display: "flex", alignItems: "center", gap: 5 }}><AlertIcon size={13} color="#fbbf24" />Patient déjà invité</p>
                      <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                        <strong style={{ color: "white" }}>{inviteEmail}</strong> a déjà reçu une invitation mais n&apos;a pas encore créé son mot de passe. Vous ne pouvez pas créer une nouvelle invitation - renvoyez-lui le lien à la place.
                      </p>
                    </div>
                    {inviteResentSuccess ? (
                      <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 12, padding: "20px", textAlign: "center", marginBottom: 20 }}>
                        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(5,150,105,0.15)", border: "2px solid #059669", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                        <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "white" }}>Lien renvoyé !</p>
                        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Un nouvel email d&apos;invitation a été envoyé à <strong style={{ color: emerald }}>{inviteEmail}</strong>.</p>
                      </div>
                    ) : (
                      <>
                        {inviteError && <p style={{ margin: "0 0 12px", fontSize: 13, color: "#f87171" }}>{inviteError}</p>}
                        <button onClick={() => void resendFromModal()} disabled={inviteResentLoading}
                          style={{ width: "100%", height: 48, borderRadius: 12, background: inviteResentLoading ? "rgba(255,255,255,0.05)" : "rgba(16,185,129,0.12)", border: `1px solid ${inviteResentLoading ? "rgba(255,255,255,0.08)" : "rgba(16,185,129,0.3)"}`, color: inviteResentLoading ? "#64748b" : emerald, cursor: inviteResentLoading ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, marginBottom: 10, transition: "all 0.2s" }}>
                          {inviteResentLoading ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500/20 border-t-emerald-500" />Envoi en cours</span> : "Renvoyer le lien d'invitation"}
                        </button>
                      </>
                    )}
                    <button onClick={() => { setInviteExistingUnactivated(false); setInviteEmail(""); setInviteError(""); setInviteResentSuccess(false); }}
                      style={{ width: "100%", height: 40, borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b", cursor: "pointer", fontSize: 13 }}>
                      ← Modifier l&apos;email
                    </button>
                  </>
                ) : (
                  /* ── Formulaire normal ── */
                  <>
                    <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>Les informations de base pour créer l&apos;espace de votre patient.</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div>
                        <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Email <span style={{ color: "#f87171" }}>*</span></p>
                        <input type="email" value={inviteEmail} onChange={e => { setInviteEmail(e.target.value); setInviteError(""); }} placeholder="patient@email.fr"
                          style={{ width: "100%", height: 46, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 14px", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 10 }}
                          onFocus={e => e.target.style.borderColor = emerald} onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                          <div>
                            <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Prénom <span style={{ color: "#f87171" }}>*</span></p>
                            <input type="text" value={inviteFirstName} onChange={e => setInviteFirstName(e.target.value)} placeholder="Sophie"
                              style={{ width: "100%", height: 42, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                              onFocus={e => e.target.style.borderColor = emerald} onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                          </div>
                          <div>
                            <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Nom</p>
                            <input type="text" value={inviteLastName} onChange={e => setInviteLastName(e.target.value)} placeholder="Martin"
                              style={{ width: "100%", height: 42, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                              onFocus={e => e.target.style.borderColor = emerald} onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                        {[
                          { label: "Âge", value: inviteAge, setter: setInviteAge, placeholder: "34", min: 0, max: 110 },
                          { label: "Taille (cm)", value: inviteTaille, setter: setInviteTaille, placeholder: "168", min: 0, max: 250 },
                          { label: "Poids (kg)", value: invitePoids, setter: setInvitePoids, placeholder: "72", min: 0, max: 500 },
                        ].map(({ label, value, setter, placeholder, min, max }) => (
                          <div key={label}>
                            <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{label}</p>
                            <input type="number" value={value}
                              onChange={e => { const val = parseInt(e.target.value); if (e.target.value === "" || (val >= min && val <= max)) setter(e.target.value); }}
                              placeholder={placeholder} min={min} max={max}
                              style={{ width: "100%", height: 42, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box", MozAppearance: "textfield" } as React.CSSProperties}
                              onFocus={e => e.target.style.borderColor = emerald} onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                          </div>
                        ))}
                        <div>
                          <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Sexe <span style={{ color: "#f87171" }}>*</span></p>
                          <select value={inviteSexe} onChange={e => setInviteSexe(e.target.value)}
                            style={{ width: "100%", height: 42, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}>
                            <option value="">Choisir</option>
                            <option value="Femme">Femme</option>
                            <option value="Homme">Homme</option>
                            <option value="Autre">Autre</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    {inviteError && <p style={{ margin: "16px 0 0", fontSize: 13, color: "#f87171" }}>{inviteError}</p>}
                    <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
                      <button onClick={() => { setShowInviteModal(false); resetInviteForm(); }}
                        style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500, transition: "all 0.2s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>
                        Annuler
                      </button>
                      <button onClick={async () => {
                        if (!inviteEmail.trim()) { setInviteError("L'email est requis."); return; }
                        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) { setInviteError("Veuillez entrer un email valide."); return; }
                        if (!inviteFirstName.trim()) { setInviteError("Le prénom est requis."); return; }
                        if (!inviteSexe) { setInviteError("Le sexe est requis."); return; }
                        setCheckingEmail(true); setInviteError("");
                        const res = await fetch("/api/check-patient-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail.trim(), practitionerId }) });
                        const data = await res.json() as { exists: boolean; canResend?: boolean };
                        setCheckingEmail(false);
                        if (data.exists && !data.canResend) { setInviteError("Ce patient est déjà actif dans votre cabinet."); return; }
                        if (data.exists && data.canResend) { setInviteExistingUnactivated(true); return; }
                        setInviteStep(2);
                      }} disabled={checkingEmail}
                        style={{ flex: 2, height: 44, borderRadius: 10, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: emerald, cursor: checkingEmail ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, transition: "all 0.2s", opacity: checkingEmail ? 0.7 : 1 }}
                        onMouseEnter={e => { if (!checkingEmail) { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; } }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; }}>
                        {checkingEmail ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500/20 border-t-emerald-500" />Vérification</span> : "Suivant"}
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : inviteStep === 2 ? (
              <>
                <p style={{ margin: "0 0 4px", fontSize: 13, color: "#94a3b8" }}>Pour que le jumeau ne donne jamais un conseil inadapté.</p>
                <p style={{ margin: "0 0 20px", fontSize: 12, color: "#4b5563" }}>Vous pourrez compléter depuis la fiche patient.</p>
                {/* Selects step 2 */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  {([
                    { label: "Pathologies", value: invitePathologies, setter: setInvitePathologies, id: "path", options: ["Diabète type 2", "Hypertension", "Hypothyroïdie", "SOPK", "Cholestérol", "TCA", "Surpoids"], required: true },
                    { label: "Allergies", value: inviteAllergies, setter: setInviteAllergies, id: "allerg", options: ["Gluten", "Lactose", "Fruits à coque", "Œufs", "Fruits de mer"], required: false },
                    { label: "Traitements", value: inviteTraitements, setter: setInviteTraitements, id: "trait", options: ["Metformine", "Lévothyrox", "Pilule contraceptive", "Antidépresseurs", "Insuline"], required: false },
                    { label: "Objectif", value: inviteObjectifClinique, setter: setInviteObjectifClinique, id: "obj", options: ["Perte de poids", "Prise de masse", "Équilibre glycémique", "Bien-être général", "Grossesse"], required: true },
                    { label: "Activité", value: inviteNiveauActivite, setter: setInviteNiveauActivite, id: "activ", options: ["Sédentaire", "Légère", "Modérée", "Intense", "Athlète"], required: false },
                    { label: "Régime", value: inviteRegime, setter: setInviteRegime, id: "regime", options: ["Végétarien", "Vegan", "Sans gluten", "Halal", "Méditerranéen"], required: false },
                  ] as { label: string; value: string; setter: (v: string) => void; id: string; options: string[]; required: boolean }[]).map(({ label, value, setter, id, options, required }) => {
                    const isAutre = value !== "" && !options.includes(value) && value !== "Aucune" && value !== "Aucun";
                    return (
                      <div key={id}>
                        <p style={{ margin: "0 0 5px", fontSize: 11, fontWeight: 600, color: "#64748b" }}>{label}{required && <span style={{ color: "#f87171" }}> *</span>}</p>
                        <select
                          value={isAutre ? "Autre" : value}
                          onChange={e => { if (e.target.value === "Autre") setter("__autre__"); else setter(e.target.value); }}
                          style={{ width: "100%", height: 40, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#161616", color: "white", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box", cursor: "pointer" }}
                        >
                          <option value="">Choisir</option>
                          <option value="Aucune">{["Pathologies", "Allergies", "Activité"].includes(label) ? "Aucune" : "Aucun"}</option>
                          {options.map(o => <option key={o} value={o}>{o}</option>)}
                          <option value="Autre">Autre...</option>
                        </select>
                        {(value === "__autre__" || isAutre) && (
                          <input type="text" value={value === "__autre__" ? "" : value} onChange={e => setter(e.target.value)}
                            placeholder="Précisez..." autoFocus
                            style={{ width: "100%", height: 38, borderRadius: 8, border: "1px solid rgba(16,185,129,0.3)", background: "#161616", color: "white", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box", marginTop: 6 }}
                            onFocus={e => e.target.style.borderColor = emerald} onBlur={e => e.target.style.borderColor = "rgba(16,185,129,0.3)"} />
                        )}
                      </div>
                    );
                  })}
                </div>
                {(() => {
                  const step2Disabled = !invitePathologies || !inviteObjectifClinique;
                  return (
                    <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                      <button onClick={() => setInviteStep(1)}
                        style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500, transition: "all 0.2s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>
                        Retour
                      </button>
                      <button onClick={() => { if (!step2Disabled) setInviteStep(3); }} disabled={step2Disabled}
                        style={{ flex: 2, height: 44, borderRadius: 10, background: step2Disabled ? "rgba(255,255,255,0.05)" : "rgba(16,185,129,0.12)", border: `1px solid ${step2Disabled ? "rgba(255,255,255,0.06)" : "rgba(16,185,129,0.3)"}`, color: step2Disabled ? "#374151" : emerald, cursor: step2Disabled ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, transition: "all 0.2s" }}
                        onMouseEnter={e => { if (!step2Disabled) { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; } }}
                        onMouseLeave={e => { if (!step2Disabled) { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; } }}>
                        Suivant
                      </button>
                    </div>
                  );
                })()}
              </>
            ) : (
              <>
                <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>C'est ici que vous glissez vos consignes spécifiques pour ce patient. Le Jumeau s'adaptera instantanément à ces nuances.</p>
                <textarea value={inviteBriefJumeau} onChange={e => setInviteBriefJumeau(e.target.value)}
                  placeholder="Exemple : Sophie est anxieuse autour de la balance - évite ce sujet. Elle se culpabilise facilement, reste bienveillant avant d'être technique. Elle adore cuisiner, utilise ça pour l'engager."
                  rows={5}
                  style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "14px", fontSize: 13, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "Inter, sans-serif", lineHeight: 1.7, marginBottom: 14 }}
                  onFocus={e => e.target.style.borderColor = emerald} onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                  <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b" }}>Durée du murmure</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 16 }}>
                {[
                    { label: "Permanent", value: "permanent" },
                    { label: "24h", value: "24h" },
                    { label: "3 jours", value: "3j" },
                    { label: "7 jours", value: "7j" },
                    { label: "30 jours", value: "30j" },
                    { label: "Personnalisé", value: "custom" },
                  ].map(({ label, value }) => (
                    <button key={value} type="button" onClick={() => setInviteMurmureDuration(value)}
                      style={{ height: 32, borderRadius: 8, padding: "0 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", border: inviteMurmureDuration === value || (value === "custom" && inviteMurmureDuration.startsWith("custom_")) ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.08)", background: inviteMurmureDuration === value || (value === "custom" && inviteMurmureDuration.startsWith("custom_")) ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.02)", color: inviteMurmureDuration === value || (value === "custom" && inviteMurmureDuration.startsWith("custom_")) ? emerald : "#64748b", transition: "all 0.2s" }}
                      onMouseEnter={e => { if (inviteMurmureDuration !== value) { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "#94a3b8"; } }}
                      onMouseLeave={e => { if (inviteMurmureDuration !== value) { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#64748b"; } }}>
                      {label}
                    </button>
                  ))}
                  {inviteMurmureDuration.startsWith("custom_") || inviteMurmureDuration === "custom" ? (
                    <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
                      <input type="number" min={1} max={365} placeholder="Ex: 5"
                        value={inviteMurmureDuration.startsWith("custom_") ? inviteMurmureDuration.split("_")[1] : ""}
                        onChange={e => setInviteMurmureDuration(`custom_${e.target.value}_${inviteMurmureDuration.startsWith("custom_") ? inviteMurmureDuration.split("_")[2] : "jours"}`)}
                        style={{ width: 70, height: 32, borderRadius: 8, border: "1px solid rgba(16,185,129,0.3)", background: "#161616", color: "white", padding: "0 10px", fontSize: 13, outline: "none" }} />
                      <select
                        value={inviteMurmureDuration.startsWith("custom_") ? inviteMurmureDuration.split("_")[2] : "jours"}
                        onChange={e => setInviteMurmureDuration(`custom_${inviteMurmureDuration.startsWith("custom_") ? inviteMurmureDuration.split("_")[1] : ""}_${e.target.value}`)}
                        style={{ height: 32, borderRadius: 8, border: "1px solid rgba(16,185,129,0.3)", background: "#161616", color: "white", padding: "0 10px", fontSize: 13, outline: "none", cursor: "pointer" }}>
                        <option value="jours">jours</option>
                        <option value="semaines">semaines</option>
                        <option value="mois">mois</option>
                      </select>
                    </div>
                  ) : null}
                </div>
                <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>Notes internes <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#4b5563" }}>· visibles uniquement par vous</span></p>
                <textarea value={inviteNotes} onChange={e => setInviteNotes(e.target.value)}
                  placeholder="Contexte de la prise en charge, objectifs du moment, points de vigilance, blocages..."
                  rows={3}
                  style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "#161616", color: "white", padding: "12px 14px", fontSize: 13, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "Inter, sans-serif", lineHeight: 1.6 }}
                  onFocus={e => { e.target.style.borderColor = "rgba(255,255,255,0.2)"; e.target.style.boxShadow = "0 0 0 3px rgba(255,255,255,0.04)"; }} onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }} />
                {inviteError && <p style={{ margin: "0 0 12px", fontSize: 13, color: "#f87171" }}>{inviteError}</p>}
                <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={() => setInviteStep(2)}
                    style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500, transition: "all 0.2s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>
                    Retour
                  </button>
                  <button onClick={() => void sendInvite()} disabled={inviting}
                    style={{ flex: 2, height: 44, borderRadius: 10, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: emerald, cursor: inviting ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, opacity: inviting ? 0.7 : 1, transition: "all 0.2s" }}
                    onMouseEnter={e => { if (!inviting) { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; } }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; }}>
                    {inviting ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500/20 border-t-emerald-500" />Envoi</span> : "Envoyer l'invitation"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

{showNoteModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowNoteModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 20, padding: 28, width: "100%", maxWidth: 440, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.12em" }}>Notes privées</p>
                <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: "white" }}>Ajoutez une note pour ce patient</h2>
                <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>Ces annotations restent strictement confidentielles et ne sont visibles que par vous.</p>
              </div>
              <button onClick={() => setShowNoteModal(false)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", flexShrink: 0, transition: "all 0.15s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.13)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "#e2e8f0"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "#64748b"; }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <textarea value={newNoteText} onChange={e => setNewNoteText(e.target.value)} placeholder="Exemple: Patiente recommandée par Dr Martin. Attention au sujet du poids en consultation." rows={5}
              style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "14px", fontSize: 13, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "Inter, sans-serif", lineHeight: 1.7, marginBottom: 16 }}
              onFocus={e => e.target.style.borderColor = "rgba(255,255,255,0.3)"} onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowNoteModal(false)}
                style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500, transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>
                Annuler
              </button>
              <button onClick={() => void addNote()} disabled={savingNote || !newNoteText.trim()}
                style={{ flex: 2, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white", cursor: savingNote || !newNoteText.trim() ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, opacity: savingNote || !newNoteText.trim() ? 0.5 : 1, transition: "all 0.2s" }}
                onMouseEnter={e => { if (!savingNote && newNoteText.trim()) { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; } }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}>
                {savingNote ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />Sauvegarde</span> : "Sauvegarder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBilanModal && (
        <div onClick={e => { if (e.target === e.currentTarget) { setShowBilanModal(false); setBilanContent(""); } }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 24, padding: 28, width: "100%", maxWidth: 520, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                </div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "white" }}>Préparer ma séance</h2>
              </div>
              <button onClick={() => { setShowBilanModal(false); setBilanContent(""); }} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", flexShrink: 0, transition: "all 0.15s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.13)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "#e2e8f0"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "#64748b"; }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div style={{ background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.12)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>L'IA analyse les derniers échanges de votre patient pour vous suggérer 3 questions clés à poser lors de votre prochaine consultation.</p>
            </div>
            {!bilanContent && !bilanLoading && (
              <button onClick={() => { if (!onboardingDemoMode) void generateBilan(); }} disabled={onboardingDemoMode}
                style={{ width: "100%", height: 44, borderRadius: 12, background: onboardingDemoMode ? "rgba(99,102,241,0.04)" : "rgba(99,102,241,0.14)", border: `1px solid ${onboardingDemoMode ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.35)"}`, color: onboardingDemoMode ? "#374151" : "#818cf8", fontSize: 14, fontWeight: 600, cursor: onboardingDemoMode ? "not-allowed" : "pointer", marginBottom: 16, transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                onMouseEnter={e => { if (!onboardingDemoMode) { e.currentTarget.style.background = "rgba(99,102,241,0.22)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; } }}
                onMouseLeave={e => { if (!onboardingDemoMode) { e.currentTarget.style.background = "rgba(99,102,241,0.14)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.35)"; } }}>
                Générer les questions
              </button>
            )}
            {bilanLoading ? (
              <div style={{ textAlign: "center", padding: "20px 0 40px" }}>
                <svg style={{ animation: "spin 1s linear infinite", display: "block", margin: "0 auto 10px" }} width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="rgba(99,102,241,0.2)" strokeWidth="3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#818cf8" strokeWidth="3" strokeLinecap="round"/></svg>
                <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Analyse de l'historique du chat en cours</p>
              </div>
            ) : bilanContent ? (
              (() => {
                try {
                  const parsed = JSON.parse(bilanContent) as { lowData?: boolean; isError?: boolean; message?: string } | { question: string; justification: string; objectif: string }[];
                  if (!Array.isArray(parsed) && (parsed.lowData || parsed.isError)) {
                    const isErr = !!(parsed as { isError?: boolean }).isError;
                    return (
                      <div style={{ background: isErr ? "rgba(244,63,94,0.05)" : "rgba(245,158,11,0.05)", border: `1px solid ${isErr ? "rgba(244,63,94,0.2)" : "rgba(245,158,11,0.2)"}`, borderRadius: 14, padding: "20px", textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: 13, color: isErr ? "#f87171" : "#94a3b8", lineHeight: 1.7 }}>{(parsed as { message?: string }).message}</p>
                      </div>
                    );
                  }
                  const questions = parsed as { question: string; justification: string; objectif: string }[];
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {questions.map((q, i) => (
                        <div key={i} style={{ background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.18)", borderRadius: 16, padding: "18px 20px" }}>
                          <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.12em" }}>Question {i + 1}</p>
                          <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "white", lineHeight: 1.5 }}>{q.question}</p>
                          <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                            <div>
                              <p style={{ margin: "0 0 3px", fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em" }}>Justification IA</p>
                              <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>{q.justification}</p>
                            </div>
                            <div>
                              <p style={{ margin: "0 0 3px", fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em" }}>Objectif clinique</p>
                              <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>{q.objectif}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                } catch {
                  return (
                    <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.18)", borderRadius: 12, padding: "16px 18px", textAlign: "center" }}>
                      <p style={{ margin: "0 0 6px", fontSize: 13, color: "#f59e0b", fontWeight: 600 }}>Erreur de lecture du bilan</p>
                      <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Le bilan n'a pas pu être analysé. Veuillez réessayer.</p>
                      <button onClick={() => setBilanContent("")} style={{ marginTop: 12, height: 34, padding: "0 16px", borderRadius: 8, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "#f59e0b", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Réessayer</button>
                    </div>
                  );
                }
              })()
            ) : null}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes breathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes onboardingPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes criticalPulse { 0%, 100% { box-shadow: 0 0 32px rgba(244,63,94,0.25); } 50% { box-shadow: 0 0 48px rgba(244,63,94,0.5); } }
      `}</style>
    </div>

    {/* ═══ Drag handle (bordure gauche du chat) ═══ */}
    {testMode && (
      <div
        onMouseEnter={() => setTestDragHover(true)}
        onMouseLeave={() => setTestDragHover(false)}
        onMouseDown={(e) => {
          testDrag.current.active = true;
          testDrag.current.startX = e.clientX;
          testDrag.current.startW = chatPanelWidth;
          document.body.style.cursor = "ew-resize";
          document.body.style.userSelect = "none";
          setTestDragging(true);
          e.preventDefault();
        }}
        title="Maintenir clic + glisser pour redimensionner"
        style={{
          width: 6,
          flexShrink: 0,
          cursor: testDragHover ? "ew-resize" : "default",
          userSelect: "none",
          background: testDragHover ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)",
          borderLeft: `1px solid ${testDragHover ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.07)"}`,
          transition: "background 0.15s, border-color 0.15s",
          position: "relative",
        }}
      >
        {testDragHover && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", gap: 2, pointerEvents: "none" }}>
            {[0, 1, 2].map(i => <div key={i} style={{ width: 2, height: 2, borderRadius: "50%", background: "rgba(16,185,129,0.7)" }} />)}
          </div>
        )}
      </div>
    )}

    {/* ═══ Panneau test : chat iframe (droite) ═══ */}
    {testMode && (
      <div style={{ width: chatPanelWidth, minWidth: 320, flexShrink: 0, display: "flex", flexDirection: "column", background: "#070B09" }}>
        <div style={{ height: 36, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(16,185,129,0.05)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: emerald, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: "#6ee7b7", letterSpacing: "0.1em", textTransform: "uppercase" }}>Mode test - vue patient simulée</span>
          </div>
          {/* Bouton supprimer le patient test actif */}
          {selectedPatientId && (
            <button
              onClick={() => setShowDeleteTestPatientModal(true)}
              title="Supprimer ce profil de test"
              style={{ position: "absolute", right: 46, top: "50%", transform: "translateY(-50%)", background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.15)", cursor: "pointer", color: "#f87171", width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(244,63,94,0.14)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.3)"; e.currentTarget.style.color = "#fca5a5"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(244,63,94,0.06)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.15)"; e.currentTarget.style.color = "#f87171"; }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          )}
          <button
            onClick={() => { testModeRef.current = false; setTestMode(false); }}
            title="Quitter le mode test"
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", color: "#94a3b8", width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "#e2e8f0"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "#94a3b8"; }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {testPatientsLoading ? (
          // Chargement en cours — afficher l'iframe immédiatement en parallèle
          <iframe
            src="/chat?test=true"
            style={{ flex: 1, border: "none", width: "100%" }}
            key="test-chat-loading"
          />
        ) : patients.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.20)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, flexShrink: 0 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/>
                <path d="M6 20v-2a6 6 0 0 1 12 0v2"/>
              </svg>
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>Aucun patient test configuré</p>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "#64748b", lineHeight: 1.6, maxWidth: 260 }}>Ajoutez un patient test pour simuler une conversation avec votre jumeau numérique.</p>
            <button
              onClick={() => { setShowAddTestPatientModal(true); setAddTestPatientStep(1); }}
              style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 10, padding: "11px 22px", color: emerald, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; }}
            >
              + Ajouter un patient test
            </button>
          </div>
        ) : (
          <iframe
            src="/chat?test=true"
            style={{ flex: 1, border: "none", width: "100%", pointerEvents: testDragging ? "none" : undefined }}
            key={testIframeKey}
          />
        )}
      </div>
    )}

    {/* ═══ Modale ajout patient test (3 étapes) ═══ */}
    {showAddTestPatientModal && (
      <>
        <div onClick={() => { setShowAddTestPatientModal(false); setAddTestPatientStep(1); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50 }} />
        <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 51, background: "#0d0d0d", borderRadius: 24, padding: 28, width: "100%", maxWidth: 500, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", overflowY: "auto", maxHeight: "90vh" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: emerald, textTransform: "uppercase", letterSpacing: "0.1em" }}>Étape {addTestPatientStep} sur 3</p>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "white" }}>
                {addTestPatientStep === 1 ? "Identité du patient test" : addTestPatientStep === 2 ? "Contexte médical" : "Profil patient"}
              </h2>
            </div>
            <button onClick={() => { setShowAddTestPatientModal(false); setAddTestPatientStep(1); }}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", color: "#94a3b8", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "#e2e8f0"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "#94a3b8"; }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          {/* Stepper */}
          <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= addTestPatientStep ? emerald : "rgba(255,255,255,0.08)", transition: "background 0.3s" }} />
            ))}
          </div>

          {/* ── Étape 1 : Identité ── */}
          {addTestPatientStep === 1 && (
            <>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>Créer un patient fictif pour tester la précision des réponses de votre Jumeau Numérique. Plus le profil est réaliste et complet, plus le test sera révélateur.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Prénom <span style={{ color: "#f87171" }}>*</span></p>
                    <input type="text" value={addTestPatientForm.firstName}
                      onChange={e => setAddTestPatientForm(f => ({ ...f, firstName: e.target.value }))}
                      placeholder="Sophie"
                      style={{ width: "100%", height: 46, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 14px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                      onFocus={e => { e.target.style.borderColor = emerald; }} onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }} />
                  </div>
                  <div>
                    <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Nom</p>
                    <input type="text" value={addTestPatientForm.lastName}
                      onChange={e => setAddTestPatientForm(f => ({ ...f, lastName: e.target.value }))}
                      placeholder="Martin"
                      style={{ width: "100%", height: 46, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 14px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                      onFocus={e => { e.target.style.borderColor = emerald; }} onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                  {([
                    { label: "Âge", key: "age", placeholder: "34", min: 0, max: 110 },
                    { label: "Taille (cm)", key: "taille", placeholder: "168", min: 0, max: 250 },
                    { label: "Poids (kg)", key: "poids", placeholder: "72", min: 0, max: 500 },
                  ] as { label: string; key: keyof typeof addTestPatientForm; placeholder: string; min: number; max: number }[]).map(({ label, key, placeholder, min, max }) => (
                    <div key={key}>
                      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{label}</p>
                      <input type="number" value={addTestPatientForm[key]}
                        onChange={e => { const val = parseInt(e.target.value); if (e.target.value === "" || (val >= min && val <= max)) setAddTestPatientForm(f => ({ ...f, [key]: e.target.value })); }}
                        placeholder={placeholder} min={min} max={max}
                        style={{ width: "100%", height: 42, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box", MozAppearance: "textfield" } as React.CSSProperties}
                        onFocus={e => { e.target.style.borderColor = emerald; }} onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }} />
                    </div>
                  ))}
                  <div>
                    <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Sexe</p>
                    <select value={addTestPatientForm.sexe}
                      onChange={e => setAddTestPatientForm(f => ({ ...f, sexe: e.target.value }))}
                      style={{ width: "100%", height: 42, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}>
                      <option value="">Choisir</option>
                      <option value="Femme">Femme</option>
                      <option value="Homme">Homme</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
                <button onClick={() => { setShowAddTestPatientModal(false); setAddTestPatientStep(1); }}
                  style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500, transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>
                  Annuler
                </button>
                <button onClick={() => { if (addTestPatientForm.firstName.trim()) setAddTestPatientStep(2); }}
                  style={{ flex: 2, height: 44, borderRadius: 10, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: emerald, cursor: addTestPatientForm.firstName.trim() ? "pointer" : "not-allowed", fontSize: 14, fontWeight: 600, transition: "all 0.2s", opacity: addTestPatientForm.firstName.trim() ? 1 : 0.5 }}
                  onMouseEnter={e => { if (addTestPatientForm.firstName.trim()) { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; } }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; }}>
                  Suivant
                </button>
              </div>
            </>
          )}

          {/* ── Étape 2 : Contexte médical ── */}
          {addTestPatientStep === 2 && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                {([
                  { label: "Pathologies", key: "pathologies", options: ["Diabète type 2", "Hypertension", "Hypothyroïdie", "SOPK", "Cholestérol", "TCA", "Surpoids"] },
                  { label: "Allergies", key: "allergies", options: ["Gluten", "Lactose", "Fruits à coque", "Œufs", "Fruits de mer"] },
                  { label: "Traitements", key: "traitements", options: ["Metformine", "Lévothyrox", "Pilule contraceptive", "Antidépresseurs", "Insuline"] },
                  { label: "Objectif", key: "objectifClinique", options: ["Perte de poids", "Prise de masse", "Équilibre glycémique", "Bien-être général", "Grossesse"] },
                  { label: "Activité", key: "activite", options: ["Sédentaire", "Légère", "Modérée", "Intense", "Athlète"] },
                  { label: "Régime", key: "regime", options: ["Végétarien", "Vegan", "Sans gluten", "Halal", "Méditerranéen"] },
                ] as { label: string; key: keyof typeof addTestPatientForm; options: string[] }[]).map(({ label, key, options }) => {
                  const val = addTestPatientForm[key] as string;
                  const isAutre = val !== "" && !options.includes(val) && val !== "Aucune" && val !== "Aucun";
                  return (
                    <div key={key}>
                      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{label}</p>
                      <select value={isAutre ? "Autre" : val}
                        onChange={e => { if (e.target.value === "Autre") setAddTestPatientForm(f => ({ ...f, [key]: "__autre__" })); else setAddTestPatientForm(f => ({ ...f, [key]: e.target.value })); }}
                        style={{ width: "100%", height: 40, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#161616", color: "white", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box", cursor: "pointer" }}>
                        <option value="">Choisir</option>
                        <option value="Aucune">{["Pathologies", "Allergies", "Activité"].includes(label) ? "Aucune" : "Aucun"}</option>
                        {options.map(o => <option key={o} value={o}>{o}</option>)}
                        <option value="Autre">Autre</option>
                      </select>
                      {(val === "__autre__" || isAutre) && (
                        <input type="text" value={val === "__autre__" ? "" : val}
                          onChange={e => setAddTestPatientForm(f => ({ ...f, [key]: e.target.value }))}
                          placeholder="Précisez..." autoFocus
                          style={{ width: "100%", height: 38, borderRadius: 8, border: "1px solid rgba(16,185,129,0.3)", background: "#161616", color: "white", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box", marginTop: 6 }}
                          onFocus={e => { e.target.style.borderColor = emerald; }} onBlur={e => { e.target.style.borderColor = "rgba(16,185,129,0.3)"; }} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                <button onClick={() => setAddTestPatientStep(1)}
                  style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500, transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>
                  Retour
                </button>
                <button onClick={() => setAddTestPatientStep(3)}
                  style={{ flex: 2, height: 44, borderRadius: 10, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: emerald, cursor: "pointer", fontSize: 14, fontWeight: 600, transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; }}>
                  Suivant
                </button>
              </div>
            </>
          )}

          {/* ── Étape 3 : Profil & Préférences ── */}
          {addTestPatientStep === 3 && (() => {
            const ALIMENTS_LIST = [
              "Poisson", "Viande rouge", "Poulet", "Dinde", "Œufs", "Tofu", "Légumineuses", "Fruits de mer",
              "Brocoli", "Épinards", "Courgette", "Tomate", "Avocat", "Champignons", "Carottes", "Chou",
              "Pâtes", "Riz", "Pain", "Quinoa", "Pomme de terre", "Patate douce",
              "Fromage", "Yaourt", "Lait", "Chocolat", "Noix", "Fruits",
            ];
            const sel: React.CSSProperties = {
              width: "100%", height: 40, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)",
              background: "#161616", color: "white", padding: "0 10px", fontSize: 13, outline: "none",
              boxSizing: "border-box", cursor: "pointer",
            };
            const toggleAliment = (a: string) => setAddTestPatientAlimentsDetestes(prev =>
              prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
            );
            const addCustomAliment = () => {
              const val = addTestPatientForm.alimentsDetestes.trim();
              if (!val) return;
              if (!ALIMENTS_LIST.includes(val) && !addTestPatientCustomAliments.includes(val))
                setAddTestPatientCustomAliments(prev => [...prev, val]);
              setAddTestPatientAlimentsDetestes(prev => prev.includes(val) ? prev : [...prev, val]);
              setAddTestPatientForm(f => ({ ...f, alimentsDetestes: "" }));
            };
            return (
              <>
                {/* 3 sélecteurs + inconforts digestifs en 2 colonnes */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  {([
                    { label: "Sommeil", key: "sommeil", options: ["Moins de 6h", "6 à 7h", "7 à 8h", "Plus de 8h"] },
                    { label: "État d'esprit", key: "humeur", options: ["Très motivé(e)", "Optimiste", "Un peu anxieux(se)", "Complètement perdu(e)", "Volontaire mais fatigué(e)", "Aucun", "Autre"] },
                    { label: "Défi principal", key: "defiPrincipal", options: ["Manque de temps", "Pulsions sucrées", "Repas au restaurant", "Manque de motivation", "Organisation en cuisine", "Manger sous le stress", "Aucun", "Autre"] },
                  ] as { label: string; key: keyof typeof addTestPatientForm; options: string[] }[]).map(({ label, key, options }) => (
                    <div key={key}>
                      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{label}</p>
                      <select value={addTestPatientForm[key] as string}
                        onChange={e => setAddTestPatientForm(f => ({ ...f, [key]: e.target.value }))}
                        style={sel}>
                        <option value="">Choisir</option>
                        {options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                  {/* Inconforts digestifs — select simple */}
                  <div>
                    <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Inconforts digestifs</p>
                    <select value={addTestPatientDigestif[0] ?? ""}
                      onChange={e => setAddTestPatientDigestif(e.target.value ? [e.target.value] : [])}
                      style={sel}>
                      <option value="">Choisir</option>
                      {["Ballonnements fréquents", "Transit lent", "Transit rapide", "Reflux / brûlures", "Aucun inconfort", "Autre"].map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Section aliments à éviter */}
                <div>
                  <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>
                    Aliments à éviter
                    <span style={{ fontWeight: 400, color: "#4b5563", marginLeft: 6 }}>cliquer pour marquer ❌</span>
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                    {[...ALIMENTS_LIST, ...addTestPatientCustomAliments].map(a => {
                      const on = addTestPatientAlimentsDetestes.includes(a);
                      return (
                        <button key={a} onClick={() => toggleAliment(a)}
                          style={{ borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer",
                            border: `1px solid ${on ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)"}`,
                            background: on ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.03)",
                            color: on ? "#f87171" : "#64748b", transition: "all 0.15s" }}>
                          {on ? "❌ " : ""}{a}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="text" value={addTestPatientForm.alimentsDetestes}
                      onChange={e => setAddTestPatientForm(f => ({ ...f, alimentsDetestes: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") addCustomAliment(); }}
                      placeholder="Ajouter un aliment personnalisé..."
                      style={{ flex: 1, height: 38, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "#161616", color: "white", padding: "0 12px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                      onFocus={e => { e.target.style.borderColor = emerald; }}
                      onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; }} />
                    <button onClick={addCustomAliment}
                      style={{ height: 38, padding: "0 14px", borderRadius: 10, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: emerald, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      + Ajouter
                    </button>
                  </div>
                  {addTestPatientAlimentsDetestes.length > 0 && (
                    <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 10, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)" }}>
                      <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 600, color: "#f87171" }}>À éviter ❌</p>
                      <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>{addTestPatientAlimentsDetestes.join(", ")}</p>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                  <button onClick={() => setAddTestPatientStep(2)}
                    style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500, transition: "all 0.2s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>
                    Retour
                  </button>
                  <button
                    disabled={addTestPatientSaving}
                    onClick={async () => {
                      setAddTestPatientSaving(true);
                      try {
                        const digestifStr = addTestPatientDigestif.length > 0 ? addTestPatientDigestif.join(", ") : null;
                        const res = await fetch("/api/test-mode/setup", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            firstName: addTestPatientForm.firstName || "Patient",
                            lastName: addTestPatientForm.lastName || "Test",
                            age: addTestPatientForm.age ? Number(addTestPatientForm.age) : null,
                            taille: addTestPatientForm.taille ? Number(addTestPatientForm.taille) : null,
                            poids: addTestPatientForm.poids ? Number(addTestPatientForm.poids) : null,
                            sexe: addTestPatientForm.sexe || null,
                            pathologies: addTestPatientForm.pathologies || null,
                            allergies: addTestPatientForm.allergies || null,
                            traitements: addTestPatientForm.traitements || null,
                            objectifClinique: addTestPatientForm.objectifClinique || null,
                            activite: addTestPatientForm.activite || null,
                            regime: addTestPatientForm.regime || null,
                            sommeil: addTestPatientForm.sommeil || null,
                            humeur: addTestPatientForm.humeur || null,
                            defiPrincipal: addTestPatientForm.defiPrincipal || null,
                            digestif: digestifStr,
                            alimentsDetestes: addTestPatientAlimentsDetestes.length > 0 ? addTestPatientAlimentsDetestes.join(", ") : null,
                          }),
                        });
                        const data = await res.json() as { testPatientUserId?: string };
                        if (data.testPatientUserId && practitionerId) {
                          await loadTestPatients(practitionerId);
                        }
                      } catch { /* silencieux */ }
                      setAddTestPatientSaving(false);
                      setShowAddTestPatientModal(false);
                      setAddTestPatientStep(1);
                      setAddTestPatientForm({ firstName: "", lastName: "", age: "", taille: "", poids: "", sexe: "", pathologies: "", allergies: "", traitements: "", objectifClinique: "", activite: "", regime: "", sommeil: "", humeur: "", defiPrincipal: "", alimentsDetestes: "" });
                      setAddTestPatientDigestif([]);
                      setAddTestPatientAlimentsDetestes([]);
                      setAddTestPatientCustomAliments([]);
                    }}
                    style={{ flex: 2, height: 44, borderRadius: 10, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: emerald, cursor: addTestPatientSaving ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, transition: "all 0.2s", opacity: addTestPatientSaving ? 0.6 : 1 }}
                    onMouseEnter={e => { if (!addTestPatientSaving) { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; } }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; }}
                  >
                    {addTestPatientSaving ? (
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <span style={{ width: 15, height: 15, borderRadius: "50%", border: "2px solid rgba(16,185,129,0.25)", borderTopColor: emerald, display: "inline-block", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
                        Création
                      </span>
                    ) : "Créer le patient test"}
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      </>
    )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardInner />
    </Suspense>
  );
}
