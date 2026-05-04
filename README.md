# HomeApp — Smart Home Sensor Monitoring

Monorepo til styring af smarte hjem med realtids-sensordata via MQTT. Projektet indeholder tre dele: en **Expo/React Native** mobilapp, en **Hono/Bun** backend og en **Next.js 16** webapp — alle med samme funktionssæt og delt PostgreSQL-schema, containeriseret med Docker Compose.

---

## Projektstruktur

```
MobileExpoApp/
├── app/                        # Expo React Native mobilapp (SDK 55)
│   ├── App.tsx                 # Rod-komponent med navigation
│   ├── lib/
│   │   ├── api.ts              # API-klient mod backend
│   │   └── authContext.tsx     # Auth-state (JWT + AsyncStorage)
│   └── screens/
│       ├── AuthScreen.tsx      # Login og registrering
│       ├── HousesScreen.tsx    # Oversigt over brugerens huse
│       ├── HouseDetailScreen.tsx
│       └── RoomDetailScreen.tsx
│
├── backend/                    # Hono REST API (Bun runtime, port 3000)
│   └── src/
│       ├── index.ts            # Server entry, JWT middleware
│       ├── db/schema.ts        # PostgreSQL schema og init
│       ├── routes/             # auth, houses, rooms, sensors
│       └── services/mqtt.ts    # MQTT-klient
│
├── nextjsapp/                  # Next.js 16 webapp (App Router, port 3000)
│   ├── app/
│   │   ├── api/                # Route Handlers (spejler backend API)
│   │   ├── auth/               # Login/registrering side
│   │   ├── houses/             # Hus-liste og detalje
│   │   └── houses/[id]/rooms/  # Rum og sensorhistorik
│   ├── lib/
│   │   ├── db.ts               # PostgreSQL via pg
│   │   ├── auth.ts             # JWT helpers (HttpOnly cookies)
│   │   ├── mqtt.ts             # MQTT singleton
│   │   └── apiClient.ts        # Client-side fetch wrapper
│   └── instrumentation.ts      # MQTT startup via Next.js hook
│
├── package.json                # Monorepo workspace root (bun workspaces)
└── bun.lock
```

---

## Kom i gang

### Forudsætninger

- [Bun](https://bun.sh) — til mobilapp og backend
- [Node.js 18+](https://nodejs.org) — til Next.js webapp
- [Expo Go](https://expo.dev/go) på telefon (SDK 55) — til mobilapp
- En MQTT-broker (f.eks. [Mosquitto](https://mosquitto.org) lokalt)

### Installation

```bash
git clone https://github.com/GuttiDK/MobileExpoApp.git
cd MobileExpoApp
bun install
```

---

## Kør backend (Hono/Bun)

```bash
cd backend
cp .env.example .env   # udfyld JWT_SECRET og evt. MQTT-indstillinger
bun run dev
```

Backend starter på `http://localhost:3000`.

---

## Kør mobilapp (Expo)

```bash
cd app
echo "EXPO_PUBLIC_API_URL=http://DIN-IP:3000/api" > .env
npx expo start
```

Scan QR-koden med Expo Go, eller tryk `a` for Android-emulator.

---

## Kør webapp (Next.js)

```bash
cd nextjsapp
cp .env.local.example .env.local   # eller rediger .env.local direkte
npm run dev
```

Webapp starter på `http://localhost:3000` (eller angiv anden port med `--port`).

Se `nextjsapp/README.md` for detaljer om webapp-opsætning.

---

## Autentificering

Alle tre dele bruger JWT (HS256, 7 dages gyldighed):

- **Mobilapp** — token gemmes i `AsyncStorage`, sendes som `Authorization: Bearer`-header
- **Backend** — token valideres med Hono's JWT-middleware
- **Webapp** — token gemmes i HttpOnly cookie, sendes automatisk med alle fetch-kald

### Registrering

```
POST /api/auth/register
{ "name": "...", "email": "...", "password": "..." }
→ { "user": {...}, "token": "eyJ..." }
```

### Login

```
POST /api/auth/login
{ "email": "...", "password": "..." }
→ { "user": {...}, "token": "eyJ..." }
```

---

## API-oversigt

Alle endpoints kræver `Authorization: Bearer <token>` (eller cookie i webapp), undtagen `/api/auth/`.

| Metode | Sti | Beskrivelse |
|--------|-----|-------------|
| POST | `/api/auth/register` | Opret bruger |
| POST | `/api/auth/login` | Log ind, få JWT |
| GET | `/api/houses` | List egne huse |
| POST | `/api/houses` | Opret hus |
| GET | `/api/houses/:id` | Hus med rum og brugere |
| PATCH | `/api/houses/:id` | Rediger hus |
| DELETE | `/api/houses/:id` | Slet hus (kun ejer) |
| POST | `/api/houses/join` | Join med invite-kode |
| DELETE | `/api/houses/:id/leave` | Forlad hus |
| POST | `/api/houses/:id/regenerate-invite` | Ny invite-kode |
| PATCH | `/api/houses/:id/members/:userId` | Skift brugers rolle |
| DELETE | `/api/houses/:id/members/:userId` | Fjern bruger fra hus |
| POST | `/api/rooms` | Opret rum |
| PATCH | `/api/rooms/:id` | Rediger rum |
| DELETE | `/api/rooms/:id` | Slet rum |
| GET | `/api/rooms/:id/history` | Sensorhistorik |
| GET | `/api/sensors/latest` | Seneste aflæsning per rum |
| POST | `/api/sensors/:roomId` | Indsend sensor-aflæsning |

---

## Database-schema

PostgreSQL med følgende tabeller (samme schema i backend og nextjsapp):

| Tabel | Felter |
|-------|--------|
| `users` | id, name, email, password_hash, created_at |
| `houses` | id, name, description, owner_id, invite_code, created_at |
| `house_members` | id, house_id, user_id, role (owner/member/viewer), joined_at |
| `rooms` | id, house_id, name, description, icon, mqtt_topic, created_at |
| `sensor_readings` | id, room_id, temperature, humidity, recorded_at |

---

## MQTT sensordata

Fysiske sensorer publicerer til et MQTT-topic (konfigureret per rum):

```
Payload (JSON):   {"temperature": 22.5, "humidity": 65}
Payload (tekst):  22.5
```

Backend/webapp abonnerer automatisk på alle rum-topics ved opstart og gemmer aflæsninger i databasen.

---

## Teknologier

| Teknologi | Formål |
|-----------|--------|
| Expo SDK 55 | React Native mobilapp |
| React Navigation v7 | Stack-navigation i mobilapp |
| Hono | Letvægts HTTP-framework (backend) |
| Bun | Runtime and package manager (backend) |
| Next.js 16 | Fullstack webapp (App Router + Turbopack) |
| PostgreSQL | Persistent relational database for backend and webapp |
| mqtt.js | MQTT-klient i backend og webapp |
| Tailwind CSS v4 | Styling i webapp |
| Zod | Input-validering |
| JWT (HS256) | Stateless authentication |
| TypeScript | Typesikkerhed i hele projektet |

---

*Skoleprojekt — GuttiDK 2026*
