/**
 * Observed Apple Worm wall-contact poses in the user's SECOND selected-video
 * batch: the body can hang against a vertical BRICK surface without a block
 * immediately below it. This is a narrowly scoped provisional physics fix;
 * no source terrain, apple, hazard, portal or worm coordinates are changed.
 *
 * Do NOT enable for the first batch (15 already replay-proven wins) or other
 * levels without matching source-footage evidence.
 */
export const BATCH_TWO_WALL_CONTACT_STAGES=new Set<number>([
  49,59,71,73,97,
]);
export function supportsBatchTwoSideContact(level:number){
  return BATCH_TWO_WALL_CONTACT_STAGES.has(level);
}
