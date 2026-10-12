import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import {
  AppWindow,
  BatteryFull,
  Square,
  Copy,
  Download,
  Monitor,
  SquareDashed,
  Volume2,
  Wifi,
  X,
} from "lucide-react";
import { gridPoints, regionForGesture, selectionRegion, type Box, type Pt } from "@/lib/gesture";
import { SPOTS, SPOT_ORDER } from "@/lib/spots";

type Tool = "circle" | "selection" | "screen" | "window";

type Result =
  | { kind: "spot"; id: string; also: string[] }
  | { kind: "screen" }
  | { kind: "empty" }
  | { kind: "need"; message: string };

const INSTALL = `cd ~/Downloads
gnome-extensions install --force circle-to-search@lasso-2.0.0.shell-extension.zip
gnome-extensions enable circle-to-search@lasso`;

const TRACEBACK = `Traceback (most recent call last):
  File "sync.py", line 42, in push
    token = config["HARBOR_TOKEN"]
KeyError: 'HARBOR_TOKEN'`;

export function Studio() {
  const stageRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const pointsRef = useRef<Pt[]>([]);
  const frameRef = useRef(0);
  const dragRef = useRef<Pt | null>(null);
  const drawingRef = useRef(false);

  const [aiming, setAiming] = useState(false);
  const [tool, setTool] = useState<Tool>("circle");
  const [ink, setInk] = useState<Pt[]>([]);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [windowId, setWindowId] = useState<string | null>(null);
  const [flash, setFlash] = useState<Box | null>(null);
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [install, setInstall] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState("");

  useEffect(() => {
    const format = () =>
      new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
        new Date(),
      );
    setNow(format());
    const id = window.setInterval(() => setNow(format()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (event.key === "Escape") {
        if (install) setInstall(false);
        else if (aiming && tool === "circle" && (drawingRef.current || marquee)) {
          drawingRef.current = false;
          dragRef.current = null;
          setMarquee(null);
        } else if (result || reading) {
          setResult(null);
          setReading(false);
        } else if (aiming) closeAim();
        return;
      }
      if (install) return;
      if (!aiming) {
        if (event.key === "s" || event.key === "S") {
          event.preventDefault();
          openAim();
        }
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "l") pickTool("circle");
      else if (key === "s") pickTool("selection");
      else if (key === "c") pickTool("screen");
      else if (key === "w") pickTool("window");
      else if (event.key === "Enter") {
        event.preventDefault();
        searchCurrent();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function openAim() {
    setAiming(true);
    setTool("circle");
    setInk([]);
    setMarquee(null);
    setWindowId(null);
    setResult(null);
    setReading(false);
    pointsRef.current = [];
  }

  function closeAim() {
    setAiming(false);
    setInk([]);
    setMarquee(null);
    setResult(null);
    setReading(false);
    setFlash(null);
    pointsRef.current = [];
  }

  function pickTool(next: Tool) {
    setTool(next);
    setInk([]);
    setMarquee(null);
    setResult(null);
    setReading(false);
    pointsRef.current = [];
    if (next !== "window") setWindowId(null);
  }

  function localPoint(event: { clientX: number; clientY: number }): Pt | null {
    const stage = stageRef.current;
    if (!stage) return null;
    const rect = stage.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100),
    };
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!aiming || reading) return;
    if (result) {
      setResult(null);
      setInk([]);
      pointsRef.current = [];
    }
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointers and some browsers refuse capture; the gesture still tracks.
    }
    drawingRef.current = true;
    const point = localPoint(event);
    if (!point) return;
    if (tool === "circle" || tool === "selection") {
      dragRef.current = point;
      setMarquee({ x: point.x, y: point.y, w: 0.4, h: 0.4 });
      setInk([]);
    } else if (tool === "window") {
      const id = windowUnder(event.clientX, event.clientY);
      setWindowId(id);
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drawingRef.current) return;
    const point = localPoint(event);
    if (!point) return;
    if ((tool === "circle" || tool === "selection") && dragRef.current) {
      const start = dragRef.current;
      setMarquee({
        x: Math.min(start.x, point.x),
        y: Math.min(start.y, point.y),
        w: Math.abs(point.x - start.x),
        h: Math.abs(point.y - start.y),
      });
    }
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    drawingRef.current = false;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Already released.
    }
    if (tool === "circle" && dragRef.current) {
      const point = localPoint(event);
      const start = dragRef.current;
      dragRef.current = null;
      setMarquee(null);
      if (!point) return;
      const box = {
        x: Math.min(start.x, point.x),
        y: Math.min(start.y, point.y),
        w: Math.abs(point.x - start.x),
        h: Math.abs(point.y - start.y),
      };
      if (boxSpan(box, stageRef.current) <= 100) return;
      const region = selectionRegion(box);
      commit(region, gridPoints(region));
    } else if (tool === "selection") {
      dragRef.current = null;
    }
  }

  function searchCurrent() {
    if (tool === "circle") {
      if (!marquee || (marquee.w < 1 && marquee.h < 1)) {
        setReading(false);
        setAiming(false);
        setResult({
          kind: "need",
          message: "Drag a rectangle around something first.",
        });
        return;
      }
      if (boxSpan(marquee, stageRef.current) <= 100) {
        setMarquee(null);
        return;
      }
      commit(selectionRegion(marquee), gridPoints(marquee));
      return;
    }
    if (tool === "selection") {
      if (!marquee) {
        setReading(false);
        setAiming(false);
        setResult({ kind: "need", message: "Drag a rectangle, then press the shutter." });
        return;
      }
      const region = selectionRegion(marquee);
      commit(region, gridPoints(region));
      return;
    }
    if (tool === "screen") {
      finish("screen", null);
      return;
    }
    if (!windowId) {
      setReading(false);
      setAiming(false);
      setResult({ kind: "need", message: "Click a window, then press the shutter." });
      return;
    }
    const stage = stageRef.current;
    const node = stage?.querySelector(`[data-window="${windowId}"]`);
    if (!stage || !(node instanceof HTMLElement)) return;
    const region = boxOf(stage, node);
    commit(region, gridPoints(region));
  }

  function commit(region: Box, samples: Pt[]) {
    const scores = tally(samples, 1);
    const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    if (ranked.length === 0 || ranked[0][1] < 2) {
      finish("empty", region);
      return;
    }
    const also = ranked
      .slice(1)
      .filter(([, score]) => score >= 2 && score >= ranked[0][1] * 0.45)
      .map(([id]) => id);
    finish({ kind: "spot", id: ranked[0][0], also }, region);
  }

  function finish(next: Result | "screen" | "empty", region: Box | null) {
    if (next === "screen") setResult({ kind: "screen" });
    else if (next === "empty") setResult({ kind: "empty" });
    else setResult(next);
    setReading(next !== "empty" && !(typeof next === "object" && next.kind === "need"));
    setAiming(false);
    setInk([]);
    setMarquee(null);
    pointsRef.current = [];
    if (region) {
      setFlash(region);
      window.setTimeout(() => setFlash(null), 260);
    }
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 700;
    window.setTimeout(() => setReading(false), delay);
  }

  function tally(samples: Pt[], weight: number) {
    const stage = stageRef.current;
    const scores = new Map<string, number>();
    if (!stage) return scores;
    const rect = stage.getBoundingClientRect();
    stage.classList.add("is-sampling");
    try {
      for (const point of samples) {
        const x = rect.left + (point.x / 100) * rect.width;
        const y = rect.top + (point.y / 100) * rect.height;
        for (const el of document.elementsFromPoint(x, y)) {
          const host = el.closest("[data-hotspot]");
          if (host instanceof HTMLElement && host.dataset.hotspot) {
            const id = host.dataset.hotspot;
            scores.set(id, (scores.get(id) ?? 0) + weight);
            break;
          }
        }
      }
    } finally {
      stage.classList.remove("is-sampling");
    }
    return scores;
  }

  function windowUnder(clientX: number, clientY: number) {
    const stage = stageRef.current;
    if (!stage) return null;
    stage.classList.add("is-sampling");
    try {
      for (const el of document.elementsFromPoint(clientX, clientY)) {
        const win = el.closest("[data-window]");
        if (win instanceof HTMLElement && win.dataset.window) return win.dataset.window;
      }
    } finally {
      stage.classList.remove("is-sampling");
    }
    return null;
  }

  const hint =
    tool === "circle"
      ? marquee
        ? ""
        : "Drag to select an area to search"
      : tool === "selection"
        ? "Drag a region, then press the shutter"
        : tool === "screen"
          ? "The whole screen. Press the shutter."
          : windowId
            ? "Window selected. Press the shutter."
            : "Click a window, then press the shutter";

  const clockSpot = {
    ...SPOTS.clock,
    quote: now || "–:––",
    title: now || "Clock",
  };

  return (
    <main className="page">
      <header className="top">
        <div className="mark">
          <img src="/favicon.svg" alt="" width={36} height={36} />
          <div>
            <p className="eyebrow">GNOME 51</p>
            <h1>Select to Search</h1>
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={aiming ? closeAim : openAim}>
            {aiming ? "Close screenshot" : "Select to Search"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setInstall(true)}>
            Install the extension
          </button>
        </div>
      </header>
      <p className="lede">
        Drag a rectangle on the frozen desktop, including the whole screen, then release.
        Select to Search opens at the bottom right and sends that screenshot to Gemini, with no extra
        text. Press <kbd>S</kbd>, shake the pointer, or use the pointer in the top bar.
      </p>
      <p className="keys">
        Try the red panda, the recipe, the KeyError, or the Japanese line.
        {aiming ? " Inside the tool: L select, S selection, C screen, W window, Enter searches." : null}
      </p>

      <div className="monitor">
        <div
          ref={stageRef}
          className={`screen${aiming ? ` is-${tool}` : ""}`}
        >
          <img className="wallpaper" src="/scene/coast.jpg" alt="" />
          <article className={`win win-loupe${windowId === "loupe" ? " is-selected" : ""}`} data-window="loupe">
            <div className="win-bar">
              <i className="dot" aria-hidden="true" />
              <span>red-panda.jpg</span>
            </div>
            <div className="win-body">
              <img className="photo" src="/scene/panda.jpg" alt="Red panda on a mossy branch" data-hotspot="panda" />
            </div>
          </article>
          <article className={`win win-web${windowId === "web" ? " is-selected" : ""}`} data-window="web">
            <div className="win-bar">
              <i className="dot" aria-hidden="true" />
              <span>Recipes</span>
            </div>
            <div className="win-body article" data-hotspot="recipe">
              <div className="url">recipes.local/miso-noodles</div>
              <h2>Brown-butter miso noodles</h2>
              <img src="/scene/noodles.jpg" alt="Noodles with brown butter, miso, scallions, and chili crisp" />
              <p>
                Toss 200 g wheat noodles with 2 tbsp brown butter, 1 tbsp white miso, and a splash of pasta water.
                Finish with scallions and chili crisp.
              </p>
            </div>
          </article>
          <article className={`win win-note${windowId === "note" ? " is-selected" : ""}`} data-window="note">
            <div className="win-bar">
              <i className="dot" aria-hidden="true" />
              <span>note.txt</span>
            </div>
            <div className="win-body note" data-hotspot="note">
              <p>明日の朝、海岸を歩こう。</p>
            </div>
          </article>
          <article className={`win win-term${windowId === "term" ? " is-selected" : ""}`} data-window="term">
            <div className="win-bar">
              <i className="dot" aria-hidden="true" />
              <span>Terminal — sync.py</span>
            </div>
            <pre className="term win-body" data-hotspot="traceback">
              {TRACEBACK.split("KeyError")[0]}
              <span className="err">KeyError: 'HARBOR_TOKEN'</span>
            </pre>
          </article>
          <div className="topbar">
            <div className="activities">Activities</div>
            <button type="button" className="clock" data-hotspot="clock">
              {now || "–:––"}
            </button>
            <div className="status">
              <button
                type="button"
                className="panel-launch"
                aria-label="Select to Search"
                onClick={openAim}
              >
                <CursorMark />
              </button>
              <span className="status-icons" aria-hidden="true">
                <Wifi />
                <Volume2 />
                <BatteryFull />
              </span>
            </div>
          </div>

          {aiming ? (
            <>
              {tool !== "circle" ? <div className="scrim chrome" /> : null}
              {tool === "circle" && marquee ? (
                <>
                  <div
                    className="select-glow chrome"
                    style={{
                      left: `${marquee.x}%`,
                      top: `${marquee.y}%`,
                      width: `${marquee.w}%`,
                      height: `${marquee.h}%`,
                    }}
                  />
                  <div
                    className="select-name chrome"
                    style={{
                      left: `${marquee.x + marquee.w / 2}%`,
                      top: `${marquee.y}%`,
                    }}
                  >
                    Search with Gemini
                  </div>
                  <div
                    className="select-size chrome"
                    style={{
                      left: `${marquee.x + marquee.w / 2}%`,
                      top: `${marquee.y + marquee.h}%`,
                    }}
                  >
                    {boxPixels(marquee, stageRef.current)}
                  </div>
                </>
              ) : null}
              {tool === "selection" && marquee ? (
                <div
                  className="marquee chrome"
                  style={{
                    left: `${marquee.x}%`,
                    top: `${marquee.y}%`,
                    width: `${marquee.w}%`,
                    height: `${marquee.h}%`,
                  }}
                />
              ) : null}
              {flash ? (
                <div
                  className="flash chrome"
                  style={{
                    left: `${flash.x}%`,
                    top: `${flash.y}%`,
                    width: `${flash.w}%`,
                    height: `${flash.h}%`,
                  }}
                />
              ) : null}
              {hint ? <div className="aim-hint chrome">{hint}</div> : null}
              <div
                ref={captureRef}
                className="capture chrome"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              />
              <div className="panel chrome">
                <button type="button" className="panel-x" onClick={closeAim} aria-label="Close screenshot">
                  <X size={16} />
                </button>
                <div className="panel-card">
                  <div className="type-row" role="toolbar" aria-label="Screenshot type">
                    <TypeButton label="Select" selected={tool === "circle"} onClick={() => pickTool("circle")}>
                      <Square />
                    </TypeButton>
                    <TypeButton label="Selection" selected={tool === "selection"} onClick={() => pickTool("selection")}>
                      <SquareDashed />
                    </TypeButton>
                    <TypeButton label="Screen" selected={tool === "screen"} onClick={() => pickTool("screen")}>
                      <Monitor />
                    </TypeButton>
                    <TypeButton label="Window" selected={tool === "window"} onClick={() => pickTool("window")}>
                      <AppWindow />
                    </TypeButton>
                  </div>
                  <button type="button" className="shutter" onClick={searchCurrent} aria-label="Capture">
                    <span />
                  </button>
                </div>
              </div>
            </>
          ) : null}
          {result ? (
            <aside className="cts-pop" aria-live="polite" aria-label="Select to Search">
              <header className="cts-bar">
                <AppCursor />
                <strong>Select to Search</strong>
                <button
                  type="button"
                  className="cts-x"
                  aria-label="Close"
                  onClick={() => {
                    setResult(null);
                    setReading(false);
                  }}
                >
                  <X size={16} />
                </button>
              </header>
              <div className="cts-view">
                {reading ? (
                  <p className="cts-wait">Sending the screenshot to Gemini…</p>
                ) : result.kind === "need" ? (
                  <p>{result.message}</p>
                ) : result.kind === "empty" ? (
                  <>
                    <p className="cts-chip">Screenshot</p>
                    <h2>Nothing in that selection</h2>
                    <p>Try the red panda, the recipe, the error in the terminal, or the Japanese line.</p>
                  </>
                ) : result.kind === "screen" ? (
                  <>
                    <p className="cts-chip">Screenshot</p>
                    <h2>Four things on this desktop</h2>
                    <div className="spot-list">
                      {SPOT_ORDER.map((id) => (
                        <button key={id} type="button" onClick={() => setResult({ kind: "spot", id, also: [] })}>
                          {id === "clock" ? clockSpot.title : SPOTS[id].title}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="cts-chip">Screenshot</p>
                    <SpotView
                      id={result.id}
                      also={result.also}
                      clockQuote={clockSpot.quote}
                      clockTitle={clockSpot.title}
                      onAlso={(id) => setResult({ kind: "spot", id, also: [] })}
                    />
                  </>
                )}
              </div>
            </aside>
          ) : null}
        </div>
      </div>

      {install ? (
        <div className="drawer-scrim" onClick={() => setInstall(false)}>
          <aside
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="install-title">Install on GNOME 51</h2>
            <p>
              Select to Search 2.0 adds a Select tool to the screenshot UI. Gemini is not opened
              when you log in. Drag a rectangle, including one that covers the whole screen, and
              release. The window opens, attaches that screenshot once, and sends it. Closing the
              window stops the browser process. A selection about 100×100 or smaller is ignored.
              Press Esc to cancel.
            </p>
            <div className="steps">
              <div className="step">
                <strong>1. Install the packages</strong>
                GNOME 51 already includes the shell. The window also needs GJS, GTK 4, libadwaita,
                and WebKitGTK 6.0. gtk4-layer-shell keeps it in the corner. Tesseract is only for
                copying text out of a picture.
              </div>
              <div className="step">
                <strong>2. Download the zip</strong>
                Save it somewhere you can find, usually Downloads. Do not unzip it.
              </div>
              <div className="step">
                <strong>3. Install and enable</strong>
                Run the commands below from the folder that contains the zip. If you already
                have an older copy, <code>--force</code> replaces it.
              </div>
              <div className="step">
                <strong>4. Log out and back in</strong>
                GNOME keeps the previous extension in memory until a new login. Do this again
                after every update.
              </div>
              <div className="step">
                <strong>5. Use it</strong>
                Use the pointer in the top bar, shake the pointer, press Super+Print, or open the
                screenshot tool and choose Select (L). Drag highlighted words to copy them, or drag
                empty space to search a picture. Sign in to Gemini the first time. Closing the
                window stops its browser process. Settings has a top-bar switch, plus a shake
                switch and a sensitivity slider.
              </div>
            </div>
            <h3>Packages</h3>
            <p className="distro-name">Debian and Ubuntu</p>
            <pre className="cmd">{`sudo apt install gjs gir1.2-gtk-4.0 gir1.2-adw-1 gir1.2-webkit-6.0 gir1.2-gtk4layershell-1 tesseract-ocr tesseract-ocr-eng`}</pre>
            <p className="distro-name">Fedora</p>
            <pre className="cmd">{`sudo dnf install gjs gtk4 libadwaita webkitgtk6.0 gtk4-layer-shell tesseract tesseract-langpack-eng`}</pre>
            <p className="distro-name">Arch Linux</p>
            <pre className="cmd">{`sudo pacman -S gjs gtk4 libadwaita webkitgtk-6.0 gtk4-layer-shell tesseract tesseract-data-eng`}</pre>
            <p>
              For another language, install that Tesseract pack too, for example
              <code> tesseract-ocr-jpn</code>, <code>tesseract-langpack-jpn</code>, or
              <code> tesseract-data-jpn</code>.
            </p>
            <div className="drawer-actions">
              <a className="btn btn-primary" href="/circle-to-search@lasso-2.0.0.shell-extension.zip" download>
                <Download size={16} />
                Download extension
              </a>
            </div>
            <pre className="cmd">{INSTALL}</pre>
            <div className="drawer-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  void navigator.clipboard.writeText(INSTALL).then(
                    () => setCopied(true),
                    () => setCopied(false),
                  );
                }}
              >
                <Copy size={16} />
                {copied ? "Copied" : "Copy commands"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setInstall(false)}>
                Close
              </button>
            </div>
            <p>
              Needs the GNOME 51 session and WebKitGTK 6, which the desktop already ships.
              No OCR package. Not affiliated with Google.
            </p>
          </aside>
        </div>
      ) : null}
    </main>
  );
}

