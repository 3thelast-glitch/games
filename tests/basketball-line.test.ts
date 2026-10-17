import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COURT_HEIGHT, COURT_WIDTH, INK_CAP, addStroke, makeRound,
  remainingInk, remainingPencils, stepRound, strokeLength, validateProgress,
  type BallBody, type Vec,
} from '../packages/games/basketball-line/engine.ts';

const segment = (x1: number, y1: number, x2: number, y2: number): Vec[] =>
  [{ x: x1, y: y1 }, { x: x2, y: y2 }];

test('Basketball Line deterministic courses, alternating hoops, balls and bombs', () => {
  const hoops = new Set<number>();
  for(let i = 1; i <= 50; i++){
    const game = makeRound(i);
    assert.equal(game.round, i);
    assert.equal(game.phase,'ready');
    assert.ok(game.hoop.x > 0 && game.hoop.x < COURT_WIDTH);
    assert.ok(game.hoop.y > 150 && game.hoop.y < COURT_HEIGHT);
    assert.ok(game.balls.some(ball=>ball.kind==='basketball'));
    for(const ball of game.balls) {
      assert.ok(ball.x > 0 && ball.x < COURT_WIDTH);
      assert.ok(ball.y >= 0 && ball.y < COURT_HEIGHT);
    }
    assert.equal(game.pencils,i===1?1:3);
    if(i>=5 && i%3!==1) assert.ok(game.balls.some(ball=>ball.kind==='bomb'));
    if(i>=8 && i%4!==1) assert.equal(game.balls.filter(b=>b.kind==='basketball').length,2);
    hoops.add(game.hoop.x);
  }
  assert.ok(hoops.size>=6);
});

test('Basketball Line: lines spend ink and pencils, stay bounded, and start physics', () => {
  const game=makeRound(2);
  assert.equal(remainingPencils(game),3);
  assert.equal(remainingInk(game),INK_CAP);
  assert.equal(addStroke(game,segment(100,230,250,250)),true);
  assert.equal(game.phase,'running');
  assert.equal(remainingPencils(game),2);
  assert.ok(remainingInk(game)<INK_CAP);
  assert.equal(addStroke(game,segment(80,400,200,400)),true);
  assert.equal(addStroke(game,segment(80,450,200,450)),true);
  assert.equal(remainingPencils(game),0);
  assert.equal(addStroke(game,segment(70,500,300,500)),false);
  assert.equal(game.strokes.length,3);
  assert.equal(addStroke(makeRound(1),[segment(10,10,20,20)[0]!,segment(10,10,20,20)[0]!]),false);
});

test('Basketball Line rejects bad strokes and clamps their coordinates and length', () => {
  const game=makeRound(2);
  assert.equal(addStroke(game,[]),false);
  assert.equal(addStroke(game,[{x:Number.NaN,y:90},{x:200,y:90}]),false);
  assert.equal(addStroke(game,segment(100,100,101,101)),false);
  const points=Array.from({length:30},(_,i)=>({x:i%2?999:-99,y:i%3?850:-99}));
  assert.equal(addStroke(game,points),true);
  assert.ok(strokeLength(game.strokes[0]!.points)<=INK_CAP+0.01);
  assert.ok(game.strokes[0]!.points.every(p=>p.x>=4 && p.x<=COURT_WIDTH-4 && p.y>=65 && p.y<=COURT_HEIGHT-15));
  assert.ok(game.inkUsed<=INK_CAP);
});

test('Basketball Line scores only a downward entry through open rim', () => {
  const game=makeRound(1);
  game.phase='running';
  const ball=game.balls[0]!;
  ball.x=game.hoop.x;
  ball.y=game.hoop.y-1;
  ball.vx=0;ball.vy=450;
  assert.equal(stepRound(game),'won');
  assert.equal(ball.scored,true);
  assert.equal(ball.active,false);
  const fromBelow=makeRound(1);
  fromBelow.phase='running';
  const other=fromBelow.balls[0]!;
  other.x=fromBelow.hoop.x;other.y=fromBelow.hoop.y+1;
  other.vx=0;other.vy=-450;
  assert.equal(stepRound(fromBelow),'running');
  assert.equal(other.scored,false);
});

test('Basketball Line never scores bomb and detects bomb-ball collisions', () => {
  const state=makeRound(5);
  state.phase='running';
  const bomb=state.balls.find(ball=>ball.kind==='bomb')!;
  const basketball=state.balls.find(ball=>ball.kind==='basketball')!;
  bomb.x=state.hoop.x;bomb.y=state.hoop.y-1;bomb.vx=0;bomb.vy=450;
  basketball.x=380;basketball.y=150;
  assert.equal(stepRound(state),'lost');
  assert.equal(state.message,'bomb');
  const crash=makeRound(5);
  crash.phase='running';
  const black=crash.balls.find(ball=>ball.kind==='bomb')!;
  const orange=crash.balls.find(ball=>ball.kind==='basketball')!;
  black.x=orange.x+1;black.y=orange.y;
  black.vx=0;black.vy=0;
  orange.vx=0;orange.vy=0;
  assert.equal(stepRound(crash),'lost');
  assert.equal(crash.message,'bomb');
});

test('Basketball Line ends when basketball goes out of bounds or time limit passes', () => {
  const miss=makeRound(2);
  miss.phase='running';
  const ball=miss.balls[0]!;
  ball.y=COURT_HEIGHT+50;
  assert.equal(stepRound(miss),'lost');
  assert.equal(miss.message,'miss');
  const timeout=makeRound(2);
  timeout.phase='running';timeout.elapsed=19;
  assert.equal(stepRound(timeout),'lost');
  assert.equal(timeout.message,'time');
  const invalid=makeRound(2);
  invalid.phase='running';
  assert.throws(()=>stepRound(invalid,.1), /Invalid/);
});

test('Basketball Line validates save contents without trusting malformed local data', () => {
  assert.deepEqual(validateProgress(null),{round:1,best:0,gems:0});
  assert.deepEqual(validateProgress({round:8,best:7,gems:11}),{round:8,best:7,gems:11});
  assert.deepEqual(validateProgress({round:-2,best:NaN,gems:'20'}),{round:1,best:0,gems:0});
  assert.deepEqual(validateProgress({round:Infinity,best:999999,gems:-10}),{round:1,best:9999,gems:0});
});
