import { effectiveSite, polygonArea, setbackStripArea, siteAreaOf } from "../src/lib/geometry";
const pts = [{x:8.321,y:0},{x:0.33,y:0.129},{x:0,y:0.149},{x:0.156,y:9.607},{x:10.963,y:9.448}];
const site:any = { points: pts, edges:[{index:0},{index:1},{index:2,road:true,roadWidth:1.8,roadSetback:1.1,roadLabel:"法42条2項 公道"},{index:3},{index:4,road:true,roadWidth:16}], northDeg:0, coverageRatio:60, farRatio:200, setback:0.5, fireproofException:false };
console.log("area", polygonArea(pts).toFixed(3));
const e = effectiveSite(site);
console.log(e.points, e.edges);
console.log("eff area", polygonArea(e.points).toFixed(3), "strip", setbackStripArea(site).toFixed(3), "siteAreaOf", siteAreaOf(site).toFixed(3));
// rectangle with west edge setback
const r:any = { points:[{x:0,y:0},{x:0,y:10},{x:8,y:10},{x:8,y:0}], edges:[{index:0,road:true,roadWidth:2,roadSetback:1}], northDeg:0, coverageRatio:60, farRatio:200, setback:0.5, fireproofException:false };
console.log(effectiveSite(r).points, setbackStripArea(r));
