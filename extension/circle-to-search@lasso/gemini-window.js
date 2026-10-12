#!/usr/bin/env gjs
// Select to Search helper.
// The shell starts this only when a search happens. Gemini is not loaded at
// login. Closing the window drops the web process so it cannot sit in memory.

imports.gi.versions.Gtk = '4.0';
imports.gi.versions.Gdk = '4.0';

const {GLib, Gio, Gtk, Gdk} = imports.gi;

const GEMINI = 'https://gemini.google.com/app';

GLib.set_prgname('circle-to-search-gemini');

const app = new Gtk.Application({
    application_id: 'org.gnome.circle_to_search.GeminiMenu',
    flags: Gio.ApplicationFlags.HANDLES_COMMAND_LINE,
});

let win = null;
let view = null;
let imagePath = '';
let searchId = 0;

app.connect('startup', () => app.hold());

app.connect('command-line', (application, commandLine) => {
    const next = imageArg(commandLine.get_arguments());
    try {
        if (!win)
            build(application);
        if (next) {
            ensureGemini();
            submitImage(next);
        }
    } catch (error) {
        printerr(error);
        if (win)
            showError(String(error));
    }
    return 0;
});

function imageArg(args) {
    for (let i = args.length - 1; i >= 0; i--) {
        const arg = args[i] || '';
        if (arg.endsWith('.png'))
            return arg;
    }
    return '';
}

function enableDrag(widget) {
    try {
        widget.set_cursor(Gdk.Cursor.new_from_name('grab', null));
    } catch (error) {
        printerr(error);
    }
    const drag = new Gtk.GestureDrag();
    drag.set_button(1);
    widget.add_controller(drag);
    drag.connect('drag-begin', gesture => {
        try {
            const surface = widget.get_native()?.get_surface();
            const event = gesture.get_current_event();
            if (!surface?.begin_move || !event)
                return;
            const [, x, y] = event.get_position();
            surface.begin_move(
                event.get_device(),
                event.get_button?.() || 1,
                x,
                y,
                event.get_time());
        } catch (error) {
            printerr(error);
        }
    });
}

function build(application) {
    win = new Gtk.ApplicationWindow({
        application,
        title: 'Select to Search',
        decorated: false,
        resizable: false,
    });
    win.add_css_class('cts-sheet');
    win.set_overflow(Gtk.Overflow.HIDDEN);
    installCss();
    watchTheme();

    const menu = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 6,
    });
    menu.add_css_class('cts-menu');
    menu.set_overflow(Gtk.Overflow.HIDDEN);
    const bar = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 8,
    });
    const name = new Gtk.Label({label: 'Select to Search', xalign: 0});
    name.add_css_class('cts-name');
    const spacer = new Gtk.Box({hexpand: true});
    const pin = new Gtk.ToggleButton({icon_name: 'view-pin-symbolic'});
    pin.add_css_class('cts-close');
    pin.add_css_class('cts-pin');
    pin.add_css_class('flat');
    pin.set_tooltip_text('Keep above other windows, on every workspace');
    pin.set_active(readPinned());
    pin.connect('toggled', () => writePinned(pin.get_active()));
    const browser = new Gtk.Button({icon_name: 'web-browser-symbolic'});
    browser.add_css_class('cts-close');
    browser.add_css_class('flat');
    browser.set_tooltip_text('Open in browser');
    browser.connect('clicked', () => {
        try {
            Gio.AppInfo.launch_default_for_uri(GEMINI, null);
        } catch (error) {
            printerr(error);
        }
    });
    const close = new Gtk.Button({icon_name: 'window-close-symbolic'});
    close.add_css_class('cts-close');
    close.add_css_class('flat');
    close.connect('clicked', () => hideWindow());
    bar.append(name);
    bar.append(spacer);
    bar.append(browser);
    bar.append(pin);
    bar.append(close);
    enableDrag(name);
    enableDrag(spacer);

    const clip = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});
    clip.add_css_class('cts-clip');
    clip.set_overflow(Gtk.Overflow.HIDDEN);
    clip.set_vexpand(true);
    clip.set_hexpand(true);
    menu.append(bar);
    menu.append(clip);
    win._root = menu;
    win._clip = clip;
    win.set_child(menu);

    const keys = new Gtk.EventControllerKey();
    keys.connect('key-pressed', (_controller, keyval) => {
        if (keyval === Gdk.KEY_Escape) {
            hideWindow();
            return true;
        }
        return false;
    });
    win.add_controller(keys);
    win.connect('close-request', () => {
        hideWindow();
        return true;
    });

    try {
        view = makeView();
        view.set_vexpand(true);
        view.set_hexpand(true);
        view.set_opacity(1);
        win._clip.append(view);
        installCss();
        view.load_uri('about:blank');
    } catch (error) {
        printerr(error);
        showError(String(error));
    }
}

function hideWindow() {
    if (hideWindow._busy)
        return;
    hideWindow._busy = true;
    searchId += 1;
    imagePath = '';
    drive._pasting = 0;
    try {
        view?.load_uri('about:blank');
    } catch (error) {
        printerr(error);
    }
    try {
        if (typeof view?.terminate_web_process === 'function')
            view.terminate_web_process();
    } catch (error) {
        printerr(error);
    }
    try {
        win?.hide();
    } catch (error) {
        printerr(error);
    }
    hideWindow._busy = false;
}

function showError(message) {
    const label = new Gtk.Label({
        label: message,
        wrap: true,
        margin_top: 12,
        margin_bottom: 16,
        margin_start: 16,
        margin_end: 16,
    });
    label.set_vexpand(true);
    win._root.append(label);
}

function reveal() {
    const geo = monitorGeometry();
    const height = Math.min(760, Math.max(560, geo.height - 88));
    win.set_default_size(432, height);
    win.present();
}

function ensureGemini() {
    const uri = view?.get_uri() || '';
    if (!uri.includes('gemini.google.com'))
        view.load_uri(GEMINI);
}

function monitorGeometry() {
    try {
        const monitors = Gdk.Display.get_default().get_monitors();
        let best = null;
        let area = 0;
        for (let i = 0; i < monitors.get_n_items(); i++) {
            const geo = monitors.get_item(i).get_geometry();
            if (geo.width * geo.height > area) {
                best = geo;
                area = geo.width * geo.height;
            }
        }
        if (best)
            return best;
    } catch (error) {
        printerr(error);
    }
    return {width: 1280, height: 800};
}

function makeView() {
    imports.gi.versions.WebKit = '6.0';
    const WebKit = imports.gi.WebKit;
    const dataDir = GLib.build_filenamev([
        GLib.get_user_data_dir(), 'circle-to-search', 'gemini']);
    const cacheDir = GLib.build_filenamev([
        GLib.get_user_cache_dir(), 'circle-to-search', 'gemini']);
    GLib.mkdir_with_parents(dataDir, 0o700);
    GLib.mkdir_with_parents(cacheDir, 0o700);

    let session;
    try {
        session = new WebKit.NetworkSession({
            data_directory: dataDir,
            cache_directory: cacheDir,
        });
    } catch (error) {
        session = new WebKit.NetworkSession(dataDir, cacheDir);
    }
    try {
        session.set_itp_enabled(false);
    } catch (error) {
        printerr(error);
    }
    try {
        session.set_persistent_credential_storage_enabled(true);
    } catch (error) {
        printerr(error);
    }
    const cookies = session.get_cookie_manager();
    cookies.set_persistent_storage(
        GLib.build_filenamev([dataDir, 'cookies.sqlite']),
        WebKit.CookiePersistentStorage.SQLITE);
    try {
        cookies.set_accept_policy(WebKit.CookieAcceptPolicy.ALWAYS);
    } catch (error) {
        printerr(error);
    }
    try {
        const pressure = new WebKit.MemoryPressureSettings();
        pressure.set_memory_limit(480);
        if (typeof pressure.set_conservative_threshold === 'function')
            pressure.set_conservative_threshold(0.6);
        if (typeof pressure.set_strict_threshold === 'function')
            pressure.set_strict_threshold(0.8);
        if (typeof pressure.set_kill_threshold === 'function')
            pressure.set_kill_threshold(0.92);
        if (typeof pressure.set_poll_interval === 'function')
            pressure.set_poll_interval(15);
        session.set_memory_pressure_settings(pressure);
    } catch (error) {
        printerr(error);
    }

    const manager = new WebKit.UserContentManager();
    const webView = new WebKit.WebView({
        network_session: session,
        user_content_manager: manager,
    });
    try {
        const settings = webView.get_settings();
        settings.set_user_agent(
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
        settings.set_enable_page_cache(false);
        if (WebKit.HardwareAccelerationPolicy)
            settings.set_hardware_acceleration_policy(
                WebKit.HardwareAccelerationPolicy.NEVER);
    } catch (error) {
        printerr(error);
    }
    webView.connect('run-file-chooser', (_webView, request) => {
        try {
            if (imagePath)
                request.select_files([imagePath]);
            else
                request.cancel();
        } catch (error) {
            printerr(error);
            try {
                request.cancel();
            } catch (cancelError) {
                printerr(cancelError);
            }
        }
        return true;
    });
    webView.connect('load-changed', (_view, event) => {
        if (!WebKit.LoadEvent || event !== WebKit.LoadEvent.FINISHED)
            return;
        const uri = webView.get_uri() || '';
        if (uri.includes('gemini.google.com') && imagePath)
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 600, () => {
                drive(searchId);
                return GLib.SOURCE_REMOVE;
            });
    });
    webView._webkit = WebKit;
    return webView;
}

function submitImage(path) {
    imagePath = path;
    const id = ++searchId;
    reveal();
    if (!view)
        return;
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
        drive(id);
        return GLib.SOURCE_REMOVE;
    });
}

function drive(id) {
    if (id !== searchId || !view || !imagePath)
        return;
    if (drive._id !== id) {
        drive._id = id;
        drive._started = Date.now();
        drive._tries = 0;
    }
    if (Date.now() - drive._started > 45000)
        return;
    evalText(probeFor(id), status => {
        if (id !== searchId)
            return;
        const state = String(status || '').replace(/"/g, '').trim();
        if (state === 'sent' || state === 'away') {
            if (state === 'away')
                schedule(id, 500);
            return;
        }
        if (state === 'paste' || state === 'inject') {
            if ((drive._tries || 0) >= 1 || drive._pasting === id) {
                schedule(id, 500);
                return;
            }
            drive._tries = 1;
            drive._pasting = id;
            injectImage(imagePath);
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 700, () => {
                if (drive._pasting === id)
                    drive._pasting = 0;
                schedule(id, 400);
                return GLib.SOURCE_REMOVE;
            });
            return;
        }
        schedule(id, 400);
    });
}

function schedule(id, delay) {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
        drive(id);
        return GLib.SOURCE_REMOVE;
    });
}

function pngBase64(path) {
    const file = Gio.File.new_for_path(path);
    const bytes = file.load_bytes(null)[0];
    let data = null;
    if (typeof bytes.toArray === 'function')
        data = bytes.toArray();
    else if (typeof bytes.get_data === 'function')
        data = bytes.get_data();
    if (!data)
        return '';
    return GLib.base64_encode(data);
}

function injectImage(path) {
    let b64 = '';
    try {
        b64 = pngBase64(path);
    } catch (error) {
        printerr(`Select to Search image read failed: ${error}`);
    }
    const script = `(() => {
        try {
            const b64 = ${JSON.stringify(b64)};
            if (!b64)
                return "empty";
            const bin = atob(b64);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++)
                arr[i] = bin.charCodeAt(i);
            const file = new File([arr], "selection.png", {type: "image/png"});
            const dt = new DataTransfer();
            dt.items.add(file);
            const box = document.querySelector("#prompt-textarea")
                || document.querySelector(".ProseMirror")
                || document.querySelector('[contenteditable="true"]')
                || document.querySelector("textarea")
                || document.activeElement;
            if (box && box.focus)
                box.focus();
            const target = box || document.body;
            let paste = null;
            try {
                paste = new ClipboardEvent("paste", {bubbles: true, cancelable: true, clipboardData: dt});
            } catch (error) {
                paste = new Event("paste", {bubbles: true, cancelable: true});
            }
            if (!paste.clipboardData || !paste.clipboardData.files || paste.clipboardData.files.length === 0) {
                try {
                    Object.defineProperty(paste, "clipboardData", {value: dt});
                } catch (error) {}
            }
            target.dispatchEvent(paste);
            return "injected";
        } catch (error) {
            return String(error);
        }
    })()`;
    evalText(script, () => {});
}

