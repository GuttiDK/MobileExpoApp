# HomeApp — Expo React Native + Hono Backend

Mobilapp til styring af smarte hjem med realtids-sensordata via MQTT. Bygget som et monorepo med en **Expo/React Native** frontend og en **Hono/Bun** backend med SQLite.

---

## 🏗️ Projektstruktur

```
MobileExpoApp/
├── app/                        # Expo React Native app (SDK 55)
│   ├── App.tsx                 # Rod-komponent med navigation
│   ├── app.json                # Expo konfiguration
│   ├── babel.config.js
│   ├── tsconfig.json
│   ├── assets/                 # Ikoner og splash screen
│   ├── lib/
│   │   ├── api.ts              # API-klient mod backend
│   │   └── authContext.tsx     # Auth-state (JWT)
│   └── screens/
│       ├── AuthScreen.tsx      # Login og registrering
│       ├── HousesScreen.tsx    # Oversigt over brugerens huse
│       ├── HouseDetailScreen.tsx # Rum, brugere og hus-styring
│       └── RoomDetailScreen.tsx  # Sensorhistorik for et rum
│
├── backend/                    # Hono REST API (Bun runtime)
│   ├── src/
│   │   ├── index.ts            # Server entry, JWT middleware
│   │   ├── db/
│   │   │   └── schema.ts       # SQLite schema og database-init
│   │   ├── routes/
│   │   │   ├── auth.ts         # POST /register, POST /login
│   │   │   ├── houses.ts       # CRUD huse + medlemsstyring
│   │   │   ├── rooms.ts        # CRUD rum + sensorhistorik
│   │   │   └── sensors.ts      # GET latest, POST sensor-reading
│   │   └── services/
│   │       └── mqtt.ts         # MQTT-klient (subscribes til rum-topics)
│   ├── .env                    # Miljøvariabler (se .env.example)
│   ├── .env.example
│   ├── tsconfig.json
│   └── package.json
│
├── package.json                # Monorepo workspace root (bun workspaces)
└── bun.lock
```

---

## 🚀 Kom i gang

### Forudsætninger
- [Bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`)
- [Expo Go](https://expo.dev/go) på din telefon (SDK 55)
- En MQTT-broker (f.eks. Mosquitto lokalt eller Shiftr.io)
- SQLite-mappe oprettet: `C:\sqlite\dbs\` (eller tilpas `DB_PATH` i `.env`)

### Installation

```bash
git clone https://github.com/GuttiDK/MobileExpoApp.git
cd MobileExpoApp
bun install
```

### Kør backend

```bash
cd backend
# Første gang: kopiér .env.example til .env og udfyld værdier
cp .env.example .env
bun run dev
```

Backend starter på `http://localhost:3000`.

### Kør appen

```bash
cd app
# Opret .env med din PC's lokale IP
echo "EXPO_PUBLIC_API_URL=http://DIN-IP:3000/api" > .env
npx expo start
```

Scan QR-koden med Expo Go, eller tryk `a` for Android-emulator.

---

## ⚙️ Konfiguration

### `backend/.env`

| Variabel | Beskrivelse | Standard |
|----------|-------------|---------|
| `PORT` | Serverens port | `3000` |
| `JWT_SECRET` | Hemmelighed til JWT-signering | — |
| `DB_PATH` | Sti til SQLite-databasefil | `C:\sqlite\dbs\app.db` |
| `MQTT_HOST` | IP/hostname på MQTT-broker | `localhost` |
| `MQTT_PORT` | MQTT-brokerens port | `1883` |
| `MQTT_USERNAME` | MQTT-brugernavn (valgfrit) | — |
| `MQTT_PASSWORD` | MQTT-adgangskode (valgfrit) | — |

### `app/.env`

| Variabel | Beskrivelse |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Backend URL, f.eks. `http://192.168.1.10:3000/api` |

---

## 📡 API-oversigt

Alle endpoints under `/api/` (undtagen `/api/auth/`) kræver `Authorization: Bearer <token>`.

| Metode | Sti | Beskrivelse |
|--------|-----|-------------|
| POST | `/api/auth/register` | Opret bruger |
| POST | `/api/auth/login` | Log ind, få JWT |
| GET | `/api/houses` | List egne huse |
| POST | `/api/houses` | Opret hus |
| GET | `/api/houses/:id` | Hus med rum og brugere |
| PATCH | `/api/houses/:id` | Rediger hus (navn/beskrivelse) |
| DELETE | `/api/houses/:id` | Slet hus (kun ejer) |
| POST | `/api/houses/join` | Join hus med invite-kode |
| DELETE | `/api/houses/:id/leave` | Forlad hus |
| POST | `/api/houses/:id/regenerate-invite` | Ny invite-kode |
| PATCH | `/api/houses/:id/members/:userId` | Skift brugers rolle |
| DELETE | `/api/houses/:id/members/:userId` | Fjern bruger fra hus |
| POST | `/api/rooms` | Opret rum |
| PATCH | `/api/rooms/:id` | Rediger rum |
| DELETE | `/api/rooms/:id` | Slet rum |
| GET | `/api/rooms/:id/history` | Sensorhistorik for rum |
| GET | `/api/sensors/latest` | Seneste aflæsning per rum |
| POST | `/api/sensors/:roomId` | Indsend sensor-aflæsning |

---

## 🗄️ Database

SQLite med følgende tabeller:

- **users** — brugere (id, name, email, password_hash)
- **houses** — huse (id, name, description, owner_id, invite_code)
- **house_members** — relationer (house_id, user_id, role: owner/member/viewer)
- **rooms** — rum (id, house_id, name, icon, mqtt_topic)
- **sensor_readings** — aflæsninger (room_id, temperature, humidity, recorded_at)

---

## 📱 App-funktioner

| Funktion | Beskrivelse |
|----------|-------------|
| **Registrering/login** | JWT-baseret auth med AsyncStorage |
| **Huse** | Opret, join med kode, se alle dine huse |
| **Hus-styring** | Rediger navn, generer ny invite-kode, slet hus |
| **Brugerstyring** | Skift rolle (medlem/gæst), fjern fra hus |
| **Rum** | Opret rum med MQTT-topic og ikon, slet rum |
| **Sensordata** | Realtids temperatur og luftfugtighed via MQTT |
| **Historik** | Graf over sensoraflæsninger |

---

## 📦 Teknologier

| Teknologi | Formål |
|-----------|--------|
| **Expo SDK 55** | React Native managed workflow |
| **React Native 0.83** | UI framework |
| **React Navigation v7** | Stack-navigation |
| **TypeScript** | Typesikkerhed |
| **Hono** | Letvægts HTTP-framework til Bun |
| **Bun** | Runtime, package manager og SQLite-driver |
| **bun:sqlite** | Indbygget SQLite (ingen ekstern driver) |
| **mqtt.js** | MQTT-klient til sensordata |
| **Zod** | Input-validering i backend |
| **JWT** | Stateless authentication |

---

*Skoleprojekt — GuttiDK 2026*
