# Release rules

Versions are MAJOR.MINOR.PATCH (semver). Tags are vX.Y.Z. package.json, the tag and the title screen always match.

Feature release (0.X.0): new systems, reworks, save migrations, broad balance changes. One theme per release, stated at the top of its CHANGELOG entry.

Patch release (0.X.Y): fixes, balance tweaks, polish, and small self-contained additions. No new core systems, no save format change. If a patch needs a save migration or reworks a system, it is a feature release instead.

Pre-release (0.X.Y-beta.N): test builds for the playtest group, published as GitHub pre-releases. Only players with the beta setting on receive them. Never promoted by retagging; the final build gets its own tag.

1.0.0 is a milestone, not a counter. After 0.9 comes 0.10. 1.0.0 is released only when:
- a full online co-op run with up to 4 players from different networks completes without desync or crash;
- reconnect after a dropped connection works, and the lobby blocks mismatched versions;
- the save format is stable and every later version migrates without loss;
- there are no known crash bugs and the perf budget holds with 4 players;
- the 1.0 scope in ROADMAP.md is complete.

After 1.0: 1.X.0 features, 1.X.Y patches, 2.0.0 only for breaking changes (a save that cannot be migrated).

Every release: CHANGELOG entry, version bump, tests and perf test green, and the updater check from the README.

Only the maintainer releases: `main` only takes reviewed pull requests, and `v*` tags (which build a release that installed games download) can only be created by the maintainer. How changes get to `main`: [CONTRIBUTING.md](CONTRIBUTING.md).
