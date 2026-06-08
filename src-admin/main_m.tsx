/**
 * Entry point for the materialize admin iframe.
 *
 * Currently identical to main.tsx; the only difference is the CSS class
 * on the root container (fmd-admin-mat-root vs fmd-admin-root) which
 * App.tsx and a future stylesheet can target. We keep a separate entry
 * point so the two builds can diverge later (e.g. different theme tokens
 * or layout) without touching the non-materialize build.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { loadHostSocketScript } from "./socket";

function boot() {
    const params = new URLSearchParams(globalThis.location.search);
    const instance = Number.parseInt(params.get("0") ?? "0", 10) || 0;
    const themeName = params.get("react") || "light";
    const themeType = (themeName === "dark" ? "dark" : "light") as "light" | "dark";

    const container = document.getElementById("root");
    if (!container) {
        // eslint-disable-next-line no-console
        console.error("[iobroker-fmd] #root not found");
        return;
    }

    loadHostSocketScript().catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("[iobroker-fmd] socket.io.js unavailable, rendering read-only:", err);
    });

    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <App
                adapterName="iobroker-fmd"
                instance={instance}
                themeName={themeName}
                themeType={themeType}
            />
        </React.StrictMode>,
    );
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
} else {
    boot();
}
