from pathlib import Path

path = Path('tests/digital-turn-timer.test.ts')
text = path.read_text()
old = """test('legacy protocol timer values remain parseable while Digital Classic normalizes them server-side', () => {
  for (const turnSeconds of [30, 45, 60, 90] as const) {
    const parsed = clientMessageSchema.parse({
      type: 'queue',
      gameId: 'digitalGame',
      ranked: false,
      playerCount: 4,
      turnSeconds,
    });
    assert.equal(parsed.type, 'queue');
  }
  assert.throws(() =>
    clientMessageSchema.parse({
      type: 'queue',
      gameId: 'digitalGame',
      ranked: false,
      playerCount: 4,
      turnSeconds: 15,
    }),
  );
});"""
new = """test('protocol timer values remain parseable while Digital Classic normalizes them server-side', () => {
  for (const turnSeconds of [15, 30, 45, 60, 90] as const) {
    const parsed = clientMessageSchema.parse({
      type: 'queue',
      gameId: 'digitalGame',
      ranked: false,
      playerCount: 4,
      turnSeconds,
    });
    assert.equal(parsed.type, 'queue');
  }
  assert.throws(() =>
    clientMessageSchema.parse({
      type: 'queue',
      gameId: 'digitalGame',
      ranked: false,
      playerCount: 4,
      turnSeconds: 20,
    }),
  );
});"""
if text.count(old) != 1:
    raise SystemExit(f'expected one protocol timer test, got {text.count(old)}')
path.write_text(text.replace(old, new, 1))
Path(__file__).unlink(missing_ok=True)
