// src/utils/netinfo-shim.ts
// In Expo managed workflow, @react-native-community/netinfo needs
// to be replaced with expo-network or a simple shim.
// This file documents the swap needed in TelemetryViewModel.ts

// Replace:
//   import NetInfo from '@react-native-community/netinfo';
// With:
//   import * as Network from 'expo-network';
//
// And replace the NetInfo.addEventListener block with:
//
//   useEffect(() => {
//     let interval: ReturnType<typeof setInterval>;
//     const checkNetwork = async () => {
//       const state = await Network.getNetworkStateAsync();
//       setAppState(prev => ({ ...prev, isOnline: !!state.isConnected }));
//     };
//     checkNetwork();
//     interval = setInterval(checkNetwork, 5000);
//     return () => clearInterval(interval);
//   }, []);

export {};
