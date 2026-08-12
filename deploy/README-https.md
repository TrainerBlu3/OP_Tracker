# HTTPS via Caddy + sslip.io (no domain needed)

Run these on the VM itself (SSH in first), as a user with sudo access.

## 1. Reserve a static external IP (if not already static)

An ephemeral IP can change on VM restart, which would break the cert
binding below. In the GCP Console: **VPC network -> IP addresses**, find
this VM's external IP, and click "Promote to static" (or via `gcloud`:
`gcloud compute addresses create op-tracker-ip --addresses=<CURRENT_IP> --region=<REGION>`
then attach it to the VM's network interface).

Note the IP -- you'll need it below. Call it `VM_IP` for the rest of this.

## 2. Open firewall ports 80 and 443

```bash
gcloud compute firewall-rules create allow-http-https \
  --allow=tcp:80,tcp:443 \
  --direction=INGRESS \
  --target-tags=http-server,https-server
```

(Or via the Console: **VPC network -> Firewall -> Create firewall rule**,
allow ingress TCP 80 and 443 from `0.0.0.0/0`. Make sure the VM has the
`http-server`/`https-server` network tags, or adjust the rule's target to
match your VM.)

## 3. Install Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

## 4. Configure Caddy

```bash
# Replace the dots in VM_IP with dashes for the sslip.io hostname, e.g.
# 34.123.45.67 -> 34-123-45-67
VM_IP_DASHED=$(echo "$VM_IP" | tr '.' '-')
echo "Your app's HTTPS hostname will be: ${VM_IP_DASHED}.sslip.io"

sudo tee /etc/caddy/Caddyfile > /dev/null <<EOF
${VM_IP_DASHED}.sslip.io {
	reverse_proxy localhost:3000
}
EOF

sudo systemctl reload caddy
sudo systemctl enable --now caddy
```

## 5. Point the app at its real HTTPS URL

Auth.js needs to know its own public URL for callback/cookie handling. In
`~/op-tracker/.env` on the VM:

```
AUTH_URL=https://34-123-45-67.sslip.io
```

(with your actual dashed IP). Then restart the app:

```bash
systemctl --user restart op-tracker
```

## 6. Verify

Visit `https://<your-dashed-ip>.sslip.io` in a browser -- you should get a
real, trusted padlock (no warning), proxied through to the app on port
3000. `http://` requests to the same hostname get auto-redirected to
`https://` by Caddy.

## Notes

- Caddy renews the cert automatically well before it expires -- nothing to
  maintain here.
- Port 3000 itself doesn't need to be open in the firewall for outside
  traffic once this is in place -- only Caddy (80/443) needs to be
  reachable from the internet; the app only needs to be reachable from
  Caddy, i.e. localhost.
