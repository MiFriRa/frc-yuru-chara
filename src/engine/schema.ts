import type { MascotDomain, YearType } from '../types/mascot';

const VALID_DOMAINS: ReadonlySet<MascotDomain> = new Set<MascotDomain>([
  'Fauna',
  'Flora_Food',
  'Lore_History',
  'Geo_Nature',
  'Object_Abstract',
]);

const VALID_YEAR_TYPES: ReadonlySet<YearType> = new Set<YearType>([
  'debut',
  'first_observed',
]);

const JIS_CODE_REGEX = /^(0[1-9]|[1-3][0-9]|4[0-7])$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates an unknown payload against the MascotRecord[] JSON schema.
 */
export function validateMascotRecords(data: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!Array.isArray(data)) {
    return {
      valid: false,
      errors: ['Root value must be an array of MascotRecord objects.'],
    };
  }

  const seenIds = new Set<string>();

  for (let i = 0; i < data.length; i += 1) {
    const entry = data[i];
    const prefix = `Record[${i}]`;

    if (!isPlainObject(entry)) {
      errors.push(`${prefix}: must be a non-null object.`);
      continue;
    }

    if (!isNonEmptyString(entry.id)) {
      errors.push(`${prefix}.id: must be a non-empty string.`);
    } else if (seenIds.has(entry.id)) {
      errors.push(`${prefix}.id: duplicate id "${entry.id}".`);
    } else {
      seenIds.add(entry.id);
    }

    if (!isNonEmptyString(entry.name_en)) {
      errors.push(`${prefix}.name_en: must be a non-empty string.`);
    }

    if (entry.name_jp !== null && typeof entry.name_jp !== 'string') {
      errors.push(`${prefix}.name_jp: must be a string or null.`);
    }

    if (typeof entry.jis_code !== 'string' || !JIS_CODE_REGEX.test(entry.jis_code)) {
      errors.push(`${prefix}.jis_code: must be a valid JIS code "01".."47".`);
    }

    if (!isNonEmptyString(entry.prefecture_en)) {
      errors.push(`${prefix}.prefecture_en: must be a non-empty string.`);
    }

    if (entry.municipality_en !== null && typeof entry.municipality_en !== 'string') {
      errors.push(`${prefix}.municipality_en: must be a string or null.`);
    }

    if (
      typeof entry.year !== 'number' ||
      !Number.isInteger(entry.year) ||
      entry.year < 1900 ||
      entry.year > 2100
    ) {
      errors.push(`${prefix}.year: must be an integer between 1900 and 2100.`);
    }

    if (
      typeof entry.year_type !== 'string' ||
      !VALID_YEAR_TYPES.has(entry.year_type as YearType)
    ) {
      errors.push(`${prefix}.year_type: must be "debut" or "first_observed".`);
    }

    if (entry.bio_en !== undefined && typeof entry.bio_en !== 'string') {
      errors.push(`${prefix}.bio_en: must be a string when provided.`);
    }

    if (!isPlainObject(entry.dna)) {
      errors.push(`${prefix}.dna: must be a non-null object.`);
      continue;
    }

    const dna = entry.dna;

    if (
      typeof dna.domain !== 'string' ||
      !VALID_DOMAINS.has(dna.domain as MascotDomain)
    ) {
      errors.push(
        `${prefix}.dna.domain: must be one of Fauna, Flora_Food, Lore_History, Geo_Nature, Object_Abstract.`
      );
    }

    if (!isNonEmptyString(dna.primary_trait)) {
      errors.push(`${prefix}.dna.primary_trait: must be a non-empty string.`);
    }

    let secondaryTraitsValid = false;
    if (!Array.isArray(dna.secondary_traits)) {
      errors.push(`${prefix}.dna.secondary_traits: must be an array of strings.`);
    } else {
      const invalidSecondary = dna.secondary_traits.some(
        (trait) => !isNonEmptyString(trait)
      );
      if (invalidSecondary) {
        errors.push(
          `${prefix}.dna.secondary_traits: every element must be a non-empty string.`
        );
      } else {
        secondaryTraitsValid = true;
      }
    }

    if (!isNonEmptyString(dna.trait_family)) {
      errors.push(`${prefix}.dna.trait_family: must be a non-empty string.`);
    }

    if (!isNonEmptyString(dna.primary_color)) {
      errors.push(`${prefix}.dna.primary_color: must be a non-empty string.`);
    }

    if (!isNonEmptyString(dna.accent_color)) {
      errors.push(`${prefix}.dna.accent_color: must be a non-empty string.`);
    }

    if (typeof dna.is_hybrid !== 'boolean') {
      errors.push(`${prefix}.dna.is_hybrid: must be a boolean.`);
    } else if (
      secondaryTraitsValid &&
      dna.is_hybrid !== ((dna.secondary_traits as string[]).length > 0)
    ) {
      errors.push(
        `${prefix}.dna.is_hybrid: must equal (secondary_traits.length > 0).`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
