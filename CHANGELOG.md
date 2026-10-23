# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/). Before 1.0, minor releases may contain
breaking changes; they are marked as **Breaking**.

## [Unreleased]

### Added

- Integration core: config flow (single entry), admin-only WebSocket API to read the
  energy preferences with metadata and unused energy meters, and to validate, save and
  restore changes of the device hierarchy.
- Checks for cycles, missing parents, duplicates and sensors that are both a source and
  a device; warnings for missing statistics and non-energy units.
- Backups of the previous energy settings before every write (last 20).
- Repair issue when the energy settings of the Home Assistant release are not supported.
- Admin panel "Energy Flow Mapper" in the sidebar: sources (read-only), the device tree
  with live power and the consumption not tracked individually, free energy sensors,
  drag and drop or a "Move to" menu, rename and remove, a draft that is saved in one
  step after a confirmation, undo and a list of backups. English and German, light and
  dark themes, phone layout.
