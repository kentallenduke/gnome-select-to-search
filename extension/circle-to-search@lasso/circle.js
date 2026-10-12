// SPDX-License-Identifier: GPL-2.0-or-later
//
// Circle mode sits inside GNOME's screenshot UI. The desktop on screen is the
// frozen stage texture ScreenshotUI already captured; the crop goes through
// Shell.Screenshot.composite_to_stream, which is what the shutter uses.

import Cairo from 'gi://cairo';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Tooltip} from 'resource:///org/gnome/shell/ui/screenshot.js';

import {recognizeWords} from './ocr.js';

const MIN_BOX = 100;

function uiLooksRight(ui) {
    return Boolean(
        ui &&
        ui._typeButtonContainer &&
        ui._selectionButton &&
        ui._screenButton &&
        ui._windowButton &&
        ui._areaSelector &&
        ui._stageScreenshot &&
        ui._primaryMonitorBin
    );
}

function playShutter() {
    try {
        const file = Gio.File.new_for_path(
            `${global.datadir}/sounds/screen-capture.oga`);
        global.display.get_sound_player().play_from_file(
            file, 'Select to Search', null);
    } catch {
        try {
            global.display.get_sound_player().play_from_theme(
                'screen-capture', 'Select to Search', null);
        } catch {
            // The sound theme is optional feedback.
        }
    }
}

class InkLayer {
    constructor(onStroke) {
        this._onStroke = onStroke;
        this._points = [];
        this._drawing = false;
        this._destroyed = false;
        this._grab = null;
        this._abort = false;
        this._words = [];
        this._selected = [];
        this._textMode = false;
        this._anchor = null;

        // Clutter.Canvas was removed in Mutter 51. St.DrawingArea is the
        // Cairo surface the shell itself still paints into.
        this.actor = new St.DrawingArea({
            name: 'cts-ink',
            style_class: 'cts-ink',
            reactive: false,
            visible: false,
            x_expand: true,
            y_expand: true,
        });
        this.actor.connect('repaint', () => this._repaint());

        this._pan = new Clutter.PanGesture();
        this._pan.set_begin_threshold(0);
        this._pan.connect('recognize', () => this._onPanBegin());
        this._pan.connect('pan-update', () => this._onPanUpdate());
        this._pan.connect('end', () => this._onPanEnd());
        this._pan.connect('cancel', () => this._onPanCancel());
        this.actor.add_action(this._pan);
        this.actor.connect('event', (_actor, event) => this._onEvent(event));
    }

    destroy() {
        this._destroyed = true;
        this._releaseGrab();
        this.actor.destroy();
    }

    get drawing() {
        return this._drawing;
    }

    show() {
        this.actor.reactive = true;
        try {
            this.actor.set_cursor_type(Clutter.CursorType.CROSSHAIR);
        } catch (error) {
            logError(error, 'Select to Search');
        }
        this.actor.show();
        this._queueRepaint();
    }

    hide() {
        this._releaseGrab();
        this.actor.reactive = false;
        this.actor.hide();
        this.clear();
    }

    clear() {
        this._points = [];
        this._drawing = false;
        this._queueRepaint();
    }

    cancel() {
        this._releaseGrab();
        this._drawing = false;
        this.clear();
    }

    hasInk() {
        return this._points.length > 0;
    }

    /// The dragged rectangle, in stage pixels.
    region() {
        const box = this._rect();
        if (!box)
            return null;
        return clampBox(box, global.stage.width, global.stage.height);
    }

    /// Longest side of the rectangle. A click is not a selection.
    drawnSpan() {
        const box = this._rect();
        if (!box)
            return null;
        return Math.max(box.w, box.h);
    }

    _rect() {
        const points = this._points;
        if (points.length < 2)
            return null;
        const w = Math.abs(points[1].x - points[0].x);
        const h = Math.abs(points[1].y - points[0].y);
        if (w < 1 && h < 1)
            return null;
        return {
            x: Math.min(points[0].x, points[1].x),
            y: Math.min(points[0].y, points[1].y),
            w,
            h,
        };
    }

    _centroid() {
        const point = this._pan.get_centroid_abs();
        return {x: point.x, y: point.y};
    }

    abort() {
        this._abort = true;
        this._drawing = false;
        this._points = [];
        this._releaseGrab();
        try {
            if (typeof this._pan.cancel === 'function')
                this._pan.cancel();
        } catch {
            // The gesture may already be finished.
        }
        this._queueRepaint();
        this._onStroke('cancel');
    }

    setWords(words) {
        this._words = words || [];
        this._selected = [];
        this._textMode = false;
        this._anchor = null;
        this._textFrom = null;
        this._textTo = null;
        this._queueRepaint();
    }

    _localPoint(x, y) {
        const [originX, originY] = this.actor.get_transformed_position();
        return {x: x - originX, y: y - originY};
    }

    _wordAt(x, y) {
        const point = this._localPoint(x, y);
        const pad = 8;
        for (let i = this._words.length - 1; i >= 0; i--) {
            const word = this._words[i];
            if (point.x >= word.x - pad && point.x <= word.x + word.w + pad &&
                point.y >= word.y - pad && point.y <= word.y + word.h + pad)
                return word;
        }
        return null;
    }

    _nearestWord(x, y) {
        const hit = this._wordAt(x, y);
        if (hit)
            return hit;
        const point = this._localPoint(x, y);
        let best = null;
        let bestDistance = 64;
        for (const word of this._words) {
            const dx = point.x - (word.x + word.w / 2);
            const dy = point.y - (word.y + word.h / 2);
            const distance = Math.hypot(dx, dy);
            if (distance < bestDistance) {
                best = word;
                bestDistance = distance;
            }
        }
        return best;
    }

    _selectCovered() {
        if (!this._textFrom || !this._textTo) {
            this._selected = [];
            return;
        }
        const start = this._localPoint(this._textFrom.x, this._textFrom.y);
        const end = this._localPoint(this._textTo.x, this._textTo.y);
        const left = Math.min(start.x, end.x) - 6;
        const right = Math.max(start.x, end.x) + 6;
        const top = Math.min(start.y, end.y) - 10;
        const bottom = Math.max(start.y, end.y) + 10;
        this._selected = this._words.filter(word =>
            word.x < right && word.x + word.w > left &&
            word.y < bottom && word.y + word.h > top);
    }

    _selectedText() {
        if (!this._selected.length)
            return '';
        let text = this._selected[0].text;
        for (let i = 1; i < this._selected.length; i++) {
            const word = this._selected[i];
            text += word.line === this._selected[i - 1].line ? ' ' : '\n';
            text += word.text;
        }
        return text;
    }

    _onPanBegin() {
        this._abort = false;
        const point = this._centroid();
        const word = this._wordAt(point.x, point.y);
        if (word) {
            this._textMode = true;
            this._anchor = word;
            this._textFrom = point;
            this._textTo = point;
            this._points = [];
            this._drawing = true;
            this._selectCovered();
            this._queueRepaint();
            if (!this._grab) {
                try {
                    this._grab = global.stage.grab(this.actor);
                } catch (error) {
                    logError(error, 'Select to Search');
                }
            }
            this._onStroke('text-begin');
            return;
        }
        this._textMode = false;
        this._anchor = null;
        this._points = [point, {x: point.x, y: point.y}];
        this._drawing = true;
        this._startPulse();
        this._queueRepaint();
        if (!this._grab) {
            try {
                this._grab = global.stage.grab(this.actor);
            } catch (error) {
                logError(error, 'Select to Search');
            }
        }
        this._onStroke('begin');
    }

    _onPanUpdate() {
        if (!this._drawing)
            return;
        if (this._textMode) {
            this._textTo = this._centroid();
            this._selectCovered();
            this._queueRepaint();
            return;
        }
        const next = this._centroid();
        if (this._points.length < 2)
            this._points.push(next);
        else
            this._points[1] = next;
        this._queueRepaint();
    }

    _onPanEnd() {
        if (this._abort || !this._drawing) {
            this._abort = false;
            this._drawing = false;
            this._textMode = false;
            this._points = [];
            this._releaseGrab();
            this._queueRepaint();
            this._onStroke('cancel');
            return;
        }
        if (this._textMode) {
            this._onPanUpdate();
            this._drawing = false;
            this._textMode = false;
            this._releaseGrab();
            this._queueRepaint();
            this._onStroke('text', this._selectedText());
            return;
        }
        this._onPanUpdate();
        this._drawing = false;
        this._releaseGrab();
        this._queueRepaint();
        this._onStroke('end');
    }

    _onPanCancel() {
        this._abort = false;
        this._drawing = false;
        this._textMode = false;
        this._points = [];
        this._releaseGrab();
        this._queueRepaint();
        this._onStroke('cancel');
    }

