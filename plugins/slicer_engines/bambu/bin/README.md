# Bambu Studio CLI Engine

Place the BambuStudio CLI executable (`bambu-studio.exe`) and its required DLL dependencies into this directory.

## Required Files

From a BambuStudio installation (e.g. `C:\Program Files\Bambu Studio\`):

- `bambu-studio.exe` (or the CLI variant)
- Required `.dll` files (varies by version)

## Notes

- This engine runs in headless (CLI) mode only — no GUI is launched
- The `--datadir` flag is used to isolate from the user's real BambuStudio config
- See `engine.json` in the parent directory for CLI argument mappings
