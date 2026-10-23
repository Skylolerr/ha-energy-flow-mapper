#!/usr/bin/env bash
# Create the GitHub release for the version in manifest.json.
#
# Usage: scripts/release.sh [--dry-run]
#
# Checks before anything is published: clean main in sync with origin, a
# CHANGELOG section "## [X.Y.Z]", no tag vX.Y.Z yet, and green Validate and
# Tests runs for the current commit. Then creates a normal (not pre-) release
# vX.Y.Z with the CHANGELOG section as notes. --dry-run only runs the checks
# and prints the notes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
GH="${GH:-gh}"
DRY_RUN=false
[ "${1:-}" = "--dry-run" ] && DRY_RUN=true

fail() {
  echo "error: $*" >&2
  exit 1
}

VERSION="$(python -c "import json; print(json.load(open('custom_components/energy_flow_mapper/manifest.json'))['version'])")"
TAG="v${VERSION}"

[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || fail "not on main"
[ -z "$(git status --porcelain)" ] || fail "working tree is not clean"
git fetch --quiet origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || fail "main is not in sync with origin/main"
grep -q "^## \[${VERSION}\]" CHANGELOG.md || fail "CHANGELOG.md has no section '## [${VERSION}]'"
if git ls-remote --exit-code --tags origin "refs/tags/${TAG}" >/dev/null; then
  fail "tag ${TAG} exists already"
fi

COMMIT="$(git rev-parse HEAD)"
for workflow in validate.yml tests.yml; do
  conclusion="$("$GH" run list --workflow "$workflow" --commit "$COMMIT" --json conclusion -q '.[0].conclusion')"
  [ "$conclusion" = "success" ] || fail "${workflow} is '${conclusion:-not run}' for ${COMMIT}"
done

NOTES="$(mktemp)"
trap 'rm -f "$NOTES"' EXIT
awk "/^## \[${VERSION}\]/{found=1; next} /^## \[/{found=0} found && !/^\[/" CHANGELOG.md >"$NOTES"
[ -s "$NOTES" ] || fail "the CHANGELOG section for ${VERSION} is empty"

if $DRY_RUN; then
  echo "All checks passed for ${TAG}. Release notes:"
  cat "$NOTES"
  exit 0
fi
"$GH" release create "$TAG" --target "$COMMIT" --title "$TAG" --notes-file "$NOTES"
