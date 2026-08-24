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

The boilerplate currently generates all of its textures procedurally in
`src/scenes/PreloadScene.ts`, so this directory starts empty. To switch to real
assets, add loader calls in `PreloadScene.preload()`:

```ts
this.load.setBaseURL('assets/');
this.load.image(TextureKeys.Ship, 'ships/interceptor.png');
this.load.atlas('fx', 'fx/fx.png', 'fx/fx.json');
this.load.audio('laser', ['audio/laser.ogg', 'audio/laser.m4a']);
```
