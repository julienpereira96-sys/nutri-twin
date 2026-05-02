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
            des données personnelles collectées via NutriTwin. Contact DPO : contact@nutri-twin.fr
          </Section>
  
          <Section title="2. Données collectées">
            NutriTwin collecte les données suivantes :
            <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
              <li><strong style={{ color: "white" }}>Données Praticien :</strong> nom, prénom, email, spécialité, réponses de configuration</li>
              <li><strong style={{ color: "white" }}>Données Patient :</strong> email, historique des conversations avec l'assistant IA</li>
              <li><strong style={{ color: "white" }}>Données de navigation :</strong> logs de connexion, adresse IP</li>
            </ul>
            <br />
            Les conversations entre les patients et l'assistant IA peuvent contenir des informations
            relatives à la santé. Ces données sont traitées avec le plus haut niveau de confidentialité.
          </Section>
  
          <Section title="3. Base légale du traitement">
            Le traitement des données est fondé sur :
            <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
              <li>L'exécution du contrat d'abonnement (données Praticien)</li>
              <li>Le consentement explicite du patient (données de santé)</li>
              <li>L'intérêt légitime pour la sécurité et l'amélioration du service</li>
            </ul>
          </Section>
  
          <Section title="4. Données de santé">
            Les conversations entre les patients et l'assistant IA peuvent constituer des données de santé
            au sens du RGPD. Ces données bénéficient d'une protection renforcée.
            <br /><br />
            Le Praticien agit en tant que responsable de traitement vis-à-vis de ses patients.
            NutriTwin agit en tant que sous-traitant. Un accord de traitement des données (DPA)
            est disponible sur demande à contact@nutri-twin.fr.
            <br /><br />
            <strong style={{ color: "#f87171" }}>Important :</strong> NutriTwin utilise des services
            d'hébergement (Supabase, Vercel) dont les serveurs peuvent être localisés hors de l'Union
            Européenne. Des garanties appropriées sont mises en place conformément au RGPD.
          </Section>
  
          <Section title="5. Sous-traitants">
            NutriTwin fait appel aux sous-traitants suivants :
            <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
              <li><strong style={{ color: "white" }}>Anthropic</strong> — traitement IA des messages (USA)</li>
              <li><strong style={{ color: "white" }}>Supabase</strong> — hébergement base de données</li>
              <li><strong style={{ color: "white" }}>Vercel</strong> — hébergement applicatif (USA)</li>
              <li><strong style={{ color: "white" }}>Resend</strong> — envoi d'emails transactionnels</li>
            </ul>
          </Section>
  
          <Section title="6. Durée de conservation">
            <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
              <li>Données Praticien : durée de l'abonnement + 3 ans</li>
              <li>Données Patient et conversations : durée du suivi + 2 ans</li>
              <li>Logs de connexion : 12 mois</li>
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
            Pour exercer ces droits : contact@nutri-twin.fr. Vous disposez également du droit
            d'introduire une réclamation auprès de la CNIL (www.cnil.fr).
          </Section>
  
          <Section title="8. Sécurité">
            NutriTwin met en œuvre les mesures techniques et organisationnelles appropriées pour protéger
            vos données : chiffrement des données en transit (HTTPS), authentification sécurisée,
            accès restreint aux données, sauvegardes régulières.
          </Section>
  
          <Section title="9. Cookies">
            NutriTwin utilise uniquement des cookies strictement nécessaires au fonctionnement du service
            (session d'authentification). Aucun cookie publicitaire ou de tracking n'est utilisé.
          </Section>
  
          <Section title="10. Contact">
            Pour toute question relative à la protection de vos données : contact@nutri-twin.fr
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
  