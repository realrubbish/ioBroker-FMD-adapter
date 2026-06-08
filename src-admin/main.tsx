/**
 * Entry point for the non-materialize admin iframe.
 *
 * Vite builds this to admin/index.html + admin/assets/.
 * The `?<instance>&newReact=true&<instance>&react=<theme>` query is
 * appended by the host admin SPA when it loads the iframe.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { loadHostSocketScript } from "./socket";

function boot() {
    // ioBroker.admin passes the instance as a query string. The format is
    //   ?<instance>&newReact=true&<instance>&react=<theme>
    // which means the first positional is the instance number.
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

    // The host admin's socket.io.js must be loaded before the React app
    // mounts so window.io is available when createAdapterSocket runs.
    // We render a tiny placeholder if it fails to load so the user sees
    // a "live data unavailable" message instead of a blank screen.
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
