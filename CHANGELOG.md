# Changelog

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
