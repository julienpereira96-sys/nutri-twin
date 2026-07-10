export default function DPAPage() {
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
          Accord de Traitement des Données (DPA)
        </h1>
        <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 8 }}>
          Data Processing Agreement — conformément à l'article 28 du RGPD
        </p>
        <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 48 }}>
          Dernière mise à jour : juillet 2026
        </p>

        <Section title="Préambule">
          Le présent Accord de Traitement des Données (ci-après « DPA ») est conclu entre Nutritwin,
          auto-entrepreneur (SIRET à compléter), 7 rue Franklin, 52000 Chaumont (ci-après le
          « Sous-traitant »), et tout Praticien utilisant la plateforme NutriTwin (ci-après le
          « Responsable de traitement »).
          <br /><br />
          En acceptant les Conditions Générales d'Utilisation de NutriTwin, le Praticien accepte
          également les termes du présent DPA, lequel entre en vigueur à la date d'activation du compte.
          <br /><br />
          Ce DPA s'inscrit dans le cadre réglementaire du Règlement (UE) 2016/679 (RGPD) et de la loi
          Informatique et Libertés modifiée.
        </Section>

        <Section title="1. Définitions">
          <strong style={{ color: "white" }}>Responsable de traitement :</strong> le Praticien utilisant
          NutriTwin, qui détermine les finalités et les moyens du traitement des données de ses patients.
          <br /><br />
          <strong style={{ color: "white" }}>Sous-traitant :</strong> Nutritwin, qui traite les données
          personnelles pour le compte et sur instruction du Responsable de traitement.
          <br /><br />
          <strong style={{ color: "white" }}>Données patients :</strong> toute donnée à caractère
          personnel relative aux patients du Praticien traitée via la plateforme NutriTwin.
          <br /><br />
          <strong style={{ color: "white" }}>Violation de données :</strong> toute violation de la
          sécurité entraînant, de manière accidentelle ou illicite, la destruction, la perte,
          l'altération, la divulgation non autorisée ou l'accès à des données personnelles.
        </Section>

        <Section title="2. Objet et durée du traitement">
          Le Sous-traitant traite les données patients pour la finalité exclusive suivante : fournir
          au Responsable de traitement un service d'assistant conversationnel basé sur l'intelligence
          artificielle dans le cadre du suivi nutritionnel et du bien-être de ses patients.
          <br /><br />
          Le traitement s'effectue pour la durée de l'abonnement du Praticien, augmentée d'une période
          de conservation résiduelle définie à l'article 6 de la Politique de Confidentialité.
        </Section>

        <Section title="3. Nature et finalité du traitement">
          Le traitement réalisé par le Sous-traitant comprend :
          <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
            <li>Stockage des données d'onboarding et du profil nutritionnel des patients</li>
            <li>Traitement des messages échangés entre le patient et l'assistant IA</li>
            <li>Analyse du contenu des échanges pour la génération de réponses par l'IA</li>
            <li>Évaluation automatisée du statut émotionnel à partir du contenu des échanges</li>
            <li>Stockage des événements SOS et des journaux d'exercices de régulation</li>
            <li>Génération de bilans et rapports à destination du Praticien</li>
            <li>Envoi d'emails transactionnels aux patients (invitations, notifications)</li>
          </ul>
        </Section>

        <Section title="4. Catégories de données traitées">
          Les catégories de données traitées incluent :
          <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
            <li>Données d'identité : nom, prénom, email</li>
            <li>Données de santé (article 9 RGPD) : pathologies, allergies, traitements, données
              corporelles (poids, taille), habitudes alimentaires, statut émotionnel</li>
            <li>Données comportementales : historique des conversations, fréquence d'utilisation,
              réponses aux exercices de régulation émotionnelle</li>
            <li>Données techniques : identifiants de session, logs de connexion</li>
          </ul>
        </Section>

        <Section title="5. Catégories de personnes concernées">
          Les personnes concernées par le traitement sont exclusivement les patients du Praticien
          ayant accepté les conditions d'utilisation de NutriTwin et dont l'inscription a été initiée
          par le Praticien via la fonctionnalité d'invitation de la plateforme.
        </Section>

        <Section title="6. Obligations du Sous-traitant">
          Le Sous-traitant s'engage à :
          <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
            <li>Ne traiter les données que sur instruction documentée du Responsable de traitement,
              telle qu'exprimée dans les CGU et le présent DPA</li>
            <li>Garantir la confidentialité des données : les personnes autorisées à traiter les
              données s'engagent à la confidentialité</li>
            <li>Mettre en œuvre les mesures de sécurité appropriées décrites à l'article 8 de la
              Politique de Confidentialité (chiffrement, contrôle d'accès, RLS, journalisation)</li>
            <li>Ne pas recruter de nouveau sous-traitant ultérieur sans en informer le Responsable
              de traitement avec un préavis de 30 jours — la liste actuelle des sous-traitants
              figure à l'article 5 de la Politique de Confidentialité</li>
            <li>Aider le Responsable de traitement à répondre aux demandes d'exercice de droits des
              personnes concernées, dans la mesure du possible compte tenu de la nature du traitement</li>
            <li>Notifier toute violation de données au Responsable de traitement dans un délai
              de 48 heures après en avoir pris connaissance</li>
            <li>Supprimer ou restituer toutes les données personnelles à l'issue du contrat, selon
              le choix du Responsable de traitement, et détruire les copies existantes sauf obligation
              légale de conservation</li>
            <li>Mettre à la disposition du Responsable de traitement toutes les informations
              nécessaires pour démontrer le respect du présent DPA</li>
          </ul>
        </Section>

        <Section title="7. Obligations du Responsable de traitement">
          Le Responsable de traitement (Praticien) s'engage à :
          <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
            <li>N'inviter sur la plateforme que des patients ayant donné leur consentement éclairé
              à l'utilisation d'un outil d'IA dans leur suivi</li>
            <li>Informer ses patients de l'existence du présent DPA et de la Politique de
              Confidentialité de NutriTwin</li>
            <li>Respecter les réglementations applicables à sa profession dans le cadre de
              l'utilisation du service</li>
            <li>Notifier NutriTwin de toute demande d'exercice de droits reçue d'un patient
              qui nécessiterait une action technique de la part du Sous-traitant</li>
            <li>Ne pas demander au Sous-traitant de traiter les données à des fins incompatibles
              avec les présentes</li>
          </ul>
        </Section>

        <Section title="8. Sous-traitants ultérieurs">
          Le Responsable de traitement autorise le Sous-traitant à faire appel aux sous-traitants
          ultérieurs listés dans la Politique de Confidentialité (Google Cloud, Supabase, Upstash,
          Vercel, Resend, Stripe). Toute modification de cette liste sera communiquée au Responsable
          de traitement par email avec un préavis de 30 jours, lui laissant la possibilité de s'y
          opposer. En l'absence d'opposition dans ce délai, la modification est réputée acceptée.
          <br /><br />
          Le Sous-traitant impose aux sous-traitants ultérieurs des obligations équivalentes à celles
          du présent DPA en matière de protection des données.
        </Section>

        <Section title="9. Transferts hors Union Européenne">
          Certains sous-traitants ultérieurs sont établis hors de l'Union Européenne (Vercel, Resend,
          Upstash, Stripe). Ces transferts sont encadrés par des clauses contractuelles types (CCT)
          adoptées par la Commission européenne, conformément à l'article 46 du RGPD. La liste des
          garanties par prestataire est disponible dans la Politique de Confidentialité.
        </Section>

        <Section title="10. Sécurité des données">
          Le Sous-traitant met en œuvre les mesures techniques et organisationnelles suivantes :
          <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
            <li>Chiffrement en transit (HTTPS/TLS 1.3)</li>
            <li>Chiffrement au repos (AES-256 via Supabase)</li>
            <li>Contrôle d'accès granulaire par ligne de base de données (Row Level Security)</li>
            <li>Séparation des droits : accès client limité aux données propres à chaque utilisateur</li>
            <li>Authentification sécurisée via Supabase Auth</li>
            <li>Journalisation des accès</li>
            <li>Sauvegardes quotidiennes automatisées</li>
            <li>Anonymisation des documents avant indexation par l'IA</li>
          </ul>
        </Section>

        <Section title="11. Notification des violations de données">
          En cas de violation de données personnelles, le Sous-traitant notifiera le Responsable de
          traitement dans un délai de 48 heures par email à l'adresse utilisée lors de l'inscription.
          La notification précisera la nature de la violation, les catégories et le nombre approximatif
          de personnes concernées, les données affectées, les conséquences probables, et les mesures
          prises ou envisagées.
          <br /><br />
          Le Responsable de traitement reste seul responsable de la notification à la CNIL dans le
          délai légal de 72 heures prévu à l'article 33 du RGPD.
        </Section>

        <Section title="12. Durée et résiliation">
          Le présent DPA prend fin automatiquement à la résiliation du contrat d'abonnement. À cette
          date, le Sous-traitant procédera à la suppression des données patients selon les durées de
          conservation définies dans la Politique de Confidentialité, ou plus tôt sur demande écrite
          du Responsable de traitement à contact@nutritwin.fr.
        </Section>

        <Section title="13. Droit applicable">
          Le présent DPA est soumis au droit français. Tout litige sera soumis aux tribunaux compétents
          de Chaumont.
        </Section>

        <Section title="14. Contact">
          Pour toute question relative au présent DPA : contact@nutritwin.fr
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