    _onEvent(event) {
        try {
            const type = event.type();
            if (type === Clutter.EventType.KEY_PRESS && isEscape(event)) {
                this.abort();
                return Clutter.EVENT_STOP;
            }
            const release = type === Clutter.EventType.BUTTON_RELEASE ||
                type === Clutter.EventType.TOUCH_END;
            if (release && this._drawing)
                this._onPanEnd();
        } catch (error) {
            logError(error, 'Select to Search');
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _releaseGrab() {
        const grab = this._grab;
        this._grab = null;
        if (!grab)
            return;
        try {
            grab.dismiss();
        } catch {
            // The screenshot UI already dropped the grab.
        }
    }

    _startPulse() {
        if (this._pulseId)
            return;
        this._pulseId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 32, () => {
            if (this._destroyed || this._points.length === 0) {
                this._pulseId = 0;
                return GLib.SOURCE_REMOVE;
            }
            this._queueRepaint();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _queueRepaint() {
        if (this._destroyed)
            return;
        if (this.actor.width <= 0 || this.actor.height <= 0)
            return;
        try {
            this.actor.queue_repaint();
        } catch (error) {
            logError(error, 'Select to Search');
        }
    }

    _repaint() {
        const cr = this.actor.get_context();
        if (!cr)
            return;
        try {
            const [originX, originY] = this.actor.get_transformed_position();
            const local = rectangleBox(this._points, originX, originY);
            const width = this.actor.width;
            const height = this.actor.height;
            cr.setOperator(Cairo.Operator.OVER);
            cr.setSourceRGBA(0, 0, 0, 0.45);
            if (!local || this._textMode) {
                cr.rectangle(0, 0, width, height);
                cr.fill();
                this._paintWords(cr);
                return;
            }
            cr.setFillRule(Cairo.FillRule.EVEN_ODD);
            cr.rectangle(0, 0, width, height);
            addRoundedRect(cr, local, 16);
            cr.fill();
            this._paintWords(cr);

            const radius = 16;
            cr.setLineCap(Cairo.LineCap.ROUND);
            cr.setLineJoin(Cairo.LineJoin.ROUND);
            paintProviderGlow(cr, local, radius);
            cr.setSourceRGBA(1, 1, 1, 1);
            cr.setLineWidth(2);
            addRoundedRect(cr, local, radius);
            cr.stroke();
            paintProviderBadge(cr, local, width, height);
            paintSize(cr, local, height);
        } finally {
            cr.$dispose();
        }
    }

    _paintWords(cr) {
        if (!this._words.length)
            return;
        const selected = new Set(this._selected);
        for (const word of this._words) {
            const on = selected.has(word);
            cr.setSourceRGBA(on ? 0.259 : 1, on ? 0.522 : 1, on ? 0.957 : 1, on ? 0.45 : 0.16);
            addRoundedRect(cr, {
                left: word.x,
                top: word.y,
                right: word.x + word.w,
                bottom: word.y + word.h,
            }, 4);
            cr.fill();
        }
    }
}

function paintProviderBadge(cr, box, actorWidth, actorHeight) {
    const label = 'Search with Gemini';
    try {
        cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
        cr.setFontSize(14);
        const extents = cr.textExtents(label);
        const padX = 10;
        const padY = 5;
        const pillW = extents.width + padX * 2;
        const pillH = extents.height + padY * 2;
        let x = (box.left + box.right) / 2 - pillW / 2;
        let y = box.top - pillH - 10;
        x = Math.max(4, Math.min(x, actorWidth - pillW - 4));
        if (y < 4)
            y = Math.min(actorHeight - pillH - 4, box.top + 10);
        cr.setSourceRGBA(0, 0, 0, 0.78);
        cr.newPath();
        cr.arc(x + pillH / 2, y + pillH / 2, pillH / 2, Math.PI / 2, Math.PI * 1.5);
        cr.arc(x + pillW - pillH / 2, y + pillH / 2, pillH / 2, -Math.PI / 2, Math.PI / 2);
        cr.closePath();
        cr.fill();
        cr.setSourceRGBA(1, 1, 1, 0.96);
        cr.moveTo(x + padX - extents.xBearing, y + padY - extents.yBearing);
        cr.showText(label);
    } catch (error) {
        logError(error, 'Select to Search');
    }
}

function shrinkScreenshot(path, maxEdge) {
    try {
        const surface = Cairo.ImageSurface.create_from_png(path);
        const width = surface.getWidth();
        const height = surface.getHeight();
        const edge = Math.max(width, height);
        if (!edge || edge <= maxEdge)
            return 1;
        const factor = maxEdge / edge;
        const small = new Cairo.ImageSurface(
            Cairo.Format.ARGB32,
            Math.max(1, Math.round(width * factor)),
            Math.max(1, Math.round(height * factor)));
        const cr = new Cairo.Context(small);
        cr.scale(factor, factor);
        cr.setSourceSurface(surface, 0, 0);
        cr.paint();
        small.writeToPNG(path);
        return factor;
    } catch (error) {
        logError(error, 'Select to Search');
        return 1;
    }
}

function paintProviderGlow(cr, local, radius) {
    const wave = 0.5 + 0.5 * Math.sin(Date.now() / 980);
    const alpha = 0.06 + wave * 0.12;
    const glow = new Cairo.LinearGradient(local.left, local.top, local.right, local.bottom);
    glow.addColorStopRGBA(0, 0.259, 0.522, 0.957, alpha);
    glow.addColorStopRGBA(0.34, 0.918, 0.263, 0.208, alpha);
    glow.addColorStopRGBA(0.67, 0.984, 0.737, 0.020, alpha);
    glow.addColorStopRGBA(1, 0.204, 0.659, 0.325, alpha);
    cr.setSource(glow);
    for (const lineWidth of [28, 16]) {
        cr.setLineWidth(lineWidth);
        addRoundedRect(cr, local, radius);
        cr.stroke();
    }
}

function isEscape(event) {
    try {
        const symbol = event.get_key_symbol();
        if (symbol === Clutter.KEY_Escape || symbol === 65307)
            return true;
    } catch {
        // Not a key event.
    }
    try {
        if (event.get_key_unicode() === '\u001b')
            return true;
    } catch {
        // No unicode for this event.
    }
    return false;
}

function rectangleBox(points, originX, originY) {
    if (!points || points.length < 2)
        return null;
    const x1 = points[0].x - originX;
    const y1 = points[0].y - originY;
    const x2 = points[1].x - originX;
    const y2 = points[1].y - originY;
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const right = Math.max(x1, x2);
    const bottom = Math.max(y1, y2);
    if (right - left < 1 && bottom - top < 1)
        return null;
    return {left, top, right, bottom};
}

function addRoundedRect(cr, box, radius) {
    const w = box.right - box.left;
    const h = box.bottom - box.top;
    const r = Math.max(0, Math.min(radius, w / 2, h / 2));
    cr.newSubPath();
    if (r < 1) {
        cr.rectangle(box.left, box.top, w, h);
        return;
    }
    cr.arc(box.right - r, box.top + r, r, -Math.PI / 2, 0);
    cr.arc(box.right - r, box.bottom - r, r, 0, Math.PI / 2);
    cr.arc(box.left + r, box.bottom - r, r, Math.PI / 2, Math.PI);
    cr.arc(box.left + r, box.top + r, r, Math.PI, Math.PI * 1.5);
    cr.closePath();
}

function paintSize(cr, box, actorHeight) {
    try {
        const label = `${Math.round(box.right - box.left)}x${Math.round(box.bottom - box.top)}`;
        cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
        cr.setFontSize(15);
        const extents = cr.textExtents(label);
        const padX = 8;
        const padY = 4;
        const pillW = extents.width + padX * 2;
        const pillH = extents.height + padY * 2;
        let x = (box.left + box.right) / 2 - pillW / 2;
        let y = box.bottom + 8;
        if (y + pillH > actorHeight - 4)
            y = Math.max(4, box.top - pillH - 8);
        cr.setSourceRGBA(0, 0, 0, 0.72);
        cr.newPath();
        cr.arc(x + pillH / 2, y + pillH / 2, pillH / 2, Math.PI / 2, Math.PI * 1.5);
        cr.arc(x + pillW - pillH / 2, y + pillH / 2, pillH / 2, -Math.PI / 2, Math.PI / 2);
        cr.closePath();
        cr.fill();
        cr.setSourceRGBA(1, 1, 1, 0.96);
        cr.moveTo(x + padX - extents.xBearing, y + padY - extents.yBearing);
        cr.showText(label);
    } catch (error) {
        logError(error, 'Select to Search');
    }
}

function clampBox(box, boundsW, boundsH) {
    const x = Math.max(0, box.x);
    const y = Math.max(0, box.y);
    const right = Math.min(boundsW, box.x + box.w);
    const bottom = Math.min(boundsH, box.y + box.h);
    return {
        x,
        y,
        w: Math.max(1, right - x),
        h: Math.max(1, bottom - y),
    };
}

function padBox(box, pad, boundsW, boundsH) {
    return clampBox({
        x: box.x - pad,
        y: box.y - pad,
        w: box.w + pad * 2,
        h: box.h + pad * 2,
    }, boundsW, boundsH);
}

export class CircleSession {
    constructor(settings, dir) {
        this._settings = settings;
        this._dir = dir;
        this._ui = null;
        this._button = null;
        this._tooltip = null;
        this._hint = null;
        this._ink = null;
        this._ids = [];
        this._updating = false;
        this._destroyed = false;
        this._gen = 0;
        this._cancellable = null;
        this._originalCapture = null;
        this._wrappedCapture = null;
        this._watchPin();
    }

    attach(ui) {
        if (this._destroyed || this._ui === ui && this._button)
            return;
        if (!uiLooksRight(ui)) {
            console.error(
                '[circle-to-search] Screenshot UI does not match GNOME 51. Circle was not added.');
            return;
        }
        this._ui = ui;

        const label = new St.Label({
            text: 'Select',
            x_align: Clutter.ActorAlign.CENTER,
        });
        const box = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'icon-label-button-container',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(new St.Icon({
            icon_name: 'edit-find-symbolic',
        }));
        box.add_child(label);

        this._button = new St.Button({
            name: 'cts-circle-button',
            style_class: 'screenshot-ui-type-button',
            toggle_mode: true,
            x_expand: true,
            can_focus: true,
        });
        this._button.set_child(box);
        this._button.label_actor = label;
        ui._typeButtonContainer.insert_child_at_index(this._button, 1);

        this._tooltip = new Tooltip(this._button, {
            text: 'Select to Search',
            style_class: 'screenshot-ui-tooltip',
            visible: false,
        });
        ui.add_child(this._tooltip);

        this._hint = new St.Label({
            style_class: 'cts-hint',
            text: 'Drag to select an area to search',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.START,
            visible: false,
        });
        ui._primaryMonitorBin.add_child(this._hint);

        this._ink = new InkLayer((phase, text) => {
            if (phase === 'begin' || phase === 'text-begin')
                this._hint?.hide();
            else if (phase === 'cancel')
                this._hint?.show();
            else if (phase === 'end')
                this.search().catch(error => logError(error, 'Select to Search'));
            else if (phase === 'text') {
                this._copyText(text);
                this._hint?.show();
            }
        });
        ui.insert_child_above(this._ink.actor, ui._areaSelector);
        this._raiseInk();

        this._connect(this._button, 'notify::checked', () => this._onCircle());
        for (const native of [ui._selectionButton, ui._screenButton, ui._windowButton])
            this._connect(native, 'notify::checked', () => this._onNative());
        this._connect(ui, 'closed', () => this._onClosed());

        this._originalCapture = ui._onCaptureButtonClicked;
        const session = this;
        this._wrappedCapture = async function () {
            if (session._button?.checked) {
                if (session._ink?.hasInk())
                    await session.search();
                return;
            }
            return session._originalCapture.call(ui);
        };
        ui._onCaptureButtonClicked = this._wrappedCapture;
    }

    activate() {
        if (!this._ui || this._destroyed)
            return;
        if (!this._button)
            this.attach(this._ui);
        if (!this._button)
            return;
        this._button.toggle_mode = true;
        if (!this._button.checked)
            this._button.checked = true;
        else
            this._enter();
    }

    concealChrome() {
        const ui = this._ui;
        if (!ui)
            return;
        this._chromeHidden = true;
        for (const actor of [ui._panel, ui._closeButton]) {
            if (!actor)
                continue;
            actor.hide();
            actor.opacity = 0;
        }
    }

    restoreChrome() {
        if (!this._chromeHidden)
            return;
        this._chromeHidden = false;
        const ui = this._ui;
        if (!ui)
            return;
        for (const actor of [ui._panel, ui._closeButton]) {
            if (!actor)
                continue;
            actor.opacity = 255;
            actor.show();
        }
    }

    destroy() {
        this._destroyed = true;
        this._gen++;
        this._cancellable?.cancel();
        this._ink?.cancel();
        const ui = this._ui;
        if (ui && this._wrappedCapture &&
            ui._onCaptureButtonClicked === this._wrappedCapture)
            ui._onCaptureButtonClicked = this._originalCapture;
        for (const [obj, id] of this._ids) {
            try {
                obj.disconnect(id);
            } catch {
                // Actor may already be gone on shell shutdown.
            }
        }
        this._ids = [];
        this._ink?.destroy();
        this._hint?.destroy();
        this._tooltip?.destroy();
        this._button?.destroy();
        this._ink = null;
        this._hint = null;
        this._tooltip = null;
        this._button = null;
        this._disarmEscape();
        this._pinMonitor?.cancel();
        this._pinMonitor = null;
    }

    async search() {
        const ui = this._ui;
        const ink = this._ink;
        if (!ui || !ink || this._destroyed || !ink.hasInk())
            return;

        let box = ink.region();
        if (!box || (box.w <= MIN_BOX && box.h <= MIN_BOX)) {
            ink.clear();
            this._hint?.show();
            return;
        }
        const pad = this._settings.get_int('stroke-padding');
        box = padBox(
            box,
            pad,
            ink.actor.width || global.stage.width,
            ink.actor.height || global.stage.height);

        const generation = ++this._gen;
        this._flash(ui, box);

        let imagePath = null;
        try {
            const bytes = await this._crop(ui, box);
            const file = this._writeCache(bytes);
            imagePath = file.get_path();
            if (this._settings.get_boolean('copy-image')) {
                St.Clipboard.get_default().set_content(
                    St.ClipboardType.CLIPBOARD, 'image/png', bytes);
            }
            if (this._settings.get_boolean('save-file'))
                this._saveCopy(file);
            playShutter();
        } catch (error) {
            logError(error, 'Select to Search');
        }

        if (generation !== this._gen || this._destroyed)
            return;
        this._releaseScreenshot();
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
            if (!this._destroyed)
                this._openGemini(imagePath);
            return GLib.SOURCE_REMOVE;
        });
    }

    _openGemini(imagePath) {
        const script = this._dir
            ? GLib.build_filenamev([this._dir, 'gemini-window.js'])
            : null;
        if (!script || !Gio.File.new_for_path(script).query_exists(null)) {
            Main.notify('Select to Search', 'The Gemini window is missing from the extension.');
            return;
        }
        const gjs = GLib.find_program_in_path('gjs') || '/usr/bin/gjs';
        this._installGeminiIcon();
        this._restartHelperIfNeeded();
        const parts = [gjs, script];
        if (imagePath)
            parts.push(imagePath);
        const command = parts.map(part => GLib.shell_quote(part)).join(' ');
        try {
            const info = Gio.AppInfo.create_from_commandline(
                command,
                'Select to Search',
                Gio.AppInfoCreateFlags.SUPPORTS_STARTUP_NOTIFICATION);
            info.launch([], global.create_app_launch_context(0, -1));
        } catch (error) {
            logError(error, 'Select to Search');
            Main.notify('Select to Search', `Could not open the search window: ${error.message || error}`);
        }
        this._armGeminiPlacement();
    }

    _installGeminiIcon() {
        try {
            const iconDir = GLib.build_filenamev([
                GLib.get_user_data_dir(), 'icons', 'hicolor', 'scalable', 'apps']);
            GLib.mkdir_with_parents(iconDir, 0o755);
            const iconDest = GLib.build_filenamev([
                iconDir, 'org.gnome.circle_to_search.GeminiMenu.svg']);
            const src = Gio.File.new_for_path(GLib.build_filenamev([this._dir, 'gemini.svg']));
            if (src.query_exists(null)) {
                src.copy(
                    Gio.File.new_for_path(iconDest),
                    Gio.FileCopyFlags.OVERWRITE,
                    null, null);
            }
            const apps = GLib.build_filenamev([GLib.get_user_data_dir(), 'applications']);
            GLib.mkdir_with_parents(apps, 0o755);
            const desktop = `[Desktop Entry]
Name=Select to Search
Comment=Select a region and ask Gemini
Exec=gjs
Icon=${iconDest}
StartupWMClass=circle-to-search-gemini
Type=Application
NoDisplay=true
Terminal=false
`;
            GLib.file_set_contents(GLib.build_filenamev([
                apps, 'org.gnome.circle_to_search.GeminiMenu.desktop']), desktop);
        } catch (error) {
            logError(error, 'Select to Search');
        }
    }

    _armGeminiPlacement() {
        this._placeToken = (this._placeToken || 0) + 1;
        const token = this._placeToken;
        let tries = 0;
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 120, () => {
            if (this._destroyed || token !== this._placeToken)
                return GLib.SOURCE_REMOVE;
            tries += 1;
            const placed = this._placeGeminiWindows();
            if (placed || tries >= 30)
                return GLib.SOURCE_REMOVE;
            return GLib.SOURCE_CONTINUE;
        });
    }

    _placeGeminiWindows() {
        if (!this._placedGemini)
            this._placedGemini = new Set();
        let actors = [];
        try {
            actors = global.get_window_actors();
        } catch (error) {
            return false;
        }
        let settled = false;
        for (const actor of actors) {
            const win = actor?.meta_window;
            if (!win || !this._isGemini(win))
                continue;
            const id = typeof win.get_id === 'function' ? win.get_id() : win;
            if (this._placedGemini.has(id)) {
                settled = true;
                this._applyChrome(win);
                continue;
            }
            if (this._moveGemini(win)) {
                this._placedGemini.add(id);
                this._applyChrome(win);
                settled = true;
            }
        }
        return settled;
    }

    _isGemini(win) {
        try {
            const id = typeof win.get_gtk_application_id === 'function'
                ? win.get_gtk_application_id() || ''
                : '';
            if (id.includes('circle_to_search'))
                return true;
            const title = (win.get_title?.() || '').toLowerCase();
            const wm = (win.get_wm_class?.() || '').toLowerCase();
            return title === 'select to search' || title === 'circle to search' || title === 'gemini' || wm.includes('circle-to-search');
        } catch (error) {
            return false;
        }
    }

    _moveGemini(win) {
        try {
            const monitor = global.display.get_current_monitor();
            const area = global.workspace_manager
                .get_active_workspace()
                .get_work_area_for_monitor(monitor);
            const rect = win.get_frame_rect();
            if (!rect || rect.width < 80 || rect.height < 80)
                return;
            const x = Math.round(area.x + area.width - rect.width - 18);
            const y = Math.round(area.y + area.height - rect.height - 18);
            win.move_frame(true, x, y);
            return true;
        } catch (error) {
            logError(error, 'Select to Search');
            return false;
        }
    }

    _watchPin() {
        try {
            const dir = GLib.build_filenamev([
                GLib.get_user_cache_dir(), 'circle-to-search']);
            GLib.mkdir_with_parents(dir, 0o700);
            this._pinMonitor = Gio.File.new_for_path(dir).monitor_directory(
                Gio.FileMonitorFlags.NONE, null);
            this._pinMonitor.connect('changed', (_monitor, file) => {
                if (file?.get_basename() === 'pin')
                    this._applyPinToWindows();
            });
        } catch (error) {
            logError(error, 'Select to Search');
        }
    }

    _applyPinToWindows() {
        let actors = [];
        try {
            actors = global.get_window_actors();
        } catch (error) {
            return;
        }
        for (const actor of actors) {
            const win = actor?.meta_window;
            if (win && this._isGemini(win))
                this._applyChrome(win);
        }
    }

    _pinned() {
        try {
            const path = GLib.build_filenamev([
                GLib.get_user_cache_dir(), 'circle-to-search', 'pin']);
            const [, bytes] = GLib.file_get_contents(path);
            return new TextDecoder().decode(bytes).trim() === '1';
        } catch (error) {
            return false;
        }
    }

    _applyChrome(win) {
        const pinned = this._pinned();
        try {
            if (pinned) {
                if (typeof win.make_above === 'function')
                    win.make_above();
                if (typeof win.stick === 'function')
                    win.stick();
            } else {
                if (typeof win.unmake_above === 'function')
                    win.unmake_above();
                if (typeof win.unstick === 'function')
                    win.unstick();
            }
        } catch (error) {
            logError(error, 'Select to Search');
        }
    }

    _restartHelperIfNeeded() {
        const stampPath = GLib.build_filenamev([
            GLib.get_user_cache_dir(), 'circle-to-search', 'helper-version']);
        GLib.mkdir_with_parents(GLib.path_get_dirname(stampPath), 0o700);
        let previous = '';
        try {
            const [, bytes] = GLib.file_get_contents(stampPath);
            previous = new TextDecoder().decode(bytes).trim();
        } catch {
            previous = '';
        }
        if (previous === '67')
            return;
        try {
            GLib.spawn_command_line_sync('pkill -f gemini-window.js');
        } catch {
            // The previous helper was not running.
        }
        GLib.file_set_contents(stampPath, '67');
    }

    _copyText(text) {
        const value = (text || '').trim();
        if (!value)
            return;
        try {
            const clip = St.Clipboard.get_default();
            if (typeof clip.set_text === 'function')
                clip.set_text(St.ClipboardType.CLIPBOARD, value);
            else
                clip.set_content(
                    St.ClipboardType.CLIPBOARD,
                    'text/plain',
                    GLib.Bytes.new(new TextEncoder().encode(value)));
        } catch (error) {
            logError(error, 'Select to Search');
        }
        if (!this._hint)
            return;
        const shown = value.length > 90 ? `${value.slice(0, 90)}…` : value;
        this._hint.set_text(`Copied: ${shown.replace(/\n/g, ' ')}`);
    }

    _beginTextScan() {
        this._ocrGen = (this._ocrGen || 0) + 1;
        try {
            this._ocrCancel?.cancel();
        } catch {
            // The previous scan already finished.
        }
        this._ocrCancel = new Gio.Cancellable();
        this._hint?.set_text('Drag to select an area to search');
        this._ink?.setWords([]);
        this._scanText(0);
    }

    _stopTextScan() {
        this._ocrGen = (this._ocrGen || 0) + 1;
        try {
            this._ocrCancel?.cancel();
        } catch {
            // Already finished.
        }
        this._ocrCancel = null;
        this._ink?.setWords([]);
    }

    _retryScan(generation, attempt) {
        if (attempt >= 4 || generation !== this._ocrGen)
            return;
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
            if (generation === this._ocrGen && !this._destroyed)
                this._scanText(attempt + 1);
            return GLib.SOURCE_REMOVE;
        });
    }

    _scanText(attempt) {
        const ui = this._ui;
        const ink = this._ink;
        const generation = this._ocrGen;
        if (!ui || !ink || this._destroyed)
            return;
        const [inkX, inkY] = ink.actor.get_transformed_position();
        let shotX = 0;
        let shotY = 0;
        try {
            [shotX, shotY] = ui._stageScreenshot.get_transformed_position();
        } catch (error) {
            logError(error, 'Select to Search');
        }
        const width = ink.actor.width;
        const height = ink.actor.height;
        if (width < 10 || height < 10) {
            this._retryScan(generation, attempt);
            return;
        }
        const scale = ui._scale || 1;
        const box = {
            x: inkX - shotX,
            y: inkY - shotY,
            w: width,
            h: height,
        };
        this._crop(ui, box).then(async bytes => {
            if (generation !== this._ocrGen || this._destroyed)
                return;
            const file = this._writeCache(bytes);
            const factor = shrinkScreenshot(file.get_path(), 1400);
            const lang = this._settings.get_string('tesseract-language') || 'eng';
            const result = await recognizeWords(file.get_path(), lang, this._ocrCancel);
            try {
                file.delete(null);
            } catch {
                // The temporary scan can already be gone.
            }
            if (generation !== this._ocrGen || this._destroyed)
                return;
            const divisor = scale * factor;
            const words = (result.words || []).map(word => ({
                ...word,
                x: word.x / divisor,
                y: word.y / divisor,
                w: Math.max(1, word.w / divisor),
                h: Math.max(1, word.h / divisor),
            }));
            ink.setWords(words);
            if (words.length && this._hint)
                this._hint.set_text('Drag across highlighted text to copy it, or drag empty space to search');
        }).catch(error => {
            if (generation !== this._ocrGen)
                return;
            logError(error, 'Select to Search');
            this._retryScan(generation, attempt);
        });
    }

    _enter() {
        const ui = this._ui;
        if (!ui || !this._button)
            return;
        this._updating = true;
        try {
            this._button.toggle_mode = false;
            ui._selectionButton.checked = false;
            ui._screenButton.checked = false;
            ui._windowButton.checked = false;
            this._ink?.show();
            this._hint?.show();
            this._raiseInk();
            this._armEscape();
            this._beginTextScan();
            ui.set_cursor_type(Clutter.CursorType.CROSSHAIR);
        } finally {
            this._updating = false;
        }
    }

    _leave() {
        this._stopTextScan();
        this._disarmEscape();
        this._ink?.cancel();
        this._updating = true;
        try {
            this._ink?.hide();
            this._hint?.hide();
            this._ui?.set_cursor_type(Clutter.CursorType.INHERIT);
            const ui = this._ui;
            if (ui &&
                !ui._selectionButton.checked &&
                !ui._screenButton.checked &&
                !ui._windowButton.checked)
                ui._selectionButton.checked = true;
        } finally {
            this._updating = false;
        }
    }

    _releaseScreenshot() {
        const ui = this._ui;
        if (!ui?.visible)
            return;
        this._releasing = true;
        try {
            ui.close(true);
        } catch (error) {
            logError(error, 'Select to Search');
        } finally {
            this._releasing = false;
        }
    }

    _onCircle() {
        if (this._updating || this._destroyed || !this._button)
            return;
        if (this._button.checked)
            this._enter();
        else
            this._leave();
    }

    _onNative() {
        if (this._updating || this._destroyed || !this._button?.checked)
            return;
        const ui = this._ui;
        const native = ui._selectionButton.checked ||
            ui._screenButton.checked ||
            ui._windowButton.checked;
        if (!native)
            return;
        this._updating = true;
        try {
            this._ink?.cancel();
            this._button.toggle_mode = true;
            this._button.checked = false;
            this._ink?.hide();
            this._hint?.hide();
        } finally {
            this._updating = false;
        }
    }

    _onClosed() {
        this._stopTextScan();
        this._disarmEscape();
        if (!this._releasing) {
            this._gen++;
            this._cancellable?.cancel();
        }
        this._ink?.cancel();
        this._updating = true;
        try {
            this._ink?.hide();
            this._hint?.hide();
            if (this._button?.checked) {
                this._button.toggle_mode = true;
                this._button.checked = false;
            }
            const ui = this._ui;
            if (ui &&
                !ui._selectionButton.checked &&
                !ui._screenButton.checked &&
                !ui._windowButton.checked)
                ui._selectionButton.checked = true;
        } finally {
            this._updating = false;
        }
        this.restoreChrome();
    }

    _armEscape() {
        this._disarmEscape();
        const filter = event => {
            if (this._destroyed || !this._button?.checked)
                return Clutter.EVENT_PROPAGATE;
            let type = -1;
            try {
                type = event.type();
            } catch {
                return Clutter.EVENT_PROPAGATE;
            }
            if (type !== Clutter.EventType.KEY_PRESS || !isEscape(event))
                return Clutter.EVENT_PROPAGATE;
            if (this._ink?.drawing || this._ink?.hasInk()) {
                this._ink.abort();
                return Clutter.EVENT_STOP;
            }
            try {
                this._ui?.close(true);
            } catch (error) {
                logError(error, 'Select to Search');
            }
            return Clutter.EVENT_STOP;
        };
        try {
            if (typeof Clutter.event_add_filter === 'function') {
                this._escapeFilter = Clutter.event_add_filter(null, filter);
                return;
            }
        } catch (error) {
            logError(error, 'Select to Search');
        }
        try {
            this._escapeId = global.stage.connect('captured-event', (_actor, event) => filter(event));
        } catch (error) {
            logError(error, 'Select to Search');
        }
    }

    _disarmEscape() {
        if (this._escapeFilter) {
            try {
                Clutter.event_remove_filter(this._escapeFilter);
            } catch (error) {
                logError(error, 'Select to Search');
            }
            this._escapeFilter = null;
        }
        if (!this._escapeId)
            return;
        try {
            global.stage.disconnect(this._escapeId);
        } catch {
            // The stage may already be gone.
        }
        this._escapeId = 0;
    }

    _connect(obj, signal, callback) {
        const id = obj.connect(signal, callback);
        this._ids.push([obj, id]);
    }

    _raiseInk() {
        const ui = this._ui;
        const ink = this._ink?.actor;
        const bin = ui?._primaryMonitorBin;
        if (!ui || !ink || !bin)
            return;
        if (ink.get_parent() === ui && bin.get_parent() === ui)
            ui.set_child_below_sibling(ink, bin);
    }

    async _crop(ui, box) {
        const content = ui._stageScreenshot.get_content?.();
        if (!content)
            throw new Error('Screenshot UI has no frozen frame');
        const texture = content.get_texture();
        const scale = ui._scale || 1;
        const stream = Gio.MemoryOutputStream.new_resizable();
        await Shell.Screenshot.composite_to_stream(
            texture,
            Math.round(box.x * scale),
            Math.round(box.y * scale),
            Math.max(1, Math.round(box.w * scale)),
            Math.max(1, Math.round(box.h * scale)),
            scale,
            null, 0, 0, 1,
            stream);
        stream.close(null);
        return stream.steal_as_bytes();
    }

    _writeCache(bytes) {
        const dir = GLib.build_filenamev([
            GLib.get_user_cache_dir(), 'circle-to-search']);
        GLib.mkdir_with_parents(dir, 0o700);
        const stamp = `${Date.now()}`;
        const path = GLib.build_filenamev([dir, `selection-${stamp}.png`]);
        const file = Gio.File.new_for_path(path);
        const stream = file.replace(
            null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        stream.write_bytes(bytes, null);
        stream.close(null);
        this._trimCache(dir);
        return file;
    }

    _trimCache(dir) {
        try {
            const folder = Gio.File.new_for_path(dir);
            const enumerator = folder.enumerate_children(
                'standard::name', Gio.FileQueryInfoFlags.NONE, null);
            const names = [];
            let info;
            while ((info = enumerator.next_file(null))) {
                const name = info.get_name();
                if (name.startsWith('selection-') && name.endsWith('.png'))
                    names.push(name);
            }
            enumerator.close(null);
            names.sort();
            const stale = names.slice(0, Math.max(0, names.length - 2));
            for (const name of stale) {
                try {
                    Gio.File.new_for_path(GLib.build_filenamev([dir, name])).delete(null);
                } catch {
                    // Another scan may have removed it.
                }
            }
        } catch (error) {
            logError(error, 'Select to Search');
        }
    }

    _saveCopy(src) {
        const pictures = GLib.get_user_special_dir(
            GLib.UserDirectory.DIRECTORY_PICTURES) || GLib.get_home_dir();
        const folder = GLib.build_filenamev([pictures, 'Screenshots']);
        GLib.mkdir_with_parents(folder, 0o755);
        const stamp = GLib.DateTime.new_now_local().format('%Y-%m-%d %H-%M-%S');
        const dest = Gio.File.new_for_path(GLib.build_filenamev([
            folder, `Circle Search from ${stamp}.png`]));
        src.copy(dest, Gio.FileCopyFlags.OVERWRITE, null, null);
    }

    _flash(ui, box) {
        const flash = new St.Widget({
            style: 'background-color: white;',
            opacity: 0,
            x: box.x,
            y: box.y,
            width: box.w,
            height: box.h,
        });
        ui.insert_child_above(flash, this._ink.actor);
        flash.ease({
            opacity: 170,
            duration: 70,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                flash.ease({
                    opacity: 0,
                    duration: 160,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    onComplete: () => flash.destroy(),
                });
            },
        });
    }
}
