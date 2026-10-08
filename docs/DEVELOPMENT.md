# Development

PromptHound is an Electron app with a React (Vite, TypeScript) interface. The extraction
engine in `core/` has no Electron or DOM dependency and is shared by the interface and the
main process.

## Layout

```text
PromptHound/
├── .github/workflows/           # ci.yml (typecheck, tests, build) and release.yml (Windows installer)
├── build/                       # Installer artwork, icon and NSIS script (installer.nsh)
├── core/                        # Extraction engine
│   ├── link-fetch.ts            # Entry points: extract from image bytes or a link
│   ├── png.ts, jpeg.ts, webp.ts # Metadata chunk readers
│   ├── format-detect.ts         # A1111 / ComfyUI / NovelAI / SwarmUI detection
│   ├── parsers/                 # A1111 settings parser and ComfyUI graph tracing
│   ├── civitai-extractor.ts     # Civitai generation-metadata engine, merged with the native readers
│   ├── content-credentials.ts   # C2PA / IPTC "AI-generated" labels (ChatGPT, Gemini, ...)
│   ├── lora-resolution.ts       # LoRA and checkpoint identification (catalog, then Civitai)
│   ├── lora-cache.ts            # In-memory and SQLite catalog of known models
│   ├── seaart.ts                # SeaArt search links
│   └── data/                    # Generated offline catalog (see below)
├── docs/                        # This file, the original blueprint and UI spec, archived notes
├── electron/
│   ├── main.ts                  # Window, IPC, SQLite library, updates, file dialogs
│   ├── shell-integration.ts     # Explorer right-click menu and opening files from it
│   └── preload.ts               # window.promptHound bridge for the UI
├── public/samples/              # Example images shown in a new Prompt Library
├── scripts/                     # Dev runner, catalog builder, LoRA benchmark, installer artwork
├── src/                         # React UI
│   ├── components/              # Shell, primitives, library, LoRA cards, recipe panels, setup wizard
│   ├── extraction/              # Extraction state (single images and batches)
│   ├── navigation/              # Routing and the Prompt Library state
│   ├── pages/                   # Home, Result, Library, Favorites, Settings, About
│   └── utils/                   # Images, library backup and search, paste handling
└── tests/                       # npm test
```

`docs/BLUEPRINT.md` and `docs/UI_SPEC.md` are the original requirements and interface
specification and no longer match the current look in every detail; `docs/archive/` keeps
older plans and analyses for history.

## Running it

Needs Node.js 20 or 22.

```bash
npm install
node scripts/dev.mjs     # desktop app: Vite, the Electron main process and Electron together
npm run dev              # web preview at http://localhost:3000 (no file access, Explorer menu or encrypted settings)
```

## Checks

```bash
npm run lint   # typecheck the UI, core and Electron main process
npm test       # extraction, library search, backup and link tests (offline)
npm run build  # build the renderer
```

CI runs all three on every push to `main` and on every pull request.

## Where data lives

The desktop app keeps everything in `%APPDATA%\PromptHound`: the SQLite database
(`lora_catalog.sqlite`: model catalog, saved prompts, settings), and `library-images\<item>\`
(original and thumbnail of every library image, served to the UI as `ph-image://`). The
Civitai API key is stored encrypted with Electron `safeStorage`, never in the source or in
the build.

## Offline LoRA catalog

PromptHound identifies LoRAs offline from two generated files. Never edit their hashes, ids
or trigger words by hand.

- `core/data/lora-seed.json`: full records (name, trigger words, cover, SHA256 and AutoV3
  hashes) for the 2,000 most-downloaded LoRA / LoCon / DoRA models, 3 versions each, plus
  the versions in `scripts/catalog-includes.json`, and 1,000 checkpoints.
- `core/data/lora-version-index.json`: a compact index (ids, names, AutoV2 and AutoV3 hash
  prefixes) of every other version of those models and of the next 8,000 models.

```bash
# Check the catalog against Civitai (writes nothing; exits 1 on mismatches)
npm run catalog:verify

# Rebuild both files
CIVITAI_API_KEY=... npm run catalog:build -- --models 2000 --versions 3 --compact-models 10000
```

Useful options: `--dry-run`, `--extra file.json` (merge hand-made records), `--all-covers`
(covers of any rating; PG only by default). See the header of
`scripts/build-lora-catalog.ts`. The app replaces its stored copy of the catalog
automatically when the bundled file changes; LoRAs users found or linked themselves are kept.

### Measuring LoRA identification

```bash
CIVITAI_API_KEY=... npm run benchmark:collect    # ~360 real Civitai images + ground truth into .benchmark/
npm run benchmark:eval -- offline                # bundled catalog only
CIVITAI_API_KEY=... npm run benchmark:eval -- online
```

In a sandbox whose proxy Node does not pick up automatically, prefix the commands with
`NODE_USE_ENV_PROXY=1`. Pass the API key through the environment only; never write it to a
file in the repository.

## Installer artwork

`build/installerSidebar.bmp` and `build/installerHeader.bmp` are committed. Regenerate them
after changing the artwork with `npm run build:installer-assets` (needs Playwright and
Chromium); CI does not render them.

## Releasing

1. On a branch: bump `version` in `package.json` and in `package-lock.json` (the two entries
   at the top) and add a `## vX.Y.Z` section at the top of `CHANGELOG.md`. The GitHub release
   notes are taken from that section.
2. Open a pull request, wait for CI, and merge.
3. Run **Actions > Build & Release Windows Desktop App** on `main` with the same version
   (it must match `package.json`). The workflow builds the installer and the portable `.exe`,
   creates the tag `vX.Y.Z` and the GitHub release, and attaches `latest.yml`, which the
   in-app updater reads. Untick **publish** for a test build: the installer is then kept as a
   run artifact for 14 days and nothing is released.

The release job installs without the lockfile (`npm install --force`), so dependency
versions can differ from the ones CI tested. The app is not code-signed.

## Updates

`electron/main.ts` uses `electron-updater` with the GitHub provider (`build.publish` in
`package.json`): it reads `latest.yml` from the latest release, downloads the installer in the
background, verifies its checksum and installs it on quit or when the user clicks **Restart to
update**. The portable build cannot update itself. Because the provider reads the repository's
releases without credentials, **the releases must be publicly readable** for updates to work.
