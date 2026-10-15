import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../apps/server/src/store.ts';
import { MatchService } from '../apps/server/src/matches.ts';
import { games } from '../packages/games/registry.ts';
import type { DominoesState } from '../packages/games/dominoes/state.ts';
import type { DigitalGameState } from '../packages/games/digital-game/state.ts';
import type { NavalBattleState, NavalPlacement } from '../packages/games/naval-battle/state.ts';

/** Keep the real server fanout projection secure, not only game-level helper functions. */
for (const gameId of ['dominoes', 'digitalGame', 'navalBattle'] as const) {
  test(`${gameId} server fanout does not reveal the opponent's secrets and refuses outsiders`, () => {
    const store = new Store();
    try {
      const a = store.createUser('Alice');
      const b = store.createUser('Bob');
      const outsider = store.createUser('Eve');
      const service = new MatchService(store, games);
      const match = service.create(gameId, [a.id, b.id]);
      assert.throws(() => service.get(match.id, outsider.id), /not-in-match/);
      assert.throws(() => service.forUser(match, outsider.id), /not-in-match/);

      if (gameId === 'dominoes') {
        const full = match.state as DominoesState;
        const alice = service.forUser(match, a.id).state as DominoesState;
        const bob = service.forUser(match, b.id).state as DominoesState;
        assert.deepEqual(alice.hands[1], []);
        assert.deepEqual(bob.hands[0], []);
        assert.deepEqual(alice.hands[0], full.hands[0]);
        assert.deepEqual(bob.hands[1], full.hands[1]);
        assert.deepEqual(alice.boneyard, []);
        assert.deepEqual(bob.boneyard, []);
        for (const id of [...full.hands[1], ...full.boneyard])
          assert.equal(JSON.stringify(alice).includes(JSON.stringify(id)), false);
      } else if (gameId === 'digitalGame') {
        const full = match.state as DigitalGameState & { serverOnlyFutureSecret?: string };
        // A future private engine field must never be auto-spread to client projections.
        full.serverOnlyFutureSecret = 'never-send-this';
        const alice = service.forUser(match, a.id).state as DigitalGameState;
        const bob = service.forUser(match, b.id).state as DigitalGameState;
        assert.equal(alice.viewerSeat, 0);
        assert.equal(bob.viewerSeat, 1);
        assert.deepEqual(alice.racks[0], full.racks[0]);
        assert.deepEqual(bob.racks[1], full.racks[1]);
        assert.equal(alice.seed, 0);
        assert.equal(bob.seed, 0);
        assert.equal('serverOnlyFutureSecret' in alice, false);
        assert.equal('serverOnlyFutureSecret' in bob, false);
        assert.equal(alice.racks[1].length, full.racks[1].length);
        assert.ok(alice.racks[1].every((id) => id.startsWith('hidden-rack-1-')));
        assert.ok(alice.drawPool.every((id) => id.startsWith('hidden-draw-')));
        for (const id of [...full.racks[1], ...full.drawPool])
          assert.equal(JSON.stringify(alice).includes(JSON.stringify(id)), false);
      } else {
        const full = match.state as NavalBattleState;
        const fleet0: NavalPlacement[] = [
          { shipId: 'carrier', row: 0, col: 0, orientation: 'horizontal' },
        ];
        const fleet1: NavalPlacement[] = [
          { shipId: 'carrier', row: 0, col: 9, orientation: 'vertical' },
        ];
        full.fleets = [fleet0, fleet1];
        full.loadouts = [
          ['sonarPulse', 'twinSalvo', 'emergencyRepair'],
          ['sonarPulse', 'signalJammer', 'silentReposition'],
        ];
        const alice = service.forUser(match, a.id).state as NavalBattleState;
        const bob = service.forUser(match, b.id).state as NavalBattleState;
        assert.deepEqual(alice.fleets[0], fleet0);
        assert.deepEqual(alice.fleets[1], []);
        assert.deepEqual(bob.fleets[0], []);
        assert.deepEqual(bob.fleets[1], fleet1);
        assert.deepEqual(alice.loadouts[1], []);
        assert.deepEqual(bob.loadouts[0], []);
      }
    } finally {
      store.close();
    }
  });
}
