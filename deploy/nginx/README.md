# Meow Nginx edge proxy

This directory contains the first Nginx layer for Meow. It is designed for an
Ubuntu VPS (for example, a MilesWeb VPS) in front of the existing Node.js API.
Vercel remains the frontend host.

## What this configuration does

- Terminates public HTTP traffic at Nginx and proxies it to the Node API.
- Uses `127.0.0.1:10000` as the initial API origin (the backend's current default port).
- Keeps REST and Socket.IO upstream pools separate:
  - REST uses `least_conn` when multiple replicas are enabled.
  - Socket.IO uses `ip_hash` to keep polling requests for one client on one API replica.
- Passes WebSocket upgrade headers and disables proxy buffering for Socket.IO.
- Keeps `/health` and `/metrics` private to localhost; `/live` is the public liveness probe.
- Allows up to 410 MiB only on `/api/upload/*`, matching the current upload middleware's
  maximum of 20 files at 20 MiB each. All other routes have a 25 MiB Nginx request cap.

Nginx is not the Node process manager. The API must already be running on the VPS.

## 1. Required deployment shape

```text
Browser / Meow PWA
       |
       | HTTPS API + Socket.IO
       v
api.<your-domain>  --->  MilesWeb Ubuntu VPS
                          Nginx :80/:443
                              |
                              +--> Node API 127.0.0.1:10000
                                       |
                                       +--> Existing production MongoDB Atlas
                                       +--> Existing shared Valkey/Redis
```

Do not point production DNS or Vercel at the VPS until the VPS API passes the
local and public smoke tests below. The existing Azure production backend remains
unchanged during this first stage.

This requires an Ubuntu VPS with sudo/root access. MilesWeb shared hosting does
not normally provide the system-level Nginx access needed for this configuration.

## 2. Prepare the VPS

First deploy the Meow backend to the VPS and start it on port 10000. Use the same
release and environment values intended for production, stored outside Git (for
example, in `/etc/meow/backend.env`). Never commit `.env`, database URIs, JWT
secrets, Redis passwords, or provider keys.

The current backend defaults to port `10000` and exposes:

- `GET /live` — liveness
- `GET /health` — readiness plus dependency status
- `/socket.io/` — Socket.IO

From the VPS, confirm the backend itself is healthy before installing the proxy:

```bash
curl -fsS http://127.0.0.1:10000/live
curl -fsS http://127.0.0.1:10000/health
```

The second endpoint should report a ready state and healthy MongoDB. Resolve any
dependency failure before continuing.

## 3. Install Nginx and load the Meow site

On Ubuntu:

```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl enable --now nginx
```

Copy the configuration:

```bash
sudo cp deploy/nginx/meow-api.conf /etc/nginx/conf.d/meow-api.conf
```

Edit the server name:

```bash
sudo nano /etc/nginx/conf.d/meow-api.conf
```

Replace `api.example.com` with the real API hostname whose DNS A record points
to this VPS's public IPv4 address. Do not leave the example hostname in production.

Validate before reloading:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Test through Nginx from the VPS (replace the hostname):

```bash
curl -fsS -H 'Host: api.your-domain.com' http://127.0.0.1/live
curl -fsS -H 'Host: api.your-domain.com' http://127.0.0.1/health
```

The readiness route is intentionally restricted to localhost by Nginx. The public
`/live` route is the external uptime check.

## 4. Firewall

If UFW is the firewall in use, allow SSH before enabling it, then allow only HTTP
and HTTPS from the public internet. Keep Node's port 10000 closed externally:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw deny 10000/tcp
sudo ufw status verbose
```

If UFW is not already enabled, inspect the existing provider firewall and SSH
rules before running `sudo ufw enable`. Do not lock out SSH. For separate backend
VPS nodes, allow port 10000 only from the Nginx host over a private network.

## 5. Enable HTTPS

After the DNS A record resolves to the VPS and inbound ports 80/443 are open,
install Certbot using its current Ubuntu instructions:

```bash
sudo apt install -y snapd
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/local/bin/certbot
sudo certbot --nginx -d api.your-domain.com
sudo certbot renew --dry-run
```

Certbot updates the Nginx server block for TLS. Verify renewal with the dry run.
Do not change the Vercel production API settings until the HTTPS endpoint returns
a successful `/live` response and the authenticated API smoke tests pass.

## 6. Connect the Vercel frontend (cut over only after validation)

The current frontend configuration uses:

- `API_URL` for server-side REST proxying through the Next.js backend proxy.
- `NEXT_PUBLIC_SOCKET_URL` for direct browser Socket.IO connections.
- `NEXT_PUBLIC_API_URL=/backend-api` for the existing same-origin REST proxy path.

After the VPS API is verified, set these Vercel production variables:

```text
API_URL=https://api.your-domain.com
NEXT_PUBLIC_SOCKET_URL=https://api.your-domain.com
NEXT_PUBLIC_API_URL=/backend-api
```

Keep `NEXT_PUBLIC_API_URL` as `/backend-api` unless the frontend proxy design
is intentionally changed. Redeploy the frontend after changing build-time
`NEXT_PUBLIC_*` values.

On the backend, keep `FRONTEND_URL` set to the actual frontend origin
(for example, `https://meow-guru.vercel.app`), not the API hostname. Preserve any
required `CORS_ALLOWED_ORIGINS` entries. Copy required production secrets to the
VPS through a secure secret-management channel; do not put secrets in this repo.

## 7. Enable multiple API replicas later

Do not enable multiple replicas just by adding Nginx server lines. First ensure
all replicas run the same release and share the same production state:

- Same MongoDB Atlas cluster/database and compatible indexes/migrations.
- Same Valkey/Redis endpoint and production namespace for shared cache, sessions,
  invalidation and rate-limit state.
- Same JWT/session secrets, auth configuration and object-storage configuration.
- Battle Socket.IO uses the Redis Streams adapter on every API instance:
  `BATTLE_REDIS_ADAPTER=true` with the shared `REDIS_URL`.
- Embedded workers are not duplicated across API replicas. Follow the repository's
  Azure multi-instance deployment settings and run the dedicated worker roles
  separately before scaling API processes.

Once three API processes are running and each passes `/live`, replace the two
upstream blocks in `meow-api.conf` with the definitions in
`meow-api-multi-upstreams.conf.example`, then test and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

The example uses `least_conn` for REST and `ip_hash` for Socket.IO polling
affinity. This is a practical OSS Nginx starting point, not perfect balancing:
clients sharing a public IP (for example, carrier NAT) may concentrate on one
replica. If Cloudflare proxying is enabled, configure Nginx's real-IP module to
trust only Cloudflare's current published IP ranges and use
`CF-Connecting-IP` before relying on `ip_hash`; never trust arbitrary
`X-Forwarded-For` sources.

Nginx Open Source uses passive upstream failure detection via
`max_fails`/`fail_timeout`; it does not actively probe every replica. Keep
independent monitoring and alerting in place.

## 8. Operational notes

- Keep the backend's Valkey-backed rate limits as the authoritative per-user
  limits. A generic Nginx per-IP rate limit can incorrectly throttle many students
  behind one school, hostel or mobile-carrier NAT.
- `/health` reveals dependency state and is local-only in this config.
  Use `/live` for an external uptime probe.
- The 410 MiB upload allowance is intentionally limited to `/api/upload/*`.
  The current upload middleware stores uploaded files in process memory; do not
  run large concurrent bulk uploads without checking VPS RAM and admin upload
  concurrency.
- The 75-second proxy read timeout is longer than the backend's default 60-second
  route timeout so Nginx does not cut off normal long-running AI requests first.
- Roll back by restoring the previous Nginx config, running `sudo nginx -t`, and
  reloading Nginx. Do not remove the Azure backend until the VPS cutover has been
  proven and a rollback window has passed.

## References

- [Nginx WebSocket proxying](https://nginx.org/en/docs/http/websocket.html)
- [Nginx proxy module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [Nginx upstream module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html)
- [Certbot Nginx instructions](https://certbot.eff.org/instructions?os=ubuntubionic&tab=standard&ws=nginx)
