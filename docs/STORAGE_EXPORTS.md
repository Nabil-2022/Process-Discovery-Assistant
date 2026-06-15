# Storage and Exports

## Current Implementation

- Exports are represented by `export_jobs`.
- Files are stored through `StorageService`.
- Local fallback path: `storage/exports`.
- Object keys include tenant and job identifiers: `tenants/{tenantId}/exports/{exportJobId}/{filename}`.
- Downloads go through protected backend endpoints.
- Checksum is calculated for generated files.

## Security

- Cross-tenant export downloads are refused.
- Completed export status is required before download.
- MIME type and filename are stored with the job.
- `storage/exports` is ignored by Git.

## Retention

- Export jobs include `expiresAt`.
- A future cleanup worker should remove expired files and mark jobs expired.

## Future MinIO/S3

- Replace local fallback with S3-compatible provider.
- Keep the same object key structure.
- Add signed URL support only if tenant/RBAC checks remain enforced.

