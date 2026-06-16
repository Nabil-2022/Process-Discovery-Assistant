import { FormEvent, useEffect, useMemo, useState } from 'react';

const badges = [
  { label: 'SaaS multi-tenant' },
  { label: 'RACI déterministe' },
  { label: 'BPMN 2.0' },
  { label: 'ISO 9001 ready' },
  {
    label: 'Conformité Maroc',
    law: 'Loi 55-19',
    variant: 'morocco',
    title:
      'Référentiel visuel pour les processus concernés par les exigences marocaines, notamment la Loi 55-19.',
  },
  { label: 'Exports officiels' },
  { label: 'IA encadrée' },
];

const problemPoints = [
  'Processus dispersés dans Excel, Word et les emails.',
  'Responsabilités floues entre directions, contrôles et validations.',
  'Procédures difficiles à maintenir et rarement à jour.',
  'Cartographies complexes à consolider par direction.',
  'Validations non tracées et audits longs à préparer.',
  'Transformation digitale ralentie par le manque de référentiel fiable.',
  'Opportunités d’automatisation difficiles à prioriser.',
  'Absence de vision unifiée sur les risques, KPI et contrôles.',
];

const steps = [
  'Recenser',
  'Formaliser',
  'Contrôler',
  'Valider',
  'Publier',
  'Exporter',
  'Améliorer',
];

const features = [
  {
    icon: 'CP',
    title: 'Cartographie des processus',
    description: 'Structurez les processus par direction, domaine, responsable et criticité.',
    benefit: 'Une vision consolidée et exploitable.',
  },
  {
    icon: '11',
    title: 'Wizard en 11 étapes',
    description: 'Guide les équipes terrain dans une formalisation complète et homogène.',
    benefit: 'Moins d’oublis, plus de qualité.',
  },
  {
    icon: '%',
    title: 'Score de complétude',
    description: 'Mesure le niveau de maturité documentaire avant validation.',
    benefit: 'Des priorités visibles immédiatement.',
  },
  {
    icon: 'R',
    title: 'Matrice RACI déterministe',
    description: 'Clarifie qui réalise, approuve, consulte et informe.',
    benefit: 'Responsabilités lisibles et partagées.',
  },
  {
    icon: 'B',
    title: 'BPMN 2.0 déterministe',
    description: 'Produit un flux BPMN cohérent, lisible et exportable.',
    benefit: 'Compatible avec les pratiques BPM.',
  },
  {
    icon: 'Q',
    title: 'Procédures qualité',
    description: 'Transforme les informations terrain en procédure documentée.',
    benefit: 'Livrables prêts pour revue.',
  },
  {
    icon: 'V',
    title: 'Workflow de validation',
    description: 'Organise les étapes de revue, correction, approbation et publication.',
    benefit: 'Gouvernance claire et traçable.',
  },
  {
    icon: 'A',
    title: 'Audit et traçabilité',
    description: 'Historise les actions, changements, validations et points de contrôle.',
    benefit: 'Préparation aux audits facilitée.',
  },
  {
    icon: 'R!',
    title: 'Risques et contrôles',
    description: 'Relie risques, contrôles, activités et responsables.',
    benefit: 'Meilleure maîtrise opérationnelle.',
  },
  {
    icon: 'K',
    title: 'KPI',
    description: 'Documente les indicateurs associés aux processus et activités.',
    benefit: 'Pilotage plus factuel.',
  },
  {
    icon: '55',
    title: 'Conformité Maroc / Loi 55-19',
    description: 'Aide à structurer les démarches, documents et validations.',
    benefit: 'Un cadre adapté aux organisations marocaines.',
  },
  {
    icon: 'PM',
    title: 'Process Mining readiness',
    description: 'Prépare les données et événements utiles aux analyses futures.',
    benefit: 'Automatisation et optimisation mieux ciblées.',
  },
  {
    icon: 'IA',
    title: 'Copilote IA encadré',
    description: 'Assiste la rédaction et l’analyse sans devenir source de vérité.',
    benefit: 'Gain de temps avec validation humaine.',
  },
  {
    icon: 'EX',
    title: 'Exports officiels',
    description: 'Génère PDF, Word, Excel, JSON et BPMN XML.',
    benefit: 'Livrables partageables et archivables.',
  },
  {
    icon: 'N',
    title: 'Notifications et tâches',
    description: 'Rend visibles les actions attendues et les retards.',
    benefit: 'Moins de suivi manuel.',
  },
  {
    icon: 'S',
    title: 'Multi-tenant SaaS',
    description: 'Segmente les organisations, rôles, données et espaces de travail.',
    benefit: 'Déploiement scalable et contrôlé.',
  },
];

