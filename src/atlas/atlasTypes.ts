/**
 * One item in the atlas. It lives in a single tile cell of the grid and is
 * centred inside that cell; `w`/`h` are the item's real size in **pixels**.
 */
export interface AtlasItem {
  name: string;
  /** Tile column of the cell that contains the item. */
  x: number;
  /** Tile row of the cell that contains the item. */
  y: number;
  /** Item width in pixels (at most `tileSize`). */
  w: number;
  /** Item height in pixels (at most `tileSize`). */
  h: number;
}

/** Shape of the `*_atlas.json` descriptors in `public/assets/ships/`. */
export interface AtlasDescriptor {
  image: string;
  /** Edge length of one square tile in pixels. */
  tileSize: number;
  /** Atlas width in tiles. */
  columns: number;
  /** Atlas height in tiles. */
  rows: number;
  items: AtlasItem[];
}

/** Pixel rectangle of an item inside the atlas image. */
export interface AtlasFrame {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
