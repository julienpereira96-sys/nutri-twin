export default function CGUPage() {
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
          Conditions Générales d'Utilisation
        </h1>
        <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 48 }}>
          Dernière mise à jour : juillet 2026
        </p>

        <Section title="1. Mentions légales et présentation du service">
          NutriTwin est un service logiciel (SaaS) édité par Julien PEREIRA, exerçant sous
          l'enseigne Nutritwin, auto-entrepreneur (SIRET à compléter), dont le siège est situé
          au 7 rue Franklin, 52000 Chaumont — ci-après « l'Éditeur ».
          Directeur de la publication : Julien PEREIRA. Email : contact@nutritwin.fr.
          <br /><br />
          Hébergement applicatif : Vercel Inc., 340 Pine Street Suite 1200, San Francisco, CA 94104, USA.
          Hébergement des données : Supabase, Inc. (région Europe West — Paris).
          <br /><br />
          NutriTwin permet aux praticiens de la nutrition de créer un assistant conversationnel basé sur
          l'intelligence artificielle, configuré selon leur approche et leurs protocoles. Ce service est
          destiné exclusivement aux professionnels de santé et de la nutrition, ci-après désignés
          « Praticiens ».
        </Section>

        <Section title="2. Acceptation des conditions">
          L'accès et l'utilisation de NutriTwin impliquent l'acceptation pleine et entière des présentes
          CGU. Si vous n'acceptez pas ces conditions, vous ne devez pas utiliser le service. Ces conditions
          peuvent être modifiées — les utilisateurs seront informés par email au moins 30 jours avant toute
          modification substantielle. La poursuite de l'utilisation du service après cette période vaut
          acceptation des nouvelles conditions.
        </Section>

        <Section title="3. Accès au service">
          NutriTwin est accessible sur abonnement mensuel dont les tarifs sont indiqués sur la page
          d'accueil du site. L'accès est nominatif et non transférable. Le Praticien est responsable
          de la confidentialité de ses identifiants de connexion. Tout accès frauduleux ou non autorisé
          doit être signalé immédiatement à contact@nutritwin.fr.
        </Section>

        <Section title="4. Facturation et paiement">
          Le paiement est effectué mensuellement par carte bancaire via Stripe (Stripe Payments Europe Ltd,
          1 Grand Canal Street Lower, Dublin 2, Irlande). Une facture est émise automatiquement à chaque
          renouvellement et adressée par email au Praticien. Les prix sont exprimés en euros toutes taxes
          comprises. NutriTwin se réserve le droit de modifier ses tarifs avec un préavis de 30 jours.
          <br /><br />
          NutriTwin n'étant pas soumis à la TVA (auto-entrepreneur sous seuil), les factures sont émises
          hors TVA conformément à l'article 293 B du Code général des impôts. Cette mention sera mise à
          jour dès dépassement du seuil de franchise.
        </Section>

        <Section title="5. Nature du service et limitation de responsabilité">
          NutriTwin est un outil d'assistance conversationnelle permettant la création d'un « jumeau
          numérique », lequel constitue une extension digitale de l'expertise du Praticien. Les conseils
          délivrés par cet assistant sont le reflet direct des protocoles et documents chargés par le
          Praticien lors de la configuration du service.
          <br /><br />
          <strong>NutriTwin n'est pas un dispositif médical.</strong> Les réponses générées ne constituent
          pas un avis médical et ne remplacent en aucun cas une consultation avec un professionnel de santé
          qualifié. Le Praticien reste seul responsable du suivi médical et nutritionnel de ses patients.
          <br /><br />
          NutriTwin décline toute responsabilité en cas de préjudice résultant d'une interprétation erronée
          ou d'une utilisation inappropriée des réponses générées par l'IA. La responsabilité de l'Éditeur
          est en tout état de cause limitée au montant des sommes versées par le Praticien au cours des
          12 derniers mois.
        </Section>

        <Section title="6. Obligations du Praticien">
          En utilisant NutriTwin, le Praticien s'engage à :
          <ul style={{ marginTop: 12, paddingLeft: 24, lineHeight: 2, listStyleType: "disc" }}>
            <li>Informer ses patients de l'utilisation d'un outil d'IA dans le cadre de leur suivi.</li>
            <li>Obtenir le consentement explicite de ses patients avant de les inviter sur la plateforme.</li>
            <li>Ne pas utiliser le service pour des pathologies nécessitant une prise en charge médicale urgente.</li>
            <li>Vérifier régulièrement les échanges entre ses patients et l'assistant IA.</li>
            <li>Ne pas fournir d'informations inexactes lors de la configuration de son jumeau numérique.</li>
            <li>S'assurer que ses patients ont bien pris connaissance de la Politique de Confidentialité.</li>
            <li>Respecter les réglementations applicables à sa profession (code de déontologie, secret professionnel, etc.).</li>
          </ul>
        </Section>

        <Section title="7. Propriété intellectuelle">
          L'ensemble des éléments constituant NutriTwin (interface, algorithmes, contenu, marque) sont
          la propriété exclusive de Nutritwin. Toute reproduction, représentation ou exploitation non
          autorisée est strictement interdite.
          <br /><br />
          Les données saisies par le Praticien lors de la configuration (protocoles, documents, réponses
          au questionnaire) restent sa propriété exclusive. NutriTwin ne revendique aucun droit sur ces
          données et ne les utilise pas à d'autres fins que la fourniture du service.
        </Section>

        <Section title="8. Abonnement et résiliation">
          L'abonnement est sans engagement et peut être résilié à tout moment depuis l'espace praticien.
          La résiliation prend effet à la fin de la période de facturation en cours. Aucun remboursement
          prorata temporis ne sera effectué sauf en cas d'erreur de facturation de notre part.
          <br /><br />
          En cas de violation des présentes CGU, NutriTwin se réserve le droit de suspendre ou résilier
          l'accès sans préavis ni indemnité.
        </Section>

        <Section title="9. Disponibilité du service et force majeure">
          NutriTwin s'engage à maintenir le service disponible 24h/24 et 7j/7, dans la limite du
          possible. Des interruptions temporaires peuvent survenir pour maintenance, avec préavis autant
          que faire se peut. NutriTwin ne saurait être tenu responsable des interruptions liées à des
          causes extérieures (hébergeur, réseau, cas de force majeure).
          <br /><br />
          Constituent des cas de force majeure exonérant l'Éditeur de toute responsabilité : les
          catastrophes naturelles, pannes d'infrastructure tier, cyberattaques, grèves générales, décisions
          gouvernementales, ou tout autre événement imprévisible et irrésistible indépendant de la volonté
          de l'Éditeur.
        </Section>

        <Section title="10. Données personnelles">
          Le traitement des données personnelles collectées dans le cadre de l'utilisation du service est
          régi par la{" "}
          <a href="/confidentialite" style={{ color: "#10b981", textDecoration: "underline" }}>
            Politique de Confidentialité
          </a>{" "}
          de NutriTwin, accessible depuis le bas de la page d'accueil. En acceptant les présentes CGU,
          le Praticien reconnaît avoir pris connaissance de cette politique.
        </Section>

        <Section title="11. Loi applicable et juridiction">
          Les présentes CGU sont soumises au droit français. En cas de litige, et à défaut de résolution
          amiable dans un délai de 30 jours à compter de la notification du différend, les tribunaux
          compétents de Chaumont seront seuls compétents.
        </Section>

        <Section title="12. Contact">
          Pour toute question relative aux présentes CGU : contact@nutritwin.fr
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
