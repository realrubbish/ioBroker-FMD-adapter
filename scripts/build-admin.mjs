#!/usr/bin/env node
/**
 * Build the admin UI and reconcile the admin/ directory.
 *
 * Why a wrapper: the ioBroker controller serves the adapter's admin/
 * folder directly. The folder mixes hand-managed files (settings.json,
 * jsonConfig.json5, favicon.ico) with build outputs (index.html,
 * index_m.html, assets/). Vite's default emptyOutDir is too aggressive
 * (it would delete settings.json) and not aggressive enough (it
 * leaves stale assets/* around). This wrapper:
 *
 *   1. Removes only the build outputs (index*.html, assets/).
 *   2. Invokes `vite build` to regenerate them.
 *   3. Copies the source-of-truth schema (src-admin/schema.json5) to
 *      admin/jsonConfig.json5 so the controller can serve it.
 *
 * settings.json and favicon.ico are never touched by this script.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const adminDir = resolve(root, "admin");
const schemaSrc = resolve(root, "src-admin", "schema.json5");
const schemaDst = resolve(adminDir, "jsonConfig.json5");

function rmrf(p) {
    if (existsSync(p)) rmSync(p, { recursive: true, force: true });
}

function reconcileBefore() {
    // Only the build outputs are safe to delete. settings.json and
    // favicon.ico are hand-managed and must survive.
    rmrf(resolve(adminDir, "index.html"));
    rmrf(resolve(adminDir, "index_m.html"));
    rmrf(resolve(adminDir, "assets"));
}

function reconcileAfter() {
    if (!existsSync(adminDir)) {
        mkdirSync(adminDir, { recursive: true });
    }
    // Refresh the served copy of the schema. We do not symlink
    // because some hosts strip symlinks during the upload step.
    copyFileSync(schemaSrc, schemaDst);
}

function runVite() {
    execSync("npx vite build --config src-admin/vite.config.ts", {
        cwd: root,
        stdio: "inherit",
    });
}

reconcileBefore();
runVite();
reconcileAfter();

console.log(`[build-admin] admin/ contents: ${readdirSync(adminDir).join(", ")}`);
