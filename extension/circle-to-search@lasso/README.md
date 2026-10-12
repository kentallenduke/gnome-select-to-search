# Select to Search

A GNOME 51 extension. Drag a rectangle on the frozen desktop, including the whole screen, then release. Select to Search opens its own window and sends that screenshot to Gemini, with no extra text.

Gemini is not opened when you log in. The browser starts only for a search, and closing the window stops that process. Sign in the first time. A selection about 100×100 or smaller is ignored. Press Esc to cancel.

This is not a Google product.

## Install

GNOME 51 already includes the shell. The window also needs GJS, GTK 4, libadwaita, and WebKitGTK 6.0. gtk4-layer-shell keeps the window in the corner. Tesseract is only for copying text out of a picture.

### Packages

Debian and Ubuntu:

```bash
sudo apt install gjs gir1.2-gtk-4.0 gir1.2-adw-1 gir1.2-webkit-6.0 gir1.2-gtk4layershell-1 tesseract-ocr tesseract-ocr-eng
```

Fedora:

```bash
sudo dnf install gjs gtk4 libadwaita webkitgtk6.0 gtk4-layer-shell tesseract tesseract-langpack-eng
```

Arch Linux:

```bash
sudo pacman -S gjs gtk4 libadwaita webkitgtk-6.0 gtk4-layer-shell tesseract tesseract-data-eng
```

For another language, install that Tesseract pack too, for example `tesseract-ocr-jpn`, `tesseract-langpack-jpn`, or `tesseract-data-jpn`.

### Extension

Download `circle-to-search@lasso-2.0.0.shell-extension.zip`. Do not unzip it. From the folder that contains the zip:

```bash
cd ~/Downloads
gnome-extensions install --force circle-to-search@lasso-2.0.0.shell-extension.zip
gnome-extensions enable circle-to-search@lasso
```

`--force` replaces an older copy. Then log out and back in. GNOME keeps the previous extension in memory until a new login. Do this again after every update. `Alt+F2`, `r` does not reload it on Wayland.

## Use it

| Action | What happens |
| --- | --- |
| Top bar sparkle | Opens Select mode. Turn the icon on or off in the extension settings. |
| Shake the pointer | Opens Select mode. Turn it off, or change how hard it is to trigger, in the settings. |
| Super+Print | Opens the screenshot tool already in Select mode. |
| Screenshot tool, then Select | The Select button sits next to Selection, Screen, and Window. Press L while the tool is open. C is already Screen. |
| Drag and release | Sends that rectangle to Gemini. The hint hides while you drag. |
| Drag highlighted words | Copies the text, if Tesseract is installed. Drag empty space to search the picture instead. |
| Drag the window title | Moves the window. |

Settings has one top-bar switch, a shake switch, and a sensitivity slider. Higher sensitivity triggers more easily.

## License

GPL-2.0-or-later. It runs inside GNOME Shell, which is GPL.
