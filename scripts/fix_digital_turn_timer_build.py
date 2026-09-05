from pathlib import Path

p = Path('tests/digital-turn-timer.test.ts')
s = p.read_text(encoding='utf-8')
old = """  assert.equal(\n    clientMessageSchema.parse({\n      type: 'queue',\n      gameId: 'digitalGame',\n      ranked: false,\n      playerCount: 4,\n      turnSeconds: 60,\n    }).turnSeconds,\n    60,\n  );\n"""
new = """  const parsed = clientMessageSchema.parse({\n    type: 'queue',\n    gameId: 'digitalGame',\n    ranked: false,\n    playerCount: 4,\n    turnSeconds: 60,\n  });\n  assert.equal(parsed.type, 'queue');\n  assert.equal('turnSeconds' in parsed ? parsed.turnSeconds : undefined, 60);\n"""
if old not in s:
    raise RuntimeError('turn timer protocol assertion not found')
p.write_text(s.replace(old, new, 1), encoding='utf-8')
