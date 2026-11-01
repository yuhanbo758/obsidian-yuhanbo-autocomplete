import { spawnSync } from "node:child_process";
const version=process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version??"")) throw new Error("Expected x.y.z");
const fs=await import("node:fs");
const manifest=JSON.parse(fs.readFileSync("manifest.json","utf8"));manifest.version=version;
fs.writeFileSync("manifest.json",JSON.stringify(manifest,null,2)+"\n");
const result=spawnSync(process.execPath,["scripts/prepare-release.mjs","--sync-manifest"],{stdio:"inherit"});process.exit(result.status??1);
