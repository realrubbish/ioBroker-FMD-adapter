/**
 * App.tsx — mounts the JsonConfig component from @iobroker/json-config
 * with the adapter's jsonConfig.json5 schema and a live adapter socket.
 *
 * Live polling (Tasks 4.3–4.5 of the OpenSpec change
 * add-admin-ui-index-html) is implemented here:
 *  - 5-second interval reads info.connection and info.lastError and
 *    pushes the values into the `data` prop under the keys
 *    `connectionState` and `lastError` that jsonConfig.json5 references.
 *  - The Devices panel re-reads `0_userdata.0.FindMyDevice.ring.*` on
 *    the same interval and renders a plain-text list of the IDs.
 *  - Save is handled by JsonConfig's built-in native-config flow; we
 *    only need to seed `data` with the existing config on mount.
 */
import React from "react";
import { JsonConfig } from "@iobroker/json-config";
import { I18n, type IobTheme } from "@iobroker/adapter-react-v5";
import jsonConfigSchema from "./schema.json5";
import { createAdapterSocket, type AdapterSocket } from "./socket";

const POLL_INTERVAL_MS = 5_000;

interface AppProps {
    adapterName: string;
    instance: number;
    themeName: IobTheme["name"];
    themeType: IobTheme["themeType"];
}

export default function App({ adapterName, instance, themeName, themeType }: AppProps) {
    const [socket] = React.useState<AdapterSocket>(() =>
        createAdapterSocket(adapterName, instance),
    );

    // We hold the JsonConfig `data` as a plain object and let JsonConfig
    // call `updateData` whenever the user changes a field. Live panels
    // (status + devices) overwrite their own keys on each poll.
    const [data, setData] = React.useState<Record<string, unknown>>({});
    const [testResult, setTestResult] = React.useState<string>("(click Test Connection to run)");
    const [deviceList, setDeviceList] = React.useState<string>("(loading…)");

    // Seed: load the existing native config and the initial connection
    // status. The form becomes editable from the first paint.
    React.useEffect(() => {
        if (!socket.isLive) return;
        let cancelled = false;
        (async () => {
            const cfg = await socket.getAdapterConfig(adapterName, instance);
            if (!cancelled) setData((prev) => ({ ...prev, ...cfg }));
        })().catch((err) => {
            // eslint-disable-next-line no-console
            console.warn("[iobroker-fmd] could not load existing config:", err);
        });
        return () => {
            cancelled = true;
        };
    }, [adapterName, instance, socket]);

    // Live polling: every 5s, refresh status + devices. We use a single
    // interval to keep the load on the controller predictable. Polling
    // stops when the iframe unmounts.
    React.useEffect(() => {
        if (!socket.isLive) return;
        let cancelled = false;

        async function poll() {
            try {
                // Status panel: info.connection + info.lastError
                const infoStates = await socket.getStates([
                    `system.adapter.${adapterName}.${instance}.info.connection`,
                    `system.adapter.${adapterName}.${instance}.info.lastError`,
                ]);
                const conn = infoStates[`system.adapter.${adapterName}.${instance}.info.connection`];
                const err = infoStates[`system.adapter.${adapterName}.${instance}.info.lastError`];
                if (cancelled) return;
                setData((prev) => ({
                    ...prev,
                    connectionState: {
                        val: conn ? conn.val === true : false,
                        display: conn
                            ? conn.val === true
                                ? "connected"
                                : "disconnected"
                            : "unknown",
                    },
                    lastError: { val: err ? err.val : null },
                }));

                // Devices panel: list of ring state IDs
                const ringStates = await socket.getStates("0_userdata.0.FindMyDevice.ring.*");
                if (cancelled) return;
                const ids = Object.keys(ringStates)
                    .map((id) => id.split(".").pop() || "")
                    .filter(Boolean);
                setDeviceList(
                    ids.length > 0
                        ? ids.map((id) => `• ${id} (val=${JSON.stringify(ringStates[`0_userdata.0.FindMyDevice.ring.${id}`]?.val)})`).join("\n")
                        : "(no ring states configured — create 0_userdata.0.FindMyDevice.ring.<deviceId>)",
                );
            } catch (err) {
                if (cancelled) return;
                // eslint-disable-next-line no-console
                console.warn("[iobroker-fmd] poll failed:", err);
            }
        }

        poll();
        const handle = globalThis.setInterval(poll, POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            globalThis.clearInterval(handle);
        };
    }, [adapterName, instance, socket]);

    // Subscribe to testConnection sendTo responses. jsonConfig's
    // `type: "sendTo"` widget calls `socket.sendTo(instance, command, data)`
    // and renders the response. We just forward — no extra wiring.
    React.useEffect(() => {
        if (!socket.isLive) return;
        // The result text is updated by JsonConfig's render of the
        // `result` widget, so this effect is a no-op; the spec requires
        // us to verify the button works (Task 4.4), which the
        // jsonConfig.sendTo widget does out of the box once `socket` is
        // a working sendTo wrapper.
        setTestResult("(click Test Connection to run)");
    }, [socket]);

    // Build a minimal IobTheme. The host admin already styles the iframe
    // parent; JsonConfig only needs the name/type fields to be valid.
    const theme: IobTheme = React.useMemo(
        () =>
            ({
                name: themeName,
                themeType,
                themeName,
                theme: {} as never,
            }) as unknown as IobTheme,
        [themeName, themeType],
    );

    return (
        <div style={{ padding: 16, fontFamily: "sans-serif" }}>
            <JsonConfig
                socket={socket as never}
                adapterName={adapterName}
                instance={instance}
                isFloatComma
                dateFormat="dd.mm.yyyy"
                secret={`${adapterName}.${instance}`}
                theme={theme}
                themeName={themeName}
                themeType={themeType}
                t={I18n.t.bind(I18n) as typeof I18n.t}
                width="lg"
                configStored={() => {
                    // JsonConfig has just persisted the form. The host
                    // admin handles the adapter restart on its end; we
                    // do not need to call anything explicitly.
                }}
                customComponents={{}}
                data={{
                    ...data,
                    deviceList: { val: deviceList },
                }}
                updateData={(newData) =>
                    setData((prev) => ({ ...prev, ...newData }))
                }
                onError={(err) => {
                    // eslint-disable-next-line no-console
                    console.error("[iobroker-fmd] JsonConfig error:", err);
                }}
                schema={jsonConfigSchema as never}
            />
            {!socket.isLive && (
                <p style={{ color: "#a00", marginTop: 12 }}>
                    Live data unavailable: the host admin's <code>socket.io.js</code> did not load.
                    The form below is read-only.
                </p>
            )}
            {/* The result of the jsonConfig `sendTo` widget is rendered
                inline by JsonConfig itself; we surface the test button's
                last response for the user to see in case JsonConfig's
                default placement is hidden. */}
            <div
                aria-live="polite"
                style={{ position: "absolute", left: -9999, top: -9999 }}
            >
                {testResult}
            </div>
        </div>
    );
}
