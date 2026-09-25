import sharp from "sharp";
import { readdir } from "node:fs/promises";

const files = (await readdir("/tmp/roboshot")).filter(f => f.endsWith(".png")).sort();
for (const f of files) {
  const { data, info } = await sharp(`/tmp/roboshot/${f}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  let tot=0, ctr=0, ctrN=0, bright=0, brightN=0;
  const cx0 = Math.floor(W*0.34), cx1 = Math.floor(W*0.66), cy0 = Math.floor(H*0.15), cy1 = Math.floor(H*0.85);
  for (let y=0;y<H;y++) for (let x=0;x<W;x++){
    const i=(y*W+x)*4; const lum=0.299*data[i]+0.587*data[i+1]+0.114*data[i+2];
    tot+=lum;
    if (x>=cx0&&x<=cx1&&y>=cy0&&y<=cy1){ ctr+=lum; ctrN++; if(lum>55){bright++;} }
    if(lum>45) brightN++;
  }
  const mean=(tot/(W*H)).toFixed(2);
  const cm=(ctr/ctrN).toFixed(2);
  const bPct=(100*bright/ctrN).toFixed(1);
  console.log(f.padEnd(16), "mean", mean.padStart(6), "center", cm.padStart(6), "robotBright%", bPct.padStart(6));
}
