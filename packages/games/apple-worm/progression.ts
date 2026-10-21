/**
 * Apple Worm campaign progression (1 -> 105).
 *
 * Only an ACTUAL victory unlocks the next level. A prior testing version
 * opened every level, so neither the saved "last viewed level" nor out-of-
 * order completed levels may bypass the sequential campaign.
 */
export const APPLE_WORM_CAMPAIGN_LEVEL_COUNT=105;

export function cleanCompletedStages(value:unknown):number[]{
  if(!Array.isArray(value))return [];
  return [...new Set(value.filter((n):n is number=>
    typeof n==='number'&&Number.isInteger(n)&&n>=1&&
    n<=APPLE_WORM_CAMPAIGN_LEVEL_COUNT))].sort((a,b)=>a-b);
}

/** Highest level the player may ENTER, including the next unfinished one. */
export function highestUnlockedStage(completed:readonly number[]):number{
  const won=new Set(completed);
  let stage=1;
  while(stage<APPLE_WORM_CAMPAIGN_LEVEL_COUNT&&won.has(stage))stage++;
  return stage;
}

export function isStageUnlocked(stage:number,completed:readonly number[]):boolean{
  return Number.isInteger(stage)&&stage>=1&&
    stage<=highestUnlockedStage(completed);
}

/** A saved QA-mode level selection is not a victory or an unlock. */
export function resumableUnlockedStage(saved:number,completed:readonly number[]):number{
  return Number.isInteger(saved)&&isStageUnlocked(saved,completed)
    ?saved:highestUnlockedStage(completed);
}
