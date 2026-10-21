import { copyFileSync, cpSync, rmSync, readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
// Preserve the standalone review build; package a root entry for Sites.
rmSync("dist", { recursive: true, force: true });
cpSync("dist-review", "dist", { recursive: true });
copyFileSync("dist/review.html", "dist/index.html");
// The reviewed Stake keep-list follows literal references and retains complete
// folders for dynamic URLs. Use the same conservative list for the private
// review build, rather than shipping every archived public art pack. Originals
// remain in source; generated JS/CSS and HTML are never pruned here.
const keep=new Set(readFileSync("stake/assets.txt","utf8").split(/\r?\n/).filter(line=>line&&!line.startsWith("#")));
const walk=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  const file=path.join(directory,entry.name);return entry.isDirectory()?walk(file):[file];
});
for(const file of walk("public")){
  const relative=path.relative("public",file).split(path.sep).join("/");
  if(!keep.has(relative))rmSync(path.join("dist",relative),{force:true});
}
for(const file of keep)if(!existsSync(path.join("dist",file)))throw new Error("Required static asset missing: "+file);
