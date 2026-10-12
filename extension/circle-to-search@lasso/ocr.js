// SPDX-License-Identifier: GPL-2.0-or-later

import Gio from 'gi://Gio';

function stdoutFrom(result) {
    if (!Array.isArray(result))
        return '';
    if (result.length >= 3)
        return result[1] || '';
    return result[0] || '';
}

function parseWords(raw) {
    const words = [];
    for (const line of String(raw || '').split('\n')) {
        const cols = line.split('\t');
        if (cols.length < 12 || cols[0] !== '5')
            continue;
        const confidence = Number(cols[10]);
        const text = cols.slice(11).join('\t').trim();
        if (!text || !(confidence >= 40))
            continue;
        words.push({
            x: Number(cols[6]),
            y: Number(cols[7]),
            w: Number(cols[8]),
            h: Number(cols[9]),
            text,
            line: `${cols[2]}:${cols[3]}:${cols[4]}`,
        });
    }
    words.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    words.forEach((word, index) => {
        word.index = index;
    });
    return words;
}

/**
 * Word boxes from tesseract's TSV output. Coordinates are image pixels.
 * Never throws. `missing` means the binary was not found.
 */
export function recognizeWords(path, language, cancellable) {
    const lang = (language || 'eng').trim() || 'eng';
    let proc;
    try {
        proc = Gio.Subprocess.new(
            ['tesseract', path, 'stdout', '-l', lang, '--psm', '3', 'tsv'],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );
    } catch {
        return Promise.resolve({words: [], missing: true});
    }

    return new Promise(resolve => {
        proc.communicate_utf8_async(null, cancellable, (obj, res) => {
            try {
                const result = obj.communicate_utf8_finish(res);
                resolve({words: parseWords(stdoutFrom(result)), missing: false});
            } catch (error) {
                const cancelled = error?.matches?.(
                    Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED);
                resolve({
                    words: [],
                    missing: false,
                    cancelled: Boolean(cancelled),
                    failed: !cancelled,
                });
            }
        });
    });
}
