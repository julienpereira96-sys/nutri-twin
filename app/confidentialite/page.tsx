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
          Dernière mise à jour : mai 2026
        </p>

        <Section title="1. Responsable du traitement">
          [Nom de la société], dont le siège social est situé à [Adresse], est responsable du traitement
          des données personnelles collectées via NutriTwin. Contact DPO : contact@nutritwin.fr
        </Section>

        <Section title="2. Données collectées">
          NutriTwin collecte les données suivantes :
          <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
            <li><strong style={{ color: "white" }}>Données Praticien :</strong> nom, prénom, email, spécialité, réponses de configuration du jumeau numérique, date et heure de consentement RGPD</li>
            <li><strong style={{ color: "white" }}>Données Patient :</strong> nom, prénom, email, âge, objectif nutritionnel, pathologies, allergies, historique des conversations avec l'assistant IA, date et heure de consentement RGPD</li>
            <li><strong style={{ color: "white" }}>Données de navigation :</strong> logs de connexion, adresse IP</li>
          </ul>
          <br />
          Les conversations entre les patients et l'assistant IA peuvent contenir des informations
          relatives à la santé. Ces données sont traitées avec le plus haut niveau de confidentialité.
          <br /><br />
          <strong style={{ color: "white" }}>Analyse visuelle des repas :</strong> Les photographies
          transmises par le Patient sont traitées en temps réel par l'intelligence artificielle pour
          en extraire les informations nutritionnelles. NutriTwin ne procède à aucun stockage persistant
          de ces images, lesquelles sont supprimées immédiatement après analyse. Aucune photographie
          n'est conservée dans nos systèmes.
        </Section>

        <Section title="3. Base légale du traitement">
          Le traitement des données est fondé sur :
          <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
            <li>L'exécution du contrat d'abonnement (données Praticien)</li>
            <li>Le consentement explicite du patient (données de santé - article 9 RGPD)</li>
            <li>L'intérêt légitime pour la sécurité et l'amélioration du service</li>
          </ul>
          La preuve du consentement est enregistrée avec horodatage lors de l'inscription.
        </Section>

        <Section title="4. Données de santé">
          Les conversations entre les patients et l'assistant IA peuvent constituer des données de santé
          au sens du RGPD. Ces données bénéficient d'une protection renforcée.
          <br /><br />
          Le Praticien agit en tant que responsable de traitement vis-à-vis de ses patients.
          NutriTwin agit en tant que sous-traitant. Un accord de traitement des données (DPA)
          est disponible sur demande à contact@nutritwin.fr.
          <br /><br />
          Les données sont hébergées sur des infrastructures dont les serveurs sont situés dans
          l'Union Européenne. Le traitement par intelligence artificielle est effectué exclusivement
          sur des serveurs localisés en Europe.
        </Section>

        <Section title="5. Sous-traitants">
          NutriTwin fait appel aux sous-traitants suivants :
          <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
            <li>
              <strong style={{ color: "white" }}>Google Cloud Vertex AI – Google Ireland Limited</strong> - Traitement par intelligence artificielle des messages et analyses nutritionnelles.
              Lieu de traitement : Union Européenne (Région europe-west9, Paris).
              Garantie : Conformité totale au RGPD. Google Cloud est certifié HDS v2.0 en France.
            </li>
            <li>
              <strong style={{ color: "white" }}>Supabase</strong> - Hébergement base de données (région EU West, Paris)
            </li>
            <li>
              <strong style={{ color: "white" }}>Vercel</strong> - Hébergement applicatif
            </li>
            <li>
              <strong style={{ color: "white" }}>Resend</strong> - Envoi d'emails transactionnels
            </li>
            <li>
              <strong style={{ color: "white" }}>Stripe</strong> - Traitement des paiements (certifié PCI-DSS)
            </li>
          </ul>
        </Section>

        <Section title="6. Durée de conservation">
          <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
            <li>Données Praticien : durée de l'abonnement + 3 ans</li>
            <li>Données Patient et conversations : durée du suivi + 2 ans</li>
            <li>Logs de connexion : 12 mois</li>
            <li>Photographies de repas : aucune conservation (suppression immédiate après analyse)</li>
            <li>Preuves de consentement RGPD : 5 ans</li>
          </ul>
          À l'expiration de ces délais, les données sont supprimées ou anonymisées.
        </Section>

        <Section title="7. Vos droits">
          Conformément au RGPD, vous disposez des droits suivants :
          <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
            <li>Droit d'accès à vos données personnelles</li>
            <li>Droit de rectification</li>
            <li>Droit à l'effacement ("droit à l'oubli")</li>
            <li>Droit à la portabilité</li>
            <li>Droit d'opposition au traitement</li>
            <li>Droit de retirer votre consentement à tout moment</li>
          </ul>
          <br />
          Pour exercer ces droits : contact@nutritwin.fr. Vous disposez également du droit
          d'introduire une réclamation auprès de la CNIL (www.cnil.fr).
        </Section>

        <Section title="8. Sécurité">
          NutriTwin met en œuvre les mesures techniques et organisationnelles appropriées pour protéger
          vos données : chiffrement des données en transit (HTTPS/TLS), authentification sécurisée,
          accès restreint aux données, sauvegardes régulières, anonymisation automatique des documents
          avant indexation par l'IA.
        </Section>

        <Section title="9. Cookies">
          NutriTwin utilise uniquement des cookies strictement nécessaires au fonctionnement du service
          (session d'authentification). Aucun cookie publicitaire ou de tracking n'est utilisé.
        </Section>

        <Section title="10. Contact">
          Pour toute question relative à la protection de vos données : contact@nutritwin.fr
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
