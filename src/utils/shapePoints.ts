/** Generate points for a regular polygon inscribed in a bounding box */
export function regularPolygonPoints(w: number, h: number, sides: number): number[] {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const pts: number[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    pts.push(cx + rx * Math.cos(angle), cy + ry * Math.sin(angle));
  }
  return pts;
}

/** Generate points for a 5-point star inscribed in a bounding box */
export function starPoints(w: number, h: number): number[] {
  const cx = w / 2;
  const cy = h / 2;
  const outerRx = w / 2;
  const outerRy = h / 2;
  const innerRx = w / 4.5;
  const innerRy = h / 4.5;
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI * 2 * i) / 10 - Math.PI / 2;
    const rx = i % 2 === 0 ? outerRx : innerRx;
    const ry = i % 2 === 0 ? outerRy : innerRy;
    pts.push(cx + rx * Math.cos(angle), cy + ry * Math.sin(angle));
  }
  return pts;
}

/** Generate points for an arrow shape */
export function arrowPoints(w: number, h: number): number[] {
  const headStart = w * 0.6;
  const shaftTop = h * 0.25;
  const shaftBottom = h * 0.75;
  return [
    0, shaftTop,
    headStart, shaftTop,
    headStart, 0,
    w, h / 2,
    headStart, h,
    headStart, shaftBottom,
    0, shaftBottom,
  ];
}

/** Generate points for a cross/plus shape */
export function crossPoints(w: number, h: number): number[] {
  const t = 0.3; // arm thickness ratio
  const x1 = w * t;
  const x2 = w * (1 - t);
  const y1 = h * t;
  const y2 = h * (1 - t);
  return [
    x1, 0,  x2, 0,  x2, y1,
    w, y1,  w, y2,  x2, y2,
    x2, h,  x1, h,  x1, y2,
    0, y2,  0, y1,  x1, y1,
  ];
}
