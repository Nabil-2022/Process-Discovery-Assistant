import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';

import { adminApi, TenantListItem } from './api';

export function TenantsPage({
  status,
  onStatusChange,
}: {
  status: string;
  onStatusChange: (value: string) => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedTenant, setSelectedTenant] = useState<TenantListItem | null>(null);
  const tenants = useQuery({
    queryKey: ['admin-tenants', search, status, page],
    queryFn: () => adminApi.tenants({ search, status, page }),
  });
  const refreshTenants = () => queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
  const suspend = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminApi.suspendTenant(id, reason),
    onSuccess: refreshTenants,
  });
  const reactivate = useMutation({
    mutationFn: (id: string) => adminApi.reactivateTenant(id),
    onSuccess: refreshTenants,
  });
  const applyTemplate = useMutation({
    mutationFn: (id: string) => adminApi.applyTemplate(id),
    onSuccess: refreshTenants,
  });
  const columns = useMemo<ColumnDef<TenantListItem>[]>(
    () => [
      {
        header: 'Client',
        accessorKey: 'name',
        cell: ({ row }) => (
          <button className="link-button" onClick={() => setSelectedTenant(row.original)}>
            {row.original.name}
          </button>
        ),
      },
      { header: 'Slug', accessorKey: 'slug' },
      { header: 'Statut', accessorKey: 'status' },
      { header: 'Utilisateurs', accessorKey: 'users' },
      { header: 'Directions', accessorKey: 'directions' },
      { header: 'Processus', accessorKey: 'processes' },
      {
        header: 'Abonnement',
        cell: ({ row }) => row.original.subscription?.plan ?? 'Aucun',
      },
      {
        header: 'Derniere activite',
        cell: ({ row }) => new Date(row.original.last_activity_at).toLocaleDateString(),
      },
      {
        header: 'Actions',
        cell: ({ row }) => (
          <div className="table-actions">
            {row.original.status === 'SUSPENDED' ? (
              <button onClick={() => reactivate.mutate(row.original.id)}>Reactiver</button>
            ) : (
              <button
                onClick={() => {
                  const reason = window.prompt('Motif de suspension');
                  if (reason) suspend.mutate({ id: row.original.id, reason });
                }}
              >
                Suspendre
              </button>
            )}
            <button onClick={() => applyTemplate.mutate(row.original.id)}>Template</button>
          </div>
        ),
      },
    ],
    [applyTemplate, reactivate, suspend],
  );
  const table = useReactTable({
    data: tenants.data?.items ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <section className="tenants-layout">
      <div className="admin-toolbar">
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Rechercher un tenant"
        />
        <select value={status} onChange={(event) => onStatusChange(event.target.value)}>
          <option value="">Tous statuts</option>
          <option value="ACTIVE">Actifs</option>
          <option value="SUSPENDED">Suspendus</option>
          <option value="ARCHIVED">Archives</option>
        </select>
      </div>

      <CreateTenantPanel onCreated={refreshTenants} />

      <section className="admin-panel wide">
        <h2>Clients</h2>
        {tenants.isLoading ? <div className="table-skeleton" /> : null}
        {tenants.error ? <p className="error-text">{tenants.error.message}</p> : null}
        {!tenants.isLoading && !tenants.error && !tenants.data?.items.length ? (
          <p className="empty-inline">Aucun tenant ne correspond aux criteres.</p>
        ) : null}
        {tenants.data?.items.length ? (
          <>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                Precedent
              </button>
              <span>
                Page {tenants.data.page} · {tenants.data.total} clients
              </span>
              <button
                disabled={tenants.data.page * tenants.data.page_size >= tenants.data.total}
                onClick={() => setPage((value) => value + 1)}
              >
                Suivant
              </button>
            </div>
          </>
        ) : null}
      </section>

      {selectedTenant ? (
        <TenantDrawer
          tenant={selectedTenant}
          onClose={() => setSelectedTenant(null)}
          onUpdated={refreshTenants}
        />
      ) : null}
    </section>
  );
}