function boxPixels(box: Box, stage: HTMLDivElement | null) {
  if (!stage) return "0x0";
  const rect = stage.getBoundingClientRect();
  const w = Math.max(1, Math.round((box.w / 100) * rect.width));
  const h = Math.max(1, Math.round((box.h / 100) * rect.height));
  return `${w}x${h}`;
}

function boxSpan(box: Box, stage: HTMLDivElement | null) {
  if (!stage) return 0;
  const rect = stage.getBoundingClientRect();
  return Math.max((box.w / 100) * rect.width, (box.h / 100) * rect.height);
}

function strokeSpan(points: Pt[], stage: HTMLDivElement | null) {
  if (!stage || points.length < 3) return null;
  const rect = stage.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let travelled = 0;
  for (let i = 0; i < points.length; i++) {
    const x = (points[i].x / 100) * rect.width;
    const y = (points[i].y / 100) * rect.height;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    if (i > 0) {
      const px = (points[i - 1].x / 100) * rect.width;
      const py = (points[i - 1].y / 100) * rect.height;
      travelled += Math.hypot(x - px, y - py);
    }
  }
  if (travelled < 18) return null;
  return Math.max(maxX - minX, maxY - minY);
}

function CursorMark() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="M8 0.9 C8.55 5.4 10.6 7.45 15.1 8 C10.6 8.55 8.55 10.6 8 15.1 C7.45 10.6 5.4 8.55 0.9 8 C5.4 7.45 7.45 5.4 8 0.9 Z" />
    </svg>
  );
}

