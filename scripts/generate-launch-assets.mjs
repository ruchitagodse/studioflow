import sharp from "sharp";
import { writeFile,copyFile,mkdir } from "node:fs/promises";

// Trace the supplied monogram's two ink layers; preserve its original geometry.
const {data,info}=await sharp("public/brand/studio-calendar-original.jpeg").extract({left:350,top:250,width:540,height:395}).resize(416,416,{fit:"contain",background:"#faf7f2"}).extend({top:48,bottom:48,left:48,right:48,background:"#faf7f2"}).removeAlpha().raw().toBuffer({resolveWithObject:true});
const {width,height,channels}=info;
function simplify(points,tolerance=1.8){
  if(points.length<4)return points;
  const first=points[0],last=points.at(-1);let far=0,index=0;
  const dx=last[0]-first[0],dy=last[1]-first[1],length=dx*dx+dy*dy;
  for(let i=1;i<points.length-1;i++){const p=points[i];const t=length?Math.max(0,Math.min(1,((p[0]-first[0])*dx+(p[1]-first[1])*dy)/length)):0;const distance=Math.hypot(p[0]-first[0]-t*dx,p[1]-first[1]-t*dy);if(distance>far){far=distance;index=i;}}
  if(far<=tolerance)return [first,last];
  return [...simplify(points.slice(0,index+1),tolerance).slice(0,-1),...simplify(points.slice(index),tolerance)];
}
function trace(test){
  const mask=new Uint8Array(width*height);
  for(let i=0;i<mask.length;i++){const offset=i*channels;mask[i]=test(data[offset],data[offset+1],data[offset+2])?1:0;}
  const edges=new Map(),stride=width+1;
  const add=(x,y,a,b)=>{const key=y*stride+x;const list=edges.get(key)??[];list.push(b*stride+a);edges.set(key,list);};
  const filled=(x,y)=>x>=0&&y>=0&&x<width&&y<height&&mask[y*width+x];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(filled(x,y)){
    if(!filled(x,y-1))add(x,y,x+1,y);if(!filled(x+1,y))add(x+1,y,x+1,y+1);if(!filled(x,y+1))add(x+1,y+1,x,y+1);if(!filled(x-1,y))add(x,y+1,x,y);
  }
  const paths=[];
  while(edges.size){const start=edges.keys().next().value;let key=start;const points=[];do{points.push([key%stride,Math.floor(key/stride)]);const next=edges.get(key);if(!next?.length)break;const target=next.pop();if(!next.length)edges.delete(key);key=target;}while(key!==start);points.push(points[0]);if(points.length<12)continue;const clean=simplify(points).slice(0,-1);if(clean.length<3)continue;const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];let path=`M${mid(clean.at(-1),clean[0]).join(",")}`;for(let i=0;i<clean.length;i++){const p=clean[i],prev=clean[(i+clean.length-1)%clean.length],next=clean[(i+1)%clean.length],end=mid(p,next);const a=[p[0]-prev[0],p[1]-prev[1]],b=[next[0]-p[0],next[1]-p[1]];const cosine=(a[0]*b[0]+a[1]*b[1])/(Math.hypot(...a)*Math.hypot(...b));path+=cosine>.45?`Q${p.join(",")} ${end.join(",")}`:`L${p.join(",")}L${end.join(",")}`;}paths.push(path+"Z");}
  return paths.join("");
}
const black=trace((r,g,b)=>Math.max(r,g,b)<125);
const gold=trace((r,g,b)=>r>125&&g>90&&r>g*1.05&&b<g*.88);
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#faf7f2"/><path fill="#181816" fill-rule="evenodd" d="${black}"/><path fill="#b89959" fill-rule="evenodd" d="${gold}"/></svg>`;
await writeFile("public/brand/studio-calendar-monogram.svg",svg);
for(const size of [192,512,1024])await sharp(Buffer.from(svg)).resize(size,size).png().toFile(`public/icons/studio-calendar-v2-${size}.png`);
await sharp(Buffer.from(svg)).resize(180,180).png().toFile("public/icons/studio-calendar-apple-v2.png");
// The maskable artwork stays within Android's central safe zone.
await sharp(Buffer.from(svg)).resize(416,416).extend({top:48,bottom:48,left:48,right:48,background:"#faf7f2"}).png().toFile("public/icons/studio-calendar-maskable-v2.png");
await mkdir("public/audio",{recursive:true});
if(process.argv[2])await copyFile(process.argv[2],"public/audio/studio-opening.mp4");
console.log("Generated vector monogram, launch icons, and supplied opening sound.");
