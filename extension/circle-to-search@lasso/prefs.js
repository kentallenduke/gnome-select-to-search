// SPDX-License-Identifier: GPL-2.0-or-later

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class CircleToSearchPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const page = new Adw.PreferencesPage({
            title: 'Select to Search',
            icon_name: 'edit-find-symbolic',
        });
        window.add(page);

        const group = new Adw.PreferencesGroup();
        page.add(group);

        const settings = this.getSettings();
        const topBar = new Adw.SwitchRow({
            title: 'Show in the top bar',
            subtitle: 'Adds a Select to Search button next to the other status icons',
        });
        this.getSettings().bind(
            'show-top-bar',
            topBar,
            'active',
            Gio.SettingsBindFlags.DEFAULT);
        group.add(topBar);

        const shake = new Adw.SwitchRow({
            title: 'Shake to search',
            subtitle: 'Shake the pointer to open Select to Search',
        });
        settings.bind(
            'shake-enabled',
            shake,
            'active',
            Gio.SettingsBindFlags.DEFAULT);
        group.add(shake);

        const sensitivity = new Adw.ActionRow({
            title: 'Shake sensitivity',
            subtitle: 'Higher triggers more easily',
        });
        const scale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            draw_value: true,
            digits: 0,
            hexpand: true,
            width_request: 180,
            valign: Gtk.Align.CENTER,
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 100,
                step_increment: 1,
                page_increment: 10,
            }),
        });
        settings.bind(
            'shake-sensitivity',
            scale.get_adjustment(),
            'value',
            Gio.SettingsBindFlags.DEFAULT);
        settings.bind(
            'shake-enabled',
            sensitivity,
            'sensitive',
            Gio.SettingsBindFlags.DEFAULT);
        sensitivity.add_suffix(scale);
        group.add(sensitivity);
    }
}
