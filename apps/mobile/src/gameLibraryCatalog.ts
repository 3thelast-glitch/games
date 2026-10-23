// Categories describe the twenty games surfaced by the mobile library.
// The existing gameInfo list remains the source of truth for visibility and game routing.
export type LibraryCategory = 'all' | 'strategy' | 'puzzle' | 'casual' | 'favorites';

export const libraryFilters: readonly LibraryCategory[] = [
  'all',
  'strategy',
  'puzzle',
  'casual',
  'favorites',
];

export const gameLibraryCategories: Readonly<Record<string, Exclude<LibraryCategory, 'all' | 'favorites'>>> = {
  ludo: 'strategy',
  appleWorm: 'puzzle',
  basketballLine: 'casual',
  backroomBill: 'puzzle',
  arithmetica: 'puzzle',
  survivalBuilder: 'casual',
  towerDestiny: 'casual',
  gasStation: 'casual',
  checkers: 'strategy',
  gomoku: 'strategy',
  nineMensMorris: 'strategy',
  connectFour: 'strategy',
  reversi: 'strategy',
  dotsAndBoxes: 'puzzle',
  dominoes: 'strategy',
  navalBattle: 'strategy',
  digitalGame: 'strategy',
  abalone: 'strategy',
  quoridor: 'strategy',
  chess: 'strategy',
};

export function gameMatchesLibraryFilter(
  gameId: string,
  translatedName: string,
  search: string,
  category: LibraryCategory,
  favorites: readonly string[],
  alternateName = '',
): boolean {
  if (category === 'favorites' && !favorites.includes(gameId)) return false;
  if (category !== 'all' && category !== 'favorites' && gameLibraryCategories[gameId] !== category) return false;
  const q = normalizeLibrarySearch(search);
  if (!q) return true;
  return [translatedName, alternateName, gameId]
    .some((value) => normalizeLibrarySearch(value).includes(q));
}

/** Search both languages without making Arabic diacritics or tatweel mandatory. */
export function normalizeLibrarySearch(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    .replace(/\u0649/g, '\u064A')
    .trim()
    .replace(/\s+/g, ' ');
}
