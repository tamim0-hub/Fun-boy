#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const uuidPath = path.join(__dirname, '..', 'node_modules', 'uuid', 'package.json');

try {
  if (fs.existsSync(uuidPath)) {
    const pkg = JSON.parse(fs.readFileSync(uuidPath, 'utf8'));
    if (!pkg.exports) {
      pkg.exports = {
        ".": {
          "require": "./dist/index.js"
        },
        "./v1": "./dist/v1.js",
        "./v3": "./dist/v3.js", 
        "./v4": "./dist/v4.js",
        "./v5": "./dist/v5.js",
        "./package.json": "./package.json"
      };
      fs.writeFileSync(uuidPath, JSON.stringify(pkg, null, 2));
      console.log('✅ Patched uuid package.json to support legacy subpath imports');
    }
  }
} catch (e) {
  console.log('⚠️ Could not patch uuid:', e.message);
}