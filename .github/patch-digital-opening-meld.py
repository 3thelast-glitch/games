from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


rules_path = Path("packages/games/digital-game/rules.ts")
rules = rules_path.read_text()
rules, count = re.subn(
    r"function hasInitialThirty\(state: DigitalGameState, player: Seat\): boolean \{.*?\n\}\n\n/\*\* Exhaustive Classic rules oracle",
    "function hasInitialThirty(state: DigitalGameState, player: Seat): boolean {\n"
    "  return rackOnlySolverCandidates(state, player).some(\n"
    "    (candidate) => candidate.score >= INITIAL_MELD_POINTS,\n"
    "  );\n"
    "}\n\n/** Exhaustive Classic rules oracle",
    rules,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit(f"hasInitialThirty replacement: expected 1 match, found {count}")

rules, count = re.subn(
    r"function initialMeldScore\(state: DigitalGameState, table: CommitMeldIntent\[\], oldTableIds: Set<string>\): number \{.*?\n\}\nfunction commitPlan",
    "function initialOpeningMeldScore(\n"
    "  state: DigitalGameState,\n"
    "  table: CommitMeldIntent[],\n"
    "  oldTableIds: Set<string>,\n"
    "): number {\n"
    "  for (const meld of table) {\n"
    "    if (meld.tiles.some((id) => oldTableIds.has(id))) continue;\n"
    "    const result = validateMeld(assertTileIds(state, meld.tiles));\n"
    "    if (!result.ok) throw new RuleError(result.code);\n"
    "    return result.score;\n"
    "  }\n"
    "  return 0;\n"
    "}\n"
    "function commitPlan",
    rules,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit(f"initialOpeningMeldScore replacement: expected 1 match, found {count}")

rules = replace_once(
    rules,
    "if (initialMeldScore(state, move.table, oldTableIds) < INITIAL_MELD_POINTS) throw new RuleError('initial-meld-30');",
    "if (initialOpeningMeldScore(state, move.table, oldTableIds) < INITIAL_MELD_POINTS) throw new RuleError('initial-meld-30');",
    "rules initial score call",
)
rules_path.write_text(rules)


ui_path = Path("packages/games/digital-game/ui.tsx")
ui = ui_path.read_text()
old_ui = """  const initialScore = useMemo(() => {
    if (state.hasCompletedInitialMeld[visibleSeat]) return null;
    let score = 0;
    for (const meld of workingTable) {
      if (meld.tiles.some((id) => oldTableIds.has(id))) continue;
      const tiles = meld.tiles.map((id) => state.tiles[id]).filter(Boolean);
      const result = validateMeld(tiles);
      if (result.ok) score += result.score;
    }
    return score;
  }, [workingTable, visibleSeat, state.hasCompletedInitialMeld, state.tiles, oldTableIds]);
"""
new_ui = """  const initialScore = useMemo(() => {
    if (state.hasCompletedInitialMeld[visibleSeat]) return null;
    for (const meld of workingTable) {
      if (meld.tiles.some((id) => oldTableIds.has(id))) continue;
      const tiles = meld.tiles.map((id) => state.tiles[id]).filter(Boolean);
      const result = validateMeld(tiles);
      return result.ok ? result.score : 0;
    }
    return 0;
  }, [workingTable, visibleSeat, state.hasCompletedInitialMeld, state.tiles, oldTableIds]);
"""
ui = replace_once(ui, old_ui, new_ui, "ui initial score")
ui_path.write_text(ui)


test_path = Path("tests/digital-game.test.ts")
tests = test_path.read_text()
replacement = """test('only the first opening meld must be 30+; later melds may be below 30', () => {
  const base = createDigitalGame(5);

  const first27 = [tile(base, 'blue', 8), tile(base, 'blue', 9), tile(base, 'blue', 10)];
  const second6 = [tile(base, 'red', 1), tile(base, 'red', 2), tile(base, 'red', 3)];
  const aggregate33 = fixture([...first27, ...second6]);
  aggregate33.tiles = base.tiles;
  assert.deepEqual(
    validateDigital(aggregate33, { type: 'commit', table: [{ tiles: first27 }, { tiles: second6 }] }),
    { ok: false, code: 'initial-meld-30' },
  );

  const first30 = [tile(base, 'blue', 9), tile(base, 'blue', 10), tile(base, 'blue', 11)];
  const third6 = [tile(base, 'blue', 2), tile(base, 'orange', 2), tile(base, 'black', 2)];
  const opening = fixture([...first30, ...second6, ...third6]);
  opening.tiles = base.tiles;
  const move = {
    type: 'commit' as const,
    table: [{ tiles: first30 }, { tiles: second6 }, { tiles: third6 }],
  };
  assert.equal(validateDigital(opening, move).ok, true);
  const afterOpening = applyDigital(opening, move);
  assert.equal(afterOpening.hasCompletedInitialMeld[0], true);

  const lowAfterOpening = fixture(second6);
  lowAfterOpening.tiles = base.tiles;
  lowAfterOpening.hasCompletedInitialMeld = [true, false];
  assert.equal(validateDigital(lowAfterOpening, { type: 'commit', table: [{ tiles: second6 }] }).ok, true);
});

"""
tests, count = re.subn(
    r"test\('initial meld rejects 29, accepts 30 and 31\+ points', \(\) => \{.*?\n\}\);\n\n(?=test\('initial meld cannot manipulate)",
    lambda _: replacement,
    tests,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit(f"digital-game test replacement: expected 1 match, found {count}")
test_path.write_text(tests)


classic_test_path = Path("tests/digital-classic.test.ts")
classic_tests = classic_test_path.read_text()
marker = """  assert.equal(hasClassicLegalPlay(twentySeven, 0), false);
});
"""
insertion = """  assert.equal(hasClassicLegalPlay(twentySeven, 0), false);

  const combinedThirtyThree = createDigitalGame(107, 2);
  combinedThirtyThree.racks = [
    [
      tile(combinedThirtyThree, 'blue', 8),
      tile(combinedThirtyThree, 'blue', 9),
      tile(combinedThirtyThree, 'blue', 10),
      tile(combinedThirtyThree, 'red', 1),
      tile(combinedThirtyThree, 'red', 2),
      tile(combinedThirtyThree, 'red', 3),
    ],
    [],
  ];
  combinedThirtyThree.rackCounts = [6, 0];
  combinedThirtyThree.drawPool = [];
  combinedThirtyThree.hasCompletedInitialMeld = [false, true];
  assert.equal(hasClassicLegalPlay(combinedThirtyThree, 0), false);
});
"""
classic_tests = replace_once(classic_tests, marker, insertion, "classic solver test")
classic_test_path.write_text(classic_tests)


readme_path = Path("packages/games/digital-game/README.md")
readme = readme_path.read_text()
readme = replace_once(
    readme,
    "- A player who has not yet opened must place at least 30 points using tiles from that player's own rack.\n- Existing table tiles cannot be manipulated or counted toward that initial 30-point requirement.",
    "- A player who has not yet opened must make the first new meld worth at least 30 points using only tiles from that player's own rack.\n- Additional second, third, or later valid melds in that same opening turn do not need to reach 30 points individually.\n- Existing table tiles cannot be manipulated or counted toward the opening meld requirement.",
    "README opening rule",
)
readme_path.write_text(readme)


i18n_path = Path("apps/mobile/src/i18n.tsx")
i18n = i18n_path.read_text()
i18n = replace_once(
    i18n,
    "Your first successful play must use only tiles from your rack and total at least 30 points.",
    "Your first new meld must use only tiles from your rack and total at least 30 points; any second or third meld you add in that same opening turn may be below 30.",
    "English Digital rules",
)
i18n = replace_once(
    i18n,
    "'initial-meld-30': 'Your initial meld must total at least 30 points from your rack.'",
    "'initial-meld-30': 'Your first opening meld must total at least 30 points from your rack; later melds do not need 30.'",
    "English error",
)
i18n = replace_once(
    i18n,
    "أول نزول ناجح لك يجب أن يستخدم بلاطات من حاملك فقط وبمجموع 30 نقطة على الأقل.",
    "أول تشكيلة جديدة في نزولك يجب أن تكون من بلاطات حاملك فقط ومجموعها 30 نقطة على الأقل، أما التشكيلة الثانية والثالثة في الدور نفسه فلا يشترط أن تصل إلى 30.",
    "Arabic Digital rules",
)
i18n = replace_once(
    i18n,
    "'initial-meld-30': 'يجب أن يساوي نزولك الأول 30 نقطة على الأقل من بلاطات حاملك.'",
    "'initial-meld-30': 'يجب أن يكون مجموع أول تشكيلة في نزولك 30 نقطة على الأقل من حاملك؛ التشكيلات التالية لا تحتاج 30.'",
    "Arabic error",
)
i18n_path.write_text(i18n)
