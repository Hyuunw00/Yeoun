// One-point perspective for the room.
// A point is described in "front plane" coordinates (x, y as if it sat on the
// screen glass) plus a depth scale `s`: 1 at the glass, BACK_SCALE at the back wall.
// Projection pulls it toward the vanishing point by that scale.

export const BACK_SCALE = 0.5;

export type Point = { x: number; y: number };

export function createRoom(width: number, height: number) {
  const vp: Point = { x: width / 2, y: height * 0.3 };

  const project = (x: number, y: number, s: number): Point => ({
    x: vp.x + s * (x - vp.x),
    y: vp.y + s * (y - vp.y),
  });

  const backTopLeft = project(0, 0, BACK_SCALE);
  const backBottomRight = project(width, height, BACK_SCALE);

  return {
    width,
    height,
    vp,
    project,
    back: {
      x: backTopLeft.x,
      y: backTopLeft.y,
      width: backBottomRight.x - backTopLeft.x,
      height: backBottomRight.y - backTopLeft.y,
    },
  };
}

export type Room = ReturnType<typeof createRoom>;
