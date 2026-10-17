import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArithmeticaCover, CHALK } from '../apps/mobile/src/ArithmeticaArt.tsx';
test('Arithmetica home illustration renders a chalkboard framed with wood, five stars and exactly two round answers',()=>{
  const svg=renderToStaticMarkup(<ArithmeticaCover/>);
  assert.match(svg,/viewBox="0 0 480 444"/);
  assert.match(svg,/2 \+ 4 = \?/);
  assert.match(svg,/Level 1/);
  assert.match(svg,/feTurbulence/);
  assert.match(svg,/#323434/);
  assert.match(svg,/#e1ac61/);
  assert.equal((svg.match(/<circle /g)??[]).length,2);
  assert.equal((svg.match(/<polygon /g)??[]).length,5);
  assert.match(CHALK.powder, /^#[0-9a-f]{6}$/i);
});
