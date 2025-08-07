#!/usr/bin/env bash

set -euo pipefail

# --- Constants & Configuration ---
# Color definitions for vibrant terminal output
readonly C_RESET='\033[0m'
readonly C_BLUE='\033[0;34m'
readonly C_GREEN='\033[0;32m'
readonly C_YELLOW='\033[0;33m'
readonly C_RED='\033[0;31m'
readonly C_CYAN='\033[0;36m'
readonly C_BOLD='\033[1m'
readonly C_UNDERLINE='\033[4m'

# Script and Project directory paths
readonly SCRIPT_PATH=$(readlink -f -- "${BASH_SOURCE[0]}")
readonly SCRIPT_DIR=$(dirname -- "${SCRIPT_PATH}")
readonly PROJECT_ROOT=$(dirname -- "${SCRIPT_DIR}")

# Build directories
readonly OUT_DIR="out"
readonly DIST_DIR="${OUT_DIR}/dist"

# --- Utility Functions ---

# A standardized logging function for consistent output.
# Arguments: $1: Color, $2: Icon, $3: Message
log() {
  printf "${1}${C_BOLD}%s %s${C_RESET}\n" "$2" "$3"
}

check_cmd() {
  if command -v "$1" > /dev/null 2>&1; then
    return 0
  fi
  return 1
}

# Displays a usage message and exits the script.
usage() {
  echo "A script to build the browser extension for Chrome and Firefox."
  echo
  log "${C_BLUE}" "Usage:" "$0 [-m] {chrome|firefox|clean}"
  log "${C_YELLOW}" "  -m" "Optional flag to build with minimal files."
  exit 1
}

# Checks for required command-line tools.
check_dependencies() {
  log "${C_BLUE}" "🔎" "Checking for required tools..."
  local missing_deps=0
  for cmd in jq zip rsync; do
    if ! check_cmd "${cmd}"; then
      log "${C_RED}" "❌" "Required command not found: '${cmd}'. Please install it."
      missing_deps=1
    fi
  done
  if [[ $missing_deps -ne 0 ]]; then
    exit 1
  fi
}

# Fetches the extension version from package.json using jq.
get_version() {
  jq -r '.version' "${PROJECT_ROOT}/package.json"
}

# Removes previous build artifacts.
clean() {
  log "${C_YELLOW}" "🧹" "Cleaning up previous build artifacts..."
  rm -rf "${PROJECT_ROOT}/${OUT_DIR}"
}

show_tree() {
  local dir="$1"
  [ -d "$dir" ] || dir="."

  log "${C_BLUE}" "📂" "Files included in the package:"
  if check_cmd eza; then
    eza --color --icons --tree "$dir"
  elif check_cmd tree; then
    tree -s -h --du -C "$dir"
  elif check_cmd perl; then
    # Thanks Stack Overflow
    find "$dir" | perl -pe 's/:$//;s/[^-][^\/]*\//    /g;s/^    (\S)/└── \1/;s/(^    |    (?= ))/│   /g;s/    (\S)/└── \1/'
  else
    # Thanks again Stack Overflow
    find "$dir" | sed -e "s/[^-][^\/]*\//  |/g" -e "s/|\([^ ]\)/|-\1/" 
  fi
}

use_minimal_icons() {
  local target_file="$1"
  local browser="$2"
  local tmp_file=$(mktemp)
  local action="action"
  local query=

  [[ "$browser" == "firefox" ]] && action="browser_action"
  query=".icons |= { \"48\": .\"48\" } | .${action}.default_icon = .icons.\"48\""

  jq "$query" "$target_file" > "${tmp_file}"
  mv "${tmp_file}" "$target_file"
}


# --- Core Build Logic ---

