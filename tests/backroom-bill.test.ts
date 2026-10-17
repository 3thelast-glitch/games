import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKROOM_STEP, createRoom, defaultBackroomProgress, MAP_SIZE, MAX_DEPTH,
  MONSTERS, recordRoomDefeat, recordRoomVictory, remainingPieces,
  saveBackroomProgress, shortestPath, tickRoom, walkable,
  type Room,
} from '../packages/games/backroom-bill/engine.ts';

test('Each of the 24 Backroom Bill floors is a connected, bounded reproducible maze', () => {
  for(let depth=1;depth<=MAX_DEPTH;depth++){
    const a=createRoom(depth),b=createRoom(depth);
    assert.equal(a.depth,depth);
    assert.deepEqual(a.walls,b.walls);
    assert.deepEqual(a.pieces,b.pieces);
    assert.equal(a.walls.length,MAP_SIZE*MAP_SIZE);
    assert.equal(a.seen.length,a.walls.length);
    assert.equal(a.pieces.length,3+Math.min(3,Math.floor(depth/4)));
    assert.equal(a.lives,3);
    assert.equal(a.phase,'exploring');
    assert.ok(shortestPath(a,a.start,a.exit).length>=2,'exit reachable floor '+depth);
    for(const item of [...a.pieces,...a.traps,...a.enemies]){
      assert.ok(walkable(a,item.x,item.y),'collectible reachable '+depth);
      assert.ok(shortestPath(a,a.start,item).length>0,'path to item '+depth);
    }
    for(let x=0;x<MAP_SIZE;x++){
      assert.equal(a.walls[x],1,'north solid boundary');
      assert.equal(a.walls[(MAP_SIZE-1)*MAP_SIZE+x],1,'south solid boundary');
    }
    for(let y=0;y<MAP_SIZE;y++){
      assert.equal(a.walls[y*MAP_SIZE],1,'west solid boundary');
      assert.equal(a.walls[y*MAP_SIZE+MAP_SIZE-1],1,'east solid boundary');
    }
  }
});

test('Player collides with walls while moving, controls stamina and discoveries',()=>{
  const room=createRoom(1);
  const initial={...room.player};
  for(let i=0;i<100;i++)tickRoom(room,{x:-1,y:0},BACKROOM_STEP);
  assert.ok(room.player.x>=1.24);
  assert.ok(room.player.y>=1.24);
  const explored=room.seen.reduce((a,b)=>a+b,0);
  assert.ok(explored>0);
  const startStamina=room.stamina;
  for(let i=0;i<40;i++)tickRoom(room,{x:1,y:0},BACKROOM_STEP,true);
  assert.ok(room.stamina<startStamina);
  for(let i=0;i<80;i++)tickRoom(room,{x:0,y:0},BACKROOM_STEP);
  assert.ok(room.stamina>startStamina-0.5);
  assert.ok(Math.hypot(room.player.x-initial.x,room.player.y-initial.y)<15);
});

test('Collecting every anomaly and reaching the unlocked door wins and unlocks next floor',()=>{
  const room=createRoom(2);
  room.enemies=[];
  for(const piece of room.pieces){
    room.player={x:piece.x+.5,y:piece.y+.5};
    tickRoom(room,{x:0,y:0});
    assert.equal(piece.found,true);
  }
  assert.equal(remainingPieces(room),0);
  room.player={x:room.exit.x+.5,y:room.exit.y+.5};
  tickRoom(room,{x:0,y:0});
  assert.equal(room.phase,'escape');
  const progress=recordRoomVictory(defaultBackroomProgress(),room);
  assert.equal(progress.unlocked,3);
  assert.equal(progress.deepest,2);
  assert.equal(progress.escapes,1);
});

test('The exit cannot be used without anomaly pieces',()=>{
  const room=createRoom(1);room.enemies=[];
  room.player={x:room.exit.x+.5,y:room.exit.y+.5};
  tickRoom(room);
  assert.equal(room.phase,'exploring');
  assert.ok(remainingPieces(room)>0);
});

test('Traps catch monsters and record their species; caught player loses three lives',()=>{
  const trapRoom=createRoom(4);
  const enemy=trapRoom.enemies[0]!;
  const trap=trapRoom.traps[0]!;
  enemy.x=trap.x+.5;enemy.y=trap.y+.5;
  enemy.pathTimer=100;
  // Place player far from trap so patrol doesn't move out within one tick.
  trapRoom.player={x:1.5,y:1.5};
  tickRoom(trapRoom);
  assert.equal(enemy.active,false);
  assert.equal(trap.armed,false);
  assert.ok(trapRoom.discoveries.includes(enemy.kind));
  const caught=createRoom(1);
  caught.pieces=[];
  caught.enemies=[caught.enemies[0]!];
  const pursuer=caught.enemies[0]!;
  pursuer.x=caught.player.x;pursuer.y=caught.player.y;pursuer.pathTimer=20;
  caught.invulnerable=0;
  for(let hit=1;hit<=3;hit++){
    pursuer.x=caught.player.x;pursuer.y=caught.player.y;
    caught.invulnerable=0;
    tickRoom(caught);
    assert.equal(caught.lives,3-hit);
  }
  assert.equal(caught.phase,'dead');
  const saved=recordRoomDefeat(defaultBackroomProgress(),caught);
  assert.ok(saved.catalog.includes(pursuer.kind));
});

test('Clocks, invalid motion values and dead-game state never simulate incorrectly',()=>{
  const room=createRoom(1);
  assert.throws(()=>tickRoom(room,{x:0,y:0},-.1),RangeError);
  assert.throws(()=>tickRoom(room,{x:0,y:0},.1),RangeError);
  room.phase='dead';
  const elapsed=room.elapsed;
  tickRoom(room);
  assert.equal(room.elapsed,elapsed);
});

test('Local progress rejects malicious or broken values, filtering unknown creatures',()=>{
  assert.deepEqual(saveBackroomProgress(null),defaultBackroomProgress());
  assert.deepEqual(saveBackroomProgress({unlocked:8,deepest:7,escapes:12,catalog:['lurker','unknown','moth','lurker']}),{
    unlocked:8,deepest:7,escapes:12,catalog:['lurker','moth'],
  });
  assert.deepEqual(saveBackroomProgress({unlocked:Infinity,deepest:-20,escapes:'10',catalog:{}}),
    defaultBackroomProgress());
  assert.equal(MONSTERS.length,3);
});
