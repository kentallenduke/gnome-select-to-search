// SPDX-License-Identifier: GPL-2.0-or-later

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import {ScreenshotUI} from 'resource:///org/gnome/shell/ui/screenshot.js';

import {CircleSession} from './circle.js';

export default class CircleToSearchExtension extends Extension {
    enable() {
        this._destroyed = false;
        this._arm = false;
        this._shortcutBound = false;
        this._settings = this.getSettings();
        this._session = new CircleSession(this._settings, this.dir.get_path());

        this._originalOpen = ScreenshotUI.prototype.open;
        const ext = this;
        ScreenshotUI.prototype.open = function (mode) {
            const direct = ext._arm;
            if (direct) {
                try {
                    ext._session.attach(this);
                    ext._session.concealChrome();
                } catch (error) {
                    logError(error, 'Select to Search');
                }
            }
            const result = ext._originalOpen.call(this, mode);
            try {
                ext._session.attach(this);
                if (direct) {
                    ext._arm = false;
                    ext._session.concealChrome();
                    ext._session.activate();
                }
            } catch (error) {
                logError(error, 'Select to Search');
            }
            return result;
        };

        this._installModeKey();
        this._bindShortcut();
        this._syncPanel();
        this._settingsIds = [
            this._settings.connect('changed::circle-to-search', () => {
                this._bindShortcut();
            }),
            this._settings.connect('changed::show-top-bar', () => {
                this._syncPanel();
            }),
            this._settings.connect('changed::shake-sensitivity', () => {
                this._shakeSensitivity = this._settings.get_int('shake-sensitivity');
            }),
            this._settings.connect('changed::shake-enabled', () => {
                this._syncShake();
            }),
        ];
        this._syncShake();

        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            if (!this._destroyed && Main.screenshotUI)
                this._session.attach(Main.screenshotUI);
            return GLib.SOURCE_REMOVE;
        });
    }

    disable() {
        this._destroyed = true;
        this._arm = false;
        if (this._settingsIds) {
            for (const id of this._settingsIds)
                this._settings.disconnect(id);
            this._settingsIds = null;
        }
        this._stopShake();
        this._unbindShortcut();
        this._removeModeKey();
        this._removePanel();
        if (ScreenshotUI.prototype.open !== this._originalOpen)
            ScreenshotUI.prototype.open = this._originalOpen;
        this._session.destroy();
        this._session = null;
        this._settings = null;
    }

    _syncPanel() {
        if (this._settings.get_boolean('show-top-bar'))
            this._addPanelButton();
        else
            this._removePanel();
    }

    _removePanel() {
        const existing = Main.panel.statusArea?.['circle-to-search'];
        if (existing) {
            try {
                existing.destroy();
            } catch (error) {
                logError(error, 'Select to Search');
            }
        }
        this._panelButton = null;
    }

    _addPanelButton() {
        this._removePanel();

        const button = new PanelMenu.Button(0.0, 'Select to Search', true);
        const icon = new St.DrawingArea({
            width: 16,
            height: 16,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            reactive: false,
        });
        icon.connect('repaint', () => this._paintPanelIcon(icon));
        button.add_child(icon);
        this._armPanelClick(button);
        Main.panel.addToStatusArea('circle-to-search', button, 1, 'right');
        this._panelButton = button;
        icon.queue_repaint();
    }

    _armPanelClick(button) {
        const Gesture = Clutter.ClickGesture;
        if (typeof Gesture === 'function') {
            const click = new Gesture();
            click.connect('recognize', () => this._trigger());
            button.add_action(click);
            return;
        }
        button.connect('event', (_actor, event) => {
            if (event.type() !== Clutter.EventType.BUTTON_RELEASE)
                return Clutter.EVENT_PROPAGATE;
            this._trigger();
            return Clutter.EVENT_STOP;
        });
    }

    _paintPanelIcon(area) {
        const cr = area.get_context();
        if (!cr)
            return;
        try {
            let red = 1;
            let green = 1;
            let blue = 1;
            let alpha = 0.92;
            try {
                const color = area.get_theme_node().get_foreground_color();
                red = color.red / 255;
                green = color.green / 255;
                blue = color.blue / 255;
                alpha = Math.max(0.75, color.alpha / 255);
            } catch (error) {
                logError(error, 'Select to Search');
            }
            cr.setSourceRGBA(red, green, blue, alpha);
            cr.moveTo(8, 0.9);
            cr.curveTo(8.55, 5.4, 10.6, 7.45, 15.1, 8);
            cr.curveTo(10.6, 8.55, 8.55, 10.6, 8, 15.1);
            cr.curveTo(7.45, 10.6, 5.4, 8.55, 0.9, 8);
            cr.curveTo(5.4, 7.45, 7.45, 5.4, 8, 0.9);
            cr.closePath();
            cr.fill();
        } finally {
            cr.$dispose();
        }
    }

    _syncShake() {
        if (this._settings.get_boolean('shake-enabled'))
            this._startShake();
        else
            this._stopShake();
    }

    _startShake() {
        if (this._shakeId)
            return;
        this._shakeSensitivity = this._settings.get_int('shake-sensitivity');
        this._clearShake();
        this._shakeAt = 0;
        this._shakeId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 40, () => {
            if (!this._destroyed)
                this._sampleShake();
            return this._destroyed ? GLib.SOURCE_REMOVE : GLib.SOURCE_CONTINUE;
        });
    }

    _stopShake() {
        if (this._shakeId) {
            GLib.source_remove(this._shakeId);
            this._shakeId = 0;
        }
    }

    _clearShake() {
        this._shakeLast = null;
        this._legX = 0;
        this._legY = 0;
        this._dirX = 0;
        this._dirY = 0;
        this._armX = false;
        this._armY = false;
        this._turns = [];
    }

    _readPointer() {
        try {
            const tracker = Meta.CursorTracker.get_for_display(global.display);
            const result = tracker.get_pointer();
            if (result && typeof result.x === 'number')
                return {x: result.x, y: result.y};
            if (result && result[0] && typeof result[0].x === 'number')
                return {x: result[0].x, y: result[0].y, mods: result[1] || 0};
            if (result && result.length >= 2 && typeof result[0] === 'number')
                return {x: result[0], y: result[1], mods: result[2] || 0};
        } catch (error) {
            if (!this._pointerError) {
                this._pointerError = true;
                logError(error, 'Select to Search');
            }
        }
        try {
            const pointer = global.get_pointer();
            if (pointer && pointer.length >= 2)
                return {x: pointer[0], y: pointer[1], mods: pointer[2] || 0};
        } catch (error) {
            if (!this._pointerError) {
                this._pointerError = true;
                logError(error, 'Select to Search');
            }
        }
        return null;
    }

    _sampleShake() {
        try {
            const point = this._readPointer();
            if (!point)
                return;
            const now = Date.now();
            const buttons = (Clutter.ModifierType.BUTTON1_MASK || 256) |
                (Clutter.ModifierType.BUTTON2_MASK || 512) |
                (Clutter.ModifierType.BUTTON3_MASK || 1024);
            if (Main.screenshotUI?.visible || (point.mods & buttons)) {
                this._clearShake();
                return;
            }
            if (now - this._shakeAt < 1500)
                return;
            const last = this._shakeLast;
            this._shakeLast = {x: point.x, y: point.y, t: now};
            if (!last)
                return;
            if (now - last.t > 120) {
                this._clearShake();
                this._shakeLast = {x: point.x, y: point.y, t: now};
                return;
            }
            const dx = point.x - last.x;
            const dy = point.y - last.y;
            if (Math.hypot(dx, dy) < 8)
                return;
            if (Math.hypot(dx, dy) / Math.max(now - last.t, 1) < 0.45)
                return;
            const sensitivity = Math.min(100, Math.max(1, this._shakeSensitivity || 50));
            const ease = (sensitivity - 1) / 99;
            const minSwing = 320 - ease * 150;
            const horizontal = Math.abs(dx) >= Math.abs(dy);
            if (horizontal) {
                const x = this._pushAxis(dx, this._legX, this._dirX, this._armX, minSwing, now);
                this._legX = x.leg;
                this._dirX = x.dir;
                this._armX = x.armed;
            } else {
                const y = this._pushAxis(dy, this._legY, this._dirY, this._armY, minSwing, now);
                this._legY = y.leg;
                this._dirY = y.dir;
                this._armY = y.armed;
            }
            const windowMs = 420 + ease * 140;
            this._turns = this._turns.filter(time => now - time <= windowMs);
            const needed = ease > 0.85 ? 4 : 5;
            if (this._turns.length >= needed) {
                this._clearShake();
                this._shakeAt = now;
                this._trigger();
            }
        } catch (error) {
            logError(error, 'Select to Search');
        }
    }

    _pushAxis(delta, leg, dir, armed, minSwing, now) {
        if (Math.abs(delta) < 4)
            return {leg, dir, armed};
        const next = delta > 0 ? 1 : -1;
        if (dir && next !== dir) {
            if (Math.abs(delta) < 18 && Math.abs(leg) > 30)
                return {leg, dir, armed};
            return {leg: delta, dir: next, armed: Math.abs(leg) >= minSwing};
        }
        const grown = leg + delta;
        if (armed && Math.abs(grown) >= minSwing && now - (this._lastTurn || 0) > 70) {
            this._turns.push(now);
            this._lastTurn = now;
            return {leg: grown, dir: next, armed: false};
        }
        return {leg: grown, dir: next, armed};
    }

    _trigger() {
        const ui = Main.screenshotUI;
        if (!ui || this._destroyed)
            return;
        try {
            this._session.attach(ui);
        } catch (error) {
            logError(error, 'Select to Search');
            return;
        }
        if (ui.visible) {
            this._session.activate();
            return;
        }
        this._arm = true;
        ui.open().catch(error => logError(error, 'Select to Search'));
    }

    _bindShortcut() {
        this._unbindShortcut();
        const modes = Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW;
        Main.wm.addKeybinding(
            'circle-to-search',
            this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            modes,
            () => this._trigger());
        this._shortcutBound = true;
    }

    _unbindShortcut() {
        if (!this._shortcutBound)
            return;
        Main.wm.removeKeybinding('circle-to-search');
        this._shortcutBound = false;
    }

    /// L, while the screenshot tool is open. C is already Screen.
    _installModeKey() {
        try {
            ScreenshotUI.get_binding_pool().install_closure(
                'circle-to-search-mode',
                Clutter.KEY_l,
                0,
                obj => {
                    if (this._destroyed)
                        return Clutter.EVENT_PROPAGATE;
                    this._session.attach(obj);
                    this._session.activate();
                    return Clutter.EVENT_STOP;
                });
            this._modeKey = true;
        } catch (error) {
            logError(error, 'Select to Search mode key');
        }
    }

    _removeModeKey() {
        if (!this._modeKey)
            return;
        try {
            const pool = ScreenshotUI.get_binding_pool();
            if (pool.remove_action)
                pool.remove_action('circle-to-search-mode');
            else
                pool.install_closure(
                    'circle-to-search-mode',
                    Clutter.KEY_l,
                    0,
                    () => Clutter.EVENT_PROPAGATE);
        } catch (error) {
            logError(error, 'Select to Search mode key');
        }
        this._modeKey = false;
    }
}
