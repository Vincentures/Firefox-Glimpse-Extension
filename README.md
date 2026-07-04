# Glimpse for Firefox

Glimpse is a lightweight Firefox extension that lets you preview links in a floating split-screen panel without leaving the page. Hold Alt and click any eligible link to open it in a compact preview, then close it, expand it to a full tab, or switch to split view when you want to compare content side by side.

## Features

- Preview links in a floating panel with a built-in iframe viewer
- Use Alt+click (or Ctrl/Shift+click, configurable from the popup) to open previews from any page
- Close, expand, or toggle split-screen mode from the preview header
- Resize and drag the preview panel to fit your workflow
- Keyboard shortcuts in the preview: Ctrl+D to bookmark, Ctrl+Shift+L to copy the link, Ctrl+Shift+Enter to expand into a tab, Alt+←/→ to navigate, Esc to close

## How it works

When you hold your chosen modifier key (Alt, Ctrl, or Shift - configurable from the popup) and click a supported link, the extension opens a real popup window displaying the destination. The preview stays in focus but doesn't obscure your original page - use the keyboard shortcuts to bookmark, copy the link, navigate, or expand it into a full tab. Alt+←/→ navigate like a normal browser window, and Esc closes the preview.

## Installation

1. Download or clone this repository.
2. Open Firefox and go to about:addons.
3. Click the gear icon and choose "Install Add-on From File...".
4. Select the extension folder or the generated ZIP archive.
5. Confirm the installation and enable the add-on.

## Usage

- Hold your chosen modifier key (Alt by default) and click any normal http/https link to open a preview.
- Use the buttons in the preview controls (or their keyboard shortcuts) to:
  - go back / forward (Alt+←/→)
  - copy the page link (Ctrl+Shift+L)
  - bookmark the page (Ctrl+D)
  - expand the page into a full tab (Ctrl+Shift+Enter)
  - close the preview (Esc)
- Open the extension popup to pick which modifier key (Alt, Ctrl, or Shift) triggers previews.

## Development

This project is a simple browser extension built with:

- HTML, CSS, and JavaScript
- Manifest V3
- Firefox-specific extension APIs

### Project structure

- manifest.json - extension metadata and permissions
- background.js - header rewriting logic for previewed pages
- content/content.js - preview panel behavior and link handling
- content/content.css - preview panel styling
- popup/popup.html and popup/popup.js - extension popup controls

## License

This project is licensed under the MIT License. See the LICENSE file for details.
