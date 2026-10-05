import {
  Canvas,
  Group,
  LinearGradient,
  Oval,
  Path,
  RadialGradient,
  Rect,
  Skia,
  vec,
  type SkPath,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { BACK_SCALE, type Point, type Room } from './geometry';
import { RoomColors, SPINE_COLORS } from './theme';

// Extra margin so parallax shifts never reveal the canvas edge
export const SHELL_BLEED = 24;

function polygon(points: Point[]): SkPath {
  const builder = Skia.PathBuilder.Make().moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) builder.lineTo(p.x, p.y);
  return builder.close().detach();
}

// Bookshelf against the right wall, spanning two depths
function useBookshelf(room: Room) {
  return useMemo(() => {
    const { project, width, height } = room;
    const near = 0.92;
    const far = 0.64;
    const wallX = width;
    const floorY = height;
    const topY = height * 0.22;
    const shelves = 4;

    const frame = polygon([
      project(wallX, topY, far),
      project(wallX, topY, near),
      project(wallX, floorY, near),
      project(wallX, floorY, far),
    ]);

    // Shelf boards and the books standing on them, receding toward the back
    const boards: SkPath[] = [];
    const books: { path: SkPath; color: string }[] = [];
    const rowHeight = (floorY - topY) / shelves;
    for (let row = 0; row < shelves; row++) {
      const boardY = topY + rowHeight * (row + 1);
      boards.push(
        polygon([
          project(wallX, boardY - 4, far),
          project(wallX, boardY - 4, near),
          project(wallX, boardY, near),
          project(wallX, boardY, far),
        ]),
      );
      const count = 9;
      for (let i = 0; i < count; i++) {
        const s0 = far + ((near - far) * (i + 0.15)) / count;
        const s1 = far + ((near - far) * (i + 0.85)) / count;
        const bookTop = boardY - 4 - rowHeight * (0.55 + ((row * 5 + i * 3) % 4) * 0.08);
        books.push({
          path: polygon([
            project(wallX, bookTop, s0),
            project(wallX, bookTop, s1),
            project(wallX, boardY - 4, s1),
            project(wallX, boardY - 4, s0),
          ]),
          color: SPINE_COLORS[(row * 3 + i) % SPINE_COLORS.length],
        });
      }
    }
    return { frame, boards, books };
  }, [room]);
}

export function RoomShell({ room }: { room: Room }) {
  const { width, height, project, back, vp } = room;
  const b = SHELL_BLEED;

  const surfaces = useMemo(() => {
    const tl = project(0, 0, BACK_SCALE);
    const tr = project(width, 0, BACK_SCALE);
    const br = project(width, height, BACK_SCALE);
    const bl = project(0, height, BACK_SCALE);

    // Floor planks: lines from the back edge out to the front, converging on the vanishing point
    const planks = Skia.PathBuilder.Make();
    for (let x = -width; x <= width * 2; x += width / 7) {
      const from = project(x, height, BACK_SCALE);
      planks.moveTo(from.x, from.y).lineTo(x, height + b);
    }

    return {
      ceiling: polygon([{ x: -b, y: -b }, { x: width + b, y: -b }, tr, tl]),
      floor: polygon([bl, br, { x: width + b, y: height + b }, { x: -b, y: height + b }]),
      left: polygon([{ x: -b, y: -b }, tl, bl, { x: -b, y: height + b }]),
      right: polygon([tr, { x: width + b, y: -b }, { x: width + b, y: height + b }, br]),
      planks: planks.detach(),
      floorCenter: project(width / 2, height, 0.72),
    };
  }, [width, height, project, b]);

  const shelf = useBookshelf(room);

  return (
    <Canvas style={[StyleSheet.absoluteFill, { margin: -b }]} pointerEvents="none">
      <Group transform={[{ translateX: b }, { translateY: b }]}>
        <Path path={surfaces.ceiling} color={RoomColors.ceiling} />
        <Path path={surfaces.left} color={RoomColors.sideWall} />
        <Path path={surfaces.right} color={RoomColors.sideWall} />
        <Rect x={back.x} y={back.y} width={back.width} height={back.height}>
          <LinearGradient
            start={vec(0, back.y)}
            end={vec(0, back.y + back.height)}
            colors={[RoomColors.backWallTop, RoomColors.backWall]}
          />
        </Rect>
        <Path path={surfaces.floor} color={RoomColors.floor} />
        <Path path={surfaces.planks} style="stroke" strokeWidth={1} color={RoomColors.plank} />

        {/* Warm pool of lamp light on the floor */}
        <Oval
          x={surfaces.floorCenter.x - width * 0.45}
          y={surfaces.floorCenter.y - height * 0.07}
          width={width * 0.9}
          height={height * 0.14}>
          <RadialGradient
            c={vec(surfaces.floorCenter.x, surfaces.floorCenter.y)}
            r={width * 0.45}
            colors={['rgba(255, 205, 140, 0.16)', 'rgba(255, 205, 140, 0)']}
          />
        </Oval>

        <Path path={shelf.frame} color={RoomColors.woodDark} />
        {shelf.books.map((book, i) => (
          <Path key={i} path={book.path} color={book.color} />
        ))}
        {shelf.boards.map((board, i) => (
          <Path key={i} path={board} color={RoomColors.woodLight} />
        ))}

        {/* Lamp glow over the whole room, then darker corners */}
        <Rect x={-b} y={-b} width={width + b * 2} height={height + b * 2}>
          <RadialGradient
            c={vec(vp.x, height * 0.06)}
            r={height * 0.75}
            colors={['rgba(255, 210, 150, 0.14)', 'rgba(255, 210, 150, 0)']}
          />
        </Rect>
        <Rect x={-b} y={-b} width={width + b * 2} height={height + b * 2}>
          <RadialGradient
            c={vec(vp.x, vp.y)}
            r={Math.max(width, height) * 0.8}
            colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.55)']}
          />
        </Rect>
      </Group>
    </Canvas>
  );
}
