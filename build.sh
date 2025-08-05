#!/bin/bash

# A script to build the browser extension for Chrome and Firefox.
#
# Usage:
#   ./build.sh chrome      - Builds the Chrome extension
#   ./build.sh firefox     - Builds the Firefox extension
#   ./build.sh clean       - Removes build artifacts

FLAG_MINIMAL=false
FLAGS=

jq_available="$(command -v jq)"
# macOS's sed requires an extension for the -i flag, even if it's empty.
sed_inplace=
if [[ "$(uname)" == "Darwin" ]]; then
  sed_inplace="sed -i ''"
else
  sed_inplace="sed -i"
fi


set -e

# Function to get the version from package.json using jq
get_version() {
  if [ -z "$jq_available" ]; then
    grep -Po '(?<="version": ").*(?=",)' package.json
  else
    jq -r '.version' package.json
  fi
}

update_manifest() {
  local version="$1"
  if [ -z "$jq_available" ]; then
    $sed_inplace "s|\"version\": \".*\"|\"version\": \"${version}\"|" dist/manifest.json
  else
    echo "🔧 Updating manifest version to ${version} using jq..."
    # Create a temporary file to hold the updated manifest
    local temp_manifest=$(mktemp)
    # Use jq to update the version and write to the temp file
    jq --arg new_version "$version" '.version = $new_version' dist/manifest.json > "$temp_manifest"
    # Overwrite the original manifest with the updated one
    mv "$temp_manifest" dist/manifest.json
  fi
}

clean() {
  echo "🧹 Cleaning up previous build artifacts..."
  rm -rf dist
  rm -f link-previewer-*.zip
}

copy_common_files() {
  local exclude_patterns=('*.gif')
  if $FLAG_MINIMAL; then
    exclude_patterns+=('icons')
  fi

  local rsync_opts=('-a')
  for pattern in "${exclude_patterns[@]}"; do
    rsync_opts+=('--exclude' "$pattern")
  done

  echo "📂 Copying Common files..."
  rsync "${rsync_opts[@]}" Common/ dist/
}

zip_files() {
  local target="$1"
  echo "📎 Zipping into ${target}..."
  (cd dist && zip -r ../"${target}" .) > /dev/null 2>&1
}

build_chrome() {
  local version=$(get_version)
  local target="link-previewer-chrome-v${version}.zip"

  echo "🚀 Building for Chrome (v${version})..."
  clean
  mkdir -p dist

  copy_common_files

  echo "📂 Copying Chrome-specific files..."
  cp -r Chrome/* dist/

  update_manifest "$version"

  zip_files "${target}"

  echo
  echo "✅ Chrome build complete: ${target}"
}

build_firefox() {
  local version=$(get_version)
  local target="link-previewer-firefox-v${version}.zip"

  echo "🚀 Building for Firefox (v${version})..."
  clean
  mkdir -p dist

  copy_common_files

  echo "📂 Copying Firefox-specific files..."
  cp -r Firefox/* dist/

  update_manifest "$version"

  echo "🔧 Replacing 'chrome' with 'browser' for Firefox compatibility..."
  find ./dist -type f -name '*.js' -print0 | xargs -0 $sed_inplace 's/chrome/browser/g'

  zip_files "${target}"

  echo
  echo "✅ Firefox build complete: ${target}"
}

if [ -z "$jq_available" ]; then
  echo "ℹ️ jq command is advised for building this extension!"
fi

while [ $# -gt 0 ]; do
  case "$1" in
    [cC]|[cC]hrome)
      build_chrome
      ;;
    [fF]|[fF]irefox)
      build_firefox
      ;;
    clean)
      clean
      echo "✅ Cleanup complete."
      ;;
    -[mM])
      FLAG_MINIMAL=true
      echo "🤏 Building with minimal files"
      ;;
    *)
      echo "Usage: $0 [-m] {chrome|firefox|clean}"
      exit 1
      ;;
  esac
  shift
done