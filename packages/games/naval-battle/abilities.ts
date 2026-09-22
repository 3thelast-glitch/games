export const NAVAL_ABILITIES = [
  { id: 'sonarPulse', kind: 'recon' },
  { id: 'twinSalvo', kind: 'attack' },
  { id: 'hunterProtocol', kind: 'attack' },
  { id: 'emergencyRepair', kind: 'defense' },
  { id: 'signalJammer', kind: 'defense' },
  { id: 'silentReposition', kind: 'maneuver' },
] as const;

export type NavalAbilityId = (typeof NAVAL_ABILITIES)[number]['id'];
export type NavalAbilityKind = (typeof NAVAL_ABILITIES)[number]['kind'];

export const NAVAL_LOADOUT_SIZE = 3;

const abilityIds = new Set<string>(NAVAL_ABILITIES.map((ability) => ability.id));

export const isNavalAbilityId = (value: unknown): value is NavalAbilityId =>
  typeof value === 'string' && abilityIds.has(value);

export function uniqueNavalAbilities(values: readonly NavalAbilityId[]) {
  return [...new Set(values)];
}