function evalText(script, done) {
    if (!view) {
        done('');
        return;
    }
    try {
        view.evaluate_javascript(script, -1, null, null, null, (_view, result) => {
            let text = '';
            try {
                const value = view.evaluate_javascript_finish(result);
                if (value && typeof value.to_string === 'function')
                    text = value.to_string();
                else if (value != null)
                    text = String(value);
            } catch (error) {
                printerr(error);
            }
            done(text);
        });
    } catch (error) {
        printerr(error);
        done('');
    }
}

let cssProvider = null;
let themeSettings = null;
let styleManager = null;

function pinPath() {
    return GLib.build_filenamev([GLib.get_user_cache_dir(), 'circle-to-search', 'pin']);
}

function readPinned() {
    try {
        const [, bytes] = GLib.file_get_contents(pinPath());
        return new TextDecoder().decode(bytes).trim() === '1';
    } catch (error) {
        return false;
    }
}

function writePinned(active) {
    const path = pinPath();
    GLib.mkdir_with_parents(GLib.path_get_dirname(path), 0o700);
    GLib.file_set_contents(path, active ? '1' : '0');
}

function startAdw() {
    if (styleManager)
        return styleManager;
    try {
        imports.gi.versions.Adw = '1';
        const Adw = imports.gi.Adw;
        Adw.init();
        styleManager = Adw.StyleManager.get_default();
        styleManager.connect('notify::dark', () => installCss());
        return styleManager;
    } catch (error) {
        printerr(`Select to Search theme: ${error}`);
        return null;
    }
}

function watchTheme() {
    startAdw();
    if (themeSettings)
        return;
    try {
        themeSettings = new Gio.Settings({schema: 'org.gnome.desktop.interface'});
        themeSettings.connect('changed::color-scheme', () => installCss());
        themeSettings.connect('changed::gtk-theme', () => installCss());
    } catch (error) {
        printerr(error);
    }
}

