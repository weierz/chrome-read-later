#!/bin/sh

set -eu

source_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
release_directory=$(mktemp -d "${TMPDIR:-/tmp}/chrome-read-later-release.XXXXXX")
release_output_directory=${CHROME_READ_LATER_RELEASE_DIR:-"$HOME/Desktop"}
mkdir -p "$release_output_directory"
release_output_directory=$(CDPATH= cd -- "$release_output_directory" && pwd)
trap 'rm -R "$release_directory"' EXIT

mkdir "$release_directory/extension"

for entry in icons background content popup archive options modules manifest.json; do
    cp -R "$source_directory/$entry" "$release_directory/extension/"
done
if [ -d "$source_directory/sidepanel" ]; then
    cp -R "$source_directory/sidepanel" "$release_directory/extension/"
fi

cd "$release_directory/extension"
zip -qr "$release_directory/chrome-read-later.zip" . \
    -x '*.test.mjs' '*/.DS_Store' '.DS_Store'
mv -f "$release_directory/chrome-read-later.zip" \
    "$release_output_directory/chrome-read-later.zip"
