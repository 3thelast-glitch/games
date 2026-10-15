import test from 'node:test';
import assert from 'node:assert/strict';
import { games } from '../packages/games/registry.ts';
import { academyLessons, academyLesson, academyCurrentStep, academyMilestone } from '../apps/mobile/src/academy.ts';

test('game academy has three specific bilingual stages and a reflection for all registered games', () => {
  const ids = games.ids();
  assert.equal(ids.length, 12);
  assert.deepEqual(Object.keys(academyLessons).sort(), [...ids].sort());
  for (const id of ids) {
    const state = games.get(id).create();
    for (const lang of ['en', 'ar'] as const) {
      const lesson = academyLesson(state, lang);
      assert.ok(lesson, `${id}/${lang}`);
      assert.equal(lesson.steps.length, 3);
      assert.ok(lesson.steps.every((tip) => tip.length >= 40), `short tip ${id}/${lang}`);
      assert.ok(lesson.review.length >= 30);
      assert.equal(new Set(lesson.steps).size, 3);
    }
  }
});

test('practice milestones follow accepted move counts and match completion without awarding mastery', () => {
  assert.equal(academyMilestone(0, false), 0);
  assert.equal(academyMilestone(1, false), 1);
  assert.equal(academyMilestone(4, false), 1);
  assert.equal(academyMilestone(5, false), 2);
  assert.equal(academyMilestone(100, false), 2);
  assert.equal(academyMilestone(0, true), 3);
  assert.equal(academyCurrentStep(0), 0);
  assert.equal(academyCurrentStep(1), 1);
  assert.equal(academyCurrentStep(5), 2);
  assert.equal(academyLesson({ gameId: '__unknown__', turn: 0, ply: 0, winner: null }, 'en'), null);
});

test('academy lesson selection uses only game identity, not hidden opponent state', () => {
  const full = games.get('navalBattle').create();
  const projected = games.get('navalBattle').view?.(full, 0) ?? full;
  assert.deepEqual(academyLesson(full, 'en'), academyLesson(projected, 'en'));
  const dominoes = games.get('dominoes').create();
  const projection = games.get('dominoes').view?.(dominoes, 0) ?? dominoes;
  assert.deepEqual(academyLesson(dominoes, 'ar'), academyLesson(projection, 'ar'));
});
