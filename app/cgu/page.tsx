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
            Dernière mise à jour : mai 2026
          </p>
  
          <Section title="1. Présentation du service">
            NutriTwin est un service logiciel (SaaS) édité par [Nom de la société], permettant aux praticiens
            de la nutrition de créer un assistant conversationnel basé sur l'intelligence artificielle,
            configuré selon leur approche et leurs protocoles. Ce service est destiné exclusivement aux
            professionnels de santé et de la nutrition, ci-après désignés « Praticiens ».
          </Section>
  
          <Section title="2. Acceptation des conditions">
            L'accès et l'utilisation de NutriTwin impliquent l'acceptation pleine et entière des présentes
            CGU. Si vous n'acceptez pas ces conditions, vous ne devez pas utiliser le service. Ces conditions
            peuvent être modifiées à tout moment — les utilisateurs seront informés par email en cas de
            modification substantielle.
          </Section>
  
          <Section title="3. Accès au service">
            NutriTwin est accessible sur abonnement mensuel. L'accès est nominatif et non transférable.
            Le Praticien est responsable de la confidentialité de ses identifiants de connexion. Tout accès
            frauduleux ou non autorisé doit être signalé immédiatement à contact@nutri-twin.fr.
          </Section>
  
          <Section title="4. Nature du service et limitation de responsabilité">
            NutriTwin est un outil d'assistance conversationnelle. Les réponses générées par l'intelligence
            artificielle sont basées sur les informations fournies par le Praticien lors de la configuration.
            <br /><br />
            <strong>NutriTwin n'est pas un dispositif médical.</strong> Les réponses générées ne constituent
            pas un avis médical et ne remplacent en aucun cas une consultation avec un professionnel de santé
            qualifié. Le Praticien reste seul responsable du suivi médical et nutritionnel de ses patients.
            <br /><br />
            NutriTwin décline toute responsabilité en cas de préjudice résultant d'une interprétation erronée
            ou d'une utilisation inappropriée des réponses générées par l'IA.
          </Section>
  
          <Section title="5. Obligations du Praticien">
            En utilisant NutriTwin, le Praticien s'engage à :
            <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 2 }}>
              <li>Informer ses patients de l'utilisation d'un outil d'IA dans le cadre de leur suivi</li>
              <li>Obtenir le consentement explicite de ses patients avant de les inviter sur la plateforme</li>
              <li>Ne pas utiliser le service pour des pathologies nécessitant une prise en charge médicale urgente</li>
              <li>Vérifier régulièrement les échanges entre ses patients et l'assistant IA</li>
              <li>Ne pas fournir d'informations inexactes lors de la configuration de son jumeau numérique</li>
            </ul>
          </Section>
  
          <Section title="6. Propriété intellectuelle">
            L'ensemble des éléments constituant NutriTwin (interface, algorithmes, contenu, marque) sont
            la propriété exclusive de [Nom de la société]. Toute reproduction, représentation ou exploitation
            non autorisée est strictement interdite.
            <br /><br />
            Les données saisies par le Praticien lors de la configuration restent sa propriété. NutriTwin
            ne revendique aucun droit sur ces données.
          </Section>
  
          <Section title="7. Abonnement et résiliation">
            L'abonnement est sans engagement et peut être résilié à tout moment depuis l'espace praticien.
            La résiliation prend effet à la fin de la période de facturation en cours. Aucun remboursement
            prorata temporis ne sera effectué sauf en cas d'erreur de facturation de notre part.
            <br /><br />
            En cas de violation des présentes CGU, NutriTwin se réserve le droit de suspendre ou résilier
            l'accès sans préavis.
          </Section>
  
          <Section title="8. Disponibilité du service">
            NutriTwin s'engage à maintenir le service disponible 24h/24 et 7j/7, dans la limite du
            possible. Des interruptions temporaires peuvent survenir pour maintenance. NutriTwin ne saurait
            être tenu responsable des interruptions liées à des causes extérieures (hébergeur, réseau, etc.).
          </Section>
  
          <Section title="9. Loi applicable et juridiction">
            Les présentes CGU sont soumises au droit français. En cas de litige, et à défaut de résolution
            amiable, les tribunaux compétents de Paris seront seuls compétents.
          </Section>
  
          <Section title="10. Contact">
            Pour toute question relative aux présentes CGU : contact@nutri-twin.fr
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

