import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { SurvivalBuilderCover, SurvivalIslandScene } from '../apps/mobile/src/SurvivalBuilderArt.tsx';
import { BLUEPRINTS, newIsland } from '../packages/games/survival-builder/engine.ts';

test('Island poster renders original tropical low-poly watercolor scenery without bitmap sprites',()=>{
  const svg=renderToStaticMarkup(<SurvivalBuilderCover/>);
  assert.match(svg,/viewBox="0 0 640 510"/);
  assert.match(svg,/BUILD &amp; SURVIVE/);
  assert.match(svg,/#39d7df/);
  assert.match(svg,/#f3d88c/);
  assert.match(svg,/class="survival-island-scene"/);
  assert.doesNotMatch(svg,/<image|<iframe/);
});
test('Island live scene includes keyboard-accessible resource nodes and four worker figures',()=>{
  const state=newIsland();
  const svg=renderToStaticMarkup(<SurvivalIslandScene state={state} onCollect={()=>{}}/>);
  assert.equal((svg.match(/role="button"/g)||[]).length,4);
  assert.equal((svg.match(/aria-label="Collect /g)||[]).length,4);
  for(const resource of ['BAMBOO','WOOD','CLAY','STONE'])assert.ok(svg.includes(resource));
  assert.ok(!svg.includes('NaN'));
});
test('All building archetypes render finite construction shapes',()=>{
  for(const bp of BLUEPRINTS){
    const state=newIsland();
    state.island=bp.id;state.phase='building';state.buildProgress=60;
    const partial=renderToStaticMarkup(<SurvivalIslandScene state={state}/>);
    assert.match(partial,/viewBox="0 0 640 510"/);
    assert.ok(!partial.includes('NaN'));
    state.phase='completed';state.buildProgress=100;
    const completed=renderToStaticMarkup(<SurvivalIslandScene state={state}/>);
    assert.match(completed,/viewBox="0 0 640 510"/);
    assert.ok(!completed.includes('Infinity'));
  }
});
