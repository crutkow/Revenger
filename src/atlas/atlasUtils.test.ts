import { describe, expect, it } from 'vitest';
import type { AtlasDescriptor } from './atlasTypes';
import { buildFrameMap, tileToPixelFrame, validateAtlas } from './atlasUtils';

const base: AtlasDescriptor = {
  image: 'a.png',
  tileSize: 64,
  columns: 4,
  rows: 4,
  items: [
    { name: 'a', x: 0, y: 0, w: 64, h: 64 },
    { name: 'b', x: 1, y: 2, w: 20, h: 40 },
  ],
};

describe('tileToPixelFrame', () => {
  it('maps a full-tile item to its cell', () => {
    expect(tileToPixelFrame({ name: 'a', x: 0, y: 0, w: 64, h: 64 }, 64)).toEqual({
      name: 'a',
      x: 0,
      y: 0,
      width: 64,
      height: 64,
    });
  });

  it('centres a smaller item inside its cell', () => {
    expect(tileToPixelFrame({ name: 'b', x: 1, y: 2, w: 20, h: 40 }, 64)).toEqual({
      name: 'b',
      x: 64 + 22,
      y: 128 + 12,
      width: 20,
      height: 40,
    });
  });

  it('floors the offset for odd sizes', () => {
    const frame = tileToPixelFrame({ name: 'c', x: 0, y: 0, w: 21, h: 21 }, 64);
    expect(frame).toMatchObject({ x: 21, y: 21 });
  });
});

describe('validateAtlas', () => {
  it('accepts a valid descriptor', () => {
    expect(validateAtlas(base, 256, 256)).toEqual([]);
  });

  it('detects duplicate names', () => {
    const d = { ...base, items: [...base.items, { name: 'a', x: 3, y: 0, w: 8, h: 8 }] };
    expect(validateAtlas(d).some((e) => e.includes('duplicate'))).toBe(true);
  });

  it('detects two items in the same tile', () => {
    const d = { ...base, items: [...base.items, { name: 'z', x: 0, y: 0, w: 8, h: 8 }] };
    expect(validateAtlas(d).some((e) => e.includes('share tile'))).toBe(true);
  });

  it('detects cells outside the grid', () => {
    const d = { ...base, items: [{ name: 'x', x: 4, y: 0, w: 8, h: 8 }] };
    expect(validateAtlas(d).some((e) => e.includes('outside'))).toBe(true);
  });

  it('detects items larger than a tile', () => {
    const d = { ...base, items: [{ name: 'x', x: 0, y: 0, w: 65, h: 8 }] };
    expect(validateAtlas(d).some((e) => e.includes('larger than'))).toBe(true);
  });

  it('detects invalid sizes', () => {
    const d = { ...base, items: [{ name: 'x', x: 0, y: 0, w: 0, h: 8 }] };
    expect(validateAtlas(d).some((e) => e.includes('invalid'))).toBe(true);
  });

  it('detects a grid larger than the image', () => {
    expect(validateAtlas(base, 128, 128).some((e) => e.includes('exceeds image'))).toBe(true);
  });
});

describe('buildFrameMap', () => {
  it('maps names to pixel frames', () => {
    const map = buildFrameMap(base);
    expect(map.get('b')).toMatchObject({ x: 86, y: 140, width: 20, height: 40 });
    expect(map.get('missing')).toBeUndefined();
  });

  it('throws on an invalid descriptor', () => {
    expect(() => buildFrameMap({ ...base, tileSize: 0 })).toThrow(/Invalid atlas descriptor/);
  });
});
