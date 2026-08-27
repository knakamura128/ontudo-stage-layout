import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [framesDirectory, outputPath, cropLeft, cropTop, cropWidth, cropHeight, renderWidth, renderHeight] = process.argv.slice(2);

if (!framesDirectory || !outputPath) {
  throw new Error("Usage: node scripts/create-stage-drag-gif.mjs <frames-directory> <output-path> [left top width height [render-width render-height]]");
}

const crop = [cropLeft, cropTop, cropWidth, cropHeight].every((value) => value !== undefined)
  ? { left: Number(cropLeft), top: Number(cropTop), width: Number(cropWidth), height: Number(cropHeight) }
  : null;

const render = [renderWidth, renderHeight].every((value) => value !== undefined)
  ? { width: Number(renderWidth), height: Number(renderHeight) }
  : null;

const frameNames = (await fs.readdir(framesDirectory))
  .filter((name) => name.endsWith(".png"))
  .sort();

if (frameNames.length === 0) {
  throw new Error("No PNG frames were found.");
}

const frames = await Promise.all(
  frameNames.map(async (name) => {
    const source = sharp(path.join(framesDirectory, name));
    const prepared = crop ? source.extract(crop) : source;
    return (render ? prepared.resize(render) : prepared).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  }),
);

const { width, height, channels } = frames[0].info;

if (!frames.every(({ info }) => info.width === width && info.height === height && info.channels === channels)) {
  throw new Error("All recording frames must share the same size.");
}

const animation = Buffer.concat(frames.map(({ data }) => data));

await sharp(animation, {
  raw: { width, height: height * frames.length, channels, pageHeight: height },
})
  .gif({ loop: 0, delay: [900, 700, 260, 260, 260, 260, 1200], colours: 128, effort: 6 })
  .toFile(outputPath);

console.log(`Created ${outputPath} from ${frames.length} browser-recorded frames.`);
