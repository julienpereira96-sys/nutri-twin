"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { buildMurmureExpiry } from "@/lib/murmure";

const emerald = "#10b981";
const amber = "#f59e0b";
const coral = "#f43f5e";

// ═══ DONNÉES DE DÉMO ONBOARDING ═══
const DEMO_PATIENTS_INITIAL = [
  {
    id: "demo-1", firstName: "Sophie", lastName: "M.", initials: "SM",
    avatarColor: "#f43f5e", emotional_status: "red", emotional_insight: "Rechute alimentaire ce soir",
    admin_alerts: [{ type: "alert", date: "2026-05-16T21:03:00", seen: false, murmure: "Sois plus doux cette semaine, elle traverse une période difficile au travail." }],
    totalMessages: 34, latest_victory: "A résisté à la cantine le 13 mai",
    age: 32, sexe: "F", taille: 165, poids: 68,
    objective: "Retrouver une relation apaisée avec la nourriture et perdre 5 kg durablement.",
    pathologies: "Hyperphagie émotionnelle",
    objectif_clinique: "Réduire les compulsions nocturnes à moins d'une par semaine.",
    niveau_activite: "modéré", regime_specifique: "Aucun",
    allergies: "Intolérance lactose (légère)", traitements: "Aucun",
    email: "sophie.m@demo.fr",
    practitioner_instruction: [{ id: "d-m1", text: "Sois plus doux cette semaine, elle traverse une période difficile au travail.", expires_at: null, created_at: new Date().toISOString() }],
    private_notes: [{ id: "n1", text: "Tendances émotionnelles fortes le soir. Suggérer un journal alimentaire.", created_at: new Date().toISOString() }],
    lastActive: "Il y a 2h", streak: 5, sosResolved: 2, onboardingCompleted: true,
  },
  {
    id: "demo-2", firstName: "Julie", lastName: "P.", initials: "JP",
    avatarColor: "#8b5cf6", emotional_status: "orange", emotional_insight: "Fatigue professionnelle",
    admin_alerts: [{ type: "alert", date: "2026-05-17T12:30:00", seen: false, murmure: "Rappelle-lui de prendre soin d'elle malgré la charge de travail." }],
    totalMessages: 18, latest_victory: "3 repas complets cette semaine",
    age: 28, sexe: "F", taille: 162, poids: 58,
    objective: "Maintenir son poids et améliorer son énergie au quotidien.",
    pathologies: "Aucune",
    objectif_clinique: "Stabiliser 3 repas par jour malgré la charge professionnelle.",
    niveau_activite: "faible", regime_specifique: "Végétarienne",
    allergies: "Aucune", traitements: "Contraception orale",
    email: "julie.p@demo.fr",
    practitioner_instruction: [{ id: "d-m2", text: "Rappelle-lui de prendre soin d'elle malgré la charge de travail.", expires_at: null, created_at: new Date().toISOString() }],
    private_notes: [],
    lastActive: "Il y a 1j", streak: 3, sosResolved: 0, onboardingCompleted: true,
  },
  {
    id: "demo-3", firstName: "Thomas", lastName: "R.", initials: "TR",
    avatarColor: "#3b82f6", emotional_status: "green", emotional_insight: "Progression constante",
    totalMessages: 40, latest_victory: "Poids stable depuis 3 semaines",
    age: 41, sexe: "M", taille: 178, poids: 82,
    objective: "Maintenir le poids atteint et développer une alimentation intuitive.",
    pathologies: "Hypertension légère (traitée)",
    objectif_clinique: "Consolider les habitudes et prévenir les rechutes.",
    niveau_activite: "élevé", regime_specifique: "Aucun",
    allergies: "Arachides", traitements: "Ramipril 5mg",
    email: "thomas.r@demo.fr",
    practitioner_instruction: [],
    private_notes: [{ id: "n3", text: "Très assidu. Envisager de passer à une consultation mensuelle.", created_at: new Date().toISOString() }],
    lastActive: "Il y a 3h", streak: 12, sosResolved: 1, onboardingCompleted: true,
  },
];

const DEMO_CONVERSATIONS: { id: string; role: "user" | "assistant"; content: string; created_at: string }[] = [
  // Semaine 1 — premiers échanges
  { id: "d1", role: "user", content: "Bonjour ! Je viens de commencer le programme. Je voulais vous dire que j'ai réussi à petit-déjeuner ce matin 🙂", created_at: "2026-05-02T08:14:00" },
  { id: "d2", role: "assistant", content: "Bonjour Sophie ! C'est un très bon départ. Un petit-déjeuner complet le matin, c'est la base d'une journée sans fringale. Qu'est-ce que vous avez mangé ?", created_at: "2026-05-02T08:15:10" },
  { id: "d3", role: "user", content: "Des œufs brouillés et une tranche de pain complet avec du café. Pas d'autres sucres.", created_at: "2026-05-02T08:16:30" },
  { id: "d4", role: "assistant", content: "Parfait — des protéines, des glucides complexes, pas de pic glycémique. Continuez sur cette lancée cette semaine.", created_at: "2026-05-02T08:17:00" },
  // Semaine 1 — fin de journée difficile
  { id: "d5", role: "user", content: "Ce soir c'était dur. Réunion jusqu'à 20h, je n'ai pas déjeuné et j'ai craqué sur des chips en rentrant.", created_at: "2026-05-05T20:42:00" },
  { id: "d6", role: "assistant", content: "Je comprends, Sophie. Une réunion aussi longue sans repas, c'est une situation impossible à tenir. Ce n'est pas de la faiblesse, c'est de la biologie. Qu'est-ce que vous avez pu faire après ?", created_at: "2026-05-05T20:43:20" },
  { id: "d7", role: "user", content: "J'ai fini par manger une omelette. Mais je me sens coupable quand même.", created_at: "2026-05-05T20:44:10" },
  { id: "d8", role: "assistant", content: "Vous avez bien fait de manger quelque chose de nourrissant après. La culpabilité n'aide pas — ce qui compte, c'est que vous ayez rattrapé la situation. Demain, essayons d'anticiper : est-ce qu'il y a une plage pour déjeuner dans votre agenda ?", created_at: "2026-05-05T20:45:00" },
  { id: "d9", role: "user", content: "Oui, demain j'ai une heure libre à 12h30. Je vais en profiter.", created_at: "2026-05-05T20:45:40" },
  { id: "d10", role: "assistant", content: "Parfait. Bloquez ce créneau comme un rendez-vous médical — on ne l'annule pas. Bonne nuit Sophie 🌙", created_at: "2026-05-05T20:46:00" },
  // Semaine 2 — progrès
  { id: "d11", role: "user", content: "J'ai réussi à déjeuner deux jours de suite ! Avec une vraie pause, assise, sans téléphone.", created_at: "2026-05-08T13:02:00" },
  { id: "d12", role: "assistant", content: "C'est exactement ça l'objectif, Sophie. Deux pauses repas en pleine conscience cette semaine — vous avez ancré une habitude. Comment vous êtes-vous sentie après ?", created_at: "2026-05-08T13:03:00" },
  { id: "d13", role: "user", content: "Moins de fringale le soir. C'est étonnant comme c'est efficace.", created_at: "2026-05-08T13:03:45" },
  { id: "d14", role: "assistant", content: "Ce n'est pas étonnant — c'est de la physiologie. Un déjeuner complet évite le pic de cortisol et la faim émotionnelle du soir. Continuez, vous êtes sur la bonne voie.", created_at: "2026-05-08T13:04:30" },
  // Semaine 2 — situation sociale difficile
  { id: "d15", role: "user", content: "Repas d'entreprise demain midi. Je stresse un peu, c'est souvent un buffet avec beaucoup de tentations.", created_at: "2026-05-12T19:15:00" },
  { id: "d16", role: "assistant", content: "Anticipons ensemble. Dans un buffet, commencez par le tour complet avant de prendre quoi que ce soit — ça permet de faire un choix conscient plutôt que réactif. Que savez-vous du menu ?", created_at: "2026-05-12T19:16:10" },
  { id: "d17", role: "user", content: "Des charcuteries, des salades, des quiches, des desserts. Et du vin bien sûr.", created_at: "2026-05-12T19:16:50" },
  { id: "d18", role: "assistant", content: "Stratégie : commencez par une salade et des protéines (quiche, charcuterie en petite quantité). Laissez la place pour les desserts si vous en avez vraiment envie, mais décidez-le au moment, pas par automatisme. Pour l'alcool, alternez avec de l'eau.", created_at: "2026-05-12T19:17:45" },
  { id: "d19", role: "user", content: "J'ai suivi votre conseil ce midi ! Je n'ai pris qu'une assiette, j'ai résisté au plateau de fromages.", created_at: "2026-05-13T14:22:00" },
  { id: "d20", role: "assistant", content: "Sophie, c'est une vraie victoire. Résister en contexte social, c'est la compétence la plus difficile. Vous avez fait un choix conscient sous pression sociale — c'est exactement ce qu'on travaille. 🌟", created_at: "2026-05-13T14:23:00" },
  // Semaine 3 — rechute
  { id: "d21", role: "user", content: "Mauvaise semaine. Conflit avec mon manager, j'ai mangé n'importe quoi pendant 3 jours.", created_at: "2026-05-16T18:30:00" },
  { id: "d22", role: "assistant", content: "Je suis désolé d'entendre ça, Sophie. Le stress professionnel est un déclencheur puissant. Vous avez quand même pris la peine de m'écrire — c'est déjà bien. Qu'est-ce qui s'est passé exactement ?", created_at: "2026-05-16T18:31:00" },
  { id: "d23", role: "user", content: "Il a remis en cause mon travail devant toute l'équipe. J'étais tellement mal que je n'arrivais plus à penser à manger sainement.", created_at: "2026-05-16T18:32:20" },
  { id: "d24", role: "assistant", content: "Ce que vous décrivez est une réaction émotionnelle tout à fait normale. La nourriture devient un régulateur quand on est blessé. Ce n'est pas de la faiblesse — c'est un mécanisme ancien. L'important, c'est d'identifier ce schéma pour mieux y répondre.", created_at: "2026-05-16T18:33:15" },
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
  { id: "d33", role: "assistant", content: "Sophie ! Voilà — preuve par neuf. Un vrai déjeuner = une soirée apaisée. Vous venez de relier cause et effet. Gardez ça en mémoire pour la prochaine fois que le stress vous fait sauter un repas.", created_at: "2026-05-17T20:11:00" },
  { id: "d34", role: "user", content: "Oui, c'est clair maintenant. Merci. On continue !", created_at: "2026-05-17T20:11:45" },
];

const DEMO_CONVERSATIONS_JULIE: { id: string; role: "user" | "assistant"; content: string; created_at: string }[] = [
  // Semaine 1
  { id: "j1", role: "user", content: "Bonjour ! Mon nutritionniste m'a dit de commencer à noter ce que je mange. Je ne sais pas trop par où commencer.", created_at: "2026-05-05T09:10:00" },
  { id: "j2", role: "assistant", content: "Bonjour Julie ! Pas besoin de tout noter en détail — commencez juste par noter les repas principaux et votre niveau d'énergie à midi et en fin de journée. C'est suffisant pour identifier des tendances.", created_at: "2026-05-05T09:11:00" },
  { id: "j3", role: "user", content: "D'accord, je vais essayer. Hier j'ai mangé une salade à midi et une pizza le soir. Pas idéal je sais.", created_at: "2026-05-05T09:12:00" },
  { id: "j4", role: "assistant", content: "Ce n'est pas si mal — la salade couvre le midi, la pizza le soir apporte des calories et des glucides. Ce qui manque : des protéines et des légumes le soir. Vous ajouteriez quoi à cette pizza pour l'équilibrer ?", created_at: "2026-05-05T09:13:00" },
  // Semaine 2 — période difficile
  { id: "j5", role: "user", content: "Je suis épuisée. Cette semaine c'était trop, pas le temps de manger correctement.", created_at: "2026-05-12T12:30:00" },
  { id: "j6", role: "assistant", content: "Je vous entends Julie. Quand la charge est forte, l'alimentation est souvent la première sacrifiée. Qu'est-ce que vous avez pu manger aujourd'hui ?", created_at: "2026-05-12T12:30:30" },
  { id: "j7", role: "user", content: "Un café le matin et un croissant... et une salade à 15h.", created_at: "2026-05-12T12:31:00" },
  { id: "j8", role: "assistant", content: "C'est insuffisant pour une journée intense. Ce soir, visez quelque chose de nourrissant mais simple — des œufs, du pain complet, des légumes. Pas besoin de faire de grands efforts.", created_at: "2026-05-12T12:31:40" },
  { id: "j9", role: "user", content: "D'accord, je vais essayer. Merci d'être là.", created_at: "2026-05-12T12:32:10" },
  // Semaine 2 suite — retour positif
  { id: "j10", role: "assistant", content: "Comment s'est passée votre soirée hier ? Avez-vous pu manger quelque chose ?", created_at: "2026-05-13T09:00:00" },
  { id: "j11", role: "user", content: "Oui ! J'ai fait des œufs avec des épinards. Simple mais ça m'a bien recentrée.", created_at: "2026-05-13T09:05:00" },
  { id: "j12", role: "assistant", content: "Excellent — œufs + épinards, c'est fer, protéines, vitamines. Vous avez fait le bon choix sans y penser longtemps. C'est ça l'alimentation intuitive.", created_at: "2026-05-13T09:06:00" },
  // Semaine 3 — victoire
  { id: "j13", role: "user", content: "Bonne semaine ! J'ai fait 3 repas complets par jour. J'ai même pris le temps de cuisiner samedi.", created_at: "2026-05-17T10:15:00" },
  { id: "j14", role: "assistant", content: "Julie, c'est une vraie victoire — 3 repas complets toute la semaine et du temps dédié à la cuisine le week-end. Vous commencez à vous mettre en priorité.", created_at: "2026-05-17T10:16:00" },
  { id: "j15", role: "user", content: "Oui, j'ai fait un batch cooking : des lentilles, du riz, des légumes rôtis. J'ai mangé des trucs bons toute la semaine.", created_at: "2026-05-17T10:17:00" },
  { id: "j16", role: "assistant", content: "Le batch cooking, c'est exactement la solution pour quelqu'un avec votre rythme. Vous avez trouvé votre format. Est-ce que vous avez ressenti une différence d'énergie ?", created_at: "2026-05-17T10:17:45" },
  { id: "j17", role: "user", content: "Oui, clairement. Moins de coups de pompe à 15h. Et je dors mieux aussi.", created_at: "2026-05-17T10:18:30" },
  { id: "j18", role: "assistant", content: "Le lien alimentation-sommeil est réel — les glucides complexes et le magnésium dans les légumes jouent un rôle. Continuez sur cette lancée, Julie. Vous avez trouvé un rythme qui vous correspond.", created_at: "2026-05-17T10:19:00" },
];

