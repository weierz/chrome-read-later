# Read Later 9.3.0

Branch: `codex/05-reading-list-ui`

Reading list presentation and favicon handling. This candidate includes preceding feature branches and committed master `8e6cc7f`, preserving its fixes and appearance. The original dirty master checkout is excluded.

## Version policy

This is a minor increment. New compatible user capabilities use minor; fixes and performance improvements use patch. No incompatible public API or saved-data migration requires a major increment. Earlier local draft numbers were never published.

## Validate and package

```sh
bun test
CHROME_READ_LATER_RELEASE_DIR=/tmp/read-later-release sh release.sh
```

The ZIP has `manifest.json` at its root and includes all applicable extension entry points. Extract it and load that directory as an unpacked extension in Chrome for acceptance testing.

This is a local release candidate. No remote push, master merge, store upload, or publication has been performed. Real remote sync and Internet Archive services require the user's configured credentials and are not exercised by the automated suite.
