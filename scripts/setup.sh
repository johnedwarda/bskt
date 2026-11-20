#!/usr/bin/env bash
# Installs the latest Expo SDK, then lets `expo install` pick the versions of every
# native module that match that SDK (so nothing here pins a version by hand).
set -euo pipefail
cd "$(dirname "$0")/.."

npm install expo@latest

npx expo install \
  expo-router expo-linking expo-constants expo-status-bar expo-splash-screen \
  expo-font expo-web-browser expo-crypto expo-clipboard expo-haptics \
  react react-dom react-native react-native-web \
  react-native-screens react-native-safe-area-context \
  react-native-gesture-handler react-native-reanimated react-native-worklets \
  react-native-svg \
  @react-native-async-storage/async-storage \
  react-native-url-polyfill

npm install @supabase/supabase-js \
  @expo-google-fonts/inter @expo-google-fonts/bricolage-grotesque

npx expo install -- --save-dev typescript @types/react

npx expo install --fix

if [ ! -f .env ]; then
  cp .env.example .env
  echo
  echo "Created .env - fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
fi