const DEMO_CONVERSATIONS_THOMAS: { id: string; role: "user" | "assistant"; content: string; created_at: string }[] = [
  // Mois 1 — début du suivi
  { id: "t1", role: "user", content: "Bonjour ! Mon médecin m'a recommandé de suivre un programme nutritionnel pour mon hypertension.", created_at: "2026-04-01T08:00:00" },
  { id: "t2", role: "assistant", content: "Bonjour Thomas ! Vous êtes au bon endroit. L'alimentation a un impact direct sur la tension artérielle, notamment la réduction du sel et l'augmentation des potassium. On va travailler ça ensemble progressivement.", created_at: "2026-04-01T08:01:00" },
  { id: "t3", role: "user", content: "J'avoue que je mange beaucoup de plats préparés le midi. Et du fromage le soir.", created_at: "2026-04-01T08:02:00" },
  { id: "t4", role: "assistant", content: "Ce sont deux sources importantes de sel caché. Pas besoin de tout supprimer — commençons par réduire d'un côté : midi ou soir, pas les deux en même temps. Lequel vous semble le plus facile à changer ?", created_at: "2026-04-01T08:03:00" },
  { id: "t5", role: "user", content: "Le midi peut-être. Je pourrais apporter ma gamelle.", created_at: "2026-04-01T08:04:00" },
  { id: "t6", role: "assistant", content: "Parfait. On vise 3 midis par semaine avec un repas fait maison. C'est déjà un changement significatif sur le sel et les calories.", created_at: "2026-04-01T08:05:00" },
  // Mois 1 suite
  { id: "t7", role: "user", content: "J'ai apporté ma gamelle lundi et mercredi. Mardi j'ai craqué sur un kebab.", created_at: "2026-04-07T12:00:00" },
  { id: "t8", role: "assistant", content: "Deux sur trois, c'est une réussite Thomas. Le kebab de mardi n'efface pas les deux autres jours. Comment vous sentiez-vous après le kebab vs après votre gamelle ?", created_at: "2026-04-07T12:01:00" },
  { id: "t9", role: "user", content: "Lourd après le kebab. La gamelle c'était plus léger et j'avais plus d'énergie l'après-midi.", created_at: "2026-04-07T12:02:00" },
  { id: "t10", role: "assistant", content: "Voilà — votre corps vous donne un signal clair. Gardez cette observation en mémoire, elle sera plus efficace que n'importe quelle règle que je pourrais vous donner.", created_at: "2026-04-07T12:03:00" },
  // Mois 2 — progrès poids
  { id: "t11", role: "user", content: "Je me suis pesé : moins 2 kg en un mois. Sans me restreindre vraiment.", created_at: "2026-04-14T07:30:00" },
  { id: "t12", role: "assistant", content: "Thomas, c'est excellent. 2 kg en un mois sans restriction, c'est le signe qu'on a changé de qualité et non de quantité — c'est ce qui tient sur le long terme.", created_at: "2026-04-14T07:31:00" },
  { id: "t13", role: "user", content: "Et ma tension a un peu baissé selon mon médecin. 140/90 contre 148/95 avant.", created_at: "2026-04-14T07:32:00" },
  { id: "t14", role: "assistant", content: "C'est significatif en un mois. La réduction du sel y contribue beaucoup. Continuez — l'objectif de votre médecin est probablement 130/80. On est sur la bonne trajectoire.", created_at: "2026-04-14T07:33:00" },
  // Mois 2 — week-end difficile
  { id: "t15", role: "user", content: "Week-end compliqué. Anniversaire de mariage, beaucoup de vin et de nourriture grasse. Je me sens coupable.", created_at: "2026-04-22T10:00:00" },
  { id: "t16", role: "assistant", content: "Un anniversaire de mariage mérite d'être célébré pleinement. Ce n'est pas un écart alimentaire, c'est de la vie. Un week-end festif sur deux mois de progrès constants, ça ne change rien à la trajectoire.", created_at: "2026-04-22T10:01:00" },
  { id: "t17", role: "user", content: "Merci de le formuler ainsi. Je reprends normalement aujourd'hui.", created_at: "2026-04-22T10:02:00" },
  { id: "t18", role: "assistant", content: "C'est tout ce qu'il faut faire — reprendre sans drama. La flexibilité fait partie d'une alimentation saine.", created_at: "2026-04-22T10:03:00" },
  // Mois 3 — alimentation intuitive
  { id: "t19", role: "user", content: "J'ai arrêté de compter les calories la semaine dernière. Je mange quand j'ai faim, je m'arrête quand je suis rassasié.", created_at: "2026-05-01T11:00:00" },
  { id: "t20", role: "assistant", content: "Thomas, c'est une étape majeure. L'alimentation intuitive, c'est l'objectif final — quand le corps reprend le pilotage naturel. Comment ça se passe concrètement ?", created_at: "2026-05-01T11:01:00" },
  { id: "t21", role: "user", content: "Bien. Je mange plus lentement. Je reconnais mieux quand je suis vraiment rassasié.", created_at: "2026-05-01T11:02:00" },
  { id: "t22", role: "assistant", content: "Manger lentement est l'une des interventions les plus efficaces — le signal de satiété met 20 minutes à arriver. Vous avez trouvé la clé tout seul. C'est votre victoire.", created_at: "2026-05-01T11:03:00" },
  // Mois 3 — activité physique
  { id: "t23", role: "user", content: "J'ai commencé à marcher 30 minutes chaque matin avant le travail. Ça me change vraiment.", created_at: "2026-05-06T07:45:00" },
  { id: "t24", role: "assistant", content: "Excellent ajout Thomas. La marche matinale régule la glycémie, réduit le cortisol et améliore l'humeur pour toute la journée. En combien de temps avez-vous pris cette habitude ?", created_at: "2026-05-06T07:46:00" },
  { id: "t25", role: "user", content: "Deux semaines. Les premiers jours c'était dur de se lever plus tôt mais maintenant j'ai hâte.", created_at: "2026-05-06T07:47:00" },
  { id: "t26", role: "assistant", content: "Deux semaines, c'est exactement le temps qu'il faut pour ancrer une habitude. Et quand on commence à « avoir hâte », c'est gagné.", created_at: "2026-05-06T07:48:00" },
  // Mois 3 — semaine de maintien
  { id: "t27", role: "user", content: "Deuxième semaine stable. Poids identique à lundi dernier à 200g près.", created_at: "2026-05-10T08:20:00" },
  { id: "t28", role: "assistant", content: "La stabilité, c'est exactement l'objectif en phase de maintien. Pas de yo-yo, pas de fluctuation. Votre corps est en équilibre.", created_at: "2026-05-10T08:21:00" },
  { id: "t29", role: "user", content: "J'ai mangé au restaurant deux fois cette semaine et le poids n'a pas bougé. Avant, ça m'aurait fait prendre 1 kg facilement.", created_at: "2026-05-10T08:22:00" },
  { id: "t30", role: "assistant", content: "Ce que vous décrivez, c'est de la flexibilité métabolique — votre corps sait désormais absorber les variations sans s'emballer. Vous avez développé une vraie résilience alimentaire.", created_at: "2026-05-10T08:23:00" },
  // Semaine récente — résultats
  { id: "t31", role: "user", content: "Consultation avec mon médecin hier : tension à 128/82. Il est très content.", created_at: "2026-05-15T09:00:00" },
  { id: "t32", role: "assistant", content: "Thomas, c'est fantastique. 128/82 depuis 148/95 en deux mois et demi — sans médicament supplémentaire, juste par l'alimentation et l'activité physique. Vous pouvez en être fier.", created_at: "2026-05-15T09:01:00" },
  { id: "t33", role: "user", content: "Il a dit qu'on peut envisager de réduire le Ramipril si ça continue. Ça m'aurait semblé impossible il y a 3 mois.", created_at: "2026-05-15T09:02:00" },
  { id: "t34", role: "assistant", content: "C'est la preuve que les changements d'hygiène de vie ont un impact réel, mesurable, clinique. Vous avez fait ce travail — je n'ai fait que vous accompagner.", created_at: "2026-05-15T09:03:00" },
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
    { question: "Qu'est-ce qui vous a aidée à résister à la cantine la semaine dernière ?", justification: "Sophie a réussi à faire un choix alimentaire cohérent dans un contexte social contraignant — comprendre ce levier est précieux.", objectif: "Renforcer les mécanismes d'auto-efficacité et capitaliser sur les succès." },
  ],
  "demo-2": [
    { question: "Comment se passe l'équilibre entre votre charge de travail et vos repas au quotidien ?", justification: "Julie a indiqué ne manger qu'un croissant le matin et une salade à 15h lors d'une semaine chargée.", objectif: "Identifier des solutions concrètes adaptées à ses contraintes professionnelles." },
    { question: "Avez-vous ressenti une différence d'énergie ou d'humeur les jours où vous avez mieux mangé ?", justification: "Julie est en phase d'apprentissage des connexions alimentation-énergie. Ce lien peut être un fort levier de motivation.", objectif: "Renforcer la conscience intéroceptive et la motivation intrinsèque." },
    { question: "Qu'est-ce qui vous rend le plus difficile de prendre soin de vous quand vous êtes surchargée ?", justification: "La fatigue professionnelle semble être un obstacle majeur à l'alimentation équilibrée chez Julie.", objectif: "Explorer les croyances sous-jacentes et trouver des solutions minimales applicables même en période intense." },
  ],
  "demo-3": [
    { question: "Comment vivez-vous la stabilité actuelle de votre poids — est-ce que cela vous rassure ou est-ce anxiogène ?", justification: "Thomas est stable depuis 3 semaines, ce qui est une réussite, mais la phase de maintien peut générer une vigilance nouvelle.", objectif: "Valider psychologiquement la phase de maintien et prévenir les rechutes liées à la pression de résultats." },
    { question: "Avez-vous envie d'évoluer vos objectifs maintenant que vous avez trouvé votre équilibre ?", justification: "Thomas se dit bien, avec plus d'énergie et un meilleur sommeil. Il est peut-être prêt pour un objectif de nouvelle phase.", objectif: "Explorer l'évolution des motivations et préparer la suite du parcours." },
    { question: "Comment se passent vos repas en contexte social depuis que vous ne comptez plus les calories ?", justification: "Thomas a évoqué l'arrêt du comptage calorique comme une libération — tester cette liberté en situation sociale est l'étape suivante.", objectif: "Consolider la flexibilité alimentaire et préparer à gérer les situations sociales sereinement." },
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
    synthese: "Thomas est en phase de consolidation avec d'excellents résultats : stabilité pondérale depuis 3 semaines, relation apaisée à la nourriture, amélioration de l'énergie et du sommeil. Il est dans la phase la plus fragile du parcours — le maintien.",
    patterns: "Thomas ne compte plus les calories et mange intuitivement, avec succès. Pas de schéma problématique observé sur la période. Bonne régularité des échanges avec le jumeau.",
    victoires: "Stabilité pondérale maintenue 3 semaines consécutives. Meilleure énergie et qualité de sommeil rapportées spontanément. Recommande le programme à son entourage — signe d'adhésion profonde.",
    murmures_bilan: "Préparer Thomas à la gestion des situations de tentation futures (vacances, fêtes). Évoquer la possibilité d'espacer les consultations, tout en maintenant le suivi du jumeau. Proposer des objectifs de maintenance ou de nouvelle phase (activité physique, optimisation).",
  },
};

