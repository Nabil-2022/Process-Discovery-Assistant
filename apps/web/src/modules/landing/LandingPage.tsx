import { FormEvent, useEffect, useMemo, useState } from 'react';

const badges = [
  { label: 'SaaS multi-tenant' },
  { label: 'RACI deterministe' },
  { label: 'BPMN 2.0' },
  { label: 'ISO 9001 ready' },
  {
    label: 'Conformite Maroc',
    law: 'Loi 55-19',
    variant: 'morocco',
    title:
      'Referentiel visuel pour les processus concernes par les exigences marocaines, notamment la Loi 55-19.',
  },
  { label: 'Exports officiels' },
  { label: 'IA encadree' },
];

const problemPoints = [
  'Processus disperses dans Excel, Word et les emails.',
  'Responsabilites floues entre directions, controles et validations.',
  'Procedures difficiles a maintenir et rarement a jour.',
  'Cartographies complexes a consolider par direction.',
  'Validations non tracees et audits longs a preparer.',
  'Transformation digitale ralentie par le manque de referentiel fiable.',
  'Opportunites d automatisation difficiles a prioriser.',
  'Absence de vision unifiee sur les risques, KPI et controles.',
];

const steps = [
  'Recenser',
  'Formaliser',
  'Controler',
  'Valider',
  'Publier',
  'Exporter',
  'Ameliorer',
];

const features = [
  {
    icon: 'CP',
    title: 'Cartographie des processus',
    description: 'Structurez les processus par direction, domaine, responsable et criticite.',
    benefit: 'Une vision consolidee et exploitable.',
  },
  {
    icon: '11',
    title: 'Wizard en 11 etapes',
    description: 'Guide les equipes terrain dans une formalisation complete et homogene.',
    benefit: 'Moins d oublis, plus de qualite.',
  },
  {
    icon: '%',
    title: 'Score de completude',
    description: 'Mesure le niveau de maturite documentaire avant validation.',
    benefit: 'Des priorites visibles immediatement.',
  },
  {
    icon: 'R',
    title: 'Matrice RACI deterministe',
    description: 'Clarifie qui realise, approuve, consulte et informe.',
    benefit: 'Responsabilites lisibles et partagees.',
  },
  {
    icon: 'B',
    title: 'BPMN 2.0 deterministe',
    description: 'Produit un flux BPMN coherent, lisible et exportable.',
    benefit: 'Compatible avec les pratiques BPM.',
  },
  {
    icon: 'Q',
    title: 'Procedures qualite',
    description: 'Transforme les informations terrain en procedure documentee.',
    benefit: 'Livrables prets pour revue.',
  },
  {
    icon: 'V',
    title: 'Workflow de validation',
    description: 'Organise les etapes de revue, correction, approbation et publication.',
    benefit: 'Gouvernance claire et tracable.',
  },
  {
    icon: 'A',
    title: 'Audit et tracabilite',
    description: 'Historise les actions, changements, validations et points de controle.',
    benefit: 'Preparation aux audits facilitee.',
  },
  {
    icon: 'R!',
    title: 'Risques et controles',
    description: 'Relie risques, controles, activites et responsables.',
    benefit: 'Meilleure maitrise operationnelle.',
  },
  {
    icon: 'K',
    title: 'KPI',
    description: 'Documente les indicateurs associes aux processus et activites.',
    benefit: 'Pilotage plus factuel.',
  },
  {
    icon: '55',
    title: 'Conformite Maroc / Loi 55-19',
    description: 'Aide a structurer les demarches, documents et validations.',
    benefit: 'Un cadre adapte aux organisations marocaines.',
  },
  {
    icon: 'PM',
    title: 'Process Mining readiness',
    description: 'Prepare les donnees et evenements utiles aux analyses futures.',
    benefit: 'Automatisation et optimisation mieux ciblees.',
  },
  {
    icon: 'IA',
    title: 'Copilote IA encadre',
    description: 'Assiste la redaction et l analyse sans devenir source de verite.',
    benefit: 'Gain de temps avec validation humaine.',
  },
  {
    icon: 'EX',
    title: 'Exports officiels',
    description: 'Genere PDF, Word, Excel, JSON et BPMN XML.',
    benefit: 'Livrables partageables et archivables.',
  },
  {
    icon: 'N',
    title: 'Notifications et taches',
    description: 'Rend visibles les actions attendues et les retards.',
    benefit: 'Moins de suivi manuel.',
  },
  {
    icon: 'S',
    title: 'Multi-tenant SaaS',
    description: 'Segmente les organisations, roles, donnees et espaces de travail.',
    benefit: 'Deploiement scalable et controle.',
  },
];

