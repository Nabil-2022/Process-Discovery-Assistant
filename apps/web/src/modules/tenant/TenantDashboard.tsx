import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { BrandLogo } from '../../components/brand/BrandLogo';
import { hasTenantAccess, tenantApi } from './api';

const palette = ['#007aff', '#2f9e62', '#b7791f', '#d92d20', '#6e6e73'];

export function TenantDashboard() {
  const [filters, setFilters] = useState({ period: '30d', process_status: '', campaign_id: '' });
  const allowed = hasTenantAccess();
  const summary = useQuery({
    queryKey: ['tenant-summary', filters],
    queryFn: () => tenantApi.summary(filters),
    enabled: allowed,
  });
  const progress = useQuery({
    queryKey: ['tenant-progress', filters],
    queryFn: () => tenantApi.progressByDirection(filters),
    enabled: allowed,
  });
  const statuses = useQuery({
    queryKey: ['tenant-statuses', filters],
    queryFn: () => tenantApi.statusDistribution(filters),
    enabled: allowed,
  });
  const categories = useQuery({
    queryKey: ['tenant-categories', filters],
    queryFn: () => tenantApi.categoryDistribution(filters),
    enabled: allowed,
  });
  const risks = useQuery({
    queryKey: ['tenant-risks'],
    queryFn: tenantApi.risksByCriticality,
    enabled: allowed,
  });
  const maturity = useQuery({
    queryKey: ['tenant-maturity', filters],
    queryFn: () => tenantApi.maturityOverview(filters),
    enabled: allowed,
  });
  const actions = useQuery({
    queryKey: ['tenant-actions', filters],
    queryFn: () => tenantApi.actionsPriority(filters),
    enabled: allowed,
  });
  const loading =
    summary.isLoading ||
    progress.isLoading ||
    statuses.isLoading ||
    categories.isLoading ||
    risks.isLoading ||
    maturity.isLoading ||
    actions.isLoading;
  const error =
    summary.error ??
    progress.error ??
    statuses.error ??
    categories.error ??
    risks.error ??
    maturity.error ??
    actions.error;

  if (!allowed) {
    return (
      <main className="tenant-shell">
        <section className="admin-empty">
          <BrandLogo variant="full" />
          <p className="eyebrow">Dashboard tenant</p>
          <h1>Acces tenant refuse</h1>
          <p>Selectionnez un tenant actif ou utilisez un support access grant valide.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="tenant-shell">
      <TenantHeader />
      <section className="tenant-grid">
        <div className="admin-toolbar">
          <select
            value={filters.period}
            onChange={(event) => setFilters((value) => ({ ...value, period: event.target.value }))}
          >
            <option value="7d">7 jours</option>
            <option value="30d">30 jours</option>
            <option value="90d">90 jours</option>
          </select>
          <select
            value={filters.process_status}
            onChange={(event) =>
              setFilters((value) => ({ ...value, process_status: event.target.value }))
            }
          >
            <option value="">Tous statuts</option>
            <option value="DRAFT">Brouillon</option>
            <option value="SUBMITTED">Soumis</option>
            <option value="CHANGES_REQUESTED">A corriger</option>
            <option value="APPROVED">Valide</option>
            <option value="PUBLISHED">Publie</option>
          </select>
          <input
            value={filters.campaign_id}
            onChange={(event) =>
              setFilters((value) => ({ ...value, campaign_id: event.target.value }))
            }
            placeholder="Filtrer par campagne ID"
          />
        </div>

        {loading ? <SkeletonCards /> : null}
        {error ? <ErrorBlock message={error.message} /> : null}

        {!loading && !error && summary.data ? (
          <>
            <div className="metric-grid">
              <Metric label="Directions" value={summary.data.directions} />
              <Metric label="Processus" value={summary.data.processes} />
              <Metric label="Brouillons" value={summary.data.draft_processes} />
              <Metric label="Soumis" value={summary.data.submitted_processes} />
              <Metric label="A corriger" value={summary.data.correction_processes} tone="warning" />
              <Metric label="Valides" value={summary.data.validated_processes} />
              <Metric label="Completude" value={`${summary.data.average_completeness}%`} />
              <Metric label="Validations" value={summary.data.pending_validations} />
              <Metric
                label="Risques critiques"
                value={summary.data.critical_risks}
                tone="warning"
              />
              <Metric label="Automatisations" value={summary.data.automation_opportunities} />
            </div>

            <ChartPanel title="Avancement par direction">
              {progress.data?.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={progress.data}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="progress" fill="#007aff" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyInline label="Aucune direction disponible." />
              )}
            </ChartPanel>

            <PiePanel title="Processus par statut" data={statuses.data ?? []} />
            <PiePanel title="Management / metier / support" data={categories.data ?? []} />
            <PiePanel title="Risques par criticite" data={risks.data ?? []} />
            <ChartPanel title="Maturite processus">
              {maturity.data?.length ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={maturity.data}>
                    <XAxis dataKey="status" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="average_completeness" fill="#2f9e62" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyInline label="Aucune donnee de maturite." />
              )}
            </ChartPanel>

            <section className="admin-panel wide">
              <h2>Actions prioritaires</h2>
              {actions.data?.length ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Processus</th>
                      <th>Direction</th>
                      <th>Statut</th>
                      <th>Completude</th>
                      <th>Priorite</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actions.data.map((item) => (
                      <tr key={item.process_id}>
                        <td>{item.process_name}</td>
                        <td>{item.direction_name}</td>
                        <td>
                          <span className="status-badge">{item.status}</span>
                        </td>
                        <td>{item.completeness_score}%</td>
                        <td>{item.priority}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyInline label="Aucune action prioritaire." />
              )}
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}

export function TenantHeader() {
  return (
    <header className="admin-header">
      <BrandLogo variant="sidebar" />
      <div>
        <p className="eyebrow">Tenant MAP</p>
        <h1>Dashboard cartographie</h1>
      </div>
      <nav className="admin-tabs">
        <a href="/tenant/dashboard">Dashboard</a>
        <a href="/tenant/directions">Directions</a>
        <a href="/tenant/processes">Processus</a>
        <a href="/tenant/exports">Exports</a>
        <a href="/tenant/notifications">Notifications</a>
        <a href="/tenant/my-actions">Mes actions</a>
        <a href="/tenant/activity">Activite</a>
        <a href="/tenant/audit">Audit</a>
        <a href="/admin">Admin HiGroup</a>
      </nav>
    </header>
  );
}

function Metric({
  label,
  value,
  tone = 'normal',
}: {
  label: string;
  value: number | string;
  tone?: string;
}) {
  return (
    <article className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="admin-panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function PiePanel({ title, data }: { title: string; data: { label: string; count: number }[] }) {
  return (
    <ChartPanel title={title}>
      {data.length ? (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="label" innerRadius={48} outerRadius={82}>
              {data.map((entry, index) => (
                <Cell key={entry.label} fill={palette[index % palette.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <EmptyInline label="Aucune donnee disponible." />
      )}
    </ChartPanel>
  );
}

function SkeletonCards() {
  return (
    <div className="metric-grid">
      {Array.from({ length: 10 }).map((_, index) => (
        <div className="metric skeleton" key={index} />
      ))}
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <section className="admin-empty error">
      <h2>Erreur API</h2>
      <p>{message}</p>
    </section>
  );
}

function EmptyInline({ label }: { label: string }) {
  return <p className="empty-inline">{label}</p>;
}