const ONBOARDING_STEPS = [
  { id: "welcome", title: "Bienvenue sur votre dashboard", text: "Votre jumeau numérique est désormais prêt à prendre le relais entre vos séances. Découvrez les différentes fonctionnalités disponibles au sein de votre cabinet numérique.", highlight: null, tooltipSide: null as null },
  { id: "patients", title: "Vos patients", text: "Ici s'affichent vos patients triés par niveau d'urgence émotionnelle. Cliquez sur l'un d'eux pour voir sa conversation en temps réel.", highlight: "patients", tooltipSide: "right" as const },
  { id: "radar", title: "Le Radar de Résilience", text: "Le Radar trie vos patients par niveau d'urgence émotionnelle. Ne consacrez votre énergie qu'à ceux qui en ont réellement besoin, l'IA s'occupe du reste.", highlight: "radar", tooltipSide: "bottom" as const },
  { id: "murmure", title: "Le Murmure", text: "C'est votre ligne directe avec votre jumeau. Une instruction, et il adapte immédiatement son approche avec ce patient.", highlight: "murmure", tooltipSide: "left" as const },
  { id: "rapport", title: "Le Rapport mensuel", text: "Chaque mois, votre jumeau génère un rapport complet pour préparer vos consultations. Un gain de temps considérable.", highlight: "rapport", tooltipSide: "left" as const },
  { id: "invite", title: "Inviter un patient", text: "Tout est prêt. Envoyez le lien à votre premier patient et votre jumeau prend le relais immédiatement.", highlight: "invite", tooltipSide: "right" as const },
];

const TOUR_ACCENT: Record<string, string> = { patients: "#10b981", radar: "#f43f5e", murmure: "#10b981", rapport: "#818cf8", invite: "#10b981" };
const TOUR_ACCENT_RGB: Record<string, string> = { patients: "16,185,129", radar: "244,63,94", murmure: "16,185,129", rapport: "129,140,248", invite: "16,185,129" };

const TourUsersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const TourRadarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="#f43f5e" fillOpacity="0.4"/>
  </svg>
);
const TourMicIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);
const TourChartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
);
const TourAddUserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/>
    <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
  </svg>
);
const TOUR_ICONS: Record<string, React.ReactNode> = {
  patients: <TourUsersIcon />, radar: <TourRadarIcon />, murmure: <TourMicIcon />,
  rapport: <TourChartIcon />, invite: <TourAddUserIcon />,
};

type OnboardingProps = {
  practitionerName: string;
  onSkip: () => void;
};

const OnboardingTour = ({ practitionerName, onSkip }: Omit<OnboardingProps, "step" | "onNext" | "onBack">) => {
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
        {/* Green glow top accent */}
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 200, height: 2, background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.6), transparent)", borderRadius: 2 }} />
        <div style={{ textAlign: "center", fontSize: 40, marginBottom: 16, lineHeight: 1 }}>🌿</div>
        <h1 style={{ margin: "0 0 16px", fontSize: 28, fontWeight: 800, color: "white", textAlign: "center", lineHeight: 1.2, letterSpacing: "-0.02em" }}>
          Bienvenue sur votre<br />Dashboard, {firstName}&nbsp;!
        </h1>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "#a1a1aa", textAlign: "center", lineHeight: 1.7 }}>
          Votre cabinet numérique est prêt. Pour l'instant, votre dashboard est en <strong style={{ color: "#d4d4d8" }}>mode démo</strong> avec 3 patients fictifs — explorez toutes les fonctionnalités librement.
        </p>
        <p style={{ margin: "0 0 36px", fontSize: 13, color: "#71717a", textAlign: "center", lineHeight: 1.6 }}>
          Le mode démo disparaîtra automatiquement dès que vous aurez invité votre premier patient.
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onSkip}
            style={{ flex: 1, height: 48, borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#71717a", fontSize: 14, cursor: "pointer", transition: "all 0.2s", fontFamily: "Inter, sans-serif" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "#a1a1aa"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#71717a"; }}>
            Fermer
          </button>
          <button onClick={onSkip}
            style={{ flex: 2, height: 48, borderRadius: 12, background: "linear-gradient(135deg, #10b981, #059669)", border: "none", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", fontFamily: "Inter, sans-serif", boxShadow: "0 4px 20px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.15)", letterSpacing: "0.01em" }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 32px rgba(16,185,129,0.5), inset 0 1px 0 rgba(255,255,255,0.15)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 20px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.15)"; e.currentTarget.style.transform = "translateY(0)"; }}>
            Explorer le dashboard →
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
  admin_alerts?: { type: string; date: string; seen: boolean; alert_type?: string; murmure?: string }[];
  age?: number; sexe?: string; taille?: number; poids?: number; objective?: string; pathologies?: string;
  allergies?: string; traitements?: string; objectif_clinique?: string; niveau_activite?: string;
  regime_specifique?: string;   practitioner_instruction?: { id: string; text: string; expires_at?: string | null; created_at: string }[];
  emotional_status?: string; emotional_insight?: string;
  latest_victory?: string; private_notes?: { id: string; text: string; created_at: string }[]; created_at?: string;
  lastActive?: string | null; streak?: number; sosResolved?: number; onboardingCompleted?: boolean; onboardingStatus?: string | null;
};

type Conversation = { id: string; role: "user" | "assistant"; content: string; created_at: string; };
type ReportPeriod = "week" | "month" | "custom";
type ActiveTab = "patients" | "vue_ensemble";
type Document = { id: string; file_name: string; file_type: string; created_at: string; content?: string; };
type MonthlyStats = { messages_geres: number; crises_nocturnes: number; temps_economise_heures: number; temps_accompagnement_heures: number; taux_retention: number; questions_repetitives_pct: number; sos_resolutions?: number; chat_resolutions?: number; delta_stress_avant?: number | null; delta_stress_apres?: number | null; };

const AVATAR_COLORS = ["#f43f5e", "#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ec4899", "#06b6d4", "#f97316"];

function getStatusColor(status?: string) { if (status === "red") return coral; if (status === "orange") return amber; return emerald; }
function getStatusEmoji(status?: string) { if (status === "red" || status === "red_critical") return "🔴"; if (status === "orange") return "🟡"; return "🟢"; }

