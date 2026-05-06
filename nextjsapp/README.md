# HomeApp — Next.js Webapp

Next.js 16 webapp til styring af smarte hjem med realtids-sensordata via MQTT. Spejler funktionerne fra mobilappen og backend-API'et i et fuldt-stack webinterface.

---

## Teknologier

| Teknologi | Version | Formål |
|-----------|---------|--------|
| Next.js | 16.x | App Router, Turbopack, API Route Handlers |
| React | 19.x | UI |
| TypeScript | 5.x | Typesikkerhed |
| Tailwind CSS | 4.x | Styling (mørkt tema) |
| pg | 8.x | PostgreSQL database (server-side) |
| mqtt.js | — | MQTT-klient til sensordata |
| jsonwebtoken | — | JWT-signering og -validering |
| bcryptjs | — | Adgangskode-hashing |
| Zod | — | Input-validering i API-routes |

---

## Projektstruktur

```
nextjsapp/
├── app/
│   ├── layout.tsx                  # Root layout med AuthProvider
│   ├── page.tsx                    # Redirect til /auth eller /houses
│   ├── globals.css                 # Tailwind + CSS-variabler
│   ├── auth/
│   │   └── page.tsx                # Login / registrering
│   ├── houses/
│   │   ├── page.tsx                # Liste over brugerens huse
│   │   └── [id]/
│   │       ├── page.tsx            # Hus-detaljer (rum + medlemmer)
│   │       └── rooms/[roomId]/
│   │           └── page.tsx        # Sensorhistorik + devices i rum
│   ├── devices/
│   │   ├── page.tsx                # Global device-liste + pair-mode
│   │   └── [ieee]/
│   │       └── page.tsx            # Device-detalje med dynamiske kontroller
│   └── api/
│       ├── auth/
│       │   ├── register/route.ts   # POST — opret bruger
│       │   ├── login/route.ts      # POST — log ind (sætter cookie)
│       │   ├── logout/route.ts     # POST — slet cookie
│       │   └── me/route.ts         # GET  — hent aktuel bruger
│       ├── houses/
│       │   ├── route.ts            # GET / POST
│       │   ├── join/route.ts       # POST — join med invite-kode
│       │   └── [id]/
│       │       ├── route.ts        # GET / PATCH / DELETE
│       │       ├── regenerate-invite/route.ts
│       │       ├── leave/route.ts  # DELETE
│       │       └── members/[userId]/route.ts  # PATCH / DELETE
│       ├── rooms/
│       │   ├── route.ts            # POST
│       │   └── [id]/
│       │       ├── route.ts        # PATCH / DELETE
│       │       ├── history/route.ts # GET
│       │       └── devices/route.ts # GET — devices i rum + tilgængelige
│       ├── sensors/
│       │   ├── latest/route.ts     # GET
│       │   └── [roomId]/route.ts   # POST
│       └── devices/
│           ├── route.ts            # GET — list devices
│           ├── permit-join/route.ts # POST
│           ├── stream/route.ts     # GET — SSE state-stream
│           └── [ieee]/
│               ├── route.ts        # GET / PATCH / DELETE
│               └── set/route.ts    # POST — kontrollér device
├── lib/
│   ├── db.ts                       # PostgreSQL-opsætning og schema
│   ├── auth.ts                     # JWT helpers (sign, verify, session)
│   ├── mqtt.ts                     # MQTT + zigbee2mqtt bridge integration
│   ├── apiClient.ts                # Client-side fetch wrapper + typer
│   ├── deviceUtils.ts              # Device-kategorisering og expose-helpers
│   └── authContext.tsx             # React auth context (use client)
├── instrumentation.ts              # Starter MQTT ved server-opstart
├── next.config.ts                  # Turbopack root, serverExternalPackages
└── .env.local                      # Miljøvariabler (oprettes manuelt)
```

---

## Kom i gang

### 1. Installer afhængigheder

```bash
cd nextjsapp
npm install
```

### 2. Konfigurer miljøvariabler

Rediger `.env.local` (oprettes automatisk ved første klon, ellers opret den):

```env
DATABASE_URL=postgres://homeapp:homeapp123@postgres:5432/homeapp
JWT_SECRET=skift-mig-i-produktion

MQTT_HOST=localhost
MQTT_PORT=1883
MQTT_USERNAME=
MQTT_PASSWORD=
```

### 3. Start udviklingsserver

```bash
npm run dev
```

Åbn `http://localhost:3000` i browseren.

### 4. Produktionsbuild

```bash
npm run build
npm run start
```

---

## Konfiguration

### `next.config.ts`

| Indstilling | Formål |
|-------------|--------|
| `turbopack.root` | Sætter Turbopack workspace-rod til `nextjsapp/` (løser CSS-module resolution i monorepo) |
| `serverExternalPackages` | Ikke påkrævet for PostgreSQL/pg-basen |
| `allowedDevOrigins` | Tillader adgang fra andre enheder på netværket i dev-mode |

### `.env.local`

