// Presentation only: world radii and replay/collision coordinates never change.
export function flightCamera(width, height) {
  const portrait = height > width;
  // Fit both horizontal approaches, including the outer lane's object extents.
  // Vertical cropping is intentional; horizontal cropping on phones is not.
  const horizontalFit = Math.max(1, (width - 12) / (2 * 1.05));
  const r = Math.min(portrait ? horizontalFit : width * .48, height * .56);
  const clearance = portrait ? 190 : height < 500 ? 100 : 140;
  return { cx: width / 2, cy: Math.max(height * (portrait ? .58 : .70), clearance + r), r };
}

// The established 900px-high desktop view renders an 84px sprite at r=504.
// Scale down in world units, without a mobile pixel floor. Retain the desktop cap.
export const rocketSize = radius => Math.min(radius / 6, 84);
export const obstacleSize = (radius, size) => radius * size;
