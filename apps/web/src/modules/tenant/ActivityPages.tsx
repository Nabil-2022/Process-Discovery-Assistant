import { FormEvent, ReactNode, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { BrandLogo } from '../../components/brand/BrandLogo';
import {
  hasTenantAccess,
  MyActions,
  NotificationPreferences,
  tenantApi,
  TenantActivity,
  TenantNotification,
  TenantTask,
} from './api';
import { TenantHeader } from './TenantDashboard';

export function NotificationsPage() {
  return (
    <TenantActivityShell title="Notifications">
      <NotificationCenter />
    </TenantActivityShell>
  );
}

export function NotificationPreferencesPage() {
  const queryClient = useQueryClient();
  const preferences = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: tenantApi.notificationPreferences,
    enabled: hasTenantAccess(),
  });
  const mutation = useMutation({
    mutationFn: tenantApi.updateNotificationPreferences,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-preferences'] }),
  });

  if (preferences.isLoading)
    return (
      <TenantActivityShell title="Preferences">
        <ActivitySkeleton />
      </TenantActivityShell>
    );
  if (preferences.error)
    return (
      <TenantActivityShell title="Preferences">
        <ErrorState message={preferences.error.message} />
      </TenantActivityShell>
    );

  const data = preferences.data as NotificationPreferences;
  return (
    <TenantActivityShell title="Preferences notifications">
      <section className="admin-panel wide">
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            mutation.mutate({
              in_app_enabled: form.get('in_app_enabled') === 'on',
              email_enabled: form.get('email_enabled') === 'on',
              frequency: String(form.get('frequency') ?? 'immediate'),
              language: String(form.get('language') ?? 'fr'),
              quiet_hours_start: String(form.get('quiet_hours_start') ?? ''),
              quiet_hours_end: String(form.get('quiet_hours_end') ?? ''),
            });
          }}
        >
          <label>
            <input name="in_app_enabled" type="checkbox" defaultChecked={data.in_app_enabled} />
            In-app
          </label>
          <label>
            <input name="email_enabled" type="checkbox" defaultChecked={data.email_enabled} />
            Email
          </label>
          <select name="frequency" defaultValue={data.frequency}>
            <option value="immediate">Immediat</option>
            <option value="daily_digest">Resume quotidien</option>
            <option value="disabled">Desactive</option>
          </select>
          <input name="language" defaultValue={data.language} placeholder="Langue" />
          <input
            name="quiet_hours_start"
            defaultValue={data.quiet_hours_start ?? ''}
            placeholder="Debut silence"
          />
          <input
            name="quiet_hours_end"
            defaultValue={data.quiet_hours_end ?? ''}
            placeholder="Fin silence"
          />
          <button className="button-link" type="submit" disabled={mutation.isPending}>
            Enregistrer
          </button>
        </form>
      </section>
    </TenantActivityShell>
  );
}

export function ActivityPage() {
  const [filters, setFilters] = useState<Record<string, string>>({
    type: '',
    process_id: '',
    direction_id: '',
  });
  const activity = useQuery({
    queryKey: ['tenant-activity', filters],
    queryFn: () => tenantApi.activity(filters),
    enabled: hasTenantAccess(),
  });
  return (
    <TenantActivityShell title="Activite">
      <ActivityFilters filters={filters} onChange={setFilters} />
      <ActivityTable
        items={activity.data ?? []}
        loading={activity.isLoading}
        error={activity.error}
      />
    </TenantActivityShell>
  );
}

export function AuditPage() {
  const [filters, setFilters] = useState<Record<string, string>>({
    action: '',
    resource_type: '',
    result: '',
  });
  const audit = useQuery({
    queryKey: ['tenant-audit', filters],
    queryFn: () => tenantApi.audit(filters),
    enabled: hasTenantAccess(),
  });
  return (
    <TenantActivityShell title="Audit">
      <ActivityFilters filters={filters} onChange={setFilters} />
      <a className="button-link" href={tenantApi.auditExportUrl()}>
        Export CSV
      </a>
      <ActivityTable items={audit.data ?? []} loading={audit.isLoading} error={audit.error} />
    </TenantActivityShell>
  );
}

export function MyActionsPage() {
  const query = useQuery({
    queryKey: ['my-actions'],
    queryFn: tenantApi.myActions,
    enabled: hasTenantAccess(),
  });
  if (query.isLoading)
    return (
      <TenantActivityShell title="Mes actions">
        <ActivitySkeleton />
      </TenantActivityShell>
    );
  if (query.error)
    return (
      <TenantActivityShell title="Mes actions">
        <ErrorState message={query.error.message} />
      </TenantActivityShell>
    );
  const data = query.data as MyActions;
  return (
    <TenantActivityShell title="Mes actions">
      <section className="metric-grid">
        <Metric label="Taches" value={data.tasks.length} />
        <Metric label="Notifications" value={data.notifications.length} />
        <Metric label="Exports prets" value={data.exports_ready.length} />
        <Metric label="Processus a completer" value={data.processes_to_complete.length} />
      </section>
      <TaskList tasks={data.tasks} />
      <NotificationList notifications={data.notifications} />
    </TenantActivityShell>
  );
}

export function NotificationBell() {
  const unread = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: tenantApi.unreadNotifications,
    enabled: hasTenantAccess(),
  });
  return (
    <a className="button-link" href="/tenant/notifications" aria-label="Notifications">
      Notifications {unread.data?.unread_count ? `(${unread.data.unread_count})` : ''}
    </a>
  );
}

