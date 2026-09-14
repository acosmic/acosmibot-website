// Presentation only: world radii and replay/collision coordinates never change.
export function flightCamera(width, height) {
  const portrait = height > width;
  const r = Math.min(width * (portrait ? .78 : .48), height * .56);
  const clearance = portrait ? 190 : height < 500 ? 100 : 140;
  return { cx: width / 2, cy: Math.max(height * .70, clearance + r), r };
}
