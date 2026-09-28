# Changelog

## 1.1.2 — 2026-09-28

- Fix **Windows reporting "no grok CLI"** with the official CLI installed. Detection probed for a file literally named `grok`, but `fs.existsSync` never applies Windows' `PATHEXT` resolution, so the installed `grok.exe` was invisible: `resolveGrokBin()` fell back to the bare name, `grokCliAvailable()` returned `false`, and every CLI-backed path — session pull, CLI/device-code login, automatic renewal — was short-circuited before it ran. Settings showed the orange "CLI not found" warning and the plugin stayed on its built-in fallback adapter, even though `spawn("grok")` itself works on Windows.
- Probe every name the platform would run. The Windows branch now tries the `PATHEXT` suffixes (defaulting to `.COM;.EXE;.BAT;.CMD` when `PATHEXT` is absent) for an explicit `DSH_GROK_BIN` path, for the `${GROK_HOME:-%USERPROFILE%\.grok}\bin\grok` install, and for every `PATH` entry, and it reads quoted entries such as `"C:\Program Files\…"`. Resolution and execution agree, because the existing `grok.exe` found by the probe is the path that gets spawned.
- Make the platform injectable in both helpers so the Windows branch runs on any CI OS. `tests/cli-detection.test.mjs` adds 13 cases — the two requested by the report, `PATHEXT` handling, quoted `PATH`, and a real-temp-directory `grok.exe` smoke test — and asserts unchanged POSIX behaviour.
- No session, login, renewal, model-routing, proxy, or quota behaviour changes. A repository-wide sweep of the remaining `existsSync`/`spawn` path joins found no other defect of this class. Restart DSH fully after updating.

## 1.1.1 — 2026-09-28

- Fix **Update plugin** failing in the desktop app. The update built its command from `process.argv[1]`, which is the entry script of whichever process loaded the plugin — the `dsh` CLI only when the host *is* the CLI. The desktop app loads plugins inside `@deepseek-ai/dsh-desktop-host`, so that argument was the desktop host entry and the update relaunched the application with `plugin …` as script arguments instead of installing anything. The version check kept working, so the update button appeared to run and then reported failure.
- Install updates into the owning profile with pnpm directly, because `dsh plugin --profile desktop` is refused outright: `profile "desktop" is managed exclusively by the Electron application`. The bundled pnpm entry is located by file name in the host's own launch arguments, with the runtime directory carrying the `@deepseek-ai/dsh` package as the fallback, so `PATH` never decides which package manager runs.
- Pin the install (`--save-exact`) and disable pnpm's release-age gate (`--config.minimumReleaseAge=0`), which would otherwise quietly keep the installed version for a release younger than 24 hours — exactly the release this button exists to fetch.
- Read the installed manifest back and compare it with the requested version before reporting success, so an update that installs nothing is reported as a failure rather than a success.
- No model-routing, authentication, proxy, or quota behavior changes. Restart DSH fully after updating so the new version loads.

## 1.1.0 — 2026-09-28

- Add the original Comet Navigator mascot and align the Chinese/English homepages around features, installation, daily use, screenshots, and maintenance.
- Add bilingual usage guides covering the official CLI requirement, subscription sessions, model access, image input, experimental quota, troubleshooting, and safe removal.
- Ship the usage guides alongside the existing screenshots and mascot in npm and release archives.
- Align the manifest, lockfile root, Settings subtitle, and pinned install examples on 1.1.0; add release metadata and documentation packaging regression checks.
- Clarify the image-input model ID as `grok-4.7-build-fast`. This is a documentation correction, not a new image-processing capability.
- No model-routing, authentication, proxy, quota, or dependency behavior changes. This release carries forward the runtime fixes in 1.0.20.

Earlier changes are recorded in the [repository history](https://github.com/BaronCyrus/dsh-grok-subscription/commits/main) and [GitHub Releases](https://github.com/BaronCyrus/dsh-grok-subscription/releases).