export function NotificationCenter() {
  const queryClient = useQueryClient();
  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: tenantApi.notifications,
    enabled: hasTenantAccess(),
  });
  const readAll = useMutation({
    mutationFn: tenantApi.readAllNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });
  if (notifications.isLoading) return <ActivitySkeleton />;
  if (notifications.error) return <ErrorState message={notifications.error.message} />;
  return (
    <section className="admin-panel wide">
      <div className="admin-toolbar">
        <h2>Centre de notifications</h2>
        <button className="button-link" onClick={() => readAll.mutate()} type="button">
          Tout marquer comme lu
        </button>
      </div>
      <NotificationList notifications={notifications.data?.items ?? []} />
    </section>
  );
}

export function NotificationList({ notifications }: { notifications: TenantNotification[] }) {
  const queryClient = useQueryClient();
  const read = useMutation({
    mutationFn: (id: string) => tenantApi.readNotification(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  if (!notifications.length) return <EmptyState label="Aucune notification." />;
  return (
    <div className="stack-list">
      {notifications.map((notification) => (
        <article className="admin-panel compact" key={notification.id}>
          <div className="row-between">
            <strong>{notification.title}</strong>
            <SeverityBadge severity={notification.severity} />
          </div>
          <p>{notification.message}</p>
          <div className="row-between">
            <span className="status-badge">{notification.status}</span>
            {notification.status !== 'read' ? (
              <button
                className="button-link"
                onClick={() => read.mutate(notification.id)}
                type="button"
              >
                Lu
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

export function TaskList({ tasks }: { tasks: TenantTask[] }) {
  const queryClient = useQueryClient();
  const complete = useMutation({
    mutationFn: tenantApi.completeTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-actions'] });
    },
  });
  if (!tasks.length) return <EmptyState label="Aucune tache." />;
  return (
    <section className="admin-panel wide">
      <h2>Taches a traiter</h2>
      <div className="stack-list">
        {tasks.map((task) => (
          <article className="admin-panel compact" key={task.id}>
            <div className="row-between">
              <strong>{task.title}</strong>
              <TaskStatusBadge status={task.status} />
            </div>
            <p>{task.description}</p>
            <div className="row-between">
              <SeverityBadge severity={task.priority} />
              {task.status !== 'completed' ? (
                <button
                  className="button-link"
                  onClick={() => complete.mutate(task.id)}
                  type="button"
                >
                  Terminer
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function TaskStatusBadge({ status }: { status: string }) {
  return <span className="status-badge">{status}</span>;
}

export function TasksPage() {
  const queryClient = useQueryClient();
  const tasks = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tenantApi.tasks(),
    enabled: hasTenantAccess(),
  });
  const create = useMutation({
    mutationFn: tenantApi.createTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
  return (
    <TenantActivityShell title="Taches">
      <section className="admin-panel wide">
        <form
          className="form-grid"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            create.mutate({
              title: String(form.get('title') ?? ''),
              description: String(form.get('description') ?? ''),
              priority: String(form.get('priority') ?? 'medium'),
            });
            event.currentTarget.reset();
          }}
        >
          <input name="title" placeholder="Titre" required />
          <input name="description" placeholder="Description" />
          <select name="priority" defaultValue="medium">
            <option value="low">Basse</option>
            <option value="medium">Moyenne</option>
            <option value="high">Haute</option>
            <option value="critical">Critique</option>
          </select>
          <button className="button-link" type="submit">
            Creer
          </button>
        </form>
      </section>
      {tasks.isLoading ? <ActivitySkeleton /> : <TaskList tasks={tasks.data ?? []} />}
      {tasks.error ? <ErrorState message={tasks.error.message} /> : null}
    </TenantActivityShell>
  );
}

function TenantActivityShell({ title, children }: { title: string; children: ReactNode }) {
  if (!hasTenantAccess()) {
    return (
      <main className="tenant-shell">
        <section className="admin-empty">
          <BrandLogo variant="full" />
          <p className="eyebrow">{title}</p>
          <h1>Acces tenant refuse</h1>
        </section>
      </main>
    );
  }
  return (
    <main className="tenant-shell">
      <TenantHeader />
      <section className="tenant-grid">
        <div className="admin-toolbar">
          <h1>{title}</h1>
          <NotificationBell />
        </div>
        {children}
      </section>
    </main>
  );
}

function ActivityFilters({
  filters,
  onChange,
}: {
  filters: Record<string, string>;
  onChange: (filters: Record<string, string>) => void;
}) {
  return (
    <section className="admin-panel wide">
      <div className="admin-toolbar">
        {Object.keys(filters).map((key) => (
          <input
            key={key}
            value={filters[key]}
            onChange={(event) => onChange({ ...filters, [key]: event.target.value })}
            placeholder={key}
          />
        ))}
      </div>
    </section>
  );
}

function ActivityTable({
  items,
  loading,
  error,
}: {
  items: TenantActivity[];
  loading: boolean;
  error: Error | null;
}) {
  if (loading) return <ActivitySkeleton />;
  if (error) return <ErrorState message={error.message} />;
  if (!items.length) return <EmptyState label="Aucune activite." />;
  return (
    <section className="admin-panel wide">
      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Action</th>
            <th>Ressource</th>
            <th>Resultat</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{new Date(item.created_at).toLocaleString()}</td>
              <td>{item.action}</td>
              <td>{item.resource_type}</td>
              <td>
                <span className="status-badge">{item.result}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  return <span className={`status-badge ${severity}`}>{severity}</span>;
}

function ActivitySkeleton() {
  return (
    <div className="metric-grid">
      <div className="metric skeleton" />
      <div className="metric skeleton" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <section className="admin-empty error">
      <h2>Erreur</h2>
      <p>{message}</p>
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <section className="admin-empty">
      <p>{label}</p>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
