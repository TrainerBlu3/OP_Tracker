# HTTPS via Caddy + sslip.io (no domain needed)

Run these on the VM itself (SSH in first), as a user with sudo access.
This assumes the VM already runs another app (e.g. QuickDash) -- if OP
Tracker is the only thing on this VM, skip the "existing app" callouts
below and use port 3000 instead of 3001 throughout (also revert
`deploy/op-tracker.service`'s `--port 3001` back to `3000`).

## 0. Add swap (two Node apps on 1GB RAM)

An e2-micro has 1GB RAM. Split between two Node apps plus the occasional
`npm run build` memory spike (which can exceed 1GB on its own), you're at
real risk of the OOM killer taking down a running service mid-build.
Swap turns that into "slower," not "crashed":

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h   # confirm swap shows up
```

This uses 2GB of your 30GB disk allowance -- well within the free-tier limit.

## 1. Reserve a static external IP (if not already static)

An ephemeral IP can change on VM restart, which would break the cert
binding below. In the GCP Console: **VPC network -> IP addresses**, find
this VM's external IP, and click "Promote to static" (or via `gcloud`:
`gcloud compute addresses create op-tracker-ip --addresses=<CURRENT_IP> --region=<REGION>`
then attach it to the VM's network interface).

Note the IP -- you'll need it below. Call it `VM_IP` for the rest of this.
If QuickDash is already deployed on this VM, it's presumably already using
this same IP (and the VM may already be static) -- check before reserving
a second one, GCP only gives one external IP per VM by default.

## 2. Open firewall ports 80 and 443

Skip this if QuickDash's own deploy already opened these -- both apps
share the same Caddy instance and the same ports.

```bash
gcloud compute firewall-rules create allow-http-https \
  --allow=tcp:80,tcp:443 \
  --direction=INGRESS \
  --target-tags=http-server,https-server
```

(Or via the Console: **VPC network -> Firewall -> Create firewall rule**,
allow ingress TCP 80 and 443 from `0.0.0.0/0`.)

## 3. Install Caddy (skip if already installed for another app)

```bash
which caddy && echo "already installed" || {
  sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt update
  sudo apt install -y caddy
}
```

## 4. Add OP Tracker's site block

**Check what's already in `/etc/caddy/Caddyfile` first** -- if QuickDash
already has a site block there, APPEND to it, don't overwrite the file:

```bash
sudo cat /etc/caddy/Caddyfile
```

Then add OP Tracker's block (the `optracker.` prefix keeps its hostname
distinct from whatever QuickDash uses):

```bash
VM_IP_DASHED=$(echo "$VM_IP" | tr '.' '-')
echo "OP Tracker's HTTPS hostname will be: optracker.${VM_IP_DASHED}.sslip.io"

sudo tee -a /etc/caddy/Caddyfile > /dev/null <<EOF

optracker.${VM_IP_DASHED}.sslip.io {
	reverse_proxy localhost:3001
}
EOF

sudo systemctl reload caddy
sudo systemctl enable --now caddy
```

## 5. Point the app at its real HTTPS URL

Auth.js needs to know its own public URL for callback/cookie handling. In
`~/op-tracker/.env` on the VM:

```
AUTH_URL=https://optracker.34-123-45-67.sslip.io
```

(with your actual dashed IP). Then restart the app:

```bash
systemctl --user restart op-tracker
```

## 6. Verify

Visit `https://optracker.<your-dashed-ip>.sslip.io` -- you should get a
real, trusted padlock (no warning), proxied through to OP Tracker on port
3001. QuickDash keeps working unaffected at its own existing hostname.

## Notes

- Caddy renews both apps' certs automatically -- nothing to maintain here.
- Only Caddy (80/443) needs to be reachable from the internet; the apps
  themselves (3000, 3001) only need to be reachable from Caddy, i.e.
  localhost.
- Watch memory during a deploy the first few times (`free -h` while
  `npm run build` runs) to confirm the swap is actually enough headroom
  for both apps plus a build in flight.

## Giving OP Tracker priority over QuickDash

If OP Tracker sees meaningfully more traffic than QuickDash, it's worth
telling systemd that explicitly rather than leaving both apps at equal
default priority. `deploy/op-tracker.service` already sets `CPUWeight=200`
(double the default share of CPU time under contention) and
`OOMScoreAdjust=-100` (less likely to be the one killed if the VM runs
out of memory). For that to actually mean something *relative to*
QuickDash, add the inverse to QuickDash's own systemd unit on the VM
(it's not part of this repo, so this has to be done by hand there):

```ini
[Service]
CPUWeight=50
OOMScoreAdjust=100
```

Add those two lines under QuickDash's `[Service]` section (e.g.
`~/.config/systemd/user/quickdash.service` or wherever its unit file
lives), then:

```bash
systemctl --user daemon-reload
systemctl --user restart quickdash
```

Neither setting matters at all when the VM isn't under actual CPU or
memory pressure -- both apps run normally otherwise. This only kicks in
when resources are genuinely contended, which is exactly when you'd want
the more-used app to win.
