# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-a2] - 2025-09-26

### Fixed
- jest-browser-reporter: fix template strings and improve filters/search stability
  - Fixed unterminated template string errors in generated HTML
  - Normalized attribute spacing to avoid parsing issues
  - Improved filter logic for 'all' / 'pass' / 'fail' states
  - Ensured live-search works consistently with filters and grouping
  - Cleaned up event delegation and debounce handling


## [1.0.0-a1] - 2025-09-25

### Added
- Initial internal release.