#!/usr/bin/env bash
# Linux / macOS: instala dependencias (solo la primera vez) y arranca la plataforma.
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
[ -d dist ] || npm run build
npm start
