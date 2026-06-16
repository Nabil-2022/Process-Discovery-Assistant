import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

type TenantChoice = {
  tenant_id: string;
  membership_id: string;
  slug: string;
  name: string;
};

type LoginResponse = {
  access_token: string;
  requires_tenant_selection: boolean;
  tenants: TenantChoice[];
};

type SelectTenantResponse = {
  access_token: string;
  tenant: { id: string; slug: string; name: string };
  permissions: string[];
};

type AccessTokenPayload = {
  active_tenant_id?: string;
  global_roles?: string[];
  tenant_roles?: string[];
  exp?: number;
};

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('tenant.admin@example.test');
  const [password, setPassword] = useState('ChangeMe12345!');
  const [remember, setRemember] = useState(true);
  const [tokenForTenantSelection, setTokenForTenantSelection] = useState<string | null>(null);
  const [tenants, setTenants] = useState<TenantChoice[]>([]);
  const [error, setError] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);

  const existingToken = useMemo(() => readAccessToken(localStorage.getItem('pda_access_token')), []);

  useEffect(() => {
    if (existingToken?.active_tenant_id) {
      navigate('/tenant/dashboard', { replace: true });
    } else if (existingToken?.global_roles?.includes('super_admin')) {
      navigate('/admin', { replace: true });
    }
  }, [existingToken, navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const result = await request<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          remember_me: remember,
        }),
      });

      localStorage.setItem('pda_access_token', result.access_token);

      if (result.requires_tenant_selection) {
        setTokenForTenantSelection(result.access_token);
        setTenants(result.tenants);
        return;
      }

      routeAfterLogin(result.access_token);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function selectTenant(tenant: TenantChoice) {
    if (!tokenForTenantSelection) return;
    setError('');
    setSubmitting(true);

    try {
      const result = await request<SelectTenantResponse>(
        '/auth/select-tenant',
        {
          method: 'POST',
          body: JSON.stringify({ tenant_id: tenant.tenant_id }),
        },
        tokenForTenantSelection,
      );
      localStorage.setItem('pda_access_token', result.access_token);
      routeAfterLogin(result.access_token);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function routeAfterLogin(token: string) {
    const payload = readAccessToken(token);
    if (payload?.active_tenant_id) {
      navigate('/tenant/dashboard', { replace: true });
      return;
    }
    if (payload?.global_roles?.includes('super_admin')) {
      navigate('/admin', { replace: true });
      return;
    }
    navigate('/tenant/dashboard', { replace: true });
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div>
          <p className="eyebrow">Process Discovery Assistant</p>
          <h1>Connexion</h1>
        </div>

        {tenants.length ? (
          <div className="stack-form">
            <h2>Choisir un tenant</h2>
            {tenants.map((tenant) => (
              <button
                type="button"
                key={tenant.membership_id}
                onClick={() => selectTenant(tenant)}
                disabled={isSubmitting}
              >
                {tenant.name}
              </button>
            ))}
          </div>
        ) : (
          <form className="stack-form" onSubmit={submit}>
            <label>
              Email
              <input
                autoComplete="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Mot de passe
              <input
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <label className="check-row login-check">
              <input
                checked={remember}
                type="checkbox"
                onChange={(event) => setRemember(event.target.checked)}
              />
              <span>Rester connecte</span>
            </label>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        )}

        {error ? <p className="error-text">{error}</p> : null}
      </section>
    </main>
  );
}

async function request<T>(path: string, init: RequestInit, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}

function readAccessToken(token: string | null): AccessTokenPayload | null {
  if (!token) return null;
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const parsed = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as
      | AccessTokenPayload
      | undefined;
    if (parsed?.exp && parsed.exp * 1000 <= Date.now()) return null;
    return parsed ?? null;
  } catch {
    return null;
  }
}

function errorMessage(err: unknown) {
  if (!(err instanceof Error)) return 'Erreur de connexion.';
  try {
    const parsed = JSON.parse(err.message) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) return parsed.message.join(' ');
    return parsed.message ?? err.message;
  } catch {
    return err.message;
  }
}
