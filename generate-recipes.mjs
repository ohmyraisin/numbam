#!/usr/bin/env node

// Backward-compatible entry point.
// Keeps `node generate-recipes.mjs` working after moving logic to scripts/sync-recipes.js.
import './scripts/sync-recipes.js';
