import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as SquareDashed, c as Copy, d as AppWindow, l as Circle, n as Wifi, o as Monitor, r as Volume2, s as Download, t as X, u as BatteryFull } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-Db7uZk-h.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function clampBox(box) {
	const x = Math.max(0, Math.min(100, box.x));
	const y = Math.max(0, Math.min(100, box.y));
	const right = Math.max(x + .8, Math.min(100, box.x + box.w));
	const bottom = Math.max(y + .8, Math.min(100, box.y + box.h));
	return {
		x,
		y,
		w: right - x,
		h: bottom - y
	};
}
function travel(points) {
	let total = 0;
	for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
	return total;
}
/** A short tap becomes a region under the pointer. A real stroke uses its bounds. */
function regionForGesture(points) {
	if (points.length === 0) return null;
	let minX = 100;
	let minY = 100;
	let maxX = 0;
	let maxY = 0;
	for (const p of points) {
		minX = Math.min(minX, p.x);
		minY = Math.min(minY, p.y);
		maxX = Math.max(maxX, p.x);
		maxY = Math.max(maxY, p.y);
	}
	const box = {
		x: minX,
		y: minY,
		w: maxX - minX,
		h: maxY - minY
	};
	if (points.length < 3 || travel(points) < 2.4) {
		const cx = box.x + box.w / 2;
		const cy = box.y + box.h / 2;
		return clampBox({
			x: cx - 11,
			y: cy - 9,
			w: 22,
			h: 18
		});
	}
	return clampBox({
		x: box.x - 1.2,
		y: box.y - 1.2,
		w: box.w + 2.4,
		h: box.h + 2.4
	});
}
function gridPoints(box, cols = 5, rows = 4) {
	const pts = [];
	for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) pts.push({
		x: box.x + box.w * (c + .5) / cols,
		y: box.y + box.h * (r + .5) / rows
	});
	return pts;
}
function selectionRegion(box) {
	if (box.w < 2 && box.h < 2) return regionForGesture([{
		x: box.x,
		y: box.y
	}, {
		x: box.x + box.w,
		y: box.y + box.h
	}]) ?? box;
	return clampBox(box);
}
var SPOTS = {
	panda: {
		kicker: "No text in the selection",
		title: "Red panda",
		quote: "",
		body: "Ailurus fulgens, on a mossy branch. Temperate forests of the eastern Himalayas and southwestern China. The diet is almost entirely bamboo.",
		links: [{
			label: "Red panda",
			href: "https://en.wikipedia.org/wiki/Red_panda",
			detail: "Species account"
		}, {
			label: "Ailuridae",
			href: "https://en.wikipedia.org/wiki/Ailuridae",
			detail: "The family it sits in"
		}]
	},
	recipe: {
		kicker: "Text in the selection",
		title: "Brown-butter miso noodles",
		quote: "Toss 200 g wheat noodles with 2 tbsp brown butter, 1 tbsp white miso, and a splash of pasta water. Finish with scallions and chili crisp.",
		body: "A weeknight bowl. On the desktop, Tesseract would return the words in the circle.",
		links: [{
			label: "Miso",
			href: "https://en.wikipedia.org/wiki/Miso",
			detail: "Fermented soybean paste"
		}, {
			label: "Chili crisp",
			href: "https://en.wikipedia.org/wiki/Chili_crisp",
			detail: "The crunch on top"
		}]
	},
	traceback: {
		kicker: "Text in the selection",
		title: "KeyError: 'HARBOR_TOKEN'",
		quote: "File \"sync.py\", line 42, in push\n    token = config[\"HARBOR_TOKEN\"]\nKeyError: 'HARBOR_TOKEN'",
		body: "That key is missing, so push() stops before it can run. Set the variable, or test for the key before indexing it.",
		links: [{
			label: "KeyError",
			href: "https://docs.python.org/3/library/exceptions.html#KeyError",
			detail: "Python docs"
		}]
	},
	note: {
		kicker: "Text · Japanese",
		title: "明日の朝、海岸を歩こう。",
		quote: "明日の朝、海岸を歩こう。",
		translation: "Let's walk along the coast tomorrow morning.",
		body: "",
		links: [{
			label: "Look up the sentence",
			href: "https://jisho.org/search/%E6%98%8E%E6%97%A5%E3%81%AE%E6%9C%9D%E3%80%81%E6%B5%B7%E5%B2%B8%E3%82%92%E6%AD%A9%E3%81%93%E3%81%86%E3%80%82",
			detail: "Jisho"
		}]
	},
	clock: {
		kicker: "Text in the selection",
		title: "Clock",
		quote: "",
		body: "The time in the top bar.",
		links: []
	}
};
var SPOT_ORDER = [
	"panda",
	"recipe",
	"traceback",
	"note",
	"clock"
];
var INSTALL = `gnome-extensions install --force circle-to-search@lasso.shell-extension.zip
gnome-extensions enable circle-to-search@lasso`;
var TRACEBACK = `Traceback (most recent call last):
  File "sync.py", line 42, in push
    token = config["HARBOR_TOKEN"]
KeyError: 'HARBOR_TOKEN'`;
function Studio() {
	const stageRef = (0, import_react.useRef)(null);
	const captureRef = (0, import_react.useRef)(null);
	const pointsRef = (0, import_react.useRef)([]);
	const frameRef = (0, import_react.useRef)(0);
	const dragRef = (0, import_react.useRef)(null);
	const drawingRef = (0, import_react.useRef)(false);
	const [aiming, setAiming] = (0, import_react.useState)(false);
	const [tool, setTool] = (0, import_react.useState)("circle");
	const [ink, setInk] = (0, import_react.useState)([]);
	const [marquee, setMarquee] = (0, import_react.useState)(null);
	const [windowId, setWindowId] = (0, import_react.useState)(null);
	const [flash, setFlash] = (0, import_react.useState)(null);
	const [reading, setReading] = (0, import_react.useState)(false);
	const [result, setResult] = (0, import_react.useState)(null);
	const [install, setInstall] = (0, import_react.useState)(false);
	const [copied, setCopied] = (0, import_react.useState)(false);
	const [now, setNow] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		const format = () => new Intl.DateTimeFormat(void 0, {
			hour: "numeric",
			minute: "2-digit"
		}).format(/* @__PURE__ */ new Date());
		setNow(format());
		const id = window.setInterval(() => setNow(format()), 3e4);
		return () => window.clearInterval(id);
	}, []);
	(0, import_react.useEffect)(() => {
		const onKey = (event) => {
			const tag = event.target?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") return;
			if (event.key === "Escape") {
				if (install) setInstall(false);
				else if (result || reading) {
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
	function pickTool(next) {
		setTool(next);
		setInk([]);
		setMarquee(null);
		setResult(null);
		setReading(false);
		pointsRef.current = [];
		if (next !== "window") setWindowId(null);
	}
	function localPoint(event) {
		const stage = stageRef.current;
		if (!stage) return null;
		const rect = stage.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return null;
		return {
			x: clamp((event.clientX - rect.left) / rect.width * 100),
			y: clamp((event.clientY - rect.top) / rect.height * 100)
		};
	}
	function onPointerDown(event) {
		if (!aiming || reading) return;
		if (result) {
			setResult(null);
			setInk([]);
			pointsRef.current = [];
		}
		event.preventDefault();
		try {
			event.currentTarget.setPointerCapture(event.pointerId);
		} catch {}
		drawingRef.current = true;
		const point = localPoint(event);
		if (!point) return;
		if (tool === "circle") {
			pointsRef.current = [point];
			setInk([point]);
		} else if (tool === "selection") {
			dragRef.current = point;
			setMarquee({
				x: point.x,
				y: point.y,
				w: .8,
				h: .8
			});
		} else if (tool === "window") {
			const id = windowUnder(event.clientX, event.clientY);
			setWindowId(id);
		}
	}
	function onPointerMove(event) {
		if (!drawingRef.current) return;
		const point = localPoint(event);
		if (!point) return;
		if (tool === "circle" && pointsRef.current.length > 0) {
			const prev = pointsRef.current[pointsRef.current.length - 1];
			if (Math.hypot(point.x - prev.x, point.y - prev.y) < .35) return;
			pointsRef.current.push(point);
			if (!frameRef.current) frameRef.current = window.requestAnimationFrame(() => {
				frameRef.current = 0;
				setInk(pointsRef.current.slice());
			});
		} else if (tool === "selection" && dragRef.current) {
			const start = dragRef.current;
			setMarquee({
				x: Math.min(start.x, point.x),
				y: Math.min(start.y, point.y),
				w: Math.abs(point.x - start.x),
				h: Math.abs(point.y - start.y)
			});
		}
	}
	function onPointerUp(event) {
		drawingRef.current = false;
		try {
			if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
		} catch {}
		if (tool === "circle" && pointsRef.current.length > 0) {
			const pts = pointsRef.current.slice();
			setInk(pts);
			const region = regionForGesture(pts);
			pointsRef.current = [];
			if (region) commit(region, [...gridPoints(region), ...pts.filter((_, index) => index % 2 === 0)]);
		} else if (tool === "selection") dragRef.current = null;
	}
	function searchCurrent() {
		if (tool === "circle") {
			const pts = pointsRef.current.length > 0 ? pointsRef.current.slice() : ink;
			const region = regionForGesture(pts);
			if (!region) {
				setResult({
					kind: "need",
					message: "Circle something first, or tap the thing you want."
				});
				return;
			}
			commit(region, [...gridPoints(region), ...pts.filter((_, index) => index % 2 === 0)]);
			return;
		}
		if (tool === "selection") {
			if (!marquee) {
				setResult({
					kind: "need",
					message: "Drag a rectangle, then press the shutter."
				});
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
			setResult({
				kind: "need",
				message: "Click a window, then press the shutter."
			});
			return;
		}
		const stage = stageRef.current;
		const node = stage?.querySelector(`[data-window="${windowId}"]`);
		if (!stage || !(node instanceof HTMLElement)) return;
		const region = boxOf(stage, node);
		commit(region, gridPoints(region));
	}
	function commit(region, samples) {
		const ranked = [...tally(samples, 1).entries()].sort((a, b) => b[1] - a[1]);
		if (ranked.length === 0 || ranked[0][1] < 2) {
			finish("empty", region);
			return;
		}
		const also = ranked.slice(1).filter(([, score]) => score >= 2 && score >= ranked[0][1] * .45).map(([id]) => id);
		finish({
			kind: "spot",
			id: ranked[0][0],
			also
		}, region);
	}
	function finish(next, region) {
		if (next === "screen") setResult({ kind: "screen" });
		else if (next === "empty") setResult({ kind: "empty" });
		else setResult(next);
		setReading(true);
		if (region) {
			setFlash(region);
			window.setTimeout(() => setFlash(null), 260);
		}
		const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 420;
		window.setTimeout(() => setReading(false), delay);
	}
	function tally(samples, weight) {
		const stage = stageRef.current;
		const scores = /* @__PURE__ */ new Map();
		if (!stage) return scores;
		const rect = stage.getBoundingClientRect();
		stage.classList.add("is-sampling");
		try {
			for (const point of samples) {
				const x = rect.left + point.x / 100 * rect.width;
				const y = rect.top + point.y / 100 * rect.height;
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
	function windowUnder(clientX, clientY) {
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
	const hint = tool === "circle" ? "Circle, scribble, or tap — release to search" : tool === "selection" ? "Drag a region, then press the shutter" : tool === "screen" ? "The whole screen. Press the shutter." : windowId ? "Window selected. Press the shutter." : "Click a window, then press the shutter";
	const clockSpot = {
		...SPOTS.clock,
		quote: now || "–:––",
		title: now || "Clock"
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "page",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "top",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mark",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: "/favicon.svg",
						alt: "",
						width: 36,
						height: 36
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "eyebrow",
						children: "GNOME 51"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: "Circle to Search" })] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "actions",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn btn-primary",
						onClick: aiming ? closeAim : openAim,
						children: aiming ? "Close screenshot" : "Circle to Search"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn btn-ghost",
						onClick: () => setInstall(true),
						children: "Install the extension"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "lede",
				children: [
					"Draw on the frozen desktop. The extension does this inside GNOME’s own screenshot tool — this is the gesture, on a sample screen. Press ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", { children: "S" }),
					" to start."
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "keys",
				children: ["Try the red panda, the recipe, the KeyError, or the Japanese line.", aiming ? " Inside the tool: L circle, S selection, C screen, W window, Enter searches." : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "monitor",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					ref: stageRef,
					className: `screen${aiming ? ` is-${tool}` : ""}`,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							className: "wallpaper",
							src: "/scene/coast.jpg",
							alt: ""
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
							className: `win win-loupe${windowId === "loupe" ? " is-selected" : ""}`,
							"data-window": "loupe",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "win-bar",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
									className: "dot",
									"aria-hidden": "true"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "red-panda.jpg" })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "win-body",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
									className: "photo",
									src: "/scene/panda.jpg",
									alt: "Red panda on a mossy branch",
									"data-hotspot": "panda"
								})
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
							className: `win win-web${windowId === "web" ? " is-selected" : ""}`,
							"data-window": "web",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "win-bar",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
									className: "dot",
									"aria-hidden": "true"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Recipes" })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "win-body article",
								"data-hotspot": "recipe",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "url",
										children: "recipes.local/miso-noodles"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Brown-butter miso noodles" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: "/scene/noodles.jpg",
										alt: "Noodles with brown butter, miso, scallions, and chili crisp"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Toss 200 g wheat noodles with 2 tbsp brown butter, 1 tbsp white miso, and a splash of pasta water. Finish with scallions and chili crisp." })
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
							className: `win win-note${windowId === "note" ? " is-selected" : ""}`,
							"data-window": "note",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "win-bar",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
									className: "dot",
									"aria-hidden": "true"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "note.txt" })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "win-body note",
								"data-hotspot": "note",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "明日の朝、海岸を歩こう。" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
							className: `win win-term${windowId === "term" ? " is-selected" : ""}`,
							"data-window": "term",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "win-bar",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
									className: "dot",
									"aria-hidden": "true"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Terminal — sync.py" })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("pre", {
								className: "term win-body",
								"data-hotspot": "traceback",
								children: [TRACEBACK.split("KeyError")[0], /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "err",
									children: "KeyError: 'HARBOR_TOKEN'"
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "topbar",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "activities",
									children: "Activities"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "clock",
									"data-hotspot": "clock",
									children: now || "–:––"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "status",
									"aria-hidden": "true",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wifi, {}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, {}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BatteryFull, {})
									]
								})
							]
						}),
						aiming ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "scrim chrome" }),
							tool === "circle" && ink.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
								className: "ink chrome",
								viewBox: "0 0 100 100",
								preserveAspectRatio: "none",
								"aria-hidden": "true",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", {
									points: ink.map((p) => `${p.x},${p.y}`).join(" "),
									fill: "none",
									stroke: "#3584e4",
									strokeWidth: 11,
									strokeLinecap: "round",
									strokeLinejoin: "round",
									vectorEffect: "non-scaling-stroke",
									opacity: .35
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", {
									points: ink.map((p) => `${p.x},${p.y}`).join(" "),
									fill: "none",
									stroke: "#1c71d8",
									strokeWidth: 4,
									strokeLinecap: "round",
									strokeLinejoin: "round",
									vectorEffect: "non-scaling-stroke"
								})]
							}) : null,
							tool === "selection" && marquee ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "marquee chrome",
								style: {
									left: `${marquee.x}%`,
									top: `${marquee.y}%`,
									width: `${marquee.w}%`,
									height: `${marquee.h}%`
								}
							}) : null,
							flash ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flash chrome",
								style: {
									left: `${flash.x}%`,
									top: `${flash.y}%`,
									width: `${flash.w}%`,
									height: `${flash.h}%`
								}
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "aim-hint chrome",
								children: hint
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								ref: captureRef,
								className: "capture chrome",
								onPointerDown,
								onPointerMove,
								onPointerUp,
								onPointerCancel: onPointerUp
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "panel chrome",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "panel-x",
									onClick: closeAim,
									"aria-label": "Close screenshot",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { size: 16 })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "panel-card",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "type-row",
										role: "toolbar",
										"aria-label": "Screenshot type",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TypeButton, {
												label: "Circle",
												selected: tool === "circle",
												onClick: () => pickTool("circle"),
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Circle, {})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TypeButton, {
												label: "Selection",
												selected: tool === "selection",
												onClick: () => pickTool("selection"),
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SquareDashed, {})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TypeButton, {
												label: "Screen",
												selected: tool === "screen",
												onClick: () => pickTool("screen"),
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Monitor, {})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TypeButton, {
												label: "Window",
												selected: tool === "window",
												onClick: () => pickTool("window"),
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppWindow, {})
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "shutter",
										onClick: searchCurrent,
										"aria-label": "Capture",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {})
									})]
								})]
							})
						] }) : null
					]
				}), aiming && (reading || result) ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "sheet",
					"aria-live": "polite",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "sheet-handle" }),
						reading || !result ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "sheet-kicker",
							children: "From the screenshot"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Reading the selection…" })] }) : result.kind === "need" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "sheet-kicker",
							children: "Circle to Search"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: result.message })] }) : result.kind === "empty" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "sheet-kicker",
								children: "Nothing recognized"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "That region is just the wallpaper" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Circle the red panda, the recipe, the error in the terminal, or the Japanese line." })
						] }) : result.kind === "screen" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "sheet-kicker",
								children: "Whole screen"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "Four things on this desktop" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "spot-list",
								children: SPOT_ORDER.map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setResult({
										kind: "spot",
										id,
										also: []
									}),
									children: id === "clock" ? clockSpot.title : SPOTS[id].title
								}, id))
							})
						] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpotView, {
							id: result.id,
							also: result.also,
							clockQuote: clockSpot.quote,
							clockTitle: clockSpot.title,
							onAlso: (id) => setResult({
								kind: "spot",
								id,
								also: []
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "sheet-actions",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "sheet-btn",
								onClick: () => {
									setResult(null);
									setReading(false);
									setInk([]);
									setMarquee(null);
								},
								children: "Draw again"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "sheet-btn",
								onClick: closeAim,
								children: "Close"
							})]
						})
					]
				}) : null]
			}),
			install ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "drawer-scrim",
				onClick: () => setInstall(false),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: "drawer",
					role: "dialog",
					"aria-modal": "true",
					"aria-labelledby": "install-title",
					onClick: (event) => event.stopPropagation(),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							id: "install-title",
							children: "Install on GNOME 51"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "The zip is a real Shell extension. It adds a Circle button to the screenshot tool and crops the frozen frame with the same call the shutter uses." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "steps",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "step",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "1. Circle, next to Selection" }), "Print still opens the screenshot tool. Circle is a fourth type, or press L. Super+Print opens straight into it."]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "step",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "2. Same frozen frame" }), "The ink is cropped from the screenshot UI’s stage texture, not a second grab."]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "step",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "3. Text stays on the machine" }), "Tesseract reads the crop if it is installed. A browser opens only when you press Search, Translate, or Lens."]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "drawer-actions",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
								className: "btn btn-primary",
								href: "/circle-to-search@lasso.shell-extension.zip",
								download: true,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { size: 16 }), "Download extension"]
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
							className: "cmd",
							children: INSTALL
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "drawer-actions",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "btn btn-ghost",
								onClick: () => {
									navigator.clipboard.writeText(INSTALL).then(() => setCopied(true), () => setCopied(false));
								},
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { size: 16 }), copied ? "Copied" : "Copy commands"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "btn btn-ghost",
								onClick: () => setInstall(false),
								children: "Close"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
							"Optional package: ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: "tesseract-ocr" }),
							". Without it, the crop still copies and Lens can take a paste. This is not affiliated with Google."
						] })
					]
				})
			}) : null
		]
	});
}
function TypeButton({ label, selected, onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		className: `type-btn${selected ? " is-on" : ""}`,
		"aria-pressed": selected,
		onClick,
		children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label })]
	});
}
function SpotView({ id, also, clockQuote, clockTitle, onAlso }) {
	const spot = id === "clock" ? {
		...SPOTS.clock,
		quote: clockQuote,
		title: clockTitle
	} : SPOTS[id];
	if (!spot) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "sheet-kicker",
			children: spot.kicker
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: spot.title }),
		spot.quote ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "quote",
			children: spot.quote
		}) : null,
		spot.translation ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "translation",
			children: spot.translation
		}) : null,
		spot.body ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: spot.body }) : null,
		spot.links.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "link-list",
			children: spot.links.map((link) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
				className: "link",
				href: link.href,
				target: "_blank",
				rel: "noreferrer",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: link.label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: link.detail })]
			}, link.href))
		}) : null,
		also.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "also",
			children: also.map((other) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => onAlso(other),
				children: ["Also: ", SPOTS[other]?.title]
			}, other))
		}) : null
	] });
}
function clamp(value) {
	return Math.max(0, Math.min(100, value));
}
function boxOf(stage, node) {
	const outer = stage.getBoundingClientRect();
	const inner = node.getBoundingClientRect();
	return {
		x: (inner.left - outer.left) / outer.width * 100,
		y: (inner.top - outer.top) / outer.height * 100,
		w: inner.width / outer.width * 100,
		h: inner.height / outer.height * 100
	};
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Studio, {});
}
//#endregion
export { Home as component };
