# Deploy Process Discovery Assistant

Target domain: `https://process.higroup.systems`

## DNS

Create the DNS record before requesting the certificate:

- Type: `A`
- Host: `process`
- Value: `IP_DU_SERVEUR`
- TTL: `300` or automatic

If IPv6 is available:

- Type: `AAAA`
- Host: `process`
- Value: `IPv6_DU_SERVEUR`

Do not invent the server IP. Use the real server address provided by infrastructure.

## Server Prerequisites

- Docker Engine and Docker Compose plugin.
- Nginx installed on the host.
- Certbot with the Nginx plugin.
- A production `.env` file on the server only, never committed.

## Build and Start

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

## Nginx

Copy or symlink:

```bash
sudo cp deploy/nginx/process.higroup.systems.conf /etc/nginx/sites-available/process.higroup.systems.conf
sudo ln -s /etc/nginx/sites-available/process.higroup.systems.conf /etc/nginx/sites-enabled/process.higroup.systems.conf
sudo nginx -t
sudo systemctl reload nginx
```

## Let's Encrypt

Once DNS points to the server:

```bash
sudo certbot --nginx -d process.higroup.systems
sudo certbot renew --dry-run
```

## Database Migration

Before deployment, back up PostgreSQL. Then run:

```bash
npx prisma migrate status --config apps/api/prisma.config.ts
npx prisma migrate deploy --config apps/api/prisma.config.ts
npm run db:check --workspace @pda/api
npm run db:seed-check --workspace @pda/api
npm run db:integrity --workspace @pda/api
```

Never run `prisma db push`, `prisma migrate reset`, or `DROP DATABASE` on production.

## Healthchecks

```bash
curl https://process.higroup.systems/api/v1/health
curl https://process.higroup.systems/health
docker compose -f docker-compose.prod.yml ps
```

## Logs

```bash
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web
sudo journalctl -u nginx -f
```
