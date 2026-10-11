'use client';

// Filter state is defined here (not in page.tsx) to avoid circular imports.
export interface SearchFiltersState {
  rating: 'any' | '6' | '7' | '8';
  lang: 'any' | 'en' | 'es' | 'fr' | 'de' | 'hi' | 'ja' | 'ko';
  year: 'any' | 'classic' | string;
}

interface Props {
  filters: SearchFiltersState;
  onChange: (filters: SearchFiltersState) => void;
  onSearch: (query: string) => void;
  currentQuery: string;
}

const LANGUAGES = [
  { value: 'any', label: 'All Languages' },
  { value: 'en',  label: 'English' },
  { value: 'es',  label: 'Spanish' },
  { value: 'fr',  label: 'French' },
  { value: 'de',  label: 'German' },
  { value: 'hi',  label: 'Hindi' },
  { value: 'ja',  label: 'Japanese' },
  { value: 'ko',  label: 'Korean' },
];

const RATINGS = [
  { value: 'any', label: 'All Ratings' },
  { value: '6',   label: '6+ ★' },
  { value: '7',   label: '7+ ★' },
  { value: '8',   label: '8+ ★' },
];

const currentYear = new Date().getFullYear();
const YEARS = [
  { value: 'any',    label: 'All Years' },
  { value: 'classic', label: 'Classic <2000' },
  ...Array.from({ length: 25 }, (_, i) => ({
    value: String(currentYear - i),
    label: String(currentYear - i),
  })),
];

const dropdownBgImage =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="%23d0bcff" stroke-width="2"%3E%3Cpath d="M6 9l6 6 6-6"/%3E%3C/svg%3E';

const selectStyle = {
  backgroundImage: `url("${dropdownBgImage}")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  paddingRight: '2.5rem',
};

// Active filter chips — shown when a non-default filter is applied
function ActiveChips({ filters, onRemove }: {
  filters: SearchFiltersState;
  onRemove: (key: keyof SearchFiltersState) => void;
}) {
  const chips: { key: keyof SearchFiltersState; label: string }[] = [];

  if (filters.rating !== 'any') {
    const label = RATINGS.find((r) => r.value === filters.rating)?.label ?? filters.rating;
    chips.push({ key: 'rating', label });
  }
  if (filters.lang !== 'any') {
    const label = LANGUAGES.find((l) => l.value === filters.lang)?.label ?? filters.lang;
    chips.push({ key: 'lang', label });
  }
  if (filters.year !== 'any') {
    const label = filters.year === 'classic'
      ? 'Classic <2000'
      : YEARS.find((y) => y.value === filters.year)?.label ?? filters.year;
    chips.push({ key: 'year', label });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-3" role="list" aria-label="Active filters">
      {chips.map(({ key, label }) => (
        <button
          key={key}
          role="listitem"
          onClick={() => onRemove(key)}
          className="min-h-[48px] px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-medium
                     border border-primary/30 flex items-center gap-1.5 hover:bg-primary/30 transition-colors"
          aria-label={`Remove ${label} filter`}
        >
          {label}
          <span aria-hidden="true">×</span>
        </button>
      ))}
    </div>
  );
}

export default function SearchFilters({ filters, onChange, onSearch, currentQuery }: Props) {
  const defaults: SearchFiltersState = { rating: 'any', lang: 'any', year: 'any' };

  const handleFilterChange = (key: keyof SearchFiltersState, value: string) => {
    onChange({ ...filters, [key]: value });
    if (currentQuery) onSearch(currentQuery);
  };

  const removeFilter = (key: keyof SearchFiltersState) => {
    onChange({ ...filters, [key]: defaults[key] });
    if (currentQuery) onSearch(currentQuery);
  };

  return (
    <div className="w-full" role="search" aria-label="Filter search results">
      <ActiveChips filters={filters} onRemove={removeFilter} />

      <div className="flex flex-wrap items-center gap-3">
        {/* Rating */}
        <div className="flex flex-col gap-0.5">
          <label
            htmlFor="filter-rating"
            className="text-[10px] text-on-surface-variant uppercase tracking-wider pl-1"
          >
            Rating
          </label>
          <select
            id="filter-rating"
            value={filters.rating}
            onChange={(e) => handleFilterChange('rating', e.target.value)}
            className="min-h-[48px] px-4 bg-surface-container rounded-xl text-sm text-white
                       border border-white/10 cursor-pointer
                       hover:border-white/20 focus:outline-none focus:border-primary
                       focus:ring-1 focus:ring-primary/50 transition-all"
            style={selectStyle}
            aria-label="Minimum rating filter"
          >
            {RATINGS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Language */}
        <div className="flex flex-col gap-0.5">
          <label
            htmlFor="filter-lang"
            className="text-[10px] text-on-surface-variant uppercase tracking-wider pl-1"
          >
            Language
          </label>
          <select
            id="filter-lang"
            value={filters.lang}
            onChange={(e) => handleFilterChange('lang', e.target.value)}
            className="min-h-[48px] px-4 bg-surface-container rounded-xl text-sm text-white
                       border border-white/10 cursor-pointer
                       hover:border-white/20 focus:outline-none focus:border-primary
                       focus:ring-1 focus:ring-primary/50 transition-all"
            style={selectStyle}
            aria-label="Original language filter"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>

        {/* Year */}
        <div className="flex flex-col gap-0.5">
          <label
            htmlFor="filter-year"
            className="text-[10px] text-on-surface-variant uppercase tracking-wider pl-1"
          >
            Year
          </label>
          <select
            id="filter-year"
            value={filters.year}
            onChange={(e) => handleFilterChange('year', e.target.value)}
            className="min-h-[48px] px-4 bg-surface-container rounded-xl text-sm text-white
                       border border-white/10 cursor-pointer
                       hover:border-white/20 focus:outline-none focus:border-primary
                       focus:ring-1 focus:ring-primary/50 transition-all"
            style={selectStyle}
            aria-label="Release year filter"
          >
            {YEARS.map((y) => (
              <option key={y.value} value={y.value}>{y.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}