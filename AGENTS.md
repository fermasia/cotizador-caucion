# Repository Guidelines

## Project Structure & Module Organization

This repository contains a static, Spanish-language surety insurance quotation app:

- `index.html`: page markup, inline CSS, form controls, and editor modals; loads Google Fonts, jsPDF, and AutoTable from external services.
- `cotizador.js`: default configuration, quote calculations, validation, exchange-rate lookup, browser storage, and PDF generation.
- `sirius_logo.png`: branding asset; the page also embeds logo data for PDF use.
- `LICENSE`: project license.

There are no source subdirectories, test directories, or package manifests. The app attempts to load `datos_cotizador.json`, which is absent from the checkout, and falls back to defaults in JavaScript.

## Build, Test, and Development Commands

- `python3 -m http.server 8000`: serve the repository; open `http://localhost:8000` to develop locally.
- `node --check cotizador.js`: check JavaScript syntax when Node.js is installed.
- `git diff --check`: check changes for whitespace errors before submitting.

No compilation, dependency installation, or configured test command is required. Internet access supports CDN libraries, fonts, and automatic exchange-rate lookup.

## Coding Style & Naming Conventions

Use four-space indentation in JavaScript and follow nearby HTML/CSS formatting. Preserve semicolons and prefer `const` unless reassignment requires `let`. Use camelCase for functions and variables, kebab-case for DOM IDs and CSS classes, and existing Spanish snake_case configuration keys such as `prima_minima`. Keep UI labels and explanatory comments in Spanish. Update DOM references together with renamed controls. No formatter or linter is configured; avoid unrelated reformatting.

## Testing Guidelines

No automated framework or coverage threshold is configured. Manually verify ARS, USD, and EUR quotes; minimum premiums; exchange-rate overrides and lookup failures; standard periods and inclusive custom date ranges; invalid inputs; and document masks. Check editor changes persist after reload and exported PDFs match displayed totals and applicant/risk details. Test narrow-screen layouts and inspect the browser console. Use a fresh browser profile to distinguish defaults from saved configuration.

## Commit & Pull Request Guidelines

History uses short descriptive subjects, often in Spanish, without a consistent prefix convention. Write focused subjects, for example `Corregir cálculo de días personalizados`. In pull requests, explain the behavior changed, link relevant issues, and list validation performed. Include screenshots for UI changes and sample PDFs for export changes. For calculation changes, provide reproducible inputs and expected totals.
