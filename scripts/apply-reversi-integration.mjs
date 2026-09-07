import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, from, to) {
  const source = readFileSync(path, 'utf8');
  if (source.includes(to)) return false;
  if (!source.includes(from)) throw new Error(`Anchor not found in ${path}: ${from.slice(0, 100)}`);
  writeFileSync(path, source.replace(from, to));
  return true;
}

replaceOnce(
  'apps/mobile/src/components.tsx',
  "['checkers', 'gomoku', 'nineMensMorris', 'connectFour', 'digitalGame'].includes(game)",
  "['checkers', 'gomoku', 'nineMensMorris', 'connectFour', 'reversi', 'digitalGame'].includes(game)",
);

replaceOnce(
  'apps/mobile/src/ClassicArt.tsx',
  `: game === 'connectFour'\n              ? '#294c73'\n              : game === 'digitalGame'\n                ? '#203633'\n                : '#282d39'`,
  `: game === 'connectFour'\n              ? '#294c73'\n              : game === 'reversi'\n                ? '#174d40'\n                : game === 'digitalGame'\n                  ? '#203633'\n                  : '#282d39'`,
);

replaceOnce(
  'apps/mobile/src/ClassicArt.tsx',
  `      {game === 'digitalGame' && (`,
  `      {game === 'reversi' && (\n        <>\n          {Array.from({ length: 64 }, (_, i) => (\n            <rect\n              key={i}\n              x={52 + (i % 8) * 42}\n              y={52 + Math.floor(i / 8) * 42}\n              width="42"\n              height="42"\n              fill={(Math.floor(i / 8) + (i % 8)) % 2 ? '#1c624f' : '#205d4d'}\n              stroke="#0d3a30"\n              strokeWidth="1"\n            />\n          ))}\n          {[\n            [18, 0], [19, 1], [20, 0], [26, 1], [27, 1], [28, 0], [29, 0],\n            [34, 0], [35, 0], [36, 1], [37, 1], [38, 0], [43, 1], [44, 0],\n            [45, 1], [46, 1],\n          ].map(([at, owner], i) =>\n            disc(73 + (at % 8) * 42, 73 + Math.floor(at / 8) * 42, owner, 300 + i),\n          )}\n        </>\n      )}\n      {game === 'digitalGame' && (`,
);

replaceOnce(
  'apps/mobile/src/i18n.tsx',
  `  connectFourDesc: 'Drop a disc. Set a trap. Connect four in any direction.',`,
  `  connectFourDesc: 'Drop a disc. Set a trap. Connect four in any direction.',\n  reversiTag: 'FLIP THE BOARD',\n  reversiDesc: 'Claim corners. Cut mobility. Turn every captured line in your favor.',\n  reversiRules:\n    'Standard Reversi on an 8×8 board. Black moves first from the four-disc center opening. Place a disc only on an empty square that traps one or more opposing discs between the new disc and another disc of your color in a straight horizontal, vertical or diagonal line. Every trapped disc in every valid direction flips. If the next player has no legal move, their turn passes automatically; passing is never voluntary. The game ends only when the board is full or neither player has a legal move. The player with more discs wins; equal counts are a draw.',\n  reversiHint: 'Tap a highlighted square to place a disc and flip every captured line.',\n  reversiBlack: 'Black',\n  reversiWhite: 'White',\n  reversiScore: 'Disc count',\n  reversiLegalMove: 'Legal move',\n  reversiPassed: 'has no legal move. The turn passed automatically.',\n  'illegal-reversi-move': 'Choose a highlighted square that captures at least one opposing disc.',\n  'reversi-win': 'The game ended with more discs of the winning color.',\n  'reversi-draw': 'Both players finished with the same number of discs.',`,
);

replaceOnce(
  'apps/mobile/src/i18n.tsx',
  `  connectFourDesc: 'أسقط قطعة. جهّز فخك. وصِل أربع قطع في أي اتجاه.',`,
  `  connectFourDesc: 'أسقط قطعة. جهّز فخك. وصِل أربع قطع في أي اتجاه.',\n  reversiTag: 'اقلب الصفوف. امتلك الزوايا.',\n  reversiDesc: 'سيطر على الزوايا، قلّل خيارات خصمك، واقلب كل خط محاصر لصالحك.',\n  reversiRules:\n    'ريفيرسي القياسية على لوحة 8×8. يبدأ الأسود من وضع البداية المكوّن من أربع قطع في الوسط. لا يجوز وضع قطعة إلا في خانة فارغة تحاصر قطعة واحدة أو أكثر للخصم بين القطعة الجديدة وقطعة أخرى من لونك على خط أفقي أو رأسي أو قطري مستقيم. تُقلب جميع قطع الخصم المحاصرة في كل الاتجاهات القانونية. إذا لم يملك اللاعب التالي أي حركة قانونية يمر دوره تلقائيًا، ولا يجوز التمرير اختياريًا. تنتهي المباراة فقط عند امتلاء اللوحة أو عندما لا يملك كلا اللاعبين أي حركة قانونية. يفوز صاحب العدد الأكبر من القطع، والتساوي يعني التعادل.',\n  reversiHint: 'اضغط خانة مضيئة لوضع قطعة وقلب جميع الخطوط المحاصرة.',\n  reversiBlack: 'الأسود',\n  reversiWhite: 'الأبيض',\n  reversiScore: 'عدد القطع',\n  reversiLegalMove: 'حركة قانونية',\n  reversiPassed: 'لا يملك حركة قانونية؛ انتقل الدور تلقائيًا.',\n  'illegal-reversi-move': 'اختر خانة مضيئة تحاصر قطعة واحدة على الأقل للخصم.',\n  'reversi-win': 'انتهت المباراة بعدد أكبر من القطع للون الفائز.',\n  'reversi-draw': 'أنهى اللاعبان المباراة بعدد متساوٍ من القطع.',`,
);

replaceOnce(
  'tests/classic-games.test.ts',
  `  assert.equal(games.ids().length, 7);`,
  `  assert.equal(games.ids().length, 8);`,
);

replaceOnce(
  'tests/server.test.ts',
  `for (const id of ['checkers', 'gomoku', 'nineMensMorris', 'connectFour']) {\n  test(\`\${id}: online rooms use authoritative rules, isolate matchmaking and settle per-game ratings\`, () => {`,
  `for (const id of ['checkers', 'gomoku', 'nineMensMorris', 'connectFour', 'reversi']) {\n  test(\`\${id}: online rooms use authoritative rules, isolate matchmaking and settle per-game ratings\`, () => {`,
);

replaceOnce(
  'tests/ui.test.tsx',
  `for (const id of ['checkers', 'gomoku', 'nineMensMorris', 'connectFour']) {`,
  `for (const id of ['checkers', 'gomoku', 'nineMensMorris', 'connectFour', 'reversi']) {`,
);

replaceOnce(
  'tests/ui.test.tsx',
  `            : id === 'nineMensMorris'\n              ? 'ضع. حرّك. اقفز.'\n              : 'أربع قطع للفوز',`,
  `            : id === 'nineMensMorris'\n              ? 'ضع. حرّك. اقفز.'\n              : id === 'reversi'\n                ? 'اقلب الصفوف. امتلك الزوايا.'\n                : 'أربع قطع للفوز',`,
);

console.log('Reversi integration patches applied.');
