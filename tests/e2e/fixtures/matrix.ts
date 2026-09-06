export type LocaleCase = {
  id: 'en' | 'ar';
  locale: string;
  dir: 'ltr' | 'rtl';
};

export type ViewportCase = {
  id: string;
  width: number;
  height: number;
  touch: boolean;
  group: 'mobile' | 'landscape' | 'tablet' | 'desktop';
};

export const locales: LocaleCase[] = [
  { id: 'en', locale: 'en-US', dir: 'ltr' },
  { id: 'ar', locale: 'ar-SA', dir: 'rtl' },
];

export const fullViewports: ViewportCase[] = [
  { id: 'm320', width: 320, height: 568, touch: true, group: 'mobile' },
  { id: 'm360', width: 360, height: 640, touch: true, group: 'mobile' },
  { id: 'm375', width: 375, height: 667, touch: true, group: 'mobile' },
  { id: 'm390', width: 390, height: 844, touch: true, group: 'mobile' },
  { id: 'm412', width: 412, height: 915, touch: true, group: 'mobile' },
  { id: 'm430', width: 430, height: 932, touch: true, group: 'mobile' },
  { id: 'm480', width: 480, height: 854, touch: true, group: 'mobile' },
  { id: 'ml568', width: 568, height: 320, touch: true, group: 'landscape' },
  { id: 'ml667', width: 667, height: 375, touch: true, group: 'landscape' },
  { id: 'ml844', width: 844, height: 390, touch: true, group: 'landscape' },
  { id: 'ml932', width: 932, height: 430, touch: true, group: 'landscape' },
  { id: 't600', width: 600, height: 960, touch: true, group: 'tablet' },
  { id: 't768', width: 768, height: 1024, touch: true, group: 'tablet' },
  { id: 't820', width: 820, height: 1180, touch: true, group: 'tablet' },
  { id: 't1024p', width: 1024, height: 1366, touch: true, group: 'tablet' },
  { id: 'd1024', width: 1024, height: 768, touch: false, group: 'desktop' },
  { id: 'd1280', width: 1280, height: 720, touch: false, group: 'desktop' },
  { id: 'd1366', width: 1366, height: 768, touch: false, group: 'desktop' },
  { id: 'd1440', width: 1440, height: 900, touch: false, group: 'desktop' },
  { id: 'd1920', width: 1920, height: 1080, touch: false, group: 'desktop' },
  { id: 'd2560', width: 2560, height: 1440, touch: false, group: 'desktop' },
];

export const smokeViewports = fullViewports.filter((viewport) =>
  ['m320', 'm390', 'ml844', 'd1366'].includes(viewport.id),
);

export const crossBrowserViewports = fullViewports.filter((viewport) =>
  ['m320', 'm390', 'ml844', 't768', 'd1366', 'd1920'].includes(viewport.id),
);

export const gameIds = [
  'abalone',
  'quoridor',
  'checkers',
  'gomoku',
  'nineMensMorris',
  'connectFour',
  'digitalGame',
] as const;

export type GameId = (typeof gameIds)[number];

export function selectedViewports(): ViewportCase[] {
  if (process.env.PW_MATRIX === 'full') return fullViewports;
  if (process.env.PW_MATRIX === 'cross-browser') return crossBrowserViewports;
  return smokeViewports;
}