const differentiators = [
  'IA assistée, jamais source de vérité',
  'Moteurs RACI et BPMN déterministes',
  'Validation humaine obligatoire',
  'Traçabilité complète des décisions',
  'Conformité Maroc intégrée avec prudence',
  'Préparation au process mining',
  'Exports documentaires officiels',
  'Approche SaaS souveraine, dédiée ou on-premise',
];

const trustItems = [
  'SaaS multi-tenant',
  'RBAC',
  'Audit logs',
  'JWT',
  'PostgreSQL',
  'Docker',
  'Nginx',
  'MinIO / S3',
  'Azure OpenAI optionnel',
  'Domaine client possible',
  'Exports contrôlés',
  'Données métier structurées',
];

const productViews = [
  {
    title: 'Dashboard tenant',
    badge: 'Pilotage',
    image: '/landing/landing-dashboard.png',
  },
  {
    title: 'Wizard',
    badge: 'Formalisation',
    image: '/landing/landing-wizard.png',
  },
  {
    title: 'Atelier',
    badge: 'Contrôle',
    image: '/landing/landing-workshop.png',
  },
  {
    title: 'RACI',
    badge: 'Responsabilités',
    image: '/landing/landing-raci.png',
  },
  {
    title: 'BPMN premium',
    badge: 'Diagramme',
    image: '/landing/landing-bpmn.png',
  },
  {
    title: 'Procédure',
    badge: 'Qualité',
    image: '/landing/landing-procedure.png',
  },
  {
    title: 'Exports',
    badge: 'Livrables',
    image: '/landing/landing-exports.png',
  },
  {
    title: 'Audit',
    badge: 'Traçabilité',
    image: '/landing/landing-audit.png',
  },
];

const useCases = [
  {
    title: 'Administration publique',
    text: 'Cartographier les démarches usagers et prioriser la simplification.',
  },
  {
    title: 'Banque / assurance',
    text: 'Structurer les processus sensibles, clarifier les responsabilités et préparer les audits.',
  },
  {
    title: 'Entreprise publique',
    text: 'Formaliser les procédures, tracer les validations et produire les livrables officiels.',
  },
  {
    title: 'Direction qualité',
    text: 'Transformer les processus terrain en procédures exploitables.',
  },
  {
    title: 'Direction transformation digitale',
    text: 'Identifier les goulots, prioriser les automatisations et préparer le process mining.',
  },
];

function updateMeta(name: string, content: string, attribute: 'name' | 'property' = 'name') {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }
  element.content = content;
}

