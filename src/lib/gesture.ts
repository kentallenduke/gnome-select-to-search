export type Pt = { x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };

function clampBox(box: Box): Box {
  const x = Math.max(0, Math.min(100, box.x));
  const y = Math.max(0, Math.min(100, box.y));
  const right = Math.max(x + 0.8, Math.min(100, box.x + box.w));
  const bottom = Math.max(y + 0.8, Math.min(100, box.y + box.h));
  return { x, y, w: right - x, h: bottom - y };
}

export function travel(points: Pt[]) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

/** A short tap becomes a region under the pointer. A real stroke uses its bounds. */
export function regionForGesture(points: Pt[]): Box | null {
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
  const box = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  if (points.length < 3 || travel(points) < 2.4) {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    return clampBox({ x: cx - 11, y: cy - 9, w: 22, h: 18 });
  }
  return clampBox({ x: box.x - 1.2, y: box.y - 1.2, w: box.w + 2.4, h: box.h + 2.4 });
}

export function gridPoints(box: Box, cols = 5, rows = 4): Pt[] {
  const pts: Pt[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      pts.push({
        x: box.x + (box.w * (c + 0.5)) / cols,
        y: box.y + (box.h * (r + 0.5)) / rows,
      });
    }
  }
  return pts;
}

export function selectionRegion(box: Box): Box {
  if (box.w < 2 && box.h < 2) {
    return (
      regionForGesture([
        { x: box.x, y: box.y },
        { x: box.x + box.w, y: box.y + box.h },
      ]) ?? box
    );
  }
  return clampBox(box);
}
