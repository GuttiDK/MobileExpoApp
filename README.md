# 📡 TelemetryApp — Expo React Native

Mobilapp der henter og visualiserer simuleret sensor-telemetri (temperatur & luftfugtighed) fra et BunJS-inspireret REST API, bygget med **Expo**, **React Native** og **TypeScript**.

---

## 🏗️ Arkitektur: MVVM + Dependency Injection

```
app/                    ← Expo Router (navigation)
  _layout.tsx           ← Tab navigation root
  index.tsx             ← Dashboard route
  settings.tsx          ← Settings route

src/
  models/               ← (Model) Datatyper og interfaces
    TelemetryModels.ts

  services/             ← (Model/Service) Datahentning og persistering
    FakerApiService.ts  ← Simuleret BunAPI med FakerJS-stil data
    CacheService.ts     ← AsyncStorage offline-cache

  viewmodels/           ← (ViewModel) Tilstandslogik og kommandoer
    TelemetryViewModel.ts ← useTelemetryViewModel() hook

  components/           ← (View) Genanvendelige UI-komponenter
    MetricCard.tsx
    SensorChart.tsx
    TimeRangePicker.tsx
    RoomPicker.tsx
    VentilationButton.tsx
    AlarmBanner.tsx
    NetworkStatusBar.tsx

  screens/              ← (View) Side-komponenter
    DashboardScreen.tsx
    SettingsScreen.tsx

  utils/
    theme.ts            ← Design tokens og farver
```

### MVVM-mønsteret
| Lag | Ansvar |
|-----|--------|
| **Model** | `TelemetryModels.ts` definerer datastrukturer. `FakerApiService` og `CacheService` håndterer datahentning og persistering |
| **ViewModel** | `useTelemetryViewModel()` eksponerer observerbar state og kommandoer. Indeholder al forretningslogik. View kalder kun kommandoer |
| **View** | Screens og komponenter binder til ViewModel-state via props og hooks. Ingen forretningslogik i View-laget |

### Dependency Injection
Services eksponeres som singletons via `getInstance()` og injiceres i ViewModel. Dette gør det let at udskifte `FakerApiService` med en rigtig HTTP-klient (f.eks. `fetch` mod en BunJS-server) uden at ændre ViewModel eller View.

---

## ✅ Kravopfyldelse

| Krav | Status | Implementering |
|------|--------|----------------|
| Vise aktuel temperatur og luftfugtighed | ✅ | `MetricCard` med live data fra `FakerApiService` |
| Målte tidspunkter i lokal tid | ✅ | `date-fns` med dansk locale, ISO → lokal konvertering |
| Graf over målinger | ✅ | `SensorChart` med `react-native-gifted-charts` LineChart |
| Vælg mellem seneste time, dag og uge | ✅ | `TimeRangePicker` komponent |
| Aktivere ventilation/servo (simuleret) | ✅ | `VentilationButton` med animeret feedback |
| MVVM designmønster | ✅ | `useTelemetryViewModel()` hook |
| Dependency Injection | ✅ | Singleton services injiceret i ViewModel |
| Vise seneste data ved netudfald | ✅ | `CacheService` med AsyncStorage |
| Robust overfor ustabil netforbindelse | ✅ | Try/catch + 5% simuleret fejlrate + automatisk fallback |
| **Optionel:** Vælg forskellige rum/sessions | ✅ | `RoomPicker` med 4 rum (Stue, Soveværelse, Køkken, Kontor) |
| **Optionel:** Alarm ved temperatur udenfor grænser | ✅ | `AlarmBanner` + konfigurerbar i Settings |

---

## 🚀 Kom i gang

### Forudsætninger
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Expo Go app på din telefon (iOS/Android)

### Installation
```bash
git clone https://github.com/GuttiDK/MobileExpoApp.git
cd MobileExpoApp
npm install
npx expo start
```

Scan QR-koden i terminalen med Expo Go, eller tryk `a` for Android-emulator / `i` for iOS-simulator.

---

## 📦 Teknologier

| Teknologi | Formål |
|-----------|--------|
| **Expo ~52** | Managed workflow, build-tooling |
| **Expo Router ~4** | Filbaseret navigation |
| **React Native 0.76** | UI framework |
| **TypeScript** | Typesikkerhed |
| **react-native-gifted-charts** | Temperatur- og luftfugtighedsgrafer |
| **@react-native-async-storage/async-storage** | Offline cache |
| **expo-network** | Netværksstatus-overvågning |
| **date-fns** | Dato-formatering med dansk locale |

---

## 🌐 API / Datasimulering

Appen simulerer et **BunJS REST API**, der normalt ville subscribere på MQTT-telemetri fra en HiveMQ-broker. Data genereres deterministisk med seeded pseudo-random (inspireret af fakerjs.dev), som:

- Simulerer **realistisk daglig temperaturvariation** (sinusoidal kurve 18–26°C)
- Simulerer **korreleret luftfugtighed** (35–65%, inverskorreleret med temperatur)
- Eksponerer **5% tilfældig netværksfejlrate** for at teste offline-robusthed
- Giver **300–700ms simuleret latency** pr. API-kald

For at tilslutte et rigtigt API: erstat `FakerApiService` med en HTTP-implementation, der peger mod din BunJS-server. ViewModel og View forbliver uændrede.

---

## 📁 Projektstruktur (uddybende)

```
MobileExpoApp/
├── app/                    # Expo Router sider
│   ├── _layout.tsx         # Tab-navigation
│   ├── index.tsx           # Dashboard
│   └── settings.tsx        # Indstillinger
├── src/
│   ├── models/
│   │   └── TelemetryModels.ts
│   ├── services/
│   │   ├── FakerApiService.ts
│   │   └── CacheService.ts
│   ├── viewmodels/
│   │   └── TelemetryViewModel.ts
│   ├── components/
│   │   ├── AlarmBanner.tsx
│   │   ├── MetricCard.tsx
│   │   ├── NetworkStatusBar.tsx
│   │   ├── RoomPicker.tsx
│   │   ├── SensorChart.tsx
│   │   ├── TimeRangePicker.tsx
│   │   └── VentilationButton.tsx
│   ├── screens/
│   │   ├── DashboardScreen.tsx
│   │   └── SettingsScreen.tsx
│   └── utils/
│       └── theme.ts
├── app.json
├── babel.config.js
├── package.json
├── tsconfig.json
└── README.md
```

---

*Skoleprojekt — GuttiDK 2026*
