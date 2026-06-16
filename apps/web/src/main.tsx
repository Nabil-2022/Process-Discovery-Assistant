import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { BrandLogo } from './components/brand/BrandLogo';
import { HealthPage } from './modules/health/HealthPage';
import './styles.css';
import './design-system.css';

const queryClient = new QueryClient();
const App = lazy(() => import('./modules/app/App').then((module) => ({ default: module.App })));
const AdminDashboard = lazy(() =>
  import('./modules/admin/AdminDashboard').then((module) => ({ default: module.AdminDashboard })),
);
const TenantDashboard = lazy(() =>
  import('./modules/tenant/TenantDashboard').then((module) => ({
    default: module.TenantDashboard,
  })),
);
const TenantDirectionsPage = lazy(() =>
  import('./modules/tenant/TenantDirections').then((module) => ({
    default: module.TenantDirectionsPage,
  })),
);
const DirectionDetailPage = lazy(() =>
  import('./modules/tenant/TenantDirections').then((module) => ({
    default: module.DirectionDetailPage,
  })),
);
const TenantProcessesPage = lazy(() =>
  import('./modules/tenant/ProcessPages').then((module) => ({
    default: module.TenantProcessesPage,
  })),
);
const TenantExportsPage = lazy(() =>
  import('./modules/tenant/ProcessPages').then((module) => ({ default: module.TenantExportsPage })),
);
const NewProcessPage = lazy(() =>
  import('./modules/tenant/ProcessPages').then((module) => ({ default: module.NewProcessPage })),
);
const ProcessRaciPage = lazy(() =>
  import('./modules/tenant/ProcessPages').then((module) => ({ default: module.ProcessRaciPage })),
);
const ProcessBpmnPage = lazy(() =>
  import('./modules/tenant/ProcessPages').then((module) => ({ default: module.ProcessBpmnPage })),
);
const ProcessWorkshopPage = lazy(() =>
  import('./modules/tenant/ProcessPages').then((module) => ({
    default: module.ProcessWorkshopPage,
  })),
);
const ProcedurePage = lazy(() =>
  import('./modules/tenant/ProcessPages').then((module) => ({ default: module.ProcedurePage })),
);
const ProcessDetailPage = lazy(() =>
  import('./modules/tenant/ProcessPages').then((module) => ({ default: module.ProcessDetailPage })),
);
const ProcessWizardPage = lazy(() =>
  import('./modules/tenant/ProcessPages').then((module) => ({ default: module.ProcessWizardPage })),
);
const NotificationsPage = lazy(() =>
  import('./modules/tenant/ActivityPages').then((module) => ({
    default: module.NotificationsPage,
  })),
);
const NotificationPreferencesPage = lazy(() =>
  import('./modules/tenant/ActivityPages').then((module) => ({
    default: module.NotificationPreferencesPage,
  })),
);
const ActivityPage = lazy(() =>
  import('./modules/tenant/ActivityPages').then((module) => ({ default: module.ActivityPage })),
);
const AuditPage = lazy(() =>
  import('./modules/tenant/ActivityPages').then((module) => ({ default: module.AuditPage })),
);
const TasksPage = lazy(() =>
  import('./modules/tenant/ActivityPages').then((module) => ({ default: module.TasksPage })),
);
const MyActionsPage = lazy(() =>
  import('./modules/tenant/ActivityPages').then((module) => ({ default: module.MyActionsPage })),
);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense
          fallback={
            <main className="tenant-shell">
              <section className="admin-empty">
                <BrandLogo variant="login" />
                <p className="eyebrow">Process Discovery Assistant</p>
                <h1>Chargement</h1>
                <div className="table-skeleton" aria-label="Chargement de l'interface" />
              </section>
            </main>
          }
        >
          <Routes>
            <Route path="/health" element={<HealthPage />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/tenant/dashboard" element={<TenantDashboard />} />
            <Route path="/tenant/directions" element={<TenantDirectionsPage />} />
            <Route path="/tenant/directions/:id" element={<DirectionDetailPage />} />
            <Route path="/tenant/processes" element={<TenantProcessesPage />} />
            <Route path="/tenant/exports" element={<TenantExportsPage />} />
            <Route path="/tenant/notifications" element={<NotificationsPage />} />
            <Route
              path="/tenant/notification-preferences"
              element={<NotificationPreferencesPage />}
            />
            <Route path="/tenant/activity" element={<ActivityPage />} />
            <Route path="/tenant/audit" element={<AuditPage />} />
            <Route path="/tenant/tasks" element={<TasksPage />} />
            <Route path="/tenant/my-actions" element={<MyActionsPage />} />
            <Route path="/tenant/processes/new" element={<NewProcessPage />} />
            <Route path="/tenant/processes/:id/raci" element={<ProcessRaciPage />} />
            <Route path="/tenant/processes/:id/bpmn" element={<ProcessBpmnPage />} />
            <Route path="/tenant/processes/:id/workshop" element={<ProcessWorkshopPage />} />
            <Route path="/tenant/processes/:id/procedure" element={<ProcedurePage />} />
            <Route path="/tenant/processes/:id" element={<ProcessDetailPage />} />
            <Route path="/tenant/processes/:id/wizard" element={<ProcessWizardPage />} />
            <Route path="*" element={<App />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
