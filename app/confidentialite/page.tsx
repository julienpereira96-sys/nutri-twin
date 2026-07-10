export default function ConfidentialitePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "white",
        fontFamily: "Inter, -apple-system, sans-serif",
        padding: "60px 20px",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <a href="/" style={{ color: "#10b981", fontSize: 14, textDecoration: "none" }}>← Retour</a>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginTop: 24, marginBottom: 8 }}>
          Politique de Confidentialité
        </h1>
        <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 48 }}>
          Dernière mise à jour : juillet 2026
        </p>

        <Section title="1. Responsable du traitement">
          Nutritwin, auto-entrepreneur (SIRET à compléter), dont le siège est situé au 7 rue Franklin,
          52000 Chaumont, est responsable du traitement des données personnelles collectées via NutriTwin.
          Contact : contact@nutritwin.fr
          <br /><br />
          NutriTwin et le Praticien sont co-responsables du traitement des données des patients,
          conformément à l'article 26 du RGPD. Les modalités de cette co-responsabilité sont définies
          dans l'
          <a href="/dpa" style={{ color: "#10b981", textDecoration: "underline" }}>
            Accord de Traitement des Données (DPA)
          </a>
          , accepté par le Praticien lors de son inscription.
        </Section>

        <Section title="2. Données collectées">
          NutriTwin collecte les données suivantes :
          <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
            <li>
              <strong style={{ color: "white" }}>Données Praticien :</strong> nom, prénom, email,
              spécialité, réponses de configuration du jumeau numérique (approche thérapeutique,
              protocoles, documents chargés), date et heure de consentement RGPD
            </li>
            <li>
              <strong style={{ color: "white" }}>Données Patient :</strong> nom, prénom, email, âge,
              sexe, taille, poids, objectif nutritionnel, pathologies, allergies, traitements en cours,
              aliments aimés et détestés, habitudes alimentaires et de vie, historique des conversations
              avec l'assistant IA, événements SOS et exercices de régulation émotionnelle, statut
              émotionnel évalué par l'IA, date et heure de consentement RGPD
            </li>
            <li>
              <strong style={{ color: "white" }}>Données de navigation :</strong> logs de connexion,
              adresse IP, dernière date de connexion
            </li>
          </ul>
          <br />
          Les données patient constituent des données de santé au sens de l'article 9 du RGPD et
          bénéficient à ce titre d'une protection renforcée.
          <br /><br />
          <strong style={{ color: "white" }}>Analyse visuelle des repas :</strong> Les photographies
          transmises par le Patient sont traitées en temps réel par l'intelligence artificielle pour
          en extraire les informations nutritionnelles. NutriTwin ne procède à aucun stockage persistant
          de ces images — elles sont supprimées immédiatement après analyse.
          <br /><br />
          <strong style={{ color: "white" }}>Exercices vocaux (Gemini Live) :</strong> Certains
          exercices de régulation émotionnelle utilisent la voix du Patient via un flux audio en
          temps réel (WebSocket). Ces flux vocaux ne sont pas enregistrés ni stockés par NutriTwin.
          Seul le texte transcrit de l'échange peut être conservé en base de données comme résumé
          de l'exercice, dans les mêmes conditions que les autres données de conversation.
        </Section>

        <Section title="3. Base légale du traitement">
          Le traitement des données est fondé sur :
          <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
            <li>L'exécution du contrat d'abonnement (données Praticien — article 6.1.b RGPD)</li>
            <li>Le consentement explicite du patient (données de santé — article 9.2.a RGPD), recueilli
              lors de la création du compte patient avec horodatage enregistré en base de données</li>
            <li>L'intérêt légitime de l'Éditeur pour la sécurité et la continuité technique du service
              (article 6.1.f RGPD) — limité aux logs de connexion et à la limitation du débit d'usage.
              Les données de conversation ne sont jamais utilisées pour améliorer ou entraîner des
              modèles d'intelligence artificielle.</li>
          </ul>
        </Section>

        <Section title="4. Traitement automatisé et évaluation par l'IA">
          NutriTwin utilise l'intelligence artificielle pour analyser le contenu des échanges entre les
          patients et l'assistant, et attribuer un statut émotionnel (neutre / vigilance / alerte) visible
          par le Praticien dans son tableau de bord. Ce traitement constitue une forme de profilage au
          sens de l'article 4.4 du RGPD.
          <br /><br />
          Ce profilage n'entraîne <strong>aucune décision entièrement automatisée</strong> : le Praticien
          reste seul décisionnaire quant aux actions à entreprendre. Le patient peut contester l'évaluation
          en contactant son praticien ou en écrivant à contact@nutritwin.fr.
        </Section>

        <Section title="5. Sous-traitants et transferts hors UE">
          NutriTwin fait appel aux prestataires suivants. Certains sont situés en dehors de l'Union
          Européenne — des garanties appropriées sont en place dans chaque cas (clauses contractuelles
          types de la Commission européenne ou décision d'adéquation) :
          <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
            <li>
              <strong style={{ color: "white" }}>Google Cloud (Vertex AI & Gemini API) – Google Ireland Limited</strong>
              {" "}— Traitement IA des messages, analyses nutritionnelles et exercices vocaux.
              Région : europe-west9 (Paris). Certifié HDS v2.0 en France.
              Garanties RGPD : clauses contractuelles types.
            </li>
            <li>
              <strong style={{ color: "white" }}>Supabase, Inc.</strong>
              {" "}— Hébergement de la base de données.
              Région : EU West (Paris). Transfert hors UE limité au support technique ;
              clauses contractuelles types applicables.
            </li>
            <li>
              <strong style={{ color: "white" }}>Upstash, Inc.</strong>
              {" "}— Cache Redis (limitation de débit, sessions temporaires).
              Région EU disponible et activée. Seuls des identifiants techniques pseudonymisés
              (UUID) sont stockés temporairement (24h maximum) à des fins de limitation du débit.
              Clauses contractuelles types applicables.
            </li>
            <li>
              <strong style={{ color: "white" }}>Vercel, Inc.</strong>
              {" "}— Hébergement applicatif (serveurs edge).
              Siège : San Francisco, USA. Le réseau edge de Vercel est mondial ; les requêtes sont
              routées vers le point de présence le plus proche de l'utilisateur.
              Clauses contractuelles types applicables.
            </li>
            <li>
              <strong style={{ color: "white" }}>Resend, Inc.</strong>
              {" "}— Envoi d'emails transactionnels (invitations, notifications).
              Siège : USA. Clauses contractuelles types applicables.
              Seuls l'email et le prénom du destinataire sont transmis.
            </li>
            <li>
              <strong style={{ color: "white" }}>Stripe Payments Europe, Ltd.</strong>
              {" "}— Traitement des paiements. Siège européen : Dublin, Irlande.
              Certifié PCI-DSS niveau 1. NutriTwin ne stocke aucune donnée de carte bancaire.
            </li>
          </ul>
        </Section>

        <Section title="6. Durée de conservation">
          <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
            <li>Données Praticien : durée de l'abonnement + 3 ans (obligations comptables)</li>
            <li>Données Patient et conversations : durée du suivi + 2 ans</li>
            <li>Logs de connexion : 12 mois</li>
            <li>Photographies de repas : aucune conservation (suppression immédiate après analyse)</li>
            <li>Données Redis (cache) : 24 heures maximum</li>
            <li>Preuves de consentement RGPD : 5 ans</li>
          </ul>
          À l'expiration de ces délais, les données sont supprimées de manière sécurisée ou anonymisées.
        </Section>

        <Section title="7. Vos droits">
          Conformément au RGPD, vous disposez des droits suivants :
          <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
            <li>Droit d'accès à vos données personnelles</li>
            <li>Droit de rectification</li>
            <li>Droit à l'effacement ("droit à l'oubli") — les patients peuvent l'exercer directement
              depuis l'application via Paramètres → Supprimer mon compte. Les Praticiens peuvent
              l'exercer en écrivant à contact@nutritwin.fr (traitement sous 30 jours).</li>
            <li>Droit à la portabilité — les patients peuvent exporter leurs données directement
              depuis Paramètres → Exporter mes données. Les Praticiens peuvent en faire la demande
              à contact@nutritwin.fr.</li>
            <li>Droit d'opposition au traitement, y compris au profilage</li>
            <li>Droit de retirer votre consentement à tout moment sans que cela n'affecte la licéité
              du traitement antérieur</li>
          </ul>
          <br />
          Pour exercer ces droits, contactez-nous à contact@nutritwin.fr. Nous nous engageons à
          répondre dans un délai d'un mois. Vous disposez également du droit d'introduire une
          réclamation auprès de la CNIL (www.cnil.fr).
        </Section>

        <Section title="8. Sécurité">
          NutriTwin met en œuvre les mesures techniques et organisationnelles suivantes pour protéger
          vos données : chiffrement des données en transit (HTTPS/TLS 1.3), chiffrement au repos
          (AES-256 côté Supabase), authentification sécurisée, contrôle d'accès par rôle (RLS),
          anonymisation automatique des documents patients avant indexation par l'IA, journalisation
          des accès, sauvegardes quotidiennes.
        </Section>

        <Section title="9. Cookies">
          NutriTwin utilise uniquement des cookies strictement nécessaires au fonctionnement du service :
          <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
            <li>Cookie de session d'authentification (Supabase) — expire à la déconnexion ou après 7 jours</li>
          </ul>
          Aucun cookie publicitaire, de tracking ou d'analyse comportementale n'est utilisé.
          Aucun bandeau de consentement cookie n'est affiché car seuls des cookies strictement
          nécessaires sont déposés, conformément à la recommandation CNIL du 17 septembre 2020.
        </Section>

        <Section title="10. Modification de la présente politique">
          Cette politique peut être mise à jour. En cas de modification substantielle, les utilisateurs
          seront informés par email au moins 30 jours à l'avance. La date de dernière mise à jour figure
          en en-tête du document.
        </Section>

        <Section title="11. Contact">
          Pour toute question relative à la protection de vos données : contact@nutritwin.fr
          <br /><br />
          NutriTwin n'a pas l'obligation légale de désigner un Délégué à la Protection des Données
          (DPO) à ce stade. Si vous souhaitez exercer vos droits, adressez-vous directement à
          l'adresse ci-dessus.
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "white", marginBottom: 12 }}>{title}</h2>
      <div style={{ fontSize: 15, lineHeight: 1.8, color: "#9ca3af" }}>{children}</div>
    </div>
  );
}
