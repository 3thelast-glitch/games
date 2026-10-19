import { mkdirSync, writeFileSync } from 'node:fs';
import { SCREENSHOT_STAGES, validateScreenshotStage } from '../packages/games/apple-worm/screenshot-stages.ts';
import { solveScreenshotWorm, replayScreenshotWorm } from '../packages/games/apple-worm/screenshot-engine.ts';

const budget=Number(process.env.WORM_SOLVER_BUDGET ?? 120000);
const results=[];
for (const stage of SCREENSHOT_STAGES) {
  const errors=validateScreenshotStage(stage);
  const start=performance.now();
  const result=errors.length ? {status:'invalid',visited:0,route:null} : solveScreenshotWorm(stage.id,budget);
  if(result.route && replayScreenshotWorm(stage.id,result.route)?.phase!=='won')
    throw new Error(`Solver replay diverged on stage ${stage.id}`);
  const row={stage:stage.id,sourceSha256:stage.sourceSha256,dataErrors:errors,
    visualVerification:'pending',unresolved:stage.unresolved,...result,elapsedMs:Math.round(performance.now()-start)};
  results.push(row);
  console.log(JSON.stringify({...row,route:result.route?.length??null}));
}
mkdirSync('artifacts/apple-worm',{recursive:true});
writeFileSync('artifacts/apple-worm/solvability.json',JSON.stringify({
  model:'screenshot-static-hazards-v1',budget,stages:results,
  solved:results.filter(r=>r.status==='solved').length,
  note:'Solving this documented adaptation does not certify source mechanics or visual fidelity.',
},null,2)+'\n');