function LandingMockup() {
  return (
    <div className="landing-product" aria-label="Aperçu produit">
      <div className="landing-product__chrome">
        <span />
        <span />
        <span />
      </div>
      <div className="landing-product__body">
        <aside>
          <div className="landing-product__logo">
            <img src="/brand/process-discovery-mark.svg" alt="" />
            <strong>Process Discovery</strong>
          </div>
          {['Dashboard', 'Processus', 'RACI', 'BPMN', 'Exports'].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </aside>
        <section>
          <div className="landing-product__header">
            <div>
              <small>Formalisation</small>
              <strong>Processus achats publics</strong>
            </div>
            <em>Score 86%</em>
          </div>
          <div className="landing-product__metrics">
            <span>
              <strong>12</strong>
              Activités
            </span>
            <span>
              <strong>4</strong>
              Rôles RACI
            </span>
            <span>
              <strong>8</strong>
              Contrôles
            </span>
          </div>
          <div className="landing-product__flow">
            <span>Demande</span>
            <i />
            <span>Instruction</span>
            <i />
            <span>Validation</span>
            <i />
            <span>Publication</span>
          </div>
          <div className="landing-product__table">
            {['Expression du besoin', 'Contrôle budgétaire', 'Validation finale'].map(
              (item, index) => (
                <article key={item}>
                  <strong>{item}</strong>
                  <span>{['R', 'A', 'C'][index]}</span>
                </article>
              ),
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function FeatureCard({ feature }: { feature: (typeof features)[number] }) {
  return (
    <article className="landing-feature-card">
      <span className="landing-feature-card__icon">{feature.icon}</span>
      <h3>{feature.title}</h3>
      <p>{feature.description}</p>
      <strong>{feature.benefit}</strong>
    </article>
  );
}

function DemoForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <form className="landing-demo-form" onSubmit={handleSubmit}>
      <label>
        Nom
        <input name="name" autoComplete="name" required />
      </label>
      <label>
        Organisation
        <input name="organization" autoComplete="organization" required />
      </label>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Téléphone
        <input name="phone" type="tel" autoComplete="tel" />
      </label>
      <label>
        Secteur
        <select name="sector" defaultValue="Administration publique">
          <option>Administration publique</option>
          <option>Entreprise publique</option>
          <option>Banque / assurance</option>
          <option>Télécoms</option>
          <option>Industrie</option>
          <option>Autre</option>
        </select>
      </label>
      <label className="landing-demo-form__wide">
        Message
        <textarea
          name="message"
          placeholder="Votre contexte, vos directions concernées, vos priorités…"
        />
      </label>
      <div className="landing-demo-form__actions">
        <button type="submit">Envoyer la demande</button>
        <a className="button-link" href="mailto:contact@higroup.systems">
          contact@higroup.systems
        </a>
      </div>
      {submitted ? (
        <p className="landing-demo-form__success">
          Votre demande sera traitée prochainement. La connexion email sera activée dans une
          prochaine étape.
        </p>
      ) : null}
    </form>
  );
}

export function LandingPage() {
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  useEffect(() => {
    const title = 'Process Discovery Assistant — Cartographie et gouvernance des processus';
    const description =
      'Plateforme SaaS pour cartographier, documenter, valider et améliorer les processus des administrations et grandes entreprises.';
    document.title = title;
    updateMeta('description', description);
    updateMeta('og:title', title, 'property');
    updateMeta('og:description', description, 'property');
    updateMeta('og:type', 'website', 'property');

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = `${window.location.origin}/landing`;
  }, []);

  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Navigation commerciale">
        <a className="landing-brand" href="/landing" aria-label="Process Discovery Assistant">
          <span>
            <img src="/brand/process-discovery-mark.svg" alt="" />
          </span>
          <strong>
            Process Discovery
            <small>Assistant</small>
          </strong>
        </a>
        <div>
          <a href="#fonctionnalites">Fonctionnalités</a>
          <a href="#secteurs">Secteurs</a>
          <a href="#demo">Démo</a>
          <a className="button-link" href="/login">
            Accéder à la plateforme
          </a>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero__content">
          <p className="eyebrow">Plateforme SaaS de gouvernance des processus</p>
          <h1>Cartographiez, contrôlez et améliorez vos processus en toute confiance.</h1>
          <p>
            Process Discovery Assistant aide les administrations et les grandes entreprises à
            formaliser leurs processus, clarifier les responsabilités, générer RACI/BPMN, préparer
            les audits et accélérer la transformation digitale.
          </p>
          <div className="landing-actions">
            <a className="landing-primary" href="#demo">
              Demander une démo
            </a>
            <a className="landing-secondary" href="#fonctionnalites">
              Voir les fonctionnalités
            </a>
          </div>
          <div className="landing-badges" aria-label="Caractéristiques principales">
            {badges.map((badge) => (
              <span
                key={badge.label}
                className={badge.variant === 'morocco' ? 'landing-badge--morocco' : undefined}
                title={badge.title}
              >
                <span>{badge.label}</span>
                {badge.law ? <small>{badge.law}</small> : null}
              </span>
            ))}
          </div>
        </div>
        <LandingMockup />
      </section>

      <section className="landing-section landing-problem">
        <div className="landing-section__intro">
          <p className="eyebrow">Le problème</p>
          <h2>Les processus sont souvent connus… mais rarement maîtrisés.</h2>
          <p>
            Dans beaucoup d’organisations, la connaissance existe, mais elle reste fragmentée,
            difficile à maintenir et insuffisamment exploitable pour l’audit, la qualité et la
            transformation digitale.
          </p>
        </div>
        <div className="landing-problem-grid">
          {problemPoints.map((point) => (
            <article key={point}>
              <span />
              <p>{point}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section__intro">
          <p className="eyebrow">La solution</p>
          <h2>Une plateforme unique pour passer du terrain au référentiel officiel.</h2>
          <p>
            Le questionnaire structuré, le wizard, l’atelier de formalisation, le score, RACI, BPMN,
            les risques, KPI, procédures, exports, validations, audit et notifications convergent
            dans un même espace de pilotage.
          </p>
        </div>
        <div className="landing-steps">
          {steps.map((step, index) => (
            <article key={step}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section" id="fonctionnalites">
        <div className="landing-section__intro">
          <p className="eyebrow">Fonctionnalités clés</p>
          <h2>Tout le cycle de vie du processus, de la collecte à l’export officiel.</h2>
        </div>
        <div className="landing-feature-grid">
          {features.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </section>

      <section className="landing-section landing-audiences" id="secteurs">
        <article>
          <p className="eyebrow">Administrations publiques</p>
          <h2>Pensé pour les administrations et organismes publics.</h2>
          <p>
            L’outil facilite la structuration des démarches usagers, la simplification, la
            digitalisation, la cartographie des risques, la traçabilité des validations et la
            production d’exports documentaires.
          </p>
          <small>
            Il ne constitue pas un avis juridique et ne garantit pas à lui seul la conformité
            réglementaire.
          </small>
        </article>
        <article>
          <p className="eyebrow">Entreprises privées</p>
          <h2>Adapté aux banques, assurances, télécoms et grandes entreprises.</h2>
          <p>
            Les directions organisation, qualité, conformité, audit interne et transformation
            digitale disposent d’un référentiel partagé pour industrialiser les procédures et
            maîtriser les risques opérationnels.
          </p>
        </article>
        <article>
          <p className="eyebrow">International</p>
          <h2>Une approche générique, adaptable à chaque organisation.</h2>
          <p>
            Multi-tenant, templates configurables, workflows adaptables, exports standards, BPMN
            2.0, déploiement cloud, souverain, dédié ou on-premise.
          </p>
        </article>
      </section>

      <section className="landing-section landing-split">
        <div>
          <p className="eyebrow">Différenciation</p>
          <h2>Pourquoi Process Discovery Assistant est différent.</h2>
          <p>
            La plateforme combine rigueur documentaire, moteurs déterministes et assistance IA
            encadrée pour accélérer les chantiers sans affaiblir la validation humaine.
          </p>
        </div>
        <div className="landing-check-list">
          {differentiators.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="landing-section landing-trust">
        <div className="landing-section__intro">
          <p className="eyebrow">Architecture de confiance</p>
          <h2>Assez simple pour les métiers, assez structuré pour rassurer les DSI.</h2>
          <p>
            Une architecture portable et contrôlée, conçue pour des données métier structurées, des
            droits différenciés et une exploitation en environnement SaaS, dédié ou on-premise.
          </p>
        </div>
        <div>
          {trustItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section__intro">
          <p className="eyebrow">Produit</p>
          <h2>Voir la plateforme en action.</h2>
          <p>
            Des aperçus stylisés présentent les principaux espaces de travail sans exposer de
            données sensibles.
          </p>
        </div>
        <div className="landing-showcase-grid">
          {productViews.map((view) => (
            <article key={view.title} className="landing-showcase-card">
              <div>
                <span>{view.title}</span>
                <strong>{view.badge}</strong>
              </div>
              <img src={view.image} alt={`Capture ${view.title} - Process Discovery Assistant`} />
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section__intro">
          <p className="eyebrow">Cas d’usage</p>
          <h2>Des parcours adaptés aux enjeux publics, privés et internationaux.</h2>
        </div>
        <div className="landing-usecase-grid">
          {useCases.map((useCase) => (
            <article key={useCase.title}>
              <h3>{useCase.title}</h3>
              <p>{useCase.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-final" id="demo">
        <div>
          <p className="eyebrow">Demander une démo</p>
          <h2>Prêt à transformer vos processus en référentiel maîtrisé ?</h2>
          <p>
            Déploiement possible en SaaS, cloud souverain, instance dédiée ou on-premise. Facilite
            l’alignement avec ISO 9001, la documentation, la traçabilité et la préparation aux
            audits.
          </p>
          <div className="landing-actions">
            <a className="landing-primary" href="mailto:contact@higroup.systems">
              Contacter HiGroup
            </a>
            <a className="landing-secondary" href="/login">
              Accéder à la plateforme
            </a>
          </div>
        </div>
        <DemoForm />
      </section>

      <footer className="landing-footer">
        <div>
          <strong>Process Discovery Assistant</strong>
          <span>HiGroup — {currentYear}</span>
        </div>
        <nav aria-label="Liens footer">
          <a href="mailto:contact@higroup.systems">contact@higroup.systems</a>
          <a href="/login">Connexion</a>
          <a href="/tenant/dashboard">Plateforme</a>
        </nav>
        <p>
          Les fonctions de conformité facilitent la structuration, la documentation et la
          traçabilité. Elles ne remplacent pas un audit, un avis juridique ou une validation
          humaine.
        </p>
      </footer>
    </main>
  );
}
