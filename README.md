# Copy GitHub URL VS Code extension

Available within VS Code and Cursor.

Please file an [issue](https://github.com/differentmatt/vscode-copy-github-url/issues) for bugs or feature requests.  Thanks!

VS Code Extension Marketplace entry [here](https://marketplace.visualstudio.com/items?itemName=mattlott.copy-github-url).

## Copy GitHub URL

Copy a GitHub URL of your current file location to the clipboard. Works for both text files (with line numbers) and non-text files like images, PDFs, and other binary files (without line numbers).

Usage: `Ctrl+L C` (same on all platforms)

For all file types (text and non-text), you can:
- Use the keyboard shortcut while the file is open and active (`Ctrl+L C`)
- Right-click the file in the Explorer panel and select "Copy GitHub URL" from the context menu

Example (text file): [`https://github.com/differentmatt/vscode-copy-github-url/blob/example-branch/extension.js#L4`](https://github.com/differentmatt/vscode-copy-github-url/blob/example-branch/extension.js#L4)

Example (image file): [`https://github.com/differentmatt/vscode-copy-github-url/blob/example-branch/images/icon.png`](https://github.com/differentmatt/vscode-copy-github-url/blob/example-branch/images/icon.png)

## Copy GitHub URL Permanent

Copy a GitHub Permanent URL of your current file location to the clipboard. Works for both text files (with line numbers) and non-text files like images (without line numbers).

Usage: `Ctrl+Shift+L C` (same on all platforms)

The same context menu options are available in the Explorer panel for this command.

Example (text file): [`https://github.com/differentmatt/vscode-copy-github-url/blob/c49dae32/extension.js#L4`](https://github.com/differentmatt/vscode-copy-github-url/blob/c49dae32/extension.js#L4)

Example (image file): [`https://github.com/differentmatt/vscode-copy-github-url/blob/c49dae32/images/icon.png`](https://github.com/differentmatt/vscode-copy-github-url/blob/c49dae32/images/icon.png)

## Copy GitHub URL Default Branch

Copy a GitHub default branch URL of your current file location to the clipboard. Works for both text files (with line numbers) and non-text files like images (without line numbers).

Usage: `Ctrl+Shift+L M` (same on all platforms)

The same context menu options are available in the Explorer panel for this command.

Example (text file): [`https://github.com/differentmatt/vscode-copy-github-url/blob/main/extension.js#L4`](https://github.com/differentmatt/vscode-copy-github-url/blob/main/extension.js#L4)

Example (image file): [`https://github.com/differentmatt/vscode-copy-github-url/blob/main/images/icon.png`](https://github.com/differentmatt/vscode-copy-github-url/blob/main/images/icon.png)

## Install

1. Within Visual Studio Code, open the command palette (`Ctrl-Shift-P` / `Cmd-Shift-P`)
2. Type `install extension` and search for `copy github url`

## Telemetry

This extension collects anonymous telemetry data to help improve the extension's functionality.

You can disable [telemetry](https://code.visualstudio.com/docs/getstarted/telemetry) collection by setting `telemetry.telemetryLevel` to `off` in VS Code settings.

No personal or repository-identifying information is collected.

## Troubleshooting

### Non-text files

If you encounter an error like "Failed to copy GitHub URL. Error: No active file found" when trying to copy a URL for non-text files (like images, PDFs, or binary files), try the following:

1. Make sure the file is open and is the active tab in VS Code
2. Right-click the file in the Explorer panel instead and use the context menu
3. Use the keyboard shortcut (`Ctrl+L C`) while the non-text file is the active tab
4. Try using the "Debug Copy GitHub URL (Non-text files)" command from the command palette to diagnose the issue
5. If the issue persists, please file an [issue](https://github.com/differentmatt/vscode-copy-github-url/issues) with the debug information

Note: The keyboard shortcuts may sometimes not work for non-text files depending on your VS Code configuration. The Explorer context menu is the most reliable method.

### Known Issues

1. **Keyboard shortcuts for non-text files**: While we've improved support for keyboard shortcuts with non-text files, they may not work in all VS Code configurations. Using the Explorer context menu is the most reliable method.

2. **Git repository detection**: For files outside the current workspace's Git repository, you may need to configure the `copyGithubUrl.rootGitFolder` setting to point to the correct Git repository location.
