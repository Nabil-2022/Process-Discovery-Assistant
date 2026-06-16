import { FormEvent, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';

import { BrandLogo } from '../../components/brand/BrandLogo';
import { canManageDirections, DirectionItem, hasTenantAccess, tenantApi } from './api';
import { TenantHeader } from './TenantDashboard';

export function TenantDirectionsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [view, setView] = useState<'table' | 'cards'>('table');
  const allowed = hasTenantAccess();
  const canWrite = canManageDirections();
  const queryClient = useQueryClient();
  const directions = useQuery({
    queryKey: ['tenant-directions', search, page],
    queryFn: () => tenantApi.directions({ search, page }),
    enabled: allowed,
  });
  const createDirection = useMutation({
    mutationFn: (payload: Record<string, unknown>) => tenantApi.createDirection(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenant-directions'] }),
  });
  const deleteDirection = useMutation({
    mutationFn: (id: string) => tenantApi.deleteDirection(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenant-directions'] }),
  });
  const remindReferent = useMutation({
    mutationFn: (id: string) => tenantApi.remindReferent(id),
  });
  const columns = useMemo<ColumnDef<DirectionItem>[]>(
    () => [
      {
        header: 'Direction',
        accessorKey: 'name',
        cell: ({ row }) => (
          <Link to={`/tenant/directions/${row.original.id}`}>{row.original.name}</Link>
        ),
      },
      {
        header: 'Referent',
        cell: ({ row }) => row.original.referent?.full_name ?? 'Aucun referent',
      },
      { header: 'Processus', accessorKey: 'processes' },
      { header: 'Valides', accessorKey: 'validated_processes' },
      { header: 'Completude', cell: ({ row }) => `${row.original.average_completeness}%` },
      {
        header: 'Progression',
        cell: ({ row }) => <Progress value={row.original.progression} />,
      },
      {
        header: 'Validation',
        cell: ({ row }) => <span className="status-badge">{row.original.validation}</span>,
      },
      {
        header: 'Derniere activite',
        cell: ({ row }) => new Date(row.original.last_activity_at).toLocaleDateString(),
      },
      {
        header: 'Actions',
        cell: ({ row }) => (
          <div className="table-actions">
            <button onClick={() => remindReferent.mutate(row.original.id)}>Relancer</button>
            {canWrite ? (
              <button
                onClick={() => {
                  if (window.confirm('Supprimer cette direction ?'))
                    deleteDirection.mutate(row.original.id);
                }}
              >
                Supprimer
              </button>
            ) : null}
          </div>
        ),
      },
    ],
    [canWrite, deleteDirection, remindReferent],
  );
  const table = useReactTable({
    data: directions.data?.items ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    createDirection.mutate({ name: form.get('name'), code: form.get('code') || undefined });
  }

  if (!allowed) {
    return (
      <main className="tenant-shell">
        <section className="admin-empty">
          <BrandLogo variant="full" />
          <p className="eyebrow">Directions</p>
          <h1>Acces refuse</h1>
          <p>Selectionnez un tenant actif pour consulter les directions.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="tenant-shell">
      <TenantHeader />
      <section className="tenant-grid">
        <div className="admin-toolbar">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Rechercher une direction"
          />
          <select
            value={view}
            onChange={(event) => setView(event.target.value as 'table' | 'cards')}
          >
            <option value="table">Tableau</option>
            <option value="cards">Cartes</option>
          </select>
          <a className="button-link" href="/api/v1/tenant/directions/export.csv">
            Export CSV
          </a>
        </div>

        {canWrite ? (
          <section className="admin-panel wide">
            <h2>Creer une direction</h2>
            <form className="tenant-form compact" onSubmit={submit}>
              <input name="name" placeholder="Nom de direction" required />
              <input name="code" placeholder="code_direction" pattern="[a-z0-9]+(_[a-z0-9]+)*" />
              <button type="submit" disabled={createDirection.isPending}>
                Creer
              </button>
            </form>
            {createDirection.error ? (
              <p className="error-text">{createDirection.error.message}</p>
            ) : null}
          </section>
        ) : null}

        <section className="admin-panel wide">
          <h2>Directions</h2>
          {directions.isLoading ? <div className="table-skeleton" /> : null}
          {directions.error ? <p className="error-text">{directions.error.message}</p> : null}
          {!directions.isLoading && !directions.error && !directions.data?.items.length ? (
            <p className="empty-inline">Aucune direction disponible.</p>
          ) : null}
          {directions.data?.items.length && view === 'table' ? (
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
              <Pagination
                page={page}
                total={directions.data.total}
                pageSize={directions.data.page_size}
                setPage={setPage}
              />
            </>
          ) : null}
          {directions.data?.items.length && view === 'cards' ? (
            <div className="direction-card-grid">
              {directions.data.items.map((direction) => (
                <article className="direction-card" key={direction.id}>
                  <Link to={`/tenant/directions/${direction.id}`}>{direction.name}</Link>
                  <span>{direction.referent?.full_name ?? 'Aucun referent'}</span>
                  <Progress value={direction.progression} />
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}

export function DirectionDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const direction = useQuery({
    queryKey: ['tenant-direction', id],
    queryFn: () => tenantApi.direction(id ?? ''),
    enabled: Boolean(id) && hasTenantAccess(),
  });
  const activity = useQuery({
    queryKey: ['tenant-direction-activity', id],
    queryFn: () => tenantApi.directionActivity(id ?? ''),
    enabled: Boolean(id) && hasTenantAccess(),
  });
  const processes = useQuery({
    queryKey: ['tenant-direction-processes', id],
    queryFn: () => tenantApi.directionProcesses(id ?? ''),
    enabled: Boolean(id) && hasTenantAccess(),
  });
  const assign = useMutation({
    mutationFn: (userId: string) => tenantApi.assignReferent(id ?? '', userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenant-direction', id] }),
  });
  const remind = useMutation({ mutationFn: () => tenantApi.remindReferent(id ?? '') });
  const canWrite = canManageDirections();

  function submitAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    assign.mutate(String(form.get('user_id')));
  }

  return (
    <main className="tenant-shell">
      <TenantHeader />
      <section className="tenant-grid">
        <section className="admin-panel wide">
          <Link to="/tenant/directions">Retour directions</Link>
          {direction.isLoading ? <div className="table-skeleton" /> : null}
          {direction.error ? <p className="error-text">{direction.error.message}</p> : null}
          {direction.data ? (
            <>
              <div className="direction-title">
                <div>
                  <p className="eyebrow">{direction.data.code ?? 'direction'}</p>
                  <h2>{direction.data.name}</h2>
                </div>
                <button disabled title={direction.data.create_process_message}>
                  {direction.data.create_process_message ?? 'Disponible au Lot 6'}
                </button>
              </div>
              <div className="metric-grid small">
                <Metric label="Processus" value={direction.data.processes} />
                <Metric label="Valides" value={direction.data.validated_processes} />
                <Metric label="Completude" value={`${direction.data.average_completeness}%`} />
                <Metric label="Progression" value={`${direction.data.progression}%`} />
              </div>
              <div className="detail-tabs">
                <section>
                  <h3>Vue d'ensemble</h3>
                  <p className="empty-inline">
                    Referent principal: {direction.data.referent?.full_name ?? 'aucun referent'}
                  </p>
                  <Progress value={direction.data.progression} />
                </section>
                <section>
                  <h3>Referents</h3>
                  {direction.data.referents?.length ? (
                    <div className="compact-list">
                      {direction.data.referents.map((referent) => (
                        <article key={referent.id}>
                          <strong>{referent.full_name}</strong>
                          <span>{referent.email}</span>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-inline">Aucun referent affecte.</p>
                  )}
                  {canWrite ? (
                    <form className="stack-form" onSubmit={submitAssign}>
                      <input name="user_id" placeholder="User ID du referent" required />
                      <button type="submit">Affecter</button>
                    </form>
                  ) : null}
                  <button onClick={() => remind.mutate()}>Relancer referent</button>
                </section>
                <section>
                  <h3>Processus</h3>
                  {processes.data?.length ? (
                    <div className="compact-list">
                      {processes.data.map((process) => (
                        <article key={process.id}>
                          <strong>{process.name}</strong>
                          <span>{process.status}</span>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-inline">Direction sans processus.</p>
                  )}
                </section>
                <section>
                  <h3>Activite</h3>
                  {activity.data?.length ? (
                    <div className="activity-list">
                      {activity.data.map((item) => (
                        <article key={item.id}>
                          <span>{item.action}</span>
                          <time>{new Date(item.created_at).toLocaleString()}</time>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-inline">Aucune activite recente.</p>
                  )}
                </section>
              </div>
            </>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="progress-bar" aria-label={`Progression ${value}%`}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
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

function Pagination({
  page,
  total,
  pageSize,
  setPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  setPage: (page: number) => void;
}) {
  return (
    <div className="pagination">
      <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
        Precedent
      </button>
      <span>
        Page {page} · {total} directions
      </span>
      <button disabled={page * pageSize >= total} onClick={() => setPage(page + 1)}>
        Suivant
      </button>
    </div>
  );
}
