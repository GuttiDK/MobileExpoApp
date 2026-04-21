// src/utils/theme.ts

export const colors = {
  bg: '#0D1117',
  surface: '#161B22',
  surfaceElevated: '#21262D',
  border: '#30363D',
  borderSubtle: '#21262D',

  text: '#E6EDF3',
  textSecondary: '#8B949E',
  textMuted: '#484F58',

  accent: '#00D4FF',       // Electric cyan — temperature
  accentGlow: 'rgba(0,212,255,0.15)',
  humidity: '#7EE787',     // Verdant green — humidity
  humidityGlow: 'rgba(126,231,135,0.15)',

  danger: '#FF6B6B',
  dangerGlow: 'rgba(255,107,107,0.15)',
  warning: '#F9A825',
  success: '#3FB950',

  gradientTemp: ['#00D4FF', '#0066FF'],
  gradientHumid: ['#7EE787', '#2EA043'],
};

export const typography = {
  // Display font: Orbitron-like monospace feel via system fonts
  mono: 'Courier New',
  sans: 'System',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
};

export const shadows = {
  cyan: {
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  green: {
    shadowColor: '#7EE787',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
};
