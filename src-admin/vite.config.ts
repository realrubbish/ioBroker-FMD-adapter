/**
 * Vite build config for the admin UI.
 *
 * Produces two entry points (non-materialize + materialize) into the
 * committed `admin/` folder, matching the ioBroker admin SPA's
 * expectations: clicking the wrench on an instance row loads
 *   /adapter/iobroker-fmd/index.html?<instance>&newReact=true&<instance>&react=<theme>
 * and the materialize variant loads index_m.html.
 *
 * Build artifacts are committed so the Docker dev container does not
 * need a Node toolchain at deploy time. See CLAUDE.md "Deployment &
 * Testing Workflow" for the order of operations.
 */
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import JSON5 from "json5";

const root = __dirname;
const outDir = resolve(root, "..", "admin");

/**
 * Tiny inline plugin: lets us `import schema from "../admin/foo.json5"`.
 * json5 supports comments, unquoted keys, trailing commas — the schema
 * format that ioBroker adapters use for their admin form definitions.
 *
 * The `resolveId` hook whitelists paths outside Vite's `root` (the
 * jsonConfig.json5 file lives in admin/, sibling to src-admin/). The
 * `transform` hook parses the file with JSON5 and emits a default
 * export that Rollup can tree-shake.
 */
function json5Plugin(): Plugin {
    return {
        name: "iobroker-fmd:json5",
        enforce: "pre",
        resolveId(source, importer) {
            if (!source.endsWith(".json5")) return null;
            if (source.startsWith(".")) {
                // Resolve relative to the importer so Vite's default
                // fs-allow check sees a path it can read.
                const importerPath = importer
                    ? resolve(importer, "..", source)
                    : resolve(root, source);
                return importerPath;
            }
            return null;
        },
        load(id) {
            if (!id.endsWith(".json5")) return null;
            const fs = require("node:fs") as typeof import("node:fs");
            return fs.readFileSync(id, "utf8");
        },
        transform(_code, id) {
            if (!id.endsWith(".json5")) return null;
            const parsed = JSON5.parse(_code);
            return {
                code: `export default ${JSON.stringify(parsed)};`,
                map: { mappings: "" },
            };
        },
    };
}

export default defineConfig({
    root,
    plugins: [react(), json5Plugin()],
    build: {
        outDir,
        // We manage the contents of admin/ ourselves: the build only
        // owns index.html, index_m.html, and assets/. The npm wrapper
        // (scripts/build-admin.mjs) wipes those before each run and
        // restores settings.json from git and jsonConfig.json5 from
        // src-admin/schema.json5. Disabling Vite's own emptyOutDir
        // avoids clobbering those hand-managed files.
        emptyOutDir: false,
        chunkSizeWarningLimit: 4096,
        rollupOptions: {
            input: {
                index: resolve(root, "index.html"),
                index_m: resolve(root, "index_m.html"),
            },
            output: {
                entryFileNames: "assets/[name]-[hash].js",
                chunkFileNames: "assets/[name]-[hash].js",
                assetFileNames: "assets/[name]-[hash][extname]",
            },
        },
    },
});