function CreateTenantPanel({ onCreated }: { onCreated: () => void }) {
  const createTenant = useMutation({
    mutationFn: (payload: Record<string, unknown>) => adminApi.createTenant(payload),
    onSuccess: onCreated,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    createTenant.mutate({
      name: form.get('name'),
      slug: form.get('slug'),
      organization_type: form.get('organization_type'),
      country: form.get('country'),
      city: form.get('city'),
      status: 'ACTIVE',
      primary_language: form.get('primary_language'),
      timezone: form.get('timezone'),
      plan: form.get('plan'),
      internal_notes: form.get('internal_notes') || undefined,
    });
  }

  return (
    <section className="admin-panel wide">
      <h2>Creer un tenant</h2>
      <form className="tenant-form" onSubmit={submit}>
        <input name="name" placeholder="Nom" required />
        <input name="slug" placeholder="slug-client" required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
        <input name="organization_type" placeholder="Type organisation" required />
        <input name="country" placeholder="Pays" required />
        <input name="city" placeholder="Ville" required />
        <input name="primary_language" placeholder="Langue" defaultValue="fr" />
        <input name="timezone" placeholder="Timezone" defaultValue="Africa/Casablanca" required />
        <input name="plan" placeholder="Plan" defaultValue="trial" required />
        <input name="internal_notes" placeholder="Notes internes" />
        <button type="submit" disabled={createTenant.isPending}>
          Creer
        </button>
      </form>
      {createTenant.error ? <p className="error-text">{createTenant.error.message}</p> : null}
    </section>
  );
}

function TenantDrawer({
  tenant,
  onClose,
  onUpdated,
}: {
  tenant: TenantListItem;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const queryClient = useQueryClient();
  const features = useQuery({
    queryKey: ['tenant-features', tenant.id],
    queryFn: () => adminApi.tenantFeatures(tenant.id),
  });
  const updateFeatures = useMutation({
    mutationFn: (payload: { code: string; enabled: boolean }[]) =>
      adminApi.updateTenantFeatures(tenant.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-features', tenant.id] });
      onUpdated();
    },
  });
  const initialAdmin = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      adminApi.createInitialAdmin(tenant.id, payload),
  });
  const subscription = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      adminApi.updateSubscription(tenant.id, payload),
    onSuccess: onUpdated,
  });

  function createAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    initialAdmin.mutate({
      email: form.get('email'),
      full_name: form.get('full_name'),
      locale: form.get('locale') || 'fr',
      invitation_message: form.get('invitation_message') || undefined,
    });
  }

  function saveSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    subscription.mutate({
      plan: form.get('plan'),
      status: form.get('status'),
      allowed_users: Number(form.get('allowed_users') || 0),
      allowed_directions: Number(form.get('allowed_directions') || 0),
      allowed_processes: Number(form.get('allowed_processes') || 0),
      internal_notes: form.get('internal_notes') || undefined,
    });
  }

  return (
    <aside className="tenant-drawer">
      <header>
        <div>
          <p className="eyebrow">{tenant.slug}</p>
          <h2>{tenant.name}</h2>
        </div>
        <button onClick={onClose}>Fermer</button>
      </header>

      <section>
        <h3>Admin initial</h3>
        <form className="stack-form" onSubmit={createAdmin}>
          <input name="email" type="email" placeholder="admin@client.test" required />
          <input name="full_name" placeholder="Nom complet" required />
          <input name="locale" placeholder="Langue" defaultValue="fr" />
          <textarea name="invitation_message" placeholder="Message d'invitation" />
          <button type="submit" disabled={initialAdmin.isPending}>
            Inviter admin
          </button>
        </form>
        {initialAdmin.error ? <p className="error-text">{initialAdmin.error.message}</p> : null}
      </section>

      <section>
        <h3>Fonctionnalites</h3>
        {features.isLoading ? <p>Chargement...</p> : null}
        {features.data?.length ? (
          <div className="feature-list">
            {features.data.map((feature) => (
              <label key={feature.code}>
                <input
                  type="checkbox"
                  defaultChecked={feature.enabled}
                  onChange={(event) =>
                    updateFeatures.mutate([{ code: feature.code, enabled: event.target.checked }])
                  }
                />
                <span>{feature.name}</span>
              </label>
            ))}
          </div>
        ) : null}
      </section>

      <section>
        <h3>Abonnement</h3>
        <form className="stack-form" onSubmit={saveSubscription}>
          <input
            name="plan"
            placeholder="Plan"
            defaultValue={tenant.subscription?.plan ?? 'trial'}
            required
          />
          <select name="status" defaultValue={tenant.subscription?.status ?? 'trial'}>
            <option value="trial">trial</option>
            <option value="active">active</option>
            <option value="past_due">past_due</option>
            <option value="suspended">suspended</option>
            <option value="cancelled">cancelled</option>
            <option value="expired">expired</option>
          </select>
          <input name="allowed_users" type="number" min="0" placeholder="Utilisateurs autorises" />
          <input
            name="allowed_directions"
            type="number"
            min="0"
            placeholder="Directions autorisees"
          />
          <input name="allowed_processes" type="number" min="0" placeholder="Processus autorises" />
          <textarea name="internal_notes" placeholder="Notes internes" />
          <button type="submit" disabled={subscription.isPending}>
            Enregistrer
          </button>
        </form>
      </section>
    </aside>
  );
}
