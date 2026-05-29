# Phones & tablets

**For staff — three steps:**

1. Join **facility Wi‑Fi**
2. Scan the **QR code** on the office computer (Settings → Phones & tablets)
3. Optional: **Add to Home Screen** on iPhone/iPad

**For the person who installed FacilityOS:**

- Install **FacilityOS Server** on the office PC — phones work automatically (no extra setup).
- Show staff the QR code from **Settings → Phones & tablets**, or tap **Show QR** on the home screen.

No app store. No passwords on Wi‑Fi. No IT steps for staff.

If a phone cannot connect, confirm it is on the same Wi‑Fi as the server PC and that the firewall script was run once during install (see [BUILD.md](BUILD.md)).

## Add to Home Screen (PWA)

- **iPhone/iPad:** Safari → Share → Add to Home Screen (banner shown automatically).
- **Android Chrome:** Use the **Install app** banner when offered, or browser menu → Install.
- The app opens full-screen (`standalone`) with an offline shell; **data still requires** the facility server on Wi‑Fi.

## FacilityOS Cloud PWA (remote managers)

For managers outside the facility LAN:

```powershell
npm run build:cloud
# Optional: set relay URL for production
# $env:VITE_CLOUD_RELAY_URL="https://relay.yourdomain.com"; npm run build:cloud
```

Deploy `dist/` to your CDN. Users sign in with **site ID + cloud login** (created in Settings → Cloud on the server PC).

Push alerts work when the relay has VAPID keys configured (`FACILITYOS_VAPID_PUBLIC` / `PRIVATE`).

## Email alerts (non-compliant tests)

On the **data server PC**, set SMTP environment variables and restart FacilityOS:

| Variable | Required |
|----------|----------|
| `SMTP_HOST` | Yes |
| `SMTP_PORT` | No (default 587) |
| `SMTP_USER` / `SMTP_PASS` | If your provider requires auth |
| `SMTP_FROM` | No |

Then in **Settings → Facility**: set facility email, enable alerts, and use **Verify SMTP** / **Send test email**.
