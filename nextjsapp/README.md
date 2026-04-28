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
| better-sqlite3 | 12.x | SQLite-database (server-side) |
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
│   │           └── page.tsx        # Sensorhistorik for et rum
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
│       │       └── history/route.ts # GET
│       └── sensors/
│           ├── latest/route.ts     # GET
│           └── [roomId]/route.ts   # POST
├── lib/
│   ├── db.ts                       # SQLite-opsætning og schema
│   ├── auth.ts                     # JWT helpers (sign, verify, session)
│   ├── mqtt.ts                     # MQTT singleton med lazy DB-import
│   ├── apiClient.ts                # Client-side fetch wrapper + typer
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
DATABASE_PATH=./homeapp.db
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
| `serverExternalPackages` | Ekskluderer `better-sqlite3` fra bundling (native C++ addon) |
| `allowedDevOrigins` | Tillader adgang fra andre enheder på netværket i dev-mode |

### `.env.local`

| Variabel | Beskrivelse | Standard |
|----------|-------------|---------|
| `DATABASE_PATH` | Sti til SQLite-fil | `./homeapp.db` |
| `JWT_SECRET` | Hemmelighed til JWT-signering | — |
| `MQTT_HOST` | MQTT-brokerens hostname | `localhost` |
| `MQTT_PORT` | MQTT-brokerens port | `1883` |
| `MQTT_USERNAME` | MQTT-brugernavn (valgfrit) | — |
| `MQTT_PASSWORD` | MQTT-adgangskode (valgfrit) | — |

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

`lib/db.ts` importeres **dynamisk** inde i event-handlers for at undgå at `better-sqlite3` trækkes ind i Turbopacks statiske module-graph for instrumentation-hooken.

---

## Kendte begrænsninger

- **Ingen realtids-push** — sensordata opdateres ved manuel genindlæsning (↺-knap)
- **SQLite** er ikke egnet til høj samskrivning fra mange brugere samtidig
- **MQTT** kræver en løbende Node.js-server — fungerer ikke på serverless-platforme (Vercel)

---

*Skoleprojekt — GuttiDK 2026*
