import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {TowerDefenseCover} from '../apps/mobile/src/TowerDestinyArt.tsx';
test('original rolling-fortress cover has five view features without external image assets',()=>{
  const markup=renderToStaticMarkup(<TowerDefenseCover/>);
  assert.match(markup,/viewBox="0 0 480 444"/);
  assert.match(markup,/#7ef4d5/);
  assert.match(markup,/#39b5ca/);
  assert.match(markup,/#ec735d|#ed735d/);
  assert.match(markup,/#a0ce5b/);
  assert.ok((markup.match(/<rect /g)??[]).length>=25);
  assert.ok((markup.match(/<circle /g)??[]).length>=15);
  assert.doesNotMatch(markup,/<image|<foreignObject|<iframe/);
});
