import type { AtlasDescriptor, AtlasFrame, AtlasItem } from './atlasTypes';

/**
 * Converts an item to the pixel rectangle it occupies in the image.
 * The item is centred inside its tile cell.
 */
export function tileToPixelFrame(item: AtlasItem, tileSize: number): AtlasFrame {
  return {
    name: item.name,
    x: item.x * tileSize + Math.floor((tileSize - item.w) / 2),
    y: item.y * tileSize + Math.floor((tileSize - item.h) / 2),
    width: item.w,
    height: item.h,
  };
}

/**
 * Returns a list of human-readable problems. An empty list means the descriptor is valid.
 * Pass the real image size to also check that the grid matches the image.
 */
export function validateAtlas(
  descriptor: AtlasDescriptor,
  imageWidth?: number,
  imageHeight?: number,
): string[] {
  const errors: string[] = [];
  const { tileSize, columns, rows, items } = descriptor;

  if (!Number.isInteger(tileSize) || tileSize <= 0) {
    errors.push(`tileSize must be a positive integer, got ${tileSize}`);
  }
  if (!Number.isInteger(columns) || columns <= 0 || !Number.isInteger(rows) || rows <= 0) {
    errors.push(`columns/rows must be positive integers, got ${columns}x${rows}`);
  }

  if (imageWidth !== undefined && imageHeight !== undefined) {
    if (columns * tileSize > imageWidth || rows * tileSize > imageHeight) {
      errors.push(
        `grid ${columns * tileSize}x${rows * tileSize}px exceeds image ${imageWidth}x${imageHeight}px`,
      );
    }
  }

  const names = new Set<string>();
  const cells = new Map<string, string>();
  for (const item of items) {
    if (!item.name) {
      errors.push('item with empty name');
    } else if (names.has(item.name)) {
      errors.push(`duplicate item name "${item.name}"`);
    }
    names.add(item.name);

    const valid =
      [item.x, item.y, item.w, item.h].every(Number.isInteger) &&
      item.x >= 0 &&
      item.y >= 0 &&
      item.w > 0 &&
      item.h > 0;
    if (!valid) {
      errors.push(`item "${item.name}" has invalid position/size`);
      continue;
    }
    if (item.x >= columns || item.y >= rows) {
      errors.push(`item "${item.name}" is outside the ${columns}x${rows} tile grid`);
    }
    if (item.w > tileSize || item.h > tileSize) {
      errors.push(`item "${item.name}" (${item.w}x${item.h}px) is larger than a ${tileSize}px tile`);
    }

    const cell = `${item.x},${item.y}`;
    const other = cells.get(cell);
    if (other !== undefined) {
      errors.push(`items "${other}" and "${item.name}" share tile ${cell}`);
    }
    cells.set(cell, item.name);
  }

  return errors;
}

/** Builds a name -> pixel frame lookup. Throws if the descriptor is invalid. */
export function buildFrameMap(
  descriptor: AtlasDescriptor,
  imageWidth?: number,
  imageHeight?: number,
): Map<string, AtlasFrame> {
  const errors = validateAtlas(descriptor, imageWidth, imageHeight);
  if (errors.length > 0) {
    throw new Error(`Invalid atlas descriptor:\n- ${errors.join('\n- ')}`);
  }
  const map = new Map<string, AtlasFrame>();
  for (const item of descriptor.items) {
    map.set(item.name, tileToPixelFrame(item, descriptor.tileSize));
  }
  return map;
}
