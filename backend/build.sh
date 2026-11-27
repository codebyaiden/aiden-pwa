#!/bin/sh
set -eu
mkdir -p backend/dist
./node_modules/.bin/esbuild backend/server.mjs --bundle --platform=node --format=esm --packages=external --outfile=backend/dist/server.mjs