# Main function to build the extension for a specific target.
# Arguments: $1: Browser name (chrome/firefox), $2: Minimal flag (true/false)
build_extension() {
  local browser="$1"
  local is_minimal="$2"
  local browser_capitalized="${browser^}"
  
  local version
  version=$(get_version)
  local target_zip="link-previewer-${browser}-v${version}.zip"

  log "${C_BLUE}" "🚀" "Building ${browser_capitalized} extension (v${version})..."

  # 1. Prepare directories
  clean
  mkdir -p "${PROJECT_ROOT}/${DIST_DIR}"

  # 2. Copy common files
  log "${C_BLUE}" "📦" "Copying common files..."
  local rsync_opts=('-a' --exclude='*.gif')
  if [[ "$is_minimal" == "true" ]]; then
    rsync_opts+=(--include='icons/link-previewer 48x48.png')
    rsync_opts+=('--exclude' 'icons/*')
    log "${C_YELLOW}" "🤏" "Excluding non-essential files for a minimal build."
  fi
  rsync "${rsync_opts[@]}" "${PROJECT_ROOT}/Common/" "${PROJECT_ROOT}/${DIST_DIR}/"

  # 3. Copy browser-specific files
  log "${C_BLUE}" "📦" "Copying ${browser_capitalized}-specific files..."
  cp -r "${PROJECT_ROOT}/${browser_capitalized}/"* "${PROJECT_ROOT}/${DIST_DIR}/"

  # 4. Update manifest version
  log "${C_BLUE}" "🔧" "Updating manifest version to ${version}..."
  local manifest_path="${PROJECT_ROOT}/${DIST_DIR}/manifest.json"
  local temp_manifest
  temp_manifest=$(mktemp)
  jq --arg new_version "$version" '.version = $new_version' "$manifest_path" > "$temp_manifest"
  mv "$temp_manifest" "$manifest_path"
  [[ "$is_minimal" == "true" ]] && use_minimal_icons "$manifest_path" "$browser"

  # 5. Apply browser-specific modifications
  if [[ "$browser" == "firefox" ]]; then
    log "${C_BLUE}" "🔧" "Applying Firefox compatibility changes..."
    # Use sed compatible with both Linux and macOS
    find "${PROJECT_ROOT}/${DIST_DIR}" -type f -name '*.js' -exec sed -i.bak 's/chrome/browser/g' {} +
    find "${PROJECT_ROOT}/${DIST_DIR}" -type f -name '*.js.bak' -delete
  fi
  
  # 6. Zip the final package
  log "${C_BLUE}" "📎" "Zipping files into '${target_zip}'..."
  (cd "${PROJECT_ROOT}/${DIST_DIR}" && zip -r "${PROJECT_ROOT}/${OUT_DIR}/${target_zip}" .) > /dev/null

  # 7. Final Output
  show_tree "${PROJECT_ROOT}/${DIST_DIR}"
  log "${C_GREEN}" "✅" "Build complete! Find the package at:"
  printf '%b%s%b\n' \
    "${C_UNDERLINE}${C_CYAN}${C_BOLD}" \
    "${PROJECT_ROOT}/${OUT_DIR}/${target_zip}" \
    "$C_RESET"
}

# --- Main Execution ---

main() {
  # Set script to run from the project's root directory
  cd "${PROJECT_ROOT}"

  # Check dependencies first
  check_dependencies

  local flag_minimal=false
  local action=""

  # Parse command-line arguments
  if [[ $# -eq 0 ]]; then
    action="chrome"
  fi

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -m|-M|--minimal)
        flag_minimal=true
        shift
        ;;
      chrome|Chrome)
        action="chrome"
        shift
        ;;
      firefox|Firefox)
        action="firefox"
        shift
        ;;
      clean)
        action="clean"
        shift
        ;;
      *)
        log "${C_RED}" "❌" "Invalid argument: $1"
        usage
        ;;
    esac
  done

  # Execute the chosen action
  case "$action" in
    chrome|firefox)
      build_extension "$action" "$flag_minimal"
      ;;
    clean)
      clean
      log "${C_GREEN}" "✅" "Cleanup complete."
      ;;
    *)
      log "${C_RED}" "❌" "No valid action specified."
      usage
      ;;
  esac
}

# Run the main function with all provided script arguments
main "$@"