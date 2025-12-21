# Traefik Certificate Troubleshooting

## Issue: "Serving default certificate"

If you see this in Traefik logs:
```
Serving default certificate for request: "lfg.findparty.online"
```

This means Traefik is using its default/self-signed certificate instead of a Let's Encrypt certificate.

## Diagnosis Steps

### 1. Check Certificate Resolver Configuration

Verify Traefik has the `le` certificate resolver configured:

```bash
# Check Traefik configuration
docker exec traefik cat /etc/traefik/traefik.yml
# OR if using command line args:
docker inspect traefik | grep -i "certificatesresolvers\|acme"
```

You should see something like:
```yaml
certificatesResolvers:
  le:
    acme:
      email: your-email@example.com
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web
```

### 2. Check ACME/Let's Encrypt Logs

```bash
# Look for ACME-related messages
docker logs traefik | grep -i "acme\|certificate\|le\|letsencrypt"

# Common messages:
# - "Obtaining certificate" = in progress
# - "Certificate obtained" = success ✅
# - "Unable to obtain certificate" = error ❌
# - "Error getting certificate" = error ❌
```

### 3. Check DNS Propagation

```bash
# Verify DNS points to your server
dig lfg.findparty.online
nslookup lfg.findparty.online

# Should show your VPS IP address
# If it doesn't, DNS hasn't propagated yet
```

### 4. Check Port 80 Accessibility

Let's Encrypt needs port 80 for HTTP challenge:

```bash
# From your server
curl -I http://lfg.findparty.online

# From external (use online tool or another server)
# Should return HTTP response, not connection refused
```

### 5. Check Traefik Entrypoints

Verify Traefik has the correct entrypoints:

```bash
docker logs traefik | grep -i "entrypoint\|web\|websecure"
```

Should see:
- `web` entrypoint on port 80
- `websecure` entrypoint on port 443

## Common Issues and Fixes

### Issue 1: Certificate Resolver Not Configured

**Symptom**: No ACME logs, only "Serving default certificate"

**Fix**: Add certificate resolver to Traefik configuration:

```yaml
certificatesResolvers:
  le:
    acme:
      email: your-email@example.com  # Change this!
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web
```

Or via command line:
```bash
--certificatesresolvers.le.acme.email=your-email@example.com
--certificatesresolvers.le.acme.storage=/letsencrypt/acme.json
--certificatesresolvers.le.acme.httpchallenge.entrypoint=web
```

### Issue 2: DNS Not Propagated

**Symptom**: "Unable to obtain certificate" or "Error getting certificate"

**Fix**: Wait for DNS propagation (5-30 minutes, up to 48 hours)

```bash
# Check DNS
dig lfg.findparty.online
# Should show your VPS IP
```

### Issue 3: Port 80 Blocked

**Symptom**: "Unable to obtain certificate", HTTP challenge fails

**Fix**: Ensure port 80 is open and accessible:

```bash
# Check if port 80 is listening
netstat -tlnp | grep :80
# OR
ss -tlnp | grep :80

# Check firewall
sudo ufw status
# Allow port 80 if needed:
sudo ufw allow 80/tcp
```

### Issue 4: ACME Storage Permission Issues

**Symptom**: "Error storing certificate" or permission errors

**Fix**: Check `/letsencrypt/acme.json` permissions:

```bash
# Check if file exists and has correct permissions
ls -la /letsencrypt/acme.json
# Should be readable/writable by Traefik

# Fix permissions if needed
chmod 600 /letsencrypt/acme.json
chown traefik:traefik /letsencrypt/acme.json
```

### Issue 5: Rate Limiting

**Symptom**: "Too many certificates" error

**Fix**: Let's Encrypt has rate limits (50/week per domain). Wait or use staging:

```yaml
certificatesResolvers:
  le:
    acme:
      # ... other config ...
      caserver: https://acme-staging-v02.api.letsencrypt.org/directory
```

## Force Certificate Request

To force Traefik to request a certificate:

1. **Restart Traefik**:
   ```bash
   docker restart traefik
   ```

2. **Make a request to trigger certificate**:
   ```bash
   curl -I https://lfg.findparty.online/healthz
   ```

3. **Watch logs**:
   ```bash
   docker logs traefik -f | grep -i "certificate\|acme"
   ```

## Verify Certificate

Once certificate is obtained:

```bash
# Check certificate details
openssl s_client -connect lfg.findparty.online:443 -servername lfg.findparty.online

# Should show:
# - Issuer: Let's Encrypt
# - Valid dates
# - Subject: lfg.findparty.online
```

## Quick Checklist

- [ ] DNS points to your VPS IP
- [ ] Port 80 is open and accessible
- [ ] Traefik has certificate resolver `le` configured
- [ ] ACME email is set correctly
- [ ] `/letsencrypt/acme.json` has correct permissions
- [ ] Traefik logs show "Obtaining certificate" or "Certificate obtained"
- [ ] No rate limiting errors

## Still Not Working?

1. Check full Traefik logs:
   ```bash
   docker logs traefik 2>&1 | tail -100
   ```

2. Verify Traefik configuration:
   ```bash
   docker exec traefik traefik version
   docker inspect traefik | grep -A 20 "Cmd"
   ```

3. Test HTTP challenge manually:
   ```bash
   # Let's Encrypt should be able to reach:
   curl http://lfg.findparty.online/.well-known/acme-challenge/test
   ```

4. Check if there are any firewall rules blocking Let's Encrypt IPs

