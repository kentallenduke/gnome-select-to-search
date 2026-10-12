# Select to Search

A GNOME 51 extension that adds a rectangle selection to the native screenshot tool.

Drag a rectangle on the frozen screenshot, then release. Select to Search opens at the bottom right, pastes that image once, and sends it to Gemini. Sign in the first time. The helper keeps that login.

If `tesseract` is installed, words on the frozen screen are highlighted. Drag across them to copy the text. Drag empty space to search the picture instead.

This is not a Google product.

## Install

Requirements: GNOME Shell 51, and WebKitGTK 6 (already part of the GNOME desktop). Do not unzip the file.

```bash
cd ~/Downloads
gnome-extensions install --force circle-to-search@lasso-2.0.0.shell-extension.zip
gnome-extensions enable circle-to-search@lasso
```

Then log out and back in. Shell keeps the previous extension in memory until a new login. Do this again after every update. `Alt+F2`, `r` does not reload it on Wayland.

## Use it

| Action | What happens |
| --- | --- |
| Top bar icon | Opens Select mode. Turn the icon on or off in the extension settings. |
| Super+Print | Opens the screenshot tool already in Select mode. |
| Shake the pointer | Opens Select mode. It can be turned off in the extension settings. |
| Print, then Select | The Select button sits next to Selection, Screen, and Window. |
| L | While the screenshot tool is open, switches to Select. (C is already Screen.) |
| Drag and release | Crops the rectangle and opens Select to Search, which pastes and sends. |

A rectangle of 150 pixels or less is ignored. Escape still closes the screenshot tool. Drag the window header to move it. The pin keeps it above other windows on every workspace.

## License

GPL-2.0-or-later. It runs inside GNOME Shell, which is GPL.