const differentiators = [
  'IA assistee, jamais source de verite',
  'Moteurs RACI et BPMN deterministes',
  'Validation humaine obligatoire',
  'Tracabilite complete des decisions',
  'Conformite Maroc integree avec prudence',
  'Preparation au process mining',
  'Exports documentaires officiels',
  'Approche SaaS souveraine, dediee ou on-premise',
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
  'Exports controles',
  'Donnees metier structurees',
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
    badge: 'Controle',
    image: '/landing/landing-workshop.png',
  },
  {
    title: 'RACI',
    badge: 'Responsabilites',
    image: '/landing/landing-raci.png',
  },
  {
    title: 'BPMN premium',
    badge: 'Diagramme',
    image: '/landing/landing-bpmn.png',
  },
  {
    title: 'Procedure',
    badge: 'Qualite',
    image: '/landing/landing-procedure.png',
  },
  {
    title: 'Exports',
    badge: 'Livrables',
    image: '/landing/landing-exports.png',
  },
  {
    title: 'Audit',
    badge: 'Tracabilite',
    image: '/landing/landing-audit.png',
  },
];

const useCases = [
  {
    title: 'Administration publique',
    text: 'Cartographier les demarches usagers et prioriser la simplification.',
  },
  {
    title: 'Banque / assurance',
    text: 'Structurer les processus sensibles, clarifier les responsabilites et preparer les audits.',
  },
  {
    title: 'Entreprise publique',
    text: 'Formaliser les procedures, tracer les validations et produire les livrables officiels.',
  },
  {
    title: 'Direction qualite',
    text: 'Transformer les processus terrain en procedures exploitables.',
  },
  {
    title: 'Direction transformation digitale',
    text: 'Identifier les goulots, prioriser les automatisations et preparer le process mining.',
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
    <div className="landing-product" aria-label="Apercu produit">
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
              Activites
            </span>
            <span>
              <strong>4</strong>
              Roles RACI
            </span>
            <span>
              <strong>8</strong>
              Controles
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
            {['Expression du besoin', 'Controle budgetaire', 'Validation finale'].map(
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
        Telephone
        <input name="phone" type="tel" autoComplete="tel" />
      </label>
      <label>
        Secteur
        <select name="sector" defaultValue="Administration publique">
          <option>Administration publique</option>
          <option>Entreprise publique</option>
          <option>Banque / assurance</option>
          <option>Telecoms</option>
          <option>Industrie</option>
          <option>Autre</option>
        </select>
      </label>
      <label className="landing-demo-form__wide">
        Message
        <textarea
          name="message"
          placeholder="Votre contexte, vos directions concernees, vos priorites..."
        />
      </label>
      <div className="landing-demo-form__actions">
        <button type="submit">Envoyer la demande</button>
        <a className="button-link" href="mailto:contact@hi-group.fr">
          contact@hi-group.fr
        </a>
      </div>
      {submitted ? (
        <p className="landing-demo-form__success">
          Votre demande sera traitee prochainement. La connexion email sera activee dans une
          prochaine etape.
        </p>
      ) : null}
    </form>
  );
}

export function LandingPage() {
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  useEffect(() => {
    const title = 'Process Discovery Assistant - Cartographie et gouvernance des processus';
    const description =
      'Plateforme SaaS pour cartographier, documenter, valider et ameliorer les processus des administrations et grandes entreprises.';
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
          <a href="#fonctionnalites">Fonctionnalites</a>
          <a href="#secteurs">Secteurs</a>
          <a href="#demo">Demo</a>
          <a className="button-link" href="/login">
            Acceder a la plateforme
          </a>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero__content">
          <p className="eyebrow">Plateforme SaaS de gouvernance des processus</p>
          <h1>Cartographiez, controlez et ameliorez vos processus en toute confiance.</h1>
          <p>
            Process Discovery Assistant aide les administrations et les grandes entreprises a
            formaliser leurs processus, clarifier les responsabilites, generer RACI/BPMN, preparer
            les audits et accelerer la transformation digitale.
          </p>
          <div className="landing-actions">
            <a className="landing-primary" href="#demo">
              Demander une demo
            </a>
            <a className="landing-secondary" href="#fonctionnalites">
              Voir les fonctionnalites
            </a>
          </div>
          <div className="landing-badges" aria-label="Caracteristiques principales">
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
          <p className="eyebrow">Le probleme</p>
          <h2>Les processus sont souvent connus... mais rarement maitrises.</h2>
          <p>
            Dans beaucoup d organisations, la connaissance existe, mais elle reste fragmenteee,
            difficile a maintenir et insuffisamment exploitable pour l audit, la qualite et la
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
          <h2>Une plateforme unique pour passer du terrain au referentiel officiel.</h2>
          <p>
            Le questionnaire structure, le wizard, l atelier de formalisation, le score, RACI, BPMN,
            les risques, KPI, procedures, exports, validations, audit et notifications convergent
            dans un meme espace de pilotage.
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
          <p className="eyebrow">Fonctionnalites cles</p>
          <h2>Tout le cycle de vie du processus, de la collecte a l export officiel.</h2>
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
          <h2>Pense pour les administrations et organismes publics.</h2>
          <p>
            L outil facilite la structuration des demarches usagers, la simplification, la
            digitalisation, la cartographie des risques, la tracabilite des validations et la
            production d exports documentaires.
          </p>
          <small>
            Il ne constitue pas un avis juridique et ne garantit pas a lui seul la conformite
            reglementaire.
          </small>
        </article>
        <article>
          <p className="eyebrow">Entreprises privees</p>
          <h2>Adapte aux banques, assurances, telecoms et grandes entreprises.</h2>
          <p>
            Les directions organisation, qualite, conformite, audit interne et transformation
            digitale disposent d un referentiel partage pour industrialiser les procedures et
            maitriser les risques operationnels.
          </p>
        </article>
        <article>
          <p className="eyebrow">International</p>
          <h2>Une approche generique, adaptable a chaque organisation.</h2>
          <p>
            Multi-tenant, templates configurables, workflows adaptables, exports standards, BPMN
            2.0, deploiement cloud, souverain, dedie ou on-premise.
          </p>
        </article>
      </section>

      <section className="landing-section landing-split">
        <div>
          <p className="eyebrow">Differenciation</p>
          <h2>Pourquoi Process Discovery Assistant est different.</h2>
          <p>
            La plateforme combine rigueur documentaire, moteurs deterministes et assistance IA
            encadree pour accelerer les chantiers sans affaiblir la validation humaine.
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
          <h2>Assez simple pour les metiers, assez structure pour rassurer les DSI.</h2>
          <p>
            Une architecture portable et controlee, concue pour des donnees metier structurees, des
            droits differencies et une exploitation en environnement SaaS, dedie ou on-premise.
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
            Des apercus stylises presentent les principaux espaces de travail sans exposer de
            donnees sensibles.
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
          <p className="eyebrow">Cas d usage</p>
          <h2>Des parcours adaptes aux enjeux publics, prives et internationaux.</h2>
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
          <p className="eyebrow">Demander une demo</p>
          <h2>Pret a transformer vos processus en referentiel maitrise ?</h2>
          <p>
            Deploiement possible en SaaS, cloud souverain, instance dediee ou on-premise. Facilite l
            alignement avec ISO 9001, la documentation, la tracabilite et la preparation aux audits.
          </p>
          <div className="landing-actions">
            <a className="landing-primary" href="mailto:contact@hi-group.fr">
              Contacter HiGroup
            </a>
            <a className="landing-secondary" href="/login">
              Acceder a la plateforme
            </a>
          </div>
        </div>
        <DemoForm />
      </section>

      <footer className="landing-footer">
        <div>
          <strong>Process Discovery Assistant</strong>
          <span>HiGroup - {currentYear}</span>
        </div>
        <nav aria-label="Liens footer">
          <a href="mailto:contact@hi-group.fr">contact@hi-group.fr</a>
          <a href="/login">Login</a>
          <a href="/tenant/dashboard">Plateforme</a>
        </nav>
        <p>
          Les fonctions de conformite facilitent la structuration, la documentation et la
          tracabilite. Elles ne remplacent pas un audit, un avis juridique ou une validation
          humaine.
        </p>
      </footer>
    </main>
  );
}