| Variabel | Beskrivelse | Standard |
|----------|-------------|---------|
| `DATABASE_URL` | Postgres connection string | `postgres://homeapp:homeapp123@postgres:5432/homeapp` |
| `JWT_SECRET` | Hemmelighed til JWT-signering | — |
| `MQTT_HOST` | MQTT-brokerens hostname | `localhost` |
| `MQTT_PORT` | MQTT-brokerens port | `1883` |
| `MQTT_USERNAME` | MQTT-brugernavn (valgfrit) | — |
| `MQTT_PASSWORD` | MQTT-adgangskode (valgfrit) | — |
| `Z2M_BASE_TOPIC` | Base-topic for zigbee2mqtt (valgfrit) | `zigbee2mqtt` |

---

## Autentificering

Sessioner håndteres via **HttpOnly cookies** med JWT (HS256, 7 dages gyldighed).

- Login/registrering sætter en `token`-cookie automatisk
- Alle API-kald fra browseren sender cookies (`credentials: 'include'`)
- Server-side API-routes læser token fra enten `Authorization: Bearer`-header eller cookie

---

## MQTT

MQTT-klienten initialiseres ved server-opstart via `instrumentation.ts` og `lib/mqtt.ts`. Den:

- Forbinder til broker konfigureret i `.env.local`
- Abonnerer automatisk på alle rums MQTT-topics ved opstart
- Parser JSON- (`{"temperature": 22.5, "humidity": 65}`) og tekstpayloads (enkelt tal)
- Gemmer aflæsninger i `sensor_readings`-tabellen

`lib/db.ts` importeres **dynamisk** inde i event-handlers for at undgå at Postgres-poolen trækkes ind i Turbopacks statiske module-graph for instrumentation-hooken.

---

## Zigbee2MQTT integration

Webappen integrerer direkte med [zigbee2mqtt](https://www.zigbee2mqtt.io/) via MQTT-broker'en og kræver ingen ekstra adapter — z2m's frontend kan stadig tilgås på `:8080` parallelt.

### Funktioner

- **Device discovery** — appen subscriberer på `zigbee2mqtt/bridge/devices` og bygger automatisk en liste over parrede enheder
- **Pair-mode** — `/devices`-siden har en "Tilføj enhed"-knap der enabler `permit_join` med 254s countdown
- **Kontrol** — tænd/sluk pærer, justér brightness, vælg farve (hex), justér farvetemperatur
- **Sensorer** — temperatur, fugt, dør/vindue-kontakt og batteri vises live
- **Realtid** — Server-Sent Events på `/api/devices/stream` pusher state-ændringer til UI'et uden polling
- **Rum som grupper** — devices tilknyttes rum fra rum-detaljesiden ("+ Tilføj"-knap viser tilgængelige enheder)

### MQTT-topics i brug

| Topic | Retning | Formål |
|-------|---------|--------|
| `zigbee2mqtt/bridge/state` | sub | Online/offline-status for z2m |
| `zigbee2mqtt/bridge/devices` | sub | Autoritativ device-liste (retained) |
| `zigbee2mqtt/bridge/event` | sub | Join/leave/interview-events |
| `zigbee2mqtt/{friendly_name}` | sub | Per-device state-opdateringer |
| `zigbee2mqtt/{friendly_name}/set` | pub | Send kommandoer til device |
| `zigbee2mqtt/bridge/request/permit_join` | pub | Toggle parring |
| `zigbee2mqtt/bridge/request/device/remove` | pub | Fjern device fra netværket |
| `zigbee2mqtt/bridge/request/device/rename` | pub | Omdøb device |

### API-endpoints

| Endpoint | Metode | Formål |
|----------|--------|--------|
| `/api/devices` | GET | List alle parrede devices |
| `/api/devices/permit-join` | POST | Body `{ value: bool, time?: number }` — toggle parring |
| `/api/devices/[ieee]` | GET / PATCH / DELETE | Hent/opdatér rum/omdøb/fjern device |
| `/api/devices/[ieee]/set` | POST | Body med settable properties — kontrollér device |
| `/api/devices/stream` | GET | Server-Sent Events stream af state-ændringer |
| `/api/rooms/[id]/devices` | GET | Devices i et rum + tilgængelige til at tilføje |

### Test-flow

1. Start hele stacken: `docker compose up` (postgres, mosquitto, zigbee2mqtt, nextjs)
2. Sæt nRF52840 til via USB (på Windows: `usbipd attach --wsl --busid <BUSID>`)
3. Verificér z2m kører på `http://localhost:8080`
4. Log ind på Next.js-appen på `http://localhost:3001` og gå til **📡 Enheder**
5. Tryk "Tilføj enhed", sæt din zigbee-enhed i parringsmode — den dukker op i listen
6. Klik på enheden for at åbne kontrol-siden (toggle, brightness-slider, farve-picker for lys; live-værdier for sensorer)
7. Tilknyt enheden til et rum: gå til rum-siden → "+ Tilføj" → vælg device

---

## Kendte begrænsninger

- **PostgreSQL** er den anbefalede database til flere samtidige brugere og containeriserede miljøer
- **MQTT** kræver en løbende Node.js-server — fungerer ikke på serverless-platforme (Vercel)
- **Sensor-historik** kræver at device er tilknyttet et rum — uden room_id gemmes kun seneste state, ikke historik

---

*Skoleprojekt — GuttiDK 2026*
