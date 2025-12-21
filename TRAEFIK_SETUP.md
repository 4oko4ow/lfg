# Traefik SSL Certificate Setup

## Issue: ERR_CERT_AUTHORITY_INVALID

This error occurs when:
1. Let's Encrypt certificate hasn't been issued yet
2. Traefik certificate resolver (`le`) is not configured
3. Domain DNS is not pointing to your server

## Prerequisites

1. **Domain DNS configured**: `lfg.findparty.online` must point to your VPS IP
2. **Traefik running** with Let's Encrypt certificate resolver configured
3. **Ports open**: 80 and 443 must be accessible

## Traefik Configuration

Your Traefik needs to have a certificate resolver named `le` configured. Here's a basic Traefik configuration:

### traefik.yml (or docker-compose for Traefik)

```yaml
api:
  dashboard: true

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true
  websecure:
    address: ":443"

certificatesResolvers:
  le:
    acme:
      email: your-email@example.com  # Change this!
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web

providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
    network: traefik
```

### Docker Compose for Traefik

```yaml
services:
  traefik:
    image: traefik:v2.10
    container_name: traefik
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.le.acme.tlschallenge=true"
      - "--certificatesresolvers.le.acme.email=your-email@example.com"
      - "--certificatesresolvers.le.acme.storage=/letsencrypt/acme.json"
      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"
      - "--entrypoints.web.http.redirections.entrypoint.scheme=https"
      - "--entrypoints.web.http.redirections.entrypoint.permanent=true"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./letsencrypt:/letsencrypt
    networks:
      - traefik
    restart: unless-stopped
```

## Restarting Traefik

If you've just added new services, restart Traefik to ensure it discovers them:

```bash
# Restart Traefik
docker restart traefik

# Watch logs for service discovery
docker logs traefik -f

# Check for certificate requests
docker logs traefik | grep -i "certificate\|acme"
```

After restart, Traefik should:
- Discover the new API service on the `traefik` network
- Request Let's Encrypt certificate for `lfg.findparty.online`
- Start routing HTTPS traffic

## Troubleshooting

### 1. Check if certificate is being issued

```bash
# Check Traefik logs
docker logs traefik | grep -i acme
docker logs traefik | grep -i certificate

# Check if acme.json exists and has content
ls -la ./letsencrypt/acme.json
```

### 2. Verify DNS is pointing correctly

```bash
# Check if domain points to your server
dig lfg.findparty.online
nslookup lfg.findparty.online
```

### 3. Check Traefik can access the domain

```bash
# From your server, test if port 80 is accessible
curl -I http://lfg.findparty.online/.well-known/acme-challenge/test
```

### 4. Temporary workaround (development only)

If you need to test immediately, you can temporarily:

1. **Use HTTP only** (not recommended for production):
   - Remove TLS from Traefik labels
   - Use `http://lfg.findparty.online` instead of `https://`

2. **Use self-signed certificate** (browser will show warning):
   - Generate self-signed cert
   - Configure Traefik to use it

3. **Wait for Let's Encrypt** (recommended):
   - Let's Encrypt certificates are usually issued within minutes
   - Check Traefik logs for certificate status
   - Once issued, the error will go away

## Common Issues

### Certificate not issuing

- **DNS not propagated**: Wait 24-48 hours for DNS changes
- **Port 80 blocked**: Let's Encrypt needs port 80 for HTTP challenge
- **Too many requests**: Let's Encrypt has rate limits (50/week per domain)
- **Wrong email**: Make sure email in Traefik config is correct

### Certificate expired

- Let's Encrypt certificates expire after 90 days
- Traefik should auto-renew, but check logs if renewal fails

## Verification

Once certificate is issued:

```bash
# Check certificate
openssl s_client -connect lfg.findparty.online:443 -servername lfg.findparty.online

# Test from browser
# Should show valid certificate from "Let's Encrypt"
```

## Quick Fix for Now

If you need to test immediately and can't wait for Let's Encrypt:

1. **Update frontend to use HTTP temporarily** (Vercel env var):
   ```
   VITE_BACKEND_URL=http://lfg.findparty.online
   ```
   ⚠️ **Warning**: This is insecure and should only be for testing!

2. **Or wait for certificate** (recommended):
   - Check Traefik logs: `docker logs traefik -f`
   - Look for "Certificate obtained" message
   - Usually takes 1-5 minutes after first request

