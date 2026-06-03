export interface LangOption {
  value: string;
  label: string;
}

export const LANGUAGE_OPTIONS: LangOption[] = [
  { value: 'en', label: 'English' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
  { value: 'vi', label: 'Vietnamese' },
];

export const LANGUAGE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  LANGUAGE_OPTIONS.map((o) => [o.value, o.label]),
);

export function getLanguageLabel(code: string | null | undefined): string {
  if (!code) return 'All languages';
  return LANGUAGE_LABEL_MAP[code] ?? code.toUpperCase();
}

export const LEVEL_OPTIONS_BY_LANGUAGE: Record<string, LangOption[]> = {
  en: [
    { value: 'A1', label: 'A1' },
    { value: 'A2', label: 'A2' },
    { value: 'B1', label: 'B1' },
    { value: 'B2', label: 'B2' },
    { value: 'C1', label: 'C1' },
    { value: 'C2', label: 'C2' },
  ],
  ja: [
    { value: 'N5', label: 'N5' },
    { value: 'N4', label: 'N4' },
    { value: 'N3', label: 'N3' },
    { value: 'N2', label: 'N2' },
    { value: 'N1', label: 'N1' },
  ],
  ko: [
    { value: 'TOPIK_I_1', label: 'TOPIK I-1' },
    { value: 'TOPIK_I_2', label: 'TOPIK I-2' },
    { value: 'TOPIK_II_3', label: 'TOPIK II-3' },
    { value: 'TOPIK_II_4', label: 'TOPIK II-4' },
    { value: 'TOPIK_II_5', label: 'TOPIK II-5' },
    { value: 'TOPIK_II_6', label: 'TOPIK II-6' },
  ],
  zh: [
    { value: 'HSK_1', label: 'HSK 1' },
    { value: 'HSK_2', label: 'HSK 2' },
    { value: 'HSK_3', label: 'HSK 3' },
    { value: 'HSK_4', label: 'HSK 4' },
    { value: 'HSK_5', label: 'HSK 5' },
    { value: 'HSK_6', label: 'HSK 6' },
  ],
  vi: [
    { value: 'BEGINNER', label: 'Beginner' },
    { value: 'INTERMEDIATE', label: 'Intermediate' },
    { value: 'ADVANCED', label: 'Advanced' },
  ],
};

export const LEVEL_SYSTEM_LABELS: Record<string, string> = {
  en: 'CEFR',
  ja: 'JLPT',
  ko: 'TOPIK',
  zh: 'HSK',
  vi: 'Vietnamese',
};

export function getLevelSystemLabel(language: string): string {
  return LEVEL_SYSTEM_LABELS[language] ?? 'Level';
}

export function getLevelOptions(language: string): LangOption[] {
  return LEVEL_OPTIONS_BY_LANGUAGE[language] ?? [];
}

export function getLevelOptionsWithAll(language: string): LangOption[] {
  const system = LEVEL_SYSTEM_LABELS[language];
  const allLabel = system ? `All ${system} levels` : 'All levels';
  return [{ value: '', label: allLabel }, ...getLevelOptions(language)];
}

export function isLevelValidForLanguage(language: string, level: string): boolean {
  if (!level) return true;
  return getLevelOptions(language).some((o) => o.value === level);
}

export function getLevelLabel(language: string | null | undefined, level: string | null | undefined): string {
  if (!level) return 'All levels';
  const options = getLevelOptions(language ?? '');
  const match = options.find((o) => o.value === level);
  if (match) return match.label;
  return level.replaceAll('_', ' ');
}