function AppCursor() {
  return (
    <svg className="cts-appicon" viewBox="0 0 128 128" width="22" height="22" aria-hidden="true">
      <rect x="4" y="4" width="120" height="120" rx="28" fill="#3584e4" />
      <path fill="#ffffff" d="M40 30 L40 90 L55 75 L68 106 L80 100 L67 71 L90 69 Z" />
      <path fill="#99c1f1" d="M94 24 L97.2 34.2 L107.4 37.4 L97.2 40.6 L94 50.8 L90.8 40.6 L80.6 37.4 L90.8 34.2 Z" />
    </svg>
  );
}

function TypeButton({
  label,
  selected,
  onClick,
  children,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className={`type-btn${selected ? " is-on" : ""}`} aria-pressed={selected} onClick={onClick}>
      {children}
      <span>{label}</span>
    </button>
  );
}

function SpotView({
  id,
  also,
  clockQuote,
  clockTitle,
  onAlso,
}: {
  id: string;
  also: string[];
  clockQuote: string;
  clockTitle: string;
  onAlso: (id: string) => void;
}) {
  const spot = id === "clock" ? { ...SPOTS.clock, quote: clockQuote, title: clockTitle } : SPOTS[id];
  if (!spot) return null;
  return (
    <>
      <h2>{spot.title}</h2>
      {spot.quote ? <div className="quote">{spot.quote}</div> : null}
      {spot.translation ? <p className="translation">{spot.translation}</p> : null}
      {spot.body ? <p>{spot.body}</p> : null}
      {spot.links.length > 0 ? (
        <div className="link-list">
          {spot.links.map((link) => (
            <a key={link.href} className="link" href={link.href} target="_blank" rel="noreferrer">
              <strong>{link.label}</strong>
              <span>{link.detail}</span>
            </a>
          ))}
        </div>
      ) : null}
      {also.length > 0 ? (
        <div className="also">
          {also.map((other) => (
            <button key={other} type="button" onClick={() => onAlso(other)}>
              Also: {SPOTS[other]?.title}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function boxOf(stage: HTMLElement, node: HTMLElement): Box {
  const outer = stage.getBoundingClientRect();
  const inner = node.getBoundingClientRect();
  return {
    x: ((inner.left - outer.left) / outer.width) * 100,
    y: ((inner.top - outer.top) / outer.height) * 100,
    w: (inner.width / outer.width) * 100,
    h: (inner.height / outer.height) * 100,
  };
}
