#!/bin/bash

# A script to build the browser extension for Chrome and Firefox.
#
# Usage:
#   ./build.sh chrome      - Builds the Chrome extension
#   ./build.sh firefox     - Builds the Firefox extension
#   ./build.sh clean       - Removes build artifacts

FLAG_MINIMAL=false
FLAGS=

set -e

clean() {
  echo "🧹 Cleaning up previous build artifacts..."
  rm -rf dist
  rm -f link-previewer-*.zip
}

copy_common_files() {
  local exclude_patterns=('*.gif')
  if $FLAG_MINIMAL; then
    # CORRECT: The path is relative to 'Common/', so it's just 'icons'
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
  (cd dist && zip -r ../${target} .) > /dev/null 2>&1
}

build_chrome() {
  local target="link-previewer-chrome.zip"

  echo "🚀 Building for Chrome..."
  clean
  mkdir -p dist

  copy_common_files

  echo "📂 Copying Chrome-specific files..."
  cp -r Chrome/* dist/

  zip_files "${target}"

  echo
  echo "✅ Chrome build complete: ${target}"
}

build_firefox() {
  local target="link-previewer-firefox.zip"

  echo "🚀 Building for Firefox..."
  clean
  mkdir -p dist

  copy_common_files

  echo "📂 Copying Firefox-specific files..."
  cp -r Firefox/* dist/

  # macOS's sed requires an extension for the -i flag, even if it's empty.
  local sed_inplace
  if [[ "$(uname)" == "Darwin" ]]; then
    sed_inplace="sed -i ''"
  else
    sed_inplace="sed -i"
  fi

  echo "🔧 Replacing 'chrome' with 'browser' for Firefox compatibility..."
  find ./dist -type f -name '*.js' -print0 | xargs -0 $sed_inplace 's/chrome/browser/g'

  zip_files "${target}"

  echo "✅ Firefox build complete: ${target}"
}



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
      echo "Usage: $0 {chrome|firefox|clean}"
      exit 1
      ;;
  esac
  shift
done