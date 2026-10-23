import type Phaser from 'phaser';
import type { AtlasDescriptor, AtlasFrame } from './atlasTypes';
import { buildFrameMap } from './atlasUtils';

const frameMaps = new Map<string, Map<string, AtlasFrame>>();

/**
 * Registers every descriptor item as a named frame on an already loaded texture,
 * so sprites can use `scene.add.sprite(x, y, textureKey, 'item-name')`.
 */
export function registerAtlasFrames(
  scene: Phaser.Scene,
  textureKey: string,
  descriptor: AtlasDescriptor,
): void {
  const texture = scene.textures.get(textureKey);
  const source = texture.getSourceImage();
  const frames = buildFrameMap(descriptor, source.width, source.height);

  for (const frame of frames.values()) {
    if (!texture.has(frame.name)) {
      texture.add(frame.name, 0, frame.x, frame.y, frame.width, frame.height);
    }
  }
  frameMaps.set(textureKey, frames);
}

export function hasAtlasFrame(textureKey: string, name: string): boolean {
  return frameMaps.get(textureKey)?.has(name) ?? false;
}

/** Pixel rectangle of a frame. Throws if the atlas or frame is unknown. */
export function getAtlasFrame(textureKey: string, name: string): AtlasFrame {
  const frame = frameMaps.get(textureKey)?.get(name);
  if (!frame) {
    throw new Error(`Unknown atlas frame "${name}" in texture "${textureKey}"`);
  }
  return frame;
}

/** Names of all registered frames of an atlas. */
export function getAtlasFrameNames(textureKey: string): string[] {
  return [...(frameMaps.get(textureKey)?.keys() ?? [])];
}