function installCss() {
    const dark = shellDark();
    try {
        const gtk = Gtk.Settings.get_default();
        gtk.gtk_application_prefer_dark_theme = dark;
        gtk.gtk_theme_name = dark ? 'Adwaita-dark' : 'Adwaita';
    } catch (error) {
        printerr(error);
    }
    if (win) {
        win.remove_css_class('cts-dark');
        win.remove_css_class('cts-light');
        win.add_css_class(dark ? 'cts-dark' : 'cts-light');
    }
    const display = Gdk.Display.get_default();
    if (cssProvider)
        Gtk.StyleContext.remove_provider_for_display(display, cssProvider);
    cssProvider = new Gtk.CssProvider();
    cssProvider.load_from_string(dark ? CSS_DARK : CSS_LIGHT);
    Gtk.StyleContext.add_provider_for_display(
        display,
        cssProvider,
        Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
    applyWebKitTheme(dark);
}

function applyWebKitTheme(dark) {
    if (!view)
        return;
    try {
        const settings = view.get_settings();
        const WebKit = view._webkit || {};
        const scheme = dark
            ? (WebKit.PreferredColorScheme?.DARK ?? WebKit.ColorScheme?.DARK ?? 2)
            : (WebKit.PreferredColorScheme?.LIGHT ?? WebKit.ColorScheme?.LIGHT ?? 1);
        const attempts = [
            () => settings.set_preferred_color_scheme(scheme),
            () => {
                settings.preferred_color_scheme = scheme;
            },
            () => settings.set_color_scheme(scheme),
            () => {
                settings.color_scheme = scheme;
            },
        ];
        for (const attempt of attempts) {
            try {
                attempt();
            } catch (error) {
                // This WebKit build uses a different property name.
            }
        }
        const rgba = new Gdk.RGBA();
        rgba.parse(dark ? '#1e1e1e' : '#ffffff');
        view.set_background_color(rgba);
    } catch (error) {
        printerr(error);
    }
}

function shellDark() {
    try {
        const manager = startAdw();
        if (manager)
            return Boolean(manager.get_dark());
    } catch (error) {
        printerr(error);
    }
    try {
        const iface = themeSettings || new Gio.Settings({
            schema: 'org.gnome.desktop.interface',
        });
        const scheme = iface.get_string('color-scheme');
        if (scheme === 'prefer-dark')
            return true;
        if (scheme === 'prefer-light')
            return false;
        const theme = iface.get_string('gtk-theme') || '';
        if (theme.toLowerCase().includes('dark'))
            return true;
    } catch (error) {
        printerr(error);
    }
    return false;
}

const CSS_LIGHT = `
window.cts-sheet { background-color: transparent; }
.cts-menu {
  background-color: rgba(255, 255, 255, 0.88);
  color: #1e1e1e;
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  padding: 8px;
}
.cts-clip { border-radius: 12px; background-color: #ffffff; }
.cts-name { font-size: 13px; font-weight: 700; }
button.cts-close {
  min-width: 28px;
  min-height: 28px;
  padding: 0;
  margin: 0 0 2px;
  border-radius: 999px;
  background: transparent;
  color: #5e5c64;
}
button.cts-close:hover { background: rgba(0, 0, 0, 0.06); }
button.cts-pin:checked { background: rgba(28, 113, 216, 0.2); color: #1c71d8; }
`;

const CSS_DARK = `
window.cts-sheet { background-color: transparent; }
.cts-menu {
  background-color: rgba(36, 36, 36, 0.86);
  color: #ffffff;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 8px;
}
.cts-clip { border-radius: 12px; background-color: #1e1e1e; }
.cts-name { font-size: 13px; font-weight: 700; }
button.cts-close {
  min-width: 28px;
  min-height: 28px;
  padding: 0;
  margin: 0 0 2px;
  border-radius: 999px;
  background: transparent;
  color: #deddda;
}
button.cts-close:hover { background: rgba(255, 255, 255, 0.08); }
button.cts-pin:checked { background: rgba(138, 180, 248, 0.22); color: #8ab4f8; }
`;

function probeFor(id) {
    return PROBE.split('__SEARCH_ID__').join(String(id));
}

const PROBE = `
(() => {
    const searchId = __SEARCH_ID__;
    function walk(fn) {
        const stack = [document];
        const seen = new Set();
        while (stack.length) {
            const node = stack.pop();
            if (!node || seen.has(node))
                continue;
            seen.add(node);
            fn(node);
            let all = [];
            try {
                all = node.querySelectorAll ? node.querySelectorAll("*") : [];
            } catch (error) {}
            for (const el of all) {
                if (el.shadowRoot)
                    stack.push(el.shadowRoot);
            }
        }
    }
    function deepQuery(selector) {
        let found = null;
        walk(node => {
            if (found || !node.querySelector)
                return;
            try {
                found = node.querySelector(selector);
            } catch (error) {}
        });
        return found;
    }
    function deepAll(selector) {
        const out = [];
        walk(node => {
            if (!node.querySelectorAll)
                return;
            try {
                node.querySelectorAll(selector).forEach(el => out.push(el));
            } catch (error) {}
        });
        return out;
    }
    function chipButtons() {
        return deepAll('button, [role="button"]').filter(item => {
            const label = ((item.getAttribute("aria-label") || "") + " " + (item.innerText || ""));
            return /remove.*(file|image|attachment|photo|picture)/i.test(label);
        });
    }
    if (!(location.hostname || "").endsWith("gemini.google.com"))
        return "away";
    if (window.__ctsSent === searchId)
        return "sent";
    if (window.__ctsActive !== searchId) {
        window.__ctsActive = searchId;
        window.__ctsPasted = false;
        window.__ctsReadyAt = 0;
        window.__ctsPasteAt = 0;
        if (!window.__ctsBoot)
            window.__ctsBoot = Date.now();
        const leftover = chipButtons()[0];
        if (leftover) {
            leftover.click();
            return "clear";
        }
    }
    function queryIn(root, selector) {
        let found = null;
        const stack = [root];
        const seen = new Set();
        while (stack.length) {
            const node = stack.pop();
            if (!node || seen.has(node))
                continue;
            seen.add(node);
            try {
                if (!found && node.querySelector)
                    found = node.querySelector(selector);
            } catch (error) {}
            if (found)
                return found;
            let all = [];
            try {
                all = node.querySelectorAll ? node.querySelectorAll("*") : [];
            } catch (error) {}
            for (const el of all) {
                if (el.shadowRoot)
                    stack.push(el.shadowRoot);
            }
        }
        return null;
    }
    const rich = deepQuery("rich-textarea");
    let box = rich ? (queryIn(rich, '[contenteditable="true"]') || queryIn(rich, "textarea")) : null;
    if (!box) {
        const selectors = ["#prompt-textarea", ".ProseMirror", "textarea", '[contenteditable="true"]'];
        let best = null;
        let area = 0;
        for (const selector of selectors) {
            for (const item of deepAll(selector)) {
                const rect = item.getBoundingClientRect();
                const size = rect.width * rect.height;
                if (rect.width > 40 && rect.height > 16 && size > area) {
                    best = item;
                    area = size;
                }
            }
            if (best)
                break;
        }
        box = best;
    }
    if (!box)
        return "wait";
    box.focus();
    const sends = deepAll('button, [role="button"]').filter(item => {
        const testId = item.getAttribute("data-testid") || "";
        if (testId === "send-button" || testId === "composer-send-button")
            return true;
        const icon = item.querySelector?.("mat-icon, .google-symbols, .mat-icon, svg");
        const label = (
            (item.getAttribute("aria-label") || "") + " " +
            (item.getAttribute("data-mat-icon-name") || "") + " " +
            (icon?.getAttribute?.("data-mat-icon-name") || "") + " " +
            (icon?.getAttribute?.("fonticon") || "") + " " +
            (icon?.textContent || "") + " " +
            (item.className || "") + " " +
            (item.innerText || "")
        ).toLowerCase();
        if (label.includes("feedback") || label.includes("stop") || label.includes("voice"))
            return false;
        return label.includes("send");
    });
    const button = sends.find(item => {
        const rect = item.getBoundingClientRect();
        return rect.width > 8 && rect.height > 8 && !item.disabled && item.getAttribute("aria-disabled") !== "true";
    });
    function boxReady(node) {
        const rect = node.getBoundingClientRect();
        return rect.width > 8 && rect.height > 8;
    }
    if (!window.__ctsPasted) {
        if (!boxReady(box))
            return "wait";
        if (!window.__ctsReadyAt)
            window.__ctsReadyAt = Date.now();
        const cold = Date.now() - (window.__ctsBoot || Date.now()) < 25000;
        if (Date.now() - window.__ctsReadyAt < (cold ? 1200 : 400))
            return "wait";
        window.__ctsPasted = true;
        window.__ctsPasteAt = Date.now();
        window.__ctsTries = 1;
        box.focus();
        return "inject";
    }
    if (Date.now() - (window.__ctsPasteAt || 0) < 1500)
        return "wait";
    if (button) {
        button.click();
        window.__ctsSent = searchId;
        return "sent";
    }
    if (Date.now() - window.__ctsPasteAt > 2500) {
        box.focus();
        box.dispatchEvent(new KeyboardEvent("keydown", {key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true}));
        window.__ctsSent = searchId;
        return "sent";
    }
    return "wait";
})()
`;

const invocation = [imports.system.programInvocationName || 'gemini-window'];
for (let i = 0; i < ARGV.length; i++)
    invocation.push(ARGV[i]);
app.run(invocation);
