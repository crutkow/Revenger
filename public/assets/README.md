# Assets

Files placed here are served verbatim by Vite and copied into `dist/` on build.
Reference them with a relative URL, e.g. `assets/ships/interceptor.png`.

```
public/assets/
├─ ships/       # sprites & atlases
├─ fx/          # particles, explosions
├─ audio/       # sfx, music
└─ fonts/       # bitmap fonts
```

## Atlases

Both atlases are 1024×1024 images on a 64×64 tile grid (16×16 tiles).
Each item sits in **one tile cell**, centred in it, and is at most 64×64 px.

| Atlas                   | Texture key  | Content                                   |
| ----------------------- | ------------ | ----------------------------------------- |
| `ships/space_atlas.png` | `atlas-space` | Player ship, bullet, asteroids (in game) |
| `ships/poer_atlas.png`  | `atlas-poer`  | Ship parts: walls, modules, crew, thrusters |

Each has a descriptor next to it (`space_atlas.json`, `poer_atlas.json`):

```json
{
  "image": "space_atlas.png",
  "tileSize": 64,
  "columns": 16,
  "rows": 16,
  "items": [{ "name": "asteroid-medium", "x": 1, "y": 0, "w": 48, "h": 48 }]
}
```

- `x`/`y`: tile column / row of the cell that holds the item.
- `w`/`h`: real item size in **pixels**. The frame is cut centred in the cell:
  `px = x * tileSize + floor((tileSize - w) / 2)`.
- Names must be unique, one item per cell. This is validated at load time
  (`src/atlas/atlasUtils.ts`); a bad descriptor throws in `PreloadScene.create()`.

To add an item, draw it centred in a free cell and append an entry. The size must
cover the art, because pixels outside `w`×`h` are cut off.

Usage in code (frames are registered in `PreloadScene.create()`):

```ts
this.add.sprite(x, y, TextureKeys.SpaceAtlas, SpaceFrames.Ship);
getAtlasFrame(TextureKeys.SpaceAtlas, 'ship-small'); // pixel rect, from '@/atlas/AtlasRegistry'
```

The ship and bullet are drawn nose-up; `SPRITE_FACING_DEG` in
`src/config/constants.ts` converts that to the game's heading convention.

## Other assets

The starfield and particle textures are still generated procedurally in
`src/scenes/PreloadScene.ts`. To load more real assets, add loader calls in
`PreloadScene.preload()`:

```ts
this.load.setBaseURL('assets/');
this.load.atlas('fx', 'fx/fx.png', 'fx/fx.json');
this.load.audio('laser', ['audio/laser.ogg', 'audio/laser.m4a']);
```
