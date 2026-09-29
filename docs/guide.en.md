# Grok subscription user guide

[Project home](../README.en.md) · [简体中文](guide.zh-CN.md) · **English**

For quick setup, see the [README](../README.en.md#install). This guide covers dependencies, capability limits, and troubleshooting.

## Installation and compatibility

You need the DeepSeek Harness desktop app, the official Grok Build CLI, and an account with Grok Build access. The plugin declares Node.js `^22.19.0 || >=24.0.0`; DSH peers use `>=0.1.5-rc.2 <0.3.0-0`, which spans the whole 0.1 and 0.2 lines. See [package.json](../package.json) for the full requirements. Declared compatibility is not a claim that every version has passed live verification.

**Install:** in the desktop app open **Settings → Plugins**, type the package name `dsh-grok-subscription` into the install field, and install it. Then **quit and restart the desktop app completely**; refreshing the page alone does not reload the Host adapter. To pin a version, put the full `package@version` in that field, for example `dsh-grok-subscription@2.0.2`.

**The plugin depends on the host's own pi-ai adapter.** From 2.0.0 the `grok-build` route is served entirely by the host's `@deepseek-ai/dsh-llm-pi-ai` / `@earendil-works/pi-ai`, which every DSH installation carries (`@deepseek-ai/dsh` → `dsh-base` → `dsh-llm-pi-ai`, with the `llm-pi-ai` row mounted unconditionally). If those packages cannot be resolved from the DSH installation, the plugin registers no route at all and **Active path** in Settings reads **unavailable**.

If the UI install fails (an unusual profile directory, say), the equivalent runs against the desktop profile itself (pnpm ≥ 11):

```sh
cd "$HOME/.dsh/profiles/desktop"    # Windows: cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add --save-exact --config.minimumReleaseAge=0 dsh-grok-subscription@2.0.2
```

`dsh plugin --profile desktop …` is refused: the Electron application owns that profile exclusively.

## Sign-in and credentials

**The official Grok Build CLI must be available on the DSH Host**, not just on the phone or another computer viewing the Web UI. The plugin checks `DSH_GROK_BIN`, then `${GROK_HOME:-$HOME/.grok}/bin/grok`, then `grok` on `PATH`. On Windows the `PATHEXT` suffixes (`.exe`, `.cmd`, …) are completed too, so a `grok.exe` install is recognised. See [session.js](../src/session.js).

Use **CLI login** or **Device-code login** in Settings. The plugin invokes the official CLI and shows the available authorization link and one-time code in the panel. Alternatively, run this locally:

```sh
grok login
```

After authorizing, select **Pull from Grok CLI**. An `XAI_API_KEY`-only configuration is not a Grok Build subscription session. Never copy `auth.json`, access tokens, or refresh tokens into chats or public reports.

The plugin reads `${GROK_HOME:-$HOME/.grok}/auth.json` and rejects symlinks, non-regular files, and unsafe ownership or permissions. On macOS / Linux, after confirming the path and owner are correct, fix permission bits with:

```sh
chmod 600 "${GROK_HOME:-$HOME/.grok}/auth.json"
```

This does not fix an incorrect owner or make a symlink safe. The plugin itself does not write the file; the official CLI manages the session file and renewal. DSH stores only the short-lived access token it needs, without returning tokens through browser RPC. See [SECURITY.md](../SECURITY.md).

## Model catalog and reasoning

After sign-in, the plugin prefers the catalog from `/v1/models-v2`; while signed out, models are empty. A failed, timed-out, or empty catalog read uses the built-in `grok-4.7` / `grok-4.6` / `grok-4.5` list and records the error. **This is a catalog fallback, not a different paid service, and listed models are not guaranteed entitlements.**

Reasoning options follow model metadata. The implementation recognizes `low` / `medium` / `high` / `xhigh`, usually defaulting to `high`; the built-in `grok-4.5` entry has only the first three. Follow the actual menu and backend-supported choices. See [catalog.js](../src/catalog.js).

Login, pull, logout, and catalog refresh notify the model picker. Near a known token expiry the plugin renews through the official CLI. If renewal fails, or the server has already revoked the session, authorization may still be required again; uninterrupted sessions are not guaranteed.

## Image input

The source currently advertises image input only for:

```text
grok-4.7
grok-4.7-build-fast
grok-4.6
```

These exact IDs come from `IMAGE_INPUT_MODEL_IDS` in [constants.js](../src/constants.js); `grok-4.5` is excluded. Image input is not image generation, and a model's name alone does not establish image support.

Paste or attach an image in the composer. DSH's attachment service processes it within pixel and byte budgets; over-budget images may degrade to a text description. Do not assume every image is sent at its original resolution.

The `grok-build` route is served by the host's official pi-ai adapter, which also owns the image pipeline (attachment resolution plus pixel and byte budgets). The **Active path** row in Settings names the adapter serving the route and whether image input is available; **unavailable** means the host has no pi-ai adapter. After an update, a refreshed browser can still be running the old version if the Host was not restarted.

## Quota and caching

Usage is read through the undocumented `/v1/billing?format=credits` endpoint and is experimental. Settings displays the used and remaining percentages actually returned. Interface changes, network failures, or invalid authentication can make the data unavailable.

The composer badge appears only for `grok-build` with a successful usage read; hover or click for weekly quota and its reset time. A failed read does not invent a percentage or independently block chat. The one exception is protobuf omitting a zero: a complete weekly or monthly `currentPeriod` that contains the current time, with no percentage field anywhere, displays as 0% used and 100% remaining, and the card says that zero was omitted rather than reported. A window that does not contain now, a prepaid balance or on-demand cap alone, or a product row that already has a percentage still produces no number.

For prefix caching, the plugin pins one stable `prompt_cache_key` per DSH session (`grok:<sessionId>`) and writes it into every request; tool ordering stays stable. Auxiliary requests (compaction, session titles) share the session's key rather than taking a separate one; measured against the proxy, isolating them did not improve the chat prefix's cache reads. These are request-construction measures, not a guarantee of backend cache hits or quota savings. No invented hit rate is reported. See [adapter.js](../src/adapter.js).

## Troubleshooting

**`grok` not found or no login window.** Check that the CLI is installed on the DSH Host and its process sees `DSH_GROK_BIN` / `PATH`. Look for a clickable login link in the panel. A browser failing to open does not by itself prove the authorization service is unreachable. On Windows, if the CLI is not on `PATH`, put the absolute `grok.exe` path in the user-level `DSH_GROK_BIN` (for example `setx DSH_GROK_BIN "C:\Users\<user>\.grok\bin\grok.exe"`) and restart DSH completely; note that `DSH_*` is a DSH bootstrap prefix, so declaring it in `~/.dsh/.env` makes that environment layer fail.

**`fetch failed` or `Billing request timed out`.** Check access to the account service and `cli-chat-proxy.grok.com` separately. When a proxy is needed, set standard `https_proxy` / `http_proxy` variables in DSH's launch environment or `~/.dsh/.env`, not the project directory's `.env`, then manually restart DSH. The plugin uses the host network setup rather than providing its own proxy service. Network conditions are one possibility; also check authentication and backend errors.

**Empty model list.** Complete subscription sign-in and select **Pull from Grok CLI**. Check for an API-key-only login entry and inspect catalog status without sharing raw responses.

**Chat or usage returns `401`.** Check the CLI session. If automatic renewal fails, run `grok login` again, authorize, and pull the session. Do not repeatedly paste an old token.

**Images rejected.** Check the supported IDs, confirm **Active path** reads **official pi-ai** with attachment capability available, and fully restart the desktop app after updating.

**Auth-file permission error.** Check the actual path, owner, symlink status, and permissions. `chmod 600` fixes permission bits only.

**No response on an old release.** Version `1.0.0` had a tool-call serialization defect fixed in `1.0.1`; older versions may also lack later renewal fixes. Update to the current published version before diagnosing a persistent problem rather than attributing every missing response to that old defect.

**The plugin vanished from Settings after a DSH update.** From 0.2.0 DSH refuses a plugin whose `@deepseek-ai/dsh*` peer ranges do not admit the running version, and it drops the whole bundle before any plugin code loads: no `grok-build` route, no Settings section, and nothing in the panel to explain it. The Host writes `skipping profile bundle "dsh-grok-subscription"` to its own stderr (the desktop app refuses `dsh --profile desktop --dump-config`, so that line is the evidence to look for). Update the plugin rather than granting a version exemption: an exemption re-enables a build that was never checked against that Host.

**Active path reads "unavailable".** The host has no pi-ai adapter: `@earendil-works/pi-ai` or `@deepseek-ai/dsh-llm-pi-ai` cannot be resolved from the DSH installation. Check that the installation is complete, that `node_modules` was not pruned by hand, and restart the desktop app completely.

## Updates and sign-out

**Update:** put `dsh-grok-subscription` (or `dsh-grok-subscription@version`) into the **Settings → Plugins** install field again to install over the current copy; the plugin's own page also has a version card and an **Update plugin** button. Then **quit and restart the desktop app completely**.

In the desktop app the `desktop` profile is owned exclusively by the Electron application, and `dsh plugin --profile desktop …` is refused outright (`profile "desktop" is managed exclusively by the Electron application`), so the desktop app can only be updated by the plugin itself. From 1.1.1 the **Update plugin** button installs the exact version inside that profile directory with DSH's own bundled pnpm. If you are still on an older version and the button reports an error, run the equivalent by hand (pnpm ≥ 11):

```sh
cd "$HOME/.dsh/profiles/desktop"    # Windows: cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add --save-exact --config.minimumReleaseAge=0 dsh-grok-subscription@2.0.2
```

Then quit and restart the desktop app completely. After a successful update the profile's `package.json` dependency should show the target version while its `dsh.profile.bundles` entry is unchanged. Refreshing the browser is not enough: without a Host restart the old version keeps loading.

**Uninstall:** remove `dsh-grok-subscription` in **Settings → Plugins**, or run `pnpm remove dsh-grok-subscription` in that profile directory. This leaves the profile, other plugins, and the CLI's `auth.json` intact.

The Settings logout action clears plugin-side session state; it does not revoke the official CLI session. If the CLI file remains, a later pull or startup may sync it again. To end the official session, use the official CLI / account's sign-out and authorization-management flow. Do not delete an entire DSH profile to handle one account.

## Local development

Follow [CONTRIBUTING.md](../CONTRIBUTING.md) to install locked dependencies, test, and build:

```sh
npm ci
npm test
npm run build
```

After source changes, regenerate tracked `lib/` rather than editing it manually. Passing tests and builds do not verify real sign-in, GUI behavior, or live model calls. Restart DSH manually before evaluating Host changes.
