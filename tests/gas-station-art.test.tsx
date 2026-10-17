import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {GasStationCover,GasStationWorld} from '../apps/mobile/src/GasStationArt.tsx';
import {newGasStation} from '../packages/games/gas-station/engine.ts';

test('Gas Station poster has original isometric highway, fuel pumps, convenience store and retro cars',()=>{
 const svg=renderToStaticMarkup(<GasStationCover/>);
 assert.match(svg,/viewBox="0 0 960 640"/);
 assert.match(svg,/GAS STATION/);
 assert.match(svg,/MINI MART/);
 assert.match(svg,/GARAGE/);
 assert.match(svg,/#f6d8aa/);
 assert.match(svg,/#ed7466/);
 assert.ok((svg.match(/<path /g)??[]).length>15);
 assert.ok((svg.match(/<ellipse /g)??[]).length>6);
 assert.doesNotMatch(svg,/<image|<foreignObject|<iframe/);
});
test('Active gas scene has keyboard-accessible debris and pump interaction points',()=>{
 const state=newGasStation();
 const svg=renderToStaticMarkup(<GasStationWorld state={state} onWalk={()=>{}} onJunk={()=>{}} onService={()=>{}} onFacility={()=>{}}/>);
 assert.equal((svg.match(/aria-label="Clear junk /g)??[]).length,state.debris.filter(d=>!d.cleared).length);
 assert.equal((svg.match(/aria-label="Fuel station /g)??[]).length,1);
 assert.ok(!svg.includes('NaN'));
 state.debris.forEach(d=>{d.cleared=true;});
 state.facilities.shop=1;
 const advanced=renderToStaticMarkup(<GasStationWorld state={state}/>);
 assert.ok(advanced.includes('MINI MART'));
 assert.ok(!advanced.includes('NaN'));
});
