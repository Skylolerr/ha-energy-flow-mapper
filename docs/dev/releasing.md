# Releasing

Releases are made only when the maintainer asks for one.

## Versioning

- SemVer. `custom_components/energy_flow_mapper/manifest.json` `version` is the single source.
- Tags and GitHub releases are `vX.Y.Z` and must match it.
- Before 1.0, a minor release may contain breaking changes; mark them clearly in
  `CHANGELOG.md`.
- Releases are normal GitHub releases with notes, **not pre-releases** (HACS hides
  pre-releases unless beta is switched on).

## Preparing ("Prepare X.Y.Z" commit)

1. `CHANGELOG.md`: rename `[Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD`, start a new empty
   `[Unreleased]`.
2. Bump the version in `manifest.json`, `panel/package.json` and `panel/package-lock.json`
   (`npm version X.Y.Z --no-git-tag-version` in `panel/`).
3. Rebuild the bundles if anything in `panel/` changed, run all tests, commit, push.
4. Wait until **Validate** and **Tests** are green for that commit.

## Publishing

```bash
scripts/release.sh --dry-run   # checks only, builds the ZIP, prints the notes
scripts/release.sh             # creates the release vX.Y.Z
```

The script refuses unless main is clean and in sync with origin, the CHANGELOG has the
section, the tag is new, and Validate and Tests are green for the commit. The release notes
are the CHANGELOG section. It attaches `energy_flow_mapper.zip` right away, because HACS
installs that ZIP (`zip_release` in `hacs.json`). `release.yml` then checks the tag again
and attaches a ZIP only if the release has none.

## Minimum Home Assistant version

`hacs.json` `homeassistant` is raised together with the maintainer, only after the new
release was tested. Raise `requirements_test.txt` at the same time (see
[testing.md](testing.md)).

## HACS default repository

The integration is in the HACS default list since 2026-11-04 (hacs/default#12520), so a new
release reaches HACS users without further steps. Anything towards `hacs/default` is done by
the owner account Skylolerr, only after the maintainer's explicit OK.
