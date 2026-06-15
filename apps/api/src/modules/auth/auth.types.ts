export type AuthenticatedRequestUser = {
  sub: string;
  session_id: string;
  active_tenant_id?: string;
  membership_id?: string;
  global_roles: string[];
  tenant_roles: string[];
  permissions: string[];
  token_type: 'access';
  jti: string;
};

export type RequestMetadata = {
  ip?: string;
  userAgent?: string;
};
