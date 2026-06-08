# Tasks: Add Admin-UI index.html

## 1. Bootstrap the admin source tree

- [x] 1.1 Create `src-admin/` directory with `index.html`, `index_m.html`, `main.ts`, `main_m.ts`, `App.tsx`, `socket.ts`, `vite.config.ts`, and a `tsconfig.json` extending the repo's existing TS config
- [x] 1.2 Add `package.json` dev dependencies: `react@^18`, `react-dom@^18`, `vite@^5`, `@vitejs/plugin-react@^4`, `typescript@^5`, `@types/react@^18`, `@types/react-dom@^18`, `@iobroker/json-config@^8`. Also add `@emotion/react` and `@emotion/cache` as devDeps — they are transitive peer-deps of MUI (used inside JsonConfig) and Vite will fail to bundle without them
- [x] 1.3 Add npm scripts: `build:admin` (vite build), `dev:admin` (vite dev for local iteration)
- [x] 1.4 Add a `.gitignore` entry for `node_modules/` under `src-admin/` and document the commit policy for the built artefacts in `CLAUDE.md`

## 2. Wire `io-package.json` schema and adminUI flags

- [x] 2.1 Add `ringDeviceId` (text, default "") and `buttonStateId` (text, default "") to the native schema in `io-package.json`
- [x] 2.2 Set `common.adminUI.config = "json"`. Do NOT set `common.adminUI.tab` — that would force the admin loader to probe for `tab.html` / `tab_m.html` (which we do not ship) and break the wrench pop-up with a `Cannot find tab(_m).html` alert
- [x] 2.3 Verify the schema validates against ioBroker's adapter schema (run `iobroker upload iobroker-fmd` against the dev container and check the controller log for schema errors)

## 3. Build the Vite config and entry points

- [x] 3.1 Configure `vite.config.ts` with two `rollupOptions.input` entries (`index.html`, `index_m.html`) and an `assets/` output directory under `admin/`
- [x] 3.2 Configure Vite to expose `@iobroker/json-config` and the admin socket client as externals / module-federation remotes, sourced from `node_modules/iobroker.admin/adminWww/`
- [x] 3.3 Verify `npm run build:admin` produces `admin/index.html`, `admin/index_m.html`, and a non-empty `admin/assets/` folder

## 4. Implement the form

- [x] 4.1 Author `admin/jsonConfig.json5` with three panels: Connection (serverUrl, username, password, ringDeviceId, buttonStateId), Status (read-only: connectionState, lastError, testButton), Devices (read-only: deviceInfo, userdataRingInfo, userdataDevicesInfo, deviceList)
- [x] 4.2 Implement `App.tsx` to mount the `JsonConfig` component from `@iobroker/json-config` (named import, not default) with the parsed `jsonConfig.json5` schema and the ioBroker socket. Add `src-admin/socket.ts`, a small adapter-socket wrapper that calls `window.io.connect(location.href, { name: adapterName + "." + instance })` and exposes the `getStates`/`getState`/`setObject`/`sendTo`/`subscribe` API the `JsonConfig` component expects
- [x] 4.3 Implement the live polling: 5-second interval calling `socket.getState('system.adapter.iobroker-fmd.0.*')` for the Status panel and `socket.getStates('0_userdata.0.FindMyDevice.ring.*')` for the Devices panel
- [x] 4.4 Verify the `Test Connection` button works via `socket.sendTo('iobroker-fmd.0', 'testConnection', '')` and renders the result inline
- [x] 4.5 Verify form save calls the standard `setObject('system.adapter.iobroker-fmd.0', { native: {...} })` and triggers an adapter restart

## 5. Update deployment workflow

- [x] 5.1 Add `npm run build:admin` to the deployment workflow in `CLAUDE.md` as the first step (after `git push`)
- [x] 5.2 Add the manual `touch /opt/iobroker/iobroker-data/files/iobroker-fmd/io-package.json` step after `iobroker upload` so the controller picks up `adminUI` flag changes
- [x] 5.3 Verify the existing "fix adapter directory" workaround still applies (it should — the workaround is about the npm name, not the adminUI flags)

## 6. Update documentation

- [x] 6.1 Update `README.md` with a one-paragraph note about the Admin-UI form, the three panels, and the two new schema fields
- [x] 6.2 Add a short `docs/admin-ui.md` explaining the build pipeline (`src-admin/` → `admin/`), the module-federation contract, and how to upgrade the host admin version
- [x] 6.3 Cross-link `docs/admin-ui.md` from `docs/admin-ui-investigation-2026-06-08.md` so the investigation points at the implemented solution

## 7. Test in the Docker dev container

- [ ] 7.1 `git push`, then `docker compose up -d`
- [ ] 7.2 `docker exec iobroker-fmd-dev iobroker url https://github.com/realrubbish/iobroker-fmd`
- [ ] 7.3 Apply the directory workaround and `iobroker upload iobroker-fmd`
- [ ] 7.4 `touch /opt/iobroker/iobroker-data/files/iobroker-fmd/io-package.json` and reload the admin page in the browser (hard reload, Cmd/Ctrl+Shift+R)
- [ ] 7.5 Click the wrench on `iobroker-fmd.0`. Verify the form renders, the Status panel shows current `info.connection`, the Devices panel lists current `0_userdata.0.FindMyDevice.ring.*` states
- [ ] 7.6 Click `Test Connection`. Verify the result message is rendered
- [ ] 7.7 Enter valid FMD credentials, save, restart the instance, set `0_userdata.0.FindMyDevice.ring.<id> = true`, verify a ring command reaches the FMD server (`docker exec iobroker-fmd-dev iobroker logs iobroker-fmd --files=20`)

## 8. Verify the new schema fields round-trip

- [ ] 8.1 Save a non-default `ringDeviceId` and `buttonStateId` from the UI. Verify they are persisted in `system.adapter.iobroker-fmd.0` native config (`iobroker object get system.adapter.iobroker-fmd.0` inside the container)
- [ ] 8.2 Trigger a `triple_push` event on the configured `buttonStateId`. Verify the adapter logs "Button triple_push detected, triggering ring" and the configured `ringDeviceId` is passed to `triggerRing`
- [ ] 8.3 Clear the fields and save. Verify the adapter falls back to the hardcoded defaults (no regression for users who do not configure the new fields)
