# MMM-Fuel Changelog

## [Unreleased]

### Fixed

### Added

### Changed

### Removed

## [2.2.1]

### Fixed

* Filtering of station ids lead to invalid price request for provider tankerkoenig

### Changed

* Log a warning if no fuel station detail could be fetched
* Updated provider integration documentation

## [2.2.0]

Thanks to @TheDuffman85 for his contribution to this release.

### Added

* Config option `stationIds` to check prices of specific gas stations (Tankerkönig only)
* Github actions

### Changed

* 3rd decimal is now superscripted
* Price and distance values are now localized based on global config option `locale`.

### Removed

* Travis-CI integration

## [2.1.2]

### Added

* Config option `showDistance` https://github.com/fewieden/MMM-Fuel/pull/49
* Missing jsdoc documentation

### Changed

* Dependency update

### Fixed

* Deinit map had a harcoded index for markers.

## [2.1.1]

### Fixed

* Wrong value in config option `sortBy` no longer keeps module in state loading forever.

## [2.1.0]

### Changed

* Using [MMM-Modal](https://github.com/fewieden/MMM-Modal) to display modals like gas station and voice commands.

## [2.0.2]

### Added

* French Translations
* Clarification for config option `updateInterval` in readme

### Changed

* Dependency Update

### Removed

* Github pages

## [2.0.1]

### Fixed

* [Rendering of ellipsis with config `shortenText` active]( https://github.com/fewieden/MMM-Fuel/issues/36)

## [2.0.0]

### Added

* Nunjuck templates
* Provider for NSW Australia

### Changed

* Config files
* async/await on the node side of the module.
* fs-extra for promised based filesystem access.
* Replaced request with node-fetch.
* eslint recommended instead of airbnb ruleset.

### Removed

* Documentation on doclets.io (unmaintained).
* Distance conversion
* Modals (help, map)

## [1.1.1]

### Added

* Disabled markdownlint rule `MD024` (no-duplicate-header)
* Config option `toFixed` to show only 2 decimals for the price.

### Changed

* Coordinate.to() throws exception if start point is not set.

## [1.1.0]

### Added

* API provider development [Guide](apis).
* API provider `spritpreisrechner.at`.
* Disabled markdownlint rule `MD026` (no-trailing-punctuation)
* Disabled eslint rule `no-console`
* Documentation
* [Doclets.io](https://doclets.io/fewieden/MMM-Fuel/master) integration
* Contributing guidelines
* Issue template
* Pull request template

### Changed

* Outsourced API provider `tankerkoenig.de`.

## [1.0.0]

Initial version