// ═══ SVG ICONS ═══
const AlertIcon = ({ size = 16, color = coral }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
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

function LeverAlerteCritique({ alert, patientId, onResolved }: { alert: { type: string; alert_type?: string }; patientId: string; onResolved: () => void }) {
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const resolve = async () => {
    setLoading(true);
    await supabase.from("patients").update({ emotional_status: "green", admin_alerts: [] }).eq("user_id", patientId);
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

function LeverAlerteSimple({ alert, patientId, murmureSuggere, onResolved }: { alert: object; patientId: string; murmureSuggere: string; onResolved: (murmure: string) => void }) {
  const [open, setOpen] = useState(false);
  const [murmure, setMurmure] = useState(murmureSuggere);
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const resolve = async () => {
    setLoading(true);
    await supabase.from("patients").update({
      emotional_status: "green",
      admin_alerts: [],
      ...(murmure ? { practitioner_instruction: [] } : {}),
    }).eq("user_id", patientId);
    onResolved(murmure);
    setLoading(false);
    setOpen(false);
  };

  if (!open) return (
    <button onClick={() => setOpen(true)}
      style={{ height: 28, borderRadius: 8, padding: "0 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.08)", color: amber, transition: "all 0.2s" }}>
      Lever l'alerte
    </button>
  );

  return (
    <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, padding: "10px 12px" }}>
      <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: amber }}>Murmure suggéré par le Jumeau</p>
      <textarea value={murmure} onChange={e => setMurmure(e.target.value)} rows={3}
        style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "white", padding: "8px 10px", fontSize: 11, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "Inter, sans-serif", lineHeight: 1.5, marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => setOpen(false)} style={{ flex: 1, height: 28, borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b", fontSize: 11, cursor: "pointer" }}>Annuler</button>
        <button onClick={resolve} disabled={loading}
          style={{ flex: 2, height: 28, borderRadius: 8, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: emerald, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          {loading ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />Chargement</span> : "Lever et activer le murmure"}
        </button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
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

  // ═══ ÉTATS PRINCIPAUX ═══
  const [activeTab, setActiveTab] = useState<ActiveTab>("patients");
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
  const [showDeletePinModal, setShowDeletePinModal] = useState(false);
  const [deletePinInput, setDeletePinInput] = useState("");
  const [deletePinError, setDeletePinError] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(0);
  const [practitionerPhoto, setPractitionerPhoto] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
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

  const [patients, setPatients] = useState<RealPatient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
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
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [vueEnsembleFilter, setVueEnsembleFilter] = useState<"tous" | "urgences" | "bravos" | "ras">("tous");
  const [bravoState, setBravoState] = useState<Record<string, { expanded: boolean; text: string; editing: boolean; loading: boolean; sent: boolean }>>({});
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
  const [inviteError, setInviteError] = useState("");
  const [editingMurmureId, setEditingMurmureId] = useState<string | null>(null);
  const [editingMurmureText, setEditingMurmureText] = useState("");
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
    const { count: totalMessages } = await supabase.from("conversations").select("*", { count: "exact", head: true }).eq("practitioner_id", pid);
    const { count: sosCount } = await supabase.from("sos_events").select("*", { count: "exact", head: true }).eq("practitioner_id", pid);
    const { data: sosFeedbacks } = await supabase.from("sos_feedback").select("score_after, stress_before_proxy").eq("practitioner_id", pid);
    const chatResolutions = (sosFeedbacks ?? []).filter(f => f.score_after < f.stress_before_proxy).length;
    const feedbacksWithData = (sosFeedbacks ?? []).filter(f => f.stress_before_proxy > 0 && f.score_after > 0);
    const avgBefore = feedbacksWithData.length > 0 ? Math.round(feedbacksWithData.reduce((sum, f) => sum + f.stress_before_proxy, 0) / feedbacksWithData.length * 10) / 10 : null;
    const avgAfter = feedbacksWithData.length > 0 ? Math.round(feedbacksWithData.reduce((sum, f) => sum + f.score_after, 0) / feedbacksWithData.length * 10) / 10 : null;
    const msgs = totalMessages ?? 0;
    const tempsLibere = Math.round(((msgs * 0.75) + ((sosCount ?? 0) * 5)) / 60 * 10) / 10;
    const { data: sessions } = await supabase.from("conversations_sessions").select("created_at, last_message_at").eq("practitioner_id", pid);
    const tempsAccompagnement = Math.round(
      (sessions ?? []).reduce((sum, s) => {
        if (!s.last_message_at) return sum;
        const dur = (new Date(s.last_message_at).getTime() - new Date(s.created_at).getTime()) / 1000 / 60;
        return sum + Math.min(dur, 60);
      }, 0) / 60 * 10
    ) / 10;
    setMonthlyStats({
      messages_geres: msgs,
      crises_nocturnes: 0,
      temps_economise_heures: tempsLibere,
      temps_accompagnement_heures: tempsAccompagnement,
      taux_retention: 85,
      questions_repetitives_pct: 72,
      sos_resolutions: sosCount ?? 0,
      chat_resolutions: chatResolutions,
      delta_stress_avant: avgBefore,
      delta_stress_apres: avgAfter,
    });
  };

  const loadPatients = async (pid: string) => {
    const { data: relations } = await supabase.from("patient_practitioner").select("patient_id").eq("practitioner_id", pid);
    if (!relations || relations.length === 0) { setLoading(false); setOnboardingDemoMode(true); return; }
    const patientIds = relations.map((r) => r.patient_id as string);

    const { data: patientsData } = await supabase.from("patients").select("user_id, first_name, last_name, email, age, sexe, taille, poids, objective, pathologies, allergies, traitements, objectif_clinique, niveau_activite, regime_specifique, practitioner_instruction, emotional_status, emotional_insight, latest_victory, private_notes, admin_alerts, created_at, onboarding_completed, onboarding_status").in("user_id", patientIds);
    if (!patientsData) { setLoading(false); return; }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 3 requêtes batch au lieu de 4 × N requêtes individuelles
    const [
      { data: allConvs },
      { data: allRecentConvs },
      { data: allSosEvents },
    ] = await Promise.all([
      supabase.from("conversations")
        .select("patient_id, role, content, created_at")
        .in("patient_id", patientIds)
        .eq("practitioner_id", pid)
        .order("created_at", { ascending: false }),
      supabase.from("conversations")
        .select("patient_id, created_at")
        .in("patient_id", patientIds)
        .eq("practitioner_id", pid)
        .eq("role", "user")
        .gte("created_at", thirtyDaysAgo),
      supabase.from("sos_events")
        .select("patient_id")
        .in("patient_id", patientIds),
    ]);

    // Construire les maps de lookup (agrégation côté client, une seule passe)
    const lastConvByPatient = new Map<string, { role: string; content: string; created_at: string }>();
    const totalCountByPatient = new Map<string, number>();
    for (const conv of (allConvs ?? [])) {
      const p = conv.patient_id as string;
      if (!lastConvByPatient.has(p)) lastConvByPatient.set(p, conv as { role: string; content: string; created_at: string });
      totalCountByPatient.set(p, (totalCountByPatient.get(p) ?? 0) + 1);
    }

    const streakDaysByPatient = new Map<string, Set<string>>();
    for (const conv of (allRecentConvs ?? [])) {
      const p = conv.patient_id as string;
      const day = (conv.created_at as string).split("T")[0];
      if (!streakDaysByPatient.has(p)) streakDaysByPatient.set(p, new Set());
      streakDaysByPatient.get(p)!.add(day);
    }

    const sosCountByPatient = new Map<string, number>();
    for (const sos of (allSosEvents ?? [])) {
      const p = sos.patient_id as string;
      sosCountByPatient.set(p, (sosCountByPatient.get(p) ?? 0) + 1);
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
        lastActive: lastConv?.created_at ?? null,
        streak: streakDaysByPatient.get(p.user_id)?.size ?? 0,
        sosResolved: sosCountByPatient.get(p.user_id) ?? 0,
        age: p.age, sexe: p.sexe, taille: p.taille, poids: p.poids, traitements: p.traitements,
        objectif_clinique: p.objectif_clinique, niveau_activite: p.niveau_activite, regime_specifique: p.regime_specifique,
        objective: p.objective, pathologies: p.pathologies, allergies: p.allergies,
        practitioner_instruction: (p.practitioner_instruction as { id: string; text: string; expires_at?: string | null; created_at: string }[] | null) ?? [],
        private_notes: (p.private_notes as { id: string; text: string; created_at: string }[] | null) ?? [],
        emotional_status: p.emotional_status ?? "green", emotional_insight: p.emotional_insight ?? "",
        created_at: p.created_at,
        latest_victory: p.latest_victory ?? "",
        onboardingCompleted: p.onboarding_completed ?? false,
        onboardingStatus: p.onboarding_status ?? null,
        admin_alerts: (p.admin_alerts as { type: string; date: string; seen: boolean }[] | null) ?? [],
      };
    });
    setPatients(patientsWithStats);
    setOnboardingDemoMode(patientsWithStats.length === 0);
    if (patientsWithStats.length > 0) setSelectedPatientId(patientsWithStats[0].id);
    else setSelectedPatientId("demo-1");
    setLoading(false);
  };
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
      const { data: practitioner } = await supabase.from("practitioners").select("first_name, last_name, email, specialty, discrete_pin").eq("user_id", pid).single();
      if (practitioner) {
        const p = practitioner as { first_name: string; last_name: string; email?: string; specialty?: string; discrete_pin?: string };
        setPractitionerName(`${p.first_name} ${p.last_name}`);
        setPractitionerEmail(p.email ?? "");
        setPractitionerSpecialty(p.specialty ?? "");
        setSavedPin(p.discrete_pin ?? "");
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
      await Promise.all([loadPatients(pid), loadMonthlyStats(pid), loadDocuments(pid)]);
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!selectedPatientId || !practitionerId || onboardingDemoMode) return;
    supabase.from("conversations").select("id, role, content, created_at").eq("patient_id", selectedPatientId).eq("practitioner_id", practitionerId).order("created_at", { ascending: true }).then(({ data }) => setConversations((data as Conversation[]) ?? []));
    const patient = patients.find((p) => p.id === selectedPatientId);
    void patient;
  }, [selectedPatientId, practitionerId, onboardingDemoMode]);

  const displayedConversations = onboardingDemoMode ? (DEMO_CONVERSATIONS_BY_PATIENT[selectedPatientId ?? "demo-1"] ?? DEMO_CONVERSATIONS) : conversations;
  const displayedPatients = onboardingDemoMode ? demoPatients as unknown as RealPatient[] : patients;
  const displayedSelectedPatient = onboardingDemoMode
    ? demoPatients.find(p => p.id === (selectedPatientId ?? "demo-1")) as unknown as RealPatient ?? demoPatients[0] as unknown as RealPatient
    : patients.find((p) => p.id === selectedPatientId);

  const filteredPatients = displayedPatients.filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const redPatients = displayedPatients.filter((p) => p.emotional_status === "red" || p.emotional_status === "red_critical");
  const orangePatients = displayedPatients.filter((p) => p.emotional_status === "orange");
  const victoryPatients = displayedPatients.filter((p) => p.latest_victory);

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
      await supabase.from("patients").update({ emotional_status: "green", admin_alerts: [] }).eq("user_id", patientId);
      await fetch("/api/invalidate-cache", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId }) });
    }
    setPatients(prev => prev.map(p => p.id === patientId ? { ...p, emotional_status: "green", admin_alerts: [] } : p));
    setDemoPatients(prev => prev.map(p => p.id === patientId ? { ...p, emotional_status: "green", admin_alerts: [] } as typeof p : p));
    setShowInterventionBubble(false);
  };

  const scrollToAlertMessage = (alert: { date?: string }) => {
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
    setBravoState(prev => ({ ...prev, [patientId]: { expanded: true, text: "", editing: false, loading: true, sent: false } }));
    try {
      const res = await fetch("/api/generate-bravo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, practitionerId, victoryText }),
      });
      const data = await res.json() as { message?: string };
      setBravoState(prev => ({ ...prev, [patientId]: { expanded: true, text: data.message ?? "", editing: false, loading: false, sent: false } }));
    } catch {
      setBravoState(prev => ({ ...prev, [patientId]: { ...prev[patientId], loading: false } }));
    }
  };

  const sendBravoMessage = async (patientId: string, text: string) => {
    if (onboardingDemoMode) {
      setBravoState(prev => ({ ...prev, [patientId]: { expanded: false, text: "", editing: false, loading: false, sent: true } }));
      setDemoPatients(prev => prev.map(p => p.id === patientId ? { ...p, latest_victory: "" } : p));
      setTimeout(() => setBravoState(prev => ({ ...prev, [patientId]: { ...prev[patientId], sent: false } })), 3000);
      return;
    }
    setBravoState(prev => ({ ...prev, [patientId]: { ...prev[patientId], loading: true } }));
    try {
      await fetch("/api/send-bravo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId, practitionerId, messageText: text }) });
      setBravoState(prev => ({ ...prev, [patientId]: { expanded: false, text: "", editing: false, loading: false, sent: true } }));
      setPatients(prev => prev.map(p => p.id === patientId ? { ...p, latest_victory: undefined } : p));
      setTimeout(() => setBravoState(prev => ({ ...prev, [patientId]: { ...prev[patientId], sent: false } })), 3000);
    } catch {
      setBravoState(prev => ({ ...prev, [patientId]: { ...prev[patientId], loading: false } }));
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

  const openProfileModal = () => {
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
    setProfileSaved(false);
    setShowProfileModal(true);
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
            notes: editNotes || null,
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
          admin_alerts: (p.admin_alerts ?? []).filter((a: { alert_type?: string }) => a.alert_type !== "identity_correction"),
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
        setReportError("Impossible de générer le rapport. Réessayez.");
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
        setBilanContent(JSON.stringify({ lowData: true, message: "Impossible de générer les questions. Réessayez après quelques échanges avec votre patient." }));
      }
    } catch { setBilanContent(JSON.stringify({ lowData: true, message: "Une erreur est survenue. Veuillez réessayer." })); }
    setBilanLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#070B09", color: "white", fontFamily: "Inter, sans-serif" }}>

      {showOnboarding && (
        <OnboardingTour practitionerName={practitionerName} onSkip={handleOnboardingSkip} />
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
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "white" }}>
                  {practitionerName ? `Bonjour ${practitionerName.split(" ")[0]} 👋` : "Dashboard"}
                  <span style={{ fontSize: 11, color: "#64748b", marginLeft: 6 }}>▾</span>
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                  {onboardingDemoMode ? "3 patients · 92 messages" : `${patients.length} patient${patients.length > 1 ? "s" : ""} · ${totalMessages} messages`}
                </p>
              </div>
            </button>

            {showAccountMenu && (
              <>
                <div onClick={() => setShowAccountMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 50, background: "#0d0d0d", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", padding: "6px", minWidth: 230 }}>
                  <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 4 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "white" }}>{practitionerName}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>{practitionerEmail}</p>
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
            {onboardingDemoMode && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 20, padding: "4px 12px" }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#818cf8", animation: "breathe 2s ease-in-out infinite", flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", whiteSpace: "nowrap" }}>Mode Démo</span>
                <span style={{ fontSize: 11, color: "#4b5563", whiteSpace: "nowrap" }}>· 3 patients fictifs</span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {(["patients", "vue_ensemble"] as ActiveTab[]).map((tab) => {
              const labels: Record<ActiveTab, string> = { patients: "Suivi", vue_ensemble: "Vue d'ensemble" };
              const isActive = activeTab === tab;
              return (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{ height: 36, borderRadius: 8, padding: "0 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: isActive ? "1px solid rgba(16,185,129,0.18)" : "1px solid transparent", background: isActive ? "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))" : "transparent", color: isActive ? emerald : "#64748b", transition: "all 0.2s", boxShadow: isActive ? "0 2px 12px rgba(0,0,0,0.3)" : "none" }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = "#64748b"; e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; } }}>
                  {labels[tab]}
                </button>
              );
            })}
            <button onClick={() => void openJumeauModal()}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 12, background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))", border: "1px solid rgba(16,185,129,0.18)", cursor: "pointer", transition: "all 0.2s", boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.22), rgba(16,185,129,0.08))"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))"; e.currentTarget.style.transform = "translateY(0)"; }}>
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



      <main style={{ maxWidth: 1600, margin: "0 auto", padding: "24px" }}>

        {/* ═══ VUE SUIVI ═══ */}
        {activeTab === "patients" && (
          <div style={{ display: "grid", gridTemplateColumns: "280px minmax(0,1fr) 300px", gap: 16, height: "calc(100vh - 160px)" }}>

            {/* Sidebar patients */}
            <div data-tour="patients" style={{ display: "flex", flexDirection: "column", background: "rgba(255,255,255,0.02)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
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
                  const isRed = patient.emotional_status === "red" || isCritical;
                  const isOrange = patient.emotional_status === "orange";
                  const hasAlert = isRed || isOrange;
                  const alertDismissed = alertBannerDismissed[patient.id];
                  const activeAlert = hasAlert && !alertDismissed;
                  // Couleurs des cartes : neutre par défaut, mise en valeur forte si sélectionné
                  const alertAccent = isRed ? coral : amber;
                  const cardBg = isSelected
                    ? "rgba(255,255,255,0.07)"
                    : "rgba(255,255,255,0.025)";
                  const cardBorder = isSelected
                    ? (activeAlert ? alertAccent : "rgba(255,255,255,0.18)")
                    : "rgba(255,255,255,0.07)";
                  const cardBorderWidth = isSelected ? "1.5px" : "1px";
                  // Sous-texte : alerte uniquement si non ignorée, sinon dernier message
                  const subText = (activeAlert && patient.emotional_insight)
                    ? patient.emotional_insight
                    : patient.lastMessage;
                  const subColor = activeAlert ? (isRed ? "rgba(244,63,94,0.8)" : "rgba(245,158,11,0.8)") : "#475569";
                  // Point de statut
                  const dotColor = isRed ? coral : isOrange ? amber : emerald;
                  return (
                    <button key={patient.id} onClick={() => { setSelectedPatientId(patient.id); setShowInterventionBubble(false); }}
                      style={{ width: "100%", borderRadius: 10, padding: "10px 12px", textAlign: "left", cursor: "pointer", marginBottom: 4, background: cardBg, border: `${cardBorderWidth} solid ${cardBorder}`, transition: "all 0.18s", boxShadow: isSelected ? "0 2px 12px rgba(0,0,0,0.35)" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <div style={{ width: 34, height: 34, borderRadius: "50%", background: patient.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "white" }}>
                            {patient.initials}
                          </div>
                          <div style={{ position: "absolute", bottom: 0, right: 0, width: 9, height: 9, borderRadius: "50%", background: dotColor, border: "1.5px solid #070B09" }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: "white", filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>{patient.firstName} <span style={{ fontWeight: 400, color: "#475569", fontSize: 12 }}>{patient.lastName}</span></span>
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: subColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>
                            {subText}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div data-tour="invite" style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <button onClick={() => { setShowInviteModal(true); setInviteSuccess(false); setInviteStep(1); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 12, background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))", border: "1px solid rgba(16,185,129,0.18)", cursor: "pointer", transition: "all 0.2s", boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.22), rgba(16,185,129,0.08))"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))"; e.currentTarget.style.transform = "translateY(0)"; }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: emerald, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: emerald }}>Inviter un patient</p>
                    <p style={{ margin: 0, fontSize: 10, color: "#64748b" }}>Envoyer un accès personnalisé</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Zone conversation */}
            <div style={{ display: "flex", flexDirection: "column", background: "rgba(255,255,255,0.02)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
              {selectedPatient ? (
                <>
                  <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: selectedPatient.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "white", flexShrink: 0 }}>
                        {selectedPatient.initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "white", filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>{selectedPatient.firstName} {selectedPatient.lastName}</p>
                        <p style={{ margin: 0, fontSize: 12, color: "#64748b", filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>{onboardingDemoMode ? "patient@email.fr" : (selectedPatient as RealPatient).email}</p>
                      </div>
                    </div>
                    {/* Bandeau alerte contextuel */}
                    {(() => {
                      const alerts = selectedPatient.admin_alerts?.filter(a => !a.seen) ?? [];
                      const isCritical = selectedPatient.emotional_status === "red_critical";
                      const isRed = selectedPatient.emotional_status === "red" || isCritical;
                      const isOrange = selectedPatient.emotional_status === "orange";
                      const hasAlert = isRed || isOrange;
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
                          {alerts.length > 0 && (
                          <button onClick={() => scrollToAlertMessage(alerts[0])}
                            style={{ fontSize: 11, fontWeight: 600, color: alertColor, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0, whiteSpace: "nowrap" }}>
                            Aller au message
                          </button>
                          )}
                          {alerts.length > 0 && <span style={{ color: "#4b5563", fontSize: 11 }}>·</span>}
                          <button onClick={() => void dismissAlertFromHeader(selectedPatient.id)}
                            style={{ fontSize: 11, color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: 0, whiteSpace: "nowrap" }}
                            onMouseEnter={e => e.currentTarget.style.color = "#94a3b8"}
                            onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
                            Ignorer
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                  <div ref={conversationContainerRef} style={{ flex: 1, overflowY: "auto", padding: "16px 20px", background: "#070707", display: "flex", flexDirection: "column", gap: 12 }}>
                    {displayedConversations.length === 0 ? (
                      <p style={{ textAlign: "center", fontSize: 13, color: "#64748b", marginTop: 40 }}>Aucune conversation</p>
                    ) : displayedConversations.map((message) => {
                      const isPatient = message.role === "user";
                      const isHighlighted = message.id === highlightedMessageId;
                      const selIsRed = selectedPatient.emotional_status === "red" || selectedPatient.emotional_status === "red_critical";
                      const highlightColor = selIsRed ? "rgba(244,63,94,0.22)" : "rgba(245,158,11,0.18)";
                      const highlightOutline = selIsRed ? "rgba(244,63,94,0.5)" : "rgba(245,158,11,0.4)";
                      return (
                        <div key={message.id} data-message-id={message.id} data-message-date={message.created_at}
                          style={{ display: "flex", justifyContent: isPatient ? "flex-start" : "flex-end", transition: "all 0.3s" }}>
                          <div style={{ maxWidth: "78%" }}>
                            <div style={{ borderRadius: 14, borderBottomRightRadius: isPatient ? 14 : 4, borderBottomLeftRadius: isPatient ? 4 : 14, padding: "10px 14px", fontSize: 14, lineHeight: 1.6, background: isHighlighted ? highlightColor : isPatient ? "rgba(255,255,255,0.06)" : emerald, color: isPatient ? "#e2e8f0" : "black", filter: discretMode ? "blur(4px)" : "none", transition: "background 0.3s, filter 0.2s", outline: isHighlighted ? `2px solid ${highlightOutline}` : "none" }}>
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
                  {/* Bloc Action — fixé en bas du chat, pleine largeur */}
                  {showInterventionBubble && (() => {
                    const patIsRed = selectedPatient.emotional_status === "red" || selectedPatient.emotional_status === "red_critical";
                    const actionColor = patIsRed ? coral : amber;
                    const actionBorder = patIsRed ? "rgba(244,63,94,0.2)" : "rgba(245,158,11,0.18)";
                    const actionBtnBg = patIsRed ? "rgba(244,63,94,0.12)" : "rgba(245,158,11,0.1)";
                    const actionBtnBorder = patIsRed ? "rgba(244,63,94,0.35)" : "rgba(245,158,11,0.3)";
                    const actionBtnHover = patIsRed ? "rgba(244,63,94,0.22)" : "rgba(245,158,11,0.2)";
                    return (
                      <div style={{ borderTop: `1px solid ${actionBorder}`, background: "rgba(10,10,12,0.97)", backdropFilter: "blur(12px)", padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, color: "#64748b", flex: 1, minWidth: 140 }}>Souhaitez-vous envoyer un mot de soutien ?</span>
                        <button onClick={() => { setShowInterventionBubble(false); void openMurmureModal(); }}
                          style={{ height: 30, borderRadius: 8, padding: "0 14px", fontSize: 11, fontWeight: 600, cursor: "pointer", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", color: "#818cf8", transition: "all 0.2s", whiteSpace: "nowrap" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.2)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "rgba(99,102,241,0.1)"; }}>
                          Générer avec mon Jumeau
                        </button>
                        <button onClick={() => { setShowInterventionBubble(false); }}
                          style={{ height: 30, borderRadius: 8, padding: "0 14px", fontSize: 11, fontWeight: 600, cursor: "pointer", background: actionBtnBg, border: `1px solid ${actionBtnBorder}`, color: actionColor, transition: "all 0.2s", whiteSpace: "nowrap" }}
                          onMouseEnter={e => { e.currentTarget.style.background = actionBtnHover; }}
                          onMouseLeave={e => { e.currentTarget.style.background = actionBtnBg; }}>
                          Répondre manuellement
                        </button>
                        <button onClick={() => setShowInterventionBubble(false)}
                          style={{ height: 30, padding: "0 8px", background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#4b5563", lineHeight: 1 }}
                          onMouseEnter={e => e.currentTarget.style.color = "#94a3b8"}
                          onMouseLeave={e => e.currentTarget.style.color = "#4b5563"}>
                          ×
                        </button>
                      </div>
                    );
                  })()}
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
                  {/* Identité */}
                  <div style={{ textAlign: "center", marginBottom: 16 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>{selectedPatient.firstName} {selectedPatient.lastName}</p>
                    <p style={{ margin: "2px 0 4px", fontSize: 12, color: "#64748b", filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>{onboardingDemoMode ? "patient@email.fr" : (selectedPatient as RealPatient).email}</p>
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
                        {selectedPatient.emotional_insight || (selectedPatient.emotional_status === "green" ? "Adhésion positive" : selectedPatient.emotional_status === "orange" ? "Vigilance modérée" : "Attention requise")}
                      </span>
                    </div>
                  </div>

                  {/* Métriques */}
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: "10px 12px", marginBottom: 10 }}>
                    {(() => {
                      const p = selectedPatient as RealPatient;
                      const lastActiveStr = onboardingDemoMode
                        ? ((p as unknown as { lastActive?: string }).lastActive ?? "Jamais")
                        : p.lastActive ? (() => {
                          const diff = Date.now() - new Date(p.lastActive).getTime();
                          const mins = Math.floor(diff / 60000);
                          const hours = Math.floor(diff / 3600000);
                          const days = Math.floor(diff / 86400000);
                          if (mins < 60) return `Il y a ${mins}min`;
                          if (hours < 24) return `Il y a ${hours}h`;
                          return `Il y a ${days}j`;
                        })() : "Jamais";
                      const streak = p.streak ?? 0;
                      const sos = p.sosResolved ?? 0;
                      return [
                        { label: "Dernière connexion", value: lastActiveStr },
                        { label: "Assiduité", value: streak > 0 ? `${streak} jours actifs` : "Aucune activité" },
                        { label: "Crises désamorcées", value: sos > 0 ? `${sos}` : "Aucune" },
                      ].map((item) => (
                        <div key={item.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: "#64748b" }}>{item.label}</span>
                          <span style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 500 }}>{item.value}</span>
                        </div>
                      ));
                    })()}
                  </div>

                  {/* Alerte admin */}
                  {(selectedPatient.admin_alerts?.filter(a => !a.seen).length ?? 0) > 0 && !onboardingDemoMode && (
                    <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <AlertIcon size={13} color={amber} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: amber }}>Action requise</span>
                      </div>
                      {selectedPatient.admin_alerts?.filter(a => !a.seen).map((alert, i) => (
                        <div key={i} style={{ marginBottom: 8 }}>
                          <p style={{ margin: "0 0 6px", fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                            {alert.type === "crisis" && alert.alert_type === "suicide" && "Le patient a exprimé des idées suicidaires."}
                            {alert.type === "crisis" && alert.alert_type === "medical" && "Urgence médicale signalée par le patient."}
                            {alert.type === "crisis" && alert.alert_type === "threat" && "Le patient a exprimé une menace envers autrui."}
                            {alert.type === "alert" && "Comportement sensible détecté - relecture recommandée."}
                            {alert.type === "admin_alert" && alert.alert_type === "identity_correction" && "Le patient signale une erreur dans son nom."}
                          </p>
                          {alert.type === "crisis" ? (
                            <LeverAlerteCritique alert={alert} patientId={selectedPatient.id} onResolved={() => {
                              setPatients(prev => prev.map(p => p.id === selectedPatient.id ? { ...p, emotional_status: "green", admin_alerts: [] } : p));
                            }} />
                          ) : (
                            <LeverAlerteSimple alert={alert} patientId={selectedPatient.id} murmureSuggere={(alert as { murmure?: string }).murmure ?? ""} onResolved={(murmure) => {
                              setPatients(prev => prev.map(p => p.id === selectedPatient.id ? { ...p, emotional_status: "green", practitioner_instruction: murmure ? [...(p.practitioner_instruction ?? []), { id: crypto.randomUUID(), text: murmure, expires_at: null, created_at: new Date().toISOString() }] : p.practitioner_instruction, admin_alerts: p.admin_alerts?.map(a => a === alert ? { ...a, seen: true } : a) } : p));
                            }} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Murmures */}
                  <div data-tour="murmure" style={{ marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: emerald }}>Murmures</span>
                    <div style={{ background: "rgba(16,185,129,0.05)", borderRadius: 10, border: "1px solid rgba(16,185,129,0.2)", padding: "10px 12px", marginTop: 6 }}>
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
                              <p style={{ margin: "0 0 3px", fontSize: 11, color: isExpired ? "#64748b" : "#94a3b8", lineHeight: 1.5, textDecoration: isExpired ? "line-through" : "none" }}>{m.text}</p>
                            )}
                            {!isEditingThis && (
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <p style={{ margin: 0, fontSize: 10, color: isExpired ? "#f59e0b" : "#4b5563" }}>
                                  {isExpired ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><AlertIcon size={11} color="#f59e0b" />Expiré</span> : m.expires_at ? `Expire le ${new Date(m.expires_at).toLocaleDateString("fr-FR")}` : "Permanent"}
                                </p>
                                {!onboardingDemoMode && (
                                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                                    <button onClick={() => { setEditingMurmureId(m.id); setEditingMurmureText(m.text); }}
                                      style={{ background: "none", border: "none", cursor: "pointer", color: "#4b5563", padding: 2, transition: "color 0.2s" }}
                                      onMouseEnter={e => e.currentTarget.style.color = "#94a3b8"}
                                      onMouseLeave={e => e.currentTarget.style.color = "#4b5563"}>
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                    </button>
                                    <button onClick={() => void deleteMurmure(m.id)}
                                      style={{ background: "none", border: "none", cursor: "pointer", color: "#4b5563", padding: "0 2px", transition: "color 0.2s", fontSize: 18, lineHeight: 1 }}
                                      onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
                                      onMouseLeave={e => e.currentTarget.style.color = "#4b5563"}>
                                      ×
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                      <button onClick={() => openMurmureModal()}
                        style={{ width: 22, height: 22, borderRadius: 6, fontSize: 14, fontWeight: 400, cursor: "pointer", border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.08)", color: emerald, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.08)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; }}>
                        +
                      </button>
                    </div>
                    </div>
                  </div>

                  {/* Notes privées */}
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "94a3b8" }}>Notes privées</span>
                    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", padding: "10px 12px", marginTop: 6 }}>
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
                                  <p style={{ margin: "0 0 3px", fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>{n.text}</p>
                                )}
                                {!isEditingThis && (
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <p style={{ margin: 0, fontSize: 10, color: "#4b5563" }}>{new Date(n.created_at).toLocaleDateString("fr-FR")}</p>
                                    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                                      <button onClick={() => { setEditingNoteId(n.id); setEditingNoteText(n.text); }}
                                        style={{ background: "none", border: "none", cursor: "pointer", color: "#4b5563", padding: 2, transition: "color 0.2s" }}
                                        onMouseEnter={e => e.currentTarget.style.color = "#94a3b8"}
                                        onMouseLeave={e => e.currentTarget.style.color = "#4b5563"}>
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                      </button>
                                      <button onClick={() => void deleteNote(n.id)}
                                        style={{ background: "none", border: "none", cursor: "pointer", color: "#4b5563", padding: "0 2px", transition: "color 0.2s", fontSize: 18, lineHeight: 1 }}
                                        onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
                                        onMouseLeave={e => e.currentTarget.style.color = "#4b5563"}>
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
                            style={{ width: 22, height: 22, borderRadius: 6, fontSize: 14, fontWeight: 400, cursor: "pointer", border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.05)", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)"; e.currentTarget.style.color = "white"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "#94a3b8"; }}>
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                  {/* Documents */}
                  <div style={{ marginBottom: 10 }}>
                    <button onClick={() => setDocsCollapsed(p => !p)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: "0 0 8px", marginBottom: 0 }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#60a5fa" }}>Documents</p>
                      <span style={{ fontSize: 12, color: "#4b5563", transition: "transform 0.2s", display: "inline-block", transform: docsCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>▾</span>
                    </button>
                    {!docsCollapsed && (
                      <button onClick={() => { setPatientDocFiles([]); setPatientDocErrors([]); setPatientDocSuccess([]); setShowPatientDocModal(true); }}
                        style={{ width: "100%", height: 36, borderRadius: 8, background: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.18)", color: "#60a5fa", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(96,165,250,0.1)"; e.currentTarget.style.borderColor = "rgba(96,165,250,0.35)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(96,165,250,0.04)"; e.currentTarget.style.borderColor = "rgba(96,165,250,0.18)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                        Gérer mes documents
                      </button>
                    )}
                  </div>

                  {/* Analyses IA */}
                  <div data-tour="rapport" style={{ marginBottom: 10 }}>
                    <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#818cf8" }}>Analyses IA</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button onClick={() => { setBilanContent(""); setShowBilanModal(true); }}
                        style={{ height: 36, borderRadius: 8, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)", color: "#818cf8", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.15)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.4)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(99,102,241,0.08)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.25)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                        Préparer ma séance
                      </button>
                      <button onClick={() => { setShowReportModal(true); setReportContent(""); }}
                        style={{ height: 36, borderRadius: 8, background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.15)", color: "#818cf8", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.12)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.3)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(99,102,241,0.04)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.15)"; e.currentTarget.style.transform = "translateY(0)"; }}>
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
                          {resentInviteLoading ? "Envoi en cours..." : "Renvoyer le lien d'invitation"}
                        </button>
                      );
                    })()
                  )}

                  {/* Supprimer le patient */}
                  {!onboardingDemoMode && selectedPatient && !(selectedPatient as RealPatient).email?.includes("demo") && (
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
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>Vue d'ensemble</h2>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>Suivi en cours · Statut IA mis à jour à chaque message</p>

              {/* KPI blocks */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
                <div style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 16, padding: 20 }}>
                  <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Delta de stress moyen</p>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: "0 0 4px", fontSize: 10, color: "#64748b" }}>Avant</p>
                      <div style={{ height: 6, background: "rgba(244,63,94,0.15)", borderRadius: 3, marginBottom: 4 }}>
                        <div style={{ height: "100%", width: `${((monthlyStats?.delta_stress_avant ?? 0) / 10) * 100}%`, background: coral, borderRadius: 3 }} />
                      </div>
                      <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: coral }}>{monthlyStats?.delta_stress_avant ?? "-"}</p>
                    </div>
                    <div style={{ fontSize: 18, color: "#64748b", paddingBottom: 4 }}>→</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: "0 0 4px", fontSize: 10, color: "#64748b" }}>Après</p>
                      <div style={{ height: 6, background: "rgba(16,185,129,0.15)", borderRadius: 3, marginBottom: 4 }}>
                        <div style={{ height: "100%", width: `${((monthlyStats?.delta_stress_apres ?? 0) / 10) * 100}%`, background: emerald, borderRadius: 3 }} />
                      </div>
                      <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: emerald }}>{monthlyStats?.delta_stress_apres ?? "-"}</p>
                    </div>
                  </div>
                  <div style={{ background: "rgba(16,185,129,0.08)", borderRadius: 8, padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <TrendDownIcon size={13} color={emerald} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: emerald }}>
                      {monthlyStats?.delta_stress_avant && monthlyStats?.delta_stress_apres
                        ? `-${Math.round((1 - monthlyStats.delta_stress_apres / monthlyStats.delta_stress_avant) * 100)}% de stress moyen`
                        : "Pas encore de données"}
                    </span>
                  </div>
                </div>
                <div style={{ background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 16, padding: 20 }}>
                  <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Crises apaisées</p>
                  <p style={{ margin: "0 0 4px", fontSize: 48, fontWeight: 900, color: "#818cf8", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                    {patients.reduce((sum, p) => sum + (p.totalMessages > 0 ? 1 : 0), 0) || 0}
                  </p>
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b" }}>En toute autonomie</p>
                  <div style={{ background: "rgba(99,102,241,0.08)", borderRadius: 8, padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <ShieldIcon size={13} color="#818cf8" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8" }}>Sans votre intervention</span>
                  </div>
                </div>
                <div style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 16, padding: 20 }}>
                  <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Interventions hors-cabinet</p>
                  <p style={{ margin: "0 0 4px", fontSize: 48, fontWeight: 900, color: amber, lineHeight: 1 }}>{monthlyStats?.messages_geres ?? 0}</p>
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b" }}>messages gérés</p>
                  <div style={{ background: "rgba(245,158,11,0.08)", borderRadius: 8, padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <ClockIcon size={13} color={amber} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: amber }}>{monthlyStats?.temps_economise_heures ?? 0}h libérées</span>
                  </div>
                </div>
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 20 }} />

              {/* Barre de filtres */}
              <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "#64748b", alignSelf: "center", marginRight: 4 }}>Filtrer par :</span>
                {([
                  { key: "tous", label: "Tous" },
                  { key: "urgences", label: "Urgences" },
                  { key: "bravos", label: "Bravos à envoyer" },
                  { key: "ras", label: "RAS" },
                ] as { key: "tous" | "urgences" | "bravos" | "ras"; label: string }[]).map(f => (
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
              // Tri strict : red_critical > red > orange > green+victory > green/neutre
              const sorted = [...displayedPatients].sort((a, b) => {
                const order = { red_critical: 0, red: 1, orange: 2, green: 3 };
                const ao = order[a.emotional_status as keyof typeof order] ?? 3;
                const bo = order[b.emotional_status as keyof typeof order] ?? 3;
                if (ao !== bo) return ao - bo;
                // À égalité de statut, ceux avec victoire avant ceux sans
                if (a.latest_victory && !b.latest_victory) return -1;
                if (!a.latest_victory && b.latest_victory) return 1;
                return 0;
              });

              // Filtre
              const filtered = sorted.filter(p => {
                if (vueEnsembleFilter === "tous") return true;
                if (vueEnsembleFilter === "urgences") return p.emotional_status === "red_critical" || p.emotional_status === "red" || p.emotional_status === "orange";
                if (vueEnsembleFilter === "bravos") return !!p.latest_victory && p.emotional_status === "green";
                if (vueEnsembleFilter === "ras") return p.emotional_status === "green" && !p.latest_victory;
                return true;
              });

              if (filtered.length === 0) return <p style={{ textAlign: "center", color: "#64748b", marginTop: 40 }}>Aucun patient dans cette catégorie</p>;

              return (
                <div data-tour="radar" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                  {filtered.map((patient) => {
                    const isCritical = patient.emotional_status === "red_critical";
                    const isRed = patient.emotional_status === "red" || isCritical;
                    const isOrange = patient.emotional_status === "orange";
                    const hasAlert = isRed || isOrange;
                    const hasVictory = !!patient.latest_victory && !hasAlert;
                    const bState = bravoState[patient.id];

                    // Couleurs de la carte
                    let cardBg = "rgba(255,255,255,0.02)";
                    let cardBorder = "rgba(255,255,255,0.07)";
                    let cardShadow = "none";
                    if (isCritical) { cardBg = "rgba(244,63,94,0.04)"; cardBorder = "rgba(244,63,94,0.25)"; cardShadow = "0 0 16px rgba(244,63,94,0.08)"; }
                    else if (isRed) { cardBg = "rgba(244,63,94,0.03)"; cardBorder = "rgba(244,63,94,0.18)"; }
                    else if (isOrange) { cardBg = "rgba(245,158,11,0.02)"; cardBorder = "rgba(245,158,11,0.15)"; }
                    else if (hasVictory) { cardBg = "rgba(16,185,129,0.02)"; cardBorder = "rgba(16,185,129,0.15)"; }

                    const alertColor = isRed ? coral : amber;

                    return (
                      <div key={patient.id}
                        style={{ borderRadius: 16, padding: "18px 20px", background: cardBg, border: `1px solid ${cardBorder}`, boxShadow: cardShadow, transition: "all 0.3s", animation: isCritical ? "criticalPulse 2s ease-in-out infinite" : "none", cursor: "pointer" }}
                        onClick={(e) => {
                          // Clic sur la carte → aller au patient dans Suivi (sauf si clic sur un bouton enfant)
                          if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("textarea")) return;
                          setSelectedPatientId(patient.id); setActiveTab("patients"); setShowInterventionBubble(false);
                        }}>
                        {/* Header carte */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: hasAlert || hasVictory ? 12 : 0 }}>
                          <div style={{ width: 38, height: 38, borderRadius: "50%", background: patient.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "white", flexShrink: 0 }}>{patient.initials}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "white", filter: discretMode ? "blur(4px)" : "none" }}>{patient.firstName} {patient.lastName}</p>
                            <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>{patient.totalMessages} messages</p>
                          </div>
                        </div>

                        {/* Contenu selon statut */}
                        {hasAlert && (
                          <>
                            <p style={{ margin: "0 0 10px", fontSize: 12, color: alertColor, lineHeight: 1.5, filter: discretMode ? "blur(4px)" : "none" }}>
                              {patient.emotional_insight || (isCritical ? "Intervention immédiate requise" : "Point de vigilance détecté")}
                            </p>
                            <button onClick={(e) => { e.stopPropagation(); setSelectedPatientId(patient.id); setActiveTab("patients"); setShowInterventionBubble(false); }}
                              style={{ height: 30, borderRadius: 8, padding: "0 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", border: `1px solid ${isRed ? "rgba(244,63,94,0.4)" : "rgba(245,158,11,0.4)"}`, background: isRed ? "rgba(244,63,94,0.12)" : "rgba(245,158,11,0.1)", color: alertColor, transition: "all 0.2s" }}
                              onMouseEnter={e => { e.currentTarget.style.background = isRed ? "rgba(244,63,94,0.22)" : "rgba(245,158,11,0.2)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = isRed ? "rgba(244,63,94,0.12)" : "rgba(245,158,11,0.1)"; }}>
                              {isRed ? "Traiter l'urgence →" : "Prendre des nouvelles →"}
                            </button>
                          </>
                        )}

                        {hasVictory && (
                          <>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                              <TrophyIcon size={12} color={emerald} />
                              <p style={{ margin: 0, fontSize: 12, color: emerald, lineHeight: 1.5, filter: discretMode ? "blur(4px)" : "none" }}>{patient.latest_victory}</p>
                            </div>

                            {bState?.sent ? (
                              <CheckCircleSent />
                            ) : bState?.expanded ? (
                              /* Zone bravo inline */
                              <div onClick={e => e.stopPropagation()} style={{ marginTop: 8 }}>
                                {bState.loading ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", color: "#64748b", fontSize: 12 }}>
                                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-emerald-400" style={{ flexShrink: 0 }} />
                                    Génération en cours...
                                  </div>
                                ) : bState.editing ? (
                                  <textarea
                                    value={bState.text}
                                    onChange={e => setBravoState(prev => ({ ...prev, [patient.id]: { ...prev[patient.id], text: e.target.value } }))}
                                    rows={3}
                                    autoFocus
                                    style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.05)", color: "white", padding: "8px 10px", fontSize: 12, outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif", lineHeight: 1.5, marginBottom: 6 }}
                                  />
                                ) : (
                                  <p style={{ margin: "0 0 8px", fontSize: 12, color: "#d4d4d8", lineHeight: 1.6, background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 8, padding: "8px 10px" }}>{bState.text}</p>
                                )}
                                {!bState.loading && (
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button onClick={() => void sendBravoMessage(patient.id, bState.text)}
                                      style={{ flex: 2, height: 28, borderRadius: 8, background: emerald, border: "none", color: "black", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                      Valider et envoyer
                                    </button>
                                    {!bState.editing ? (
                                      <button onClick={() => setBravoState(prev => ({ ...prev, [patient.id]: { ...prev[patient.id], editing: true } }))}
                                        style={{ flex: 1, height: 28, borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", fontSize: 11, cursor: "pointer" }}>
                                        Modifier
                                      </button>
                                    ) : (
                                      <button onClick={() => setBravoState(prev => ({ ...prev, [patient.id]: { ...prev[patient.id], editing: false } }))}
                                        style={{ flex: 1, height: 28, borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", fontSize: 11, cursor: "pointer" }}>
                                        OK
                                      </button>
                                    )}
                                    <button onClick={() => setBravoState(prev => ({ ...prev, [patient.id]: { ...prev[patient.id], expanded: false } }))}
                                      style={{ width: 28, height: 28, borderRadius: 8, background: "transparent", border: "none", color: "#4b5563", fontSize: 13, cursor: "pointer" }}>✕</button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <button onClick={(e) => { e.stopPropagation(); void generateBravo(patient.id, patient.latest_victory ?? ""); }}
                                style={{ height: 30, borderRadius: 8, padding: "0 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", border: "1px solid rgba(16,185,129,0.35)", background: "rgba(16,185,129,0.1)", color: emerald, transition: "all 0.2s" }}
                                onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.1)"; }}>
                                Envoyer un bravo ✦
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
                            {(patient as RealPatient).objectif_clinique && (
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
              <button onClick={async (e) => { e.currentTarget.innerHTML = '<span class="flex items-center justify-center gap-2"><span class="h-4 w-4 animate-spin rounded-full border-2 border-red-500/20 border-t-red-400"></span>Déconnexion...</span>'; const s = createSupabaseBrowserClient(); await s.auth.signOut(); window.location.href = "/login"; }} style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#f87171", fontSize: 14, fontWeight: 600, cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(244,63,94,0.15)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.35)"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(244,63,94,0.08)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.2)"; }}>Se déconnecter</button>
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
            <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: "white" }}>Supprimer ce patient ?</h2>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>Toutes les données et l'accès du patient seront supprimés définitivement.<br/>Cette action est irréversible.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowDeletePatientModal(false)} disabled={deletingPatient} style={{ flex: 1, height: 52, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: deletingPatient ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 500, opacity: deletingPatient ? 0.5 : 1, transition: "all 0.2s" }} onMouseEnter={e => { if (!deletingPatient) { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "white"; } }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#94a3b8"; }}>Annuler</button>
              <button onClick={() => void removePatient(selectedPatientId)} disabled={deletingPatient} style={{ flex: 1, height: 52, borderRadius: 12, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#f87171", fontSize: 14, fontWeight: 600, cursor: deletingPatient ? "not-allowed" : "pointer", opacity: deletingPatient ? 0.7 : 1, transition: "all 0.2s" }} onMouseEnter={e => { if (!deletingPatient) { e.currentTarget.style.background = "rgba(244,63,94,0.16)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.4)"; e.currentTarget.style.color = "#fca5a5"; } }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(244,63,94,0.08)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.2)"; e.currentTarget.style.color = "#f87171"; }}>
                {deletingPatient ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-red-500/20 border-t-red-400" />Suppression...</span> : "Supprimer"}
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
              <button onClick={() => { setShowPasswordModal(false); setPasswordResetSent(false); }} style={{ background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", fontSize: 18, color: "#94a3b8", width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
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
                  <button onClick={async () => { const s = createSupabaseBrowserClient(); await s.auth.resetPasswordForEmail(practitionerEmail, { redirectTo: `${window.location.origin}/reset-password` }); setPasswordResetSent(true); }} style={{ flex: 2, height: 44, borderRadius: 10, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: emerald, fontSize: 14, fontWeight: 600, cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; }}>Envoyer le lien</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowSettingsModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 24, padding: 28, width: "100%", maxWidth: 480, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "white" }}>Paramètres</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>Gérez votre compte et vos préférences</p>
              </div>
              <button onClick={() => setShowSettingsModal(false)} style={{ background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Votre profil</p>
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{ width: 52, height: 52, borderRadius: "50%", border: `2px solid ${emerald}`, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {practitionerPhoto ? <img src={practitionerPhoto} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : AVATARS[selectedAvatar]}
                    </div>
                    <button onClick={() => avatarInputRef.current?.click()} style={{ position: "absolute", bottom: -2, right: -2, width: 18, height: 18, borderRadius: "50%", background: emerald, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="black" strokeWidth="2.5" strokeLinecap="round"/></svg>
                    </button>
                    <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = ev => setPractitionerPhoto(ev.target?.result as string); reader.readAsDataURL(file); }} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "white" }}>{practitionerName}</p>
                    <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{practitionerEmail}</p>
                    {practitionerSpecialty && <p style={{ margin: "2px 0 0", fontSize: 11, color: emerald }}>{practitionerSpecialty}</p>}
                  </div>
                </div>
                {!practitionerPhoto && (
                  <>
                    <p style={{ margin: "0 0 8px", fontSize: 11, color: "#64748b" }}>Choisir un avatar</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {AVATARS.map((avatar, i) => (
                        <button key={i} onClick={() => setSelectedAvatar(i)} style={{ width: 40, height: 40, borderRadius: "50%", border: `2px solid ${selectedAvatar === i ? emerald : "rgba(255,255,255,0.08)"}`, background: selectedAvatar === i ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }}>
                          {avatar}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {practitionerPhoto && <button onClick={() => setPractitionerPhoto(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#f87171", textDecoration: "underline", padding: 0, marginTop: 4 }}>Supprimer la photo</button>}
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Mode discret</p>
              <div style={{ background: "rgba(245,158,11,0.05)", borderRadius: 12, border: "1px solid rgba(245,158,11,0.2)", padding: "16px" }}>
                <p style={{ margin: "0 0 10px", fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{savedPin ? "Un PIN est défini. Entrez un nouveau code pour le modifier." : "Définissez un code PIN pour sécuriser la sortie du mode discret."}</p>
                <input type="password" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder={savedPin ? "Nouveau PIN (4-6 chiffres)" : "Créer un PIN (4-6 chiffres)"} maxLength={6}
                  style={{ width: "100%", height: 40, borderRadius: 10, border: "1px solid rgba(245,158,11,0.3)", background: "#161616", color: "white", padding: "0 12px", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif", marginBottom: 10 }} />
                <button onClick={() => void saveSettings()} disabled={savingSettings || !newPin || newPin.length < 4}
                  style={{ width: "100%", height: 40, borderRadius: 10, background: savingSettings || !newPin || newPin.length < 4 ? "rgba(255,255,255,0.04)" : "rgba(245,158,11,0.08)", border: `1px solid ${savingSettings || !newPin || newPin.length < 4 ? "rgba(255,255,255,0.06)" : "rgba(245,158,11,0.2)"}`, color: savingSettings || !newPin || newPin.length < 4 ? "#64748b" : amber, fontSize: 13, fontWeight: 500, cursor: savingSettings || !newPin || newPin.length < 4 ? "not-allowed" : "pointer", transition: "all 0.2s", marginBottom: savedPin ? 8 : 0 }}
                  onMouseEnter={e => { if (!savingSettings && newPin && newPin.length >= 4) e.currentTarget.style.background = "rgba(245,158,11,0.15)"; }}
                  onMouseLeave={e => { if (!savingSettings && newPin && newPin.length >= 4) e.currentTarget.style.background = "rgba(245,158,11,0.08)"; }}>
                  {settingsSaved ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke={emerald} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>PIN sauvegardé</span> : savingSettings ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500/20 border-t-amber-400" />Sauvegarde</span> : "Sauvegarder le PIN"}
                </button>
                {savedPin && <button onClick={() => setShowDeletePinModal(true)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#f87171", textDecoration: "underline", padding: 0 }}>Supprimer le PIN</button>}
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Sécurité</p>
              <button onClick={() => setShowPasswordModal(true)} style={{ width: "100%", height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "white"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#94a3b8"; }}>Changer mon mot de passe</button>
            </div>
            <div>
              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Session</p>
              <button onClick={() => setShowLogoutModal(true)} style={{ width: "100%", height: 44, borderRadius: 10, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#f87171", fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(244,63,94,0.15)"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(244,63,94,0.08)"; }}>Se déconnecter</button>
            </div>
          </div>
        </div>
      )}

      {showMurmureModal && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowMurmureModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 20, padding: 28, width: "100%", maxWidth: 480, border: "1px solid rgba(16,185,129,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: emerald, textTransform: "uppercase", letterSpacing: "0.1em" }}>Murmure</p>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "white" }}>Consigne prioritaire</h2>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>Pour {selectedPatient?.firstName} · Choisissez la durée appropriée</p>
              </div>
              <button onClick={() => setShowMurmureModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8" }}>×</button>
            </div>
            <div style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 12, color: emerald, lineHeight: 1.6 }}>Cette consigne sera injectée en priorité absolue dans chaque réponse du jumeau pour ce patient.</p>
            </div>
            <textarea value={murmureText} onChange={(e) => setMurmureText(e.target.value)} placeholder="Exemple: Sois plus doux cette semaine, elle traverse une période difficile au travail." rows={5}
              style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "14px", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "Inter, sans-serif", lineHeight: 1.6 }} />
            <div style={{ marginBottom: 16 }}>
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
              <button onClick={() => setShowJumeauModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#94a3b8" }}>×</button>
            </div>

            {/* MA VISION ET MA SIGNATURE */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>Ma Vision et Ma Signature</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {/* Vision card */}
                {editingVision ? (
                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(16,185,129,0.3)" }}>
                    <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em" }}>Ma Vision</p>
                    <textarea value={visionDraft} onChange={e => setVisionDraft(e.target.value)} autoFocus
                      placeholder="Exemple : Je crois que la santé commence dans l'intestin et que l'alimentation doit être un levier de vitalité, jamais une source d'anxiété..."
                      rows={4} style={{ width: "100%", borderRadius: 10, border: "1px solid rgba(16,185,129,0.4)", background: "#1a1a1a", color: "white", padding: "10px 12px", fontSize: 13, outline: "none", resize: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box" }} />
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
                        {visionText ? "Ma Vision" : <span style={{ color: "#4b5563" }}>Ma Vision — non renseignée</span>}
                      </span>
                    </div>
                    <button onClick={() => { setVisionDraft(visionText); setEditingVision(true); }}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: emerald, padding: "0 0 0 8px", flexShrink: 0 }}
                      onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
                      onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                      Modifier
                    </button>
                  </div>
                )}

                {/* Signature card */}
                {editingSignature ? (
                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(16,185,129,0.3)" }}>
                    <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em" }}>Ma Signature</p>
                    <textarea value={signatureDraft} onChange={e => setSignatureDraft(e.target.value)} autoFocus
                      placeholder={'Exemple : Je compare souvent le métabolisme à un feu de camp. Mon expression fétiche : "Un repas ne fait pas le moine, on tourne la page"...'}
                      rows={4} style={{ width: "100%", borderRadius: 10, border: "1px solid rgba(16,185,129,0.4)", background: "#1a1a1a", color: "white", padding: "10px 12px", fontSize: 13, outline: "none", resize: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box" }} />
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
                        {signatureText ? "Ma Signature" : <span style={{ color: "#4b5563" }}>Ma Signature — non renseignée</span>}
                      </span>
                    </div>
                    <button onClick={() => { setSignatureDraft(signatureText); setEditingSignature(true); }}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: emerald, padding: "0 0 0 8px", flexShrink: 0 }}
                      onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
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
                <label style={{ borderRadius: 12, border: `2px dashed ${documentType === "protocole" ? emerald : "rgba(255,255,255,0.15)"}`, background: documentType === "protocole" ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)", padding: "16px", textAlign: "left", cursor: "pointer", transition: "all 0.2s", display: "block" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(16,185,129,0.6)"; e.currentTarget.style.background = "rgba(16,185,129,0.05)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = documentType === "protocole" ? emerald : "rgba(255,255,255,0.15)"; e.currentTarget.style.background = documentType === "protocole" ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)"; }}>
                  <input type="file" multiple accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.csv,.mp3,.wav,.m4a" onChange={e => { setDocumentType("protocole"); handleFileChange(e); }} style={{ display: "none" }} />
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.1em" }}>Gérer mes documents</p>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "white" }}>Documents patient</h2>
              </div>
              <button onClick={() => setShowPatientDocModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#94a3b8" }}>×</button>
            </div>

            {/* Encadré anonymisation */}
            <div style={{ background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 12, padding: "12px 14px", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p style={{ margin: 0, fontSize: 12, color: "#93c5fd", lineHeight: 1.6 }}>Tous les documents ajoutés ici sont <strong style={{ color: "#60a5fa" }}>automatiquement anonymisés par l'IA</strong> avant indexation, pour garantir la confidentialité du patient.</p>
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
                  if (patientDocFiles.length === 0 || !practitionerId) return;
                  setPatientDocUploading(true); setPatientDocErrors([]); setPatientDocSuccess([]);
                  for (const file of patientDocFiles) {
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("practitionerId", practitionerId);
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
                disabled={patientDocUploading || patientDocFiles.length === 0}
                style={{ flex: 2, height: 44, borderRadius: 10, background: patientDocUploading || patientDocFiles.length === 0 ? "rgba(96,165,250,0.05)" : "rgba(96,165,250,0.15)", border: `1px solid ${patientDocUploading || patientDocFiles.length === 0 ? "rgba(96,165,250,0.1)" : "rgba(96,165,250,0.35)"}`, color: patientDocUploading || patientDocFiles.length === 0 ? "#4b5563" : "#60a5fa", fontSize: 13, fontWeight: 600, cursor: patientDocUploading || patientDocFiles.length === 0 ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
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
                <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: emerald, textTransform: "uppercase", letterSpacing: "0.1em" }}>Modifier le profil</p>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "white" }}>{selectedPatient?.firstName} {selectedPatient?.lastName}</h2>
              </div>
              <button onClick={() => setShowProfileModal(false)} style={{ background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              {/* Colonne gauche - Informations patient */}
              <div>
                <p style={{ margin: "0 0 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b" }}>Informations patient</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Email</p>
                    <input type="email" value={(selectedPatient as RealPatient)?.email ?? ""} disabled
                      style={{ width: "100%", height: 42, borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", color: "#64748b", padding: "0 14px", fontSize: 13, outline: "none", boxSizing: "border-box", cursor: "not-allowed" }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Prénom</p>
                      <input type="text" value={editFirstName} onChange={e => setEditFirstName(e.target.value)} placeholder="Sophie"
                        style={{ width: "100%", height: 42, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                        onFocus={e => e.target.style.borderColor = emerald} onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
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
                      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Sexe</p>
                      <select value={editSexe} onChange={e => setEditSexe(e.target.value)}
                        style={{ width: "100%", height: 42, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}>
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
                    return (
                      <div key={id}>
                        <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{label}</p>
                        <select value={isAutre ? "Autre" : value} onChange={e => { if (e.target.value === "Autre") setter("__autre__"); else setter(e.target.value); }}
                          style={{ width: "100%", height: 42, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#161616", color: "white", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box", cursor: "pointer" }}>
                          <option value="">Choisir</option>
                          <option value="Aucune">{["Pathologies", "Allergies", "Activité"].includes(label) ? "Aucune" : "Aucun"}</option>
                          {options.map(o => <option key={o} value={o}>{o}</option>)}
                          <option value="Autre">Autre...</option>
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

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button onClick={() => setShowProfileModal(false)}
                style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500, transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>
                Annuler
              </button>
              <button onClick={() => void saveProfile()} disabled={savingProfile}
                style={{ flex: 2, height: 44, borderRadius: 10, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: emerald, cursor: savingProfile ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, opacity: savingProfile ? 0.7 : 1, transition: "all 0.2s" }}
                onMouseEnter={e => { if (!savingProfile) { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; } }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; }}>
                {savingProfile ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500/20 border-t-emerald-500" />Sauvegarde</span> : "Mettre à jour les informations"}
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
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "white" }}>Rapport — {selectedPatient?.firstName}</h2>
              </div>
              <button onClick={() => { setShowReportModal(false); setReportContent(""); setReportError(""); }}
                style={{ background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", color: "#94a3b8", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "white"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#94a3b8"; }}>×</button>
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
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6, width: 26, height: 26, cursor: "pointer", color: "#94a3b8", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>←</button>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "white", textTransform: "capitalize" }}>{reportMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</span>
                      <button onClick={() => setReportMonth(new Date(reportMonth.getFullYear(), reportMonth.getMonth() + 1))}
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6, width: 26, height: 26, cursor: "pointer", color: "#94a3b8", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>→</button>
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
                            style={{ aspectRatio: "1", borderRadius: 5, border: "none", cursor: isFuture ? "not-allowed" : "pointer", background: isFrom || isTo ? emerald : isInRange ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.03)", color: isFrom || isTo ? "black" : isFuture ? "#374151" : "#e2e8f0", fontSize: 11, fontWeight: isFrom || isTo ? 700 : 400, opacity: isFuture ? 0.25 : 1, padding: "4px 0" }}>
                            {day.day}
                          </button>
                        );
                      })}
                    </div>
                    {reportDateFrom && <p style={{ margin: "10px 0 0", fontSize: 11, color: emerald, textAlign: "center" }}>{reportDateTo ? `Du ${new Date(reportDateFrom + "T12:00:00").toLocaleDateString("fr-FR")} au ${new Date(reportDateTo + "T12:00:00").toLocaleDateString("fr-FR")}` : `Début : ${new Date(reportDateFrom + "T12:00:00").toLocaleDateString("fr-FR")} — sélectionnez la date de fin`}</p>}
                  </div>
                )}
              </div>
            )}
            {reportError && (
              <div style={{ background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.18)", borderRadius: 10, padding: "11px 14px", marginBottom: 14, fontSize: 13, color: "#f87171", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span>{reportError}</span>
                <button onClick={() => void generateReport()} style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.25)", borderRadius: 7, padding: "5px 12px", color: "#f87171", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>Réessayer</button>
              </div>
            )}
            {!reportContent && !reportLoading && (
              <button onClick={() => void generateReport()} disabled={reportPeriod === "custom" && (!reportDateFrom || !reportDateTo)}
                style={{ width: "100%", height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: (reportPeriod === "custom" && (!reportDateFrom || !reportDateTo)) ? "#374151" : "#94a3b8", fontSize: 14, fontWeight: 600, cursor: (reportPeriod === "custom" && (!reportDateFrom || !reportDateTo)) ? "not-allowed" : "pointer", marginBottom: 4, transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                onMouseEnter={e => { if (!(reportPeriod === "custom" && (!reportDateFrom || !reportDateTo))) { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)"; e.currentTarget.style.color = "white"; } }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = (reportPeriod === "custom" && (!reportDateFrom || !reportDateTo)) ? "#374151" : "#94a3b8"; }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                Générer le rapport
              </button>
            )}
            {reportLoading && (
              <div style={{ textAlign: "center", padding: "44px 0" }}>
                <svg style={{ animation: "spin 1s linear infinite", marginBottom: 14 }} width="26" height="26" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="rgba(99,102,241,0.2)" strokeWidth="3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#818cf8" strokeWidth="3" strokeLinecap="round"/></svg>
                <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Génération du rapport en cours...</p>
              </div>
            )}
            {reportContent && (() => {
              try {
                const parsed = JSON.parse(reportContent) as { lowData?: boolean; message?: string; synthese?: string; patterns?: string; victoires?: string; murmures_bilan?: string };
                if (parsed.lowData) {
                  return (
                    <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.18)", borderRadius: 14, padding: "20px", textAlign: "center", marginBottom: 16 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
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
                return <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{reportContent}</p>;
              }
            })()}
          </div>
        </div>
      )}

      {showInviteModal && (
        <div onClick={(e) => { e.stopPropagation(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 24, padding: 28, width: "100%", maxWidth: 500, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: emerald, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  {inviteSuccess ? "" : `Étape ${inviteStep} sur 3`}
                </p>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "white" }}>
                  {inviteSuccess ? "" : inviteStep === 1 ? "Nouveau patient" : inviteStep === 2 ? "Contexte médical" : "Murmure"}
                </h2>
              </div>
              <button onClick={() => { setShowInviteModal(false); resetInviteForm(); setInviteStep(1); }} style={{ background: "rgba(255,255,255,0.05)", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "white"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#94a3b8"; }}>×</button>
            </div>

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
                        <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Email *</p>
                        <input type="email" value={inviteEmail} onChange={e => { setInviteEmail(e.target.value); setInviteError(""); }} placeholder="patient@email.fr"
                          style={{ width: "100%", height: 46, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 14px", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 10 }}
                          onFocus={e => e.target.style.borderColor = emerald} onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                          <div>
                            <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Prénom</p>
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
                          <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Sexe</p>
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
                        {checkingEmail ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500/20 border-t-emerald-500" />Vérification</span> : "Suivant →"}
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : inviteStep === 2 ? (
              <>
                <p style={{ margin: "0 0 4px", fontSize: 13, color: "#94a3b8" }}>Pour que le jumeau ne donne jamais un conseil inadapté.</p>
                <p style={{ margin: "0 0 20px", fontSize: 12, color: "#4b5563" }}>Vous pourrez compléter depuis la fiche patient.</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  {[
                    { label: "Pathologies", value: invitePathologies, setter: setInvitePathologies, id: "path", options: ["Diabète type 2", "Hypertension", "Hypothyroïdie", "SOPK", "Cholestérol", "TCA", "Surpoids"] },
                    { label: "Allergies", value: inviteAllergies, setter: setInviteAllergies, id: "allerg", options: ["Gluten", "Lactose", "Fruits à coque", "Œufs", "Fruits de mer"] },
                    { label: "Traitements", value: inviteTraitements, setter: setInviteTraitements, id: "trait", options: ["Metformine", "Lévothyrox", "Pilule contraceptive", "Antidépresseurs", "Insuline"] },
                    { label: "Objectif", value: inviteObjectifClinique, setter: setInviteObjectifClinique, id: "obj", options: ["Perte de poids", "Prise de masse", "Équilibre glycémique", "Bien-être général", "Grossesse"] },
                    { label: "Activité", value: inviteNiveauActivite, setter: setInviteNiveauActivite, id: "activ", options: ["Sédentaire", "Légère", "Modérée", "Intense", "Athlète"] },
                    { label: "Régime", value: inviteRegime, setter: setInviteRegime, id: "regime", options: ["Végétarien", "Vegan", "Sans gluten", "Halal", "Méditerranéen"] },
                  ].map(({ label, value, setter, id, options }) => {
                    const isAutre = value !== "" && !options.includes(value) && value !== "Aucune" && value !== "Aucun";
                    return (
                      <div key={id}>
                        <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{label}</p>
                        <select value={isAutre ? "Autre" : value} onChange={e => { if (e.target.value === "Autre") setter("__autre__"); else setter(e.target.value); }}
                          style={{ width: "100%", height: 40, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#161616", color: "white", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box", cursor: "pointer" }}>
                          <option value="">Choisir</option>
                          <option value="Aucune">{["Pathologies", "Allergies", "Activité"].includes(label) ? "Aucune" : "Aucun"}</option>
                          {options.map(o => <option key={o} value={o}>{o}</option>)}
                          <option value="Autre">Autre...</option>
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
                <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                <button onClick={() => setInviteStep(1)}
                    style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500, transition: "all 0.2s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>
                    ← Retour
                  </button>
                  <button onClick={() => setInviteStep(3)}
                    style={{ flex: 2, height: 44, borderRadius: 10, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: emerald, cursor: "pointer", fontSize: 14, fontWeight: 600, transition: "all 0.2s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; }}>
                    Suivant →
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ background: "rgba(16,185,129,0.05)", borderRadius: 14, border: "1px solid rgba(16,185,129,0.15)", padding: "14px 16px", marginBottom: 20 }}>
                  <p style={{ margin: 0, fontSize: 12, color: emerald, lineHeight: 1.6 }}>C'est ici que vous glissez vos consignes spécifiques pour ce patient. Points de vigilance, blessures à éviter, passions pour le motiver...<br/>Le Jumeau s'adaptera instantanément à ces nuances.</p>
                </div>
                <textarea value={inviteBriefJumeau} onChange={e => setInviteBriefJumeau(e.target.value)}
                  placeholder="Exemple : Sophie est anxieuse autour de la balance - évite ce sujet. Elle se culpabilise facilement, reste bienveillant avant d'être technique. Elle adore cuisiner, utilise ça pour l'engager."
                  rows={5}
                  style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(16,185,129,0.2)", background: "#161616", color: "white", padding: "14px", fontSize: 13, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "Inter, sans-serif", lineHeight: 1.7, marginBottom: 12 }}
                  onFocus={e => e.target.style.borderColor = emerald} onBlur={e => e.target.style.borderColor = "rgba(16,185,129,0.2)"} />
                  <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>Définir la durée</p>
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
                <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>Notes internes <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#4b5563" }}>— visibles uniquement par vous</span></p>
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
                    ← Retour
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em" }}>Nouvelle Note</p>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "white" }}>Note privée</h2>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>Visible uniquement par vous</p>
              </div>
              <button onClick={() => setShowNoteModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8" }}>×</button>
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
          <div style={{ background: "#0d0d0d", borderRadius: 24, padding: 28, width: "100%", maxWidth: 520, border: "1px solid rgba(99,102,241,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                </div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "white" }}>Préparer ma séance</h2>
              </div>
              <button onClick={() => { setShowBilanModal(false); setBilanContent(""); }} style={{ background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", color: "#94a3b8", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "white"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#94a3b8"; }}>×</button>
            </div>
            <div style={{ background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.12)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>L'IA analyse les derniers échanges de votre patient pour vous suggérer 3 questions clés à poser lors de votre prochaine consultation.</p>
            </div>
            {!bilanContent && !bilanLoading && (
              <button onClick={() => void generateBilan()}
                style={{ width: "100%", height: 44, borderRadius: 12, background: "rgba(99,102,241,0.14)", border: "1px solid rgba(99,102,241,0.35)", color: "#818cf8", fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 16, transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.22)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(99,102,241,0.14)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.35)"; }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                Générer les questions
              </button>
            )}
            {bilanLoading ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <svg style={{ animation: "spin 1s linear infinite", marginBottom: 14 }} width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="rgba(99,102,241,0.2)" strokeWidth="3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#818cf8" strokeWidth="3" strokeLinecap="round"/></svg>
                <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Analyse de l'historique du chat en cours...</p>
              </div>
            ) : bilanContent ? (
              (() => {
                try {
                  const parsed = JSON.parse(bilanContent) as { lowData?: boolean; message?: string } | { question: string; justification: string; objectif: string }[];
                  if (!Array.isArray(parsed) && parsed.lowData) {
                    return (
                      <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 14, padding: "20px 20px", textAlign: "center" }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>{(parsed as { message?: string }).message}</p>
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
                  return <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.7 }}>{bilanContent}</p>;
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
  );
}
