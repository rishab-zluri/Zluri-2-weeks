# Fix Nixpacks Build Error

## Problem

The nixpacks.toml was overriding the default build process and causing `npm ci` to fail because it wasn't properly handling the package-lock.json file.

**Error:**
```
npm error The `npm ci` command can only install with an existing package-lock.json
ERROR: failed to build: failed to solve: process "/bin/bash -ol pipefail -c npm ci" did not complete successfully: exit code: 1
```

## Solution

Simplified the nixpacks.toml to only add Python3 packages and let Nixpacks automatically detect and handle the Node.js build process.

## Updated nixpacks.toml

```toml
# Nixpacks configuration for Railway deployment
# Adds Python3 support for script execution

[phases.setup]
nixPkgs = ["nodejs", "python3", "python3Packages.pip"]

[start]
cmd = "npm start"
```

This configuration:
- ✅ Adds Python3 and pip to the container
- ✅ Lets Nixpacks automatically detect package.json
- ✅ Lets Nixpacks automatically run npm install
- ✅ Lets Nixpacks automatically run npm build
- ✅ Uses our custom start command

## Deploy the Fix

```bash
git add backend/nixpacks.toml
git commit -m "Fix nixpacks build - simplify configuration"
git push
```

Railway will automatically redeploy with the corrected configuration.

## What Changed

### Before (BROKEN):
```toml
[phases.install]
cmds = ["npm ci"]  # ❌ This was failing

[phases.build]
cmds = ["npm run build"]  # ❌ Never reached
```

### After (FIXED):
```toml
# No custom install/build phases
# Let Nixpacks auto-detect and handle it ✅
```

## Expected Result

After pushing, Railway logs should show:
```
✅ Installing dependencies...
✅ Building application...
✅ Starting server...
✅ Server running on port 8080
```

No more "npm ci" errors!

## Why This Works

Nixpacks is smart enough to:
1. Detect package.json and package-lock.json
2. Choose the right install command (npm ci or npm install)
3. Run the build script automatically
4. Handle all the file copying correctly

By removing our custom install/build commands, we let Nixpacks do what it does best.

## Still Adds Python3

The important part (`nixPkgs = ["nodejs", "python3", "python3Packages.pip"]`) is still there, so Python3 will be installed and available for script execution.
