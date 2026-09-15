import type { BudgetLocation } from '../engine/types'

/**
 * ZIP → area localization. Purely client-side and deterministic so the static
 * site works with no API key and no network hop.
 *
 * A user's 5-digit ZIP is resolved to a ZIP3 (first three digits), which matches
 * a metro when an exact prefix is known, otherwise a broad ZIP3-range region.
 * Coverage is complete (every 000–999 maps to something), so a valid ZIP always
 * localizes.
 *
 * The per-area numbers are APPROXIMATE REGIONAL GUIDES, synthesized from public
 * reference data and coarse to ZIP3 level — they are not official per-ZIP
 * statistics:
 *  - cola: regional price level vs US average ≈ 1.00 (BEA Regional Price
 *    Parities, ~2022 relative cost of living).
 *  - rentFactor: typical rent for the area vs US-average typical rent ≈ 1.00
 *    (ACS 5-year median gross rent, ~2022).
 *  - medianIncome: median household income, annual $ (ACS 5-year).
 *
 * UA: everything live is labelled "approximately". If density matters someday,
 * swap this file for a real per-ZIP provider (e.g. a runtime Census/geocoder)
 * behind the same `locationForZip` shape.
 */

export const US_MEDIAN_HOUSEHOLD_INCOME = 75_240

export const LOCATION_SOURCES = {
  rpp: { label: 'BEA · Regional Price Parities (cost of living vs US)', url: 'https://www.bea.gov/data/prices-incomes/regional-price-parities' },
  acs: { label: 'U.S. Census ACS · median gross rent & household income', url: 'https://www.census.gov/acs/www/data/data-tables-and-tools/data-profiles/' },
} as const

interface RegionEntry {
  label: string
  cola: number
  rentFactor: number
  medianIncome: number
  /** Exact ZIP3 prefixes (metropolitan areas first — they beat ranges). */
  prefixes?: number[]
  /** Inclusive ZIP3 range for the regional fallback. */
  range?: [number, number]
}

const METROS: RegionEntry[] = [
  // ---- Northeast metros ----
  { label: 'New York City', cola: 1.3, rentFactor: 1.9, medianIncome: 86_000, prefixes: [100, 101, 102, 103, 104, 111, 112, 113, 114, 116] },
  { label: 'New York metro · Long Island / Westchester', cola: 1.24, rentFactor: 1.55, medianIncome: 119_000, prefixes: [105, 106, 107, 110, 115, 117, 118, 119] },
  { label: 'Boston metro', cola: 1.22, rentFactor: 1.6, medianIncome: 98_000, prefixes: [21, 22, 23, 24] },
  { label: 'Hartford metro', cola: 1.03, rentFactor: 1.1, medianIncome: 80_000, prefixes: [61] },
  { label: 'Providence metro', cola: 1.05, rentFactor: 1.1, medianIncome: 76_000, prefixes: [28, 29] },
  { label: 'New Haven / Bridgeport, CT', cola: 1.06, rentFactor: 1.15, medianIncome: 80_000, prefixes: [64, 65, 66, 68] },
  { label: 'Buffalo metro', cola: 0.92, rentFactor: 0.88, medianIncome: 64_000, prefixes: [140, 141, 142] },
  { label: 'Rochester metro', cola: 0.92, rentFactor: 0.83, medianIncome: 66_000, prefixes: [144, 145, 146] },
  { label: 'Albany metro', cola: 0.96, rentFactor: 0.92, medianIncome: 74_000, prefixes: [120, 121, 122, 123] },
  { label: 'Pittsburgh metro', cola: 0.92, rentFactor: 0.85, medianIncome: 67_000, prefixes: [150, 151, 152, 153] },
  { label: 'Philadelphia metro', cola: 1.05, rentFactor: 1.05, medianIncome: 79_000, prefixes: [190, 191, 192, 193, 194, 195, 196] },
  { label: 'Baltimore metro', cola: 1.02, rentFactor: 1.05, medianIncome: 72_000, prefixes: [212] },

  // ---- Mid-Atlantic / Washington ----
  { label: 'Washington DC metro', cola: 1.24, rentFactor: 1.5, medianIncome: 112_000, prefixes: [200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 220, 221, 222, 223] },
  { label: 'Richmond metro', cola: 0.95, rentFactor: 0.95, medianIncome: 73_000, prefixes: [230, 231, 232] },
  { label: 'Virginia Beach / Norfolk', cola: 0.97, rentFactor: 0.95, medianIncome: 75_000, prefixes: [233, 234, 235, 236] },
  { label: 'Charlotte metro', cola: 0.95, rentFactor: 1.02, medianIncome: 79_000, prefixes: [281, 282] },
  { label: 'Raleigh / Durham', cola: 0.95, rentFactor: 1.05, medianIncome: 90_000, prefixes: [275, 276, 277, 278] },

  // ---- Southeast ----
  { label: 'Atlanta metro', cola: 1.02, rentFactor: 1.1, medianIncome: 87_000, prefixes: [300, 301, 302, 303, 305, 306] },
  { label: 'Jacksonville metro', cola: 0.93, rentFactor: 0.9, medianIncome: 64_000, prefixes: [320, 321, 322] },
  { label: 'Orlando metro', cola: 0.98, rentFactor: 1.05, medianIncome: 67_000, prefixes: [327, 328] },
  { label: 'Tampa Bay', cola: 0.95, rentFactor: 0.95, medianIncome: 64_000, prefixes: [335, 336, 337] },
  { label: 'Miami / Fort Lauderdale', cola: 1.08, rentFactor: 1.15, medianIncome: 62_000, prefixes: [330, 331, 332, 333, 334] },
  { label: 'Nashville metro', cola: 0.96, rentFactor: 1.05, medianIncome: 75_000, prefixes: [370, 371, 372] },
  { label: 'Memphis metro', cola: 0.87, rentFactor: 0.78, medianIncome: 57_000, prefixes: [375, 380, 381] },
  { label: 'New Orleans metro', cola: 0.95, rentFactor: 0.9, medianIncome: 58_000, prefixes: [700, 701, 703, 704] },

  // ---- Midwest ----
  { label: 'Detroit metro', cola: 0.93, rentFactor: 0.9, medianIncome: 63_000, prefixes: [480, 481, 482, 483, 484, 485] },
  { label: 'Cleveland metro', cola: 0.92, rentFactor: 0.9, medianIncome: 58_000, prefixes: [440, 441, 442] },
  { label: 'Columbus metro', cola: 0.93, rentFactor: 0.95, medianIncome: 69_000, prefixes: [430, 431, 432, 433] },
  { label: 'Cincinnati metro', cola: 0.93, rentFactor: 0.95, medianIncome: 68_000, prefixes: [450, 451, 452, 453] },
  { label: 'Chicago metro', cola: 1.06, rentFactor: 1.1, medianIncome: 78_000, prefixes: [600, 601, 602, 603, 604, 605, 606, 607, 608] },
  { label: 'Milwaukee metro', cola: 0.95, rentFactor: 0.95, medianIncome: 68_000, prefixes: [531, 532, 534] },
  { label: 'Minneapolis / St. Paul', cola: 0.99, rentFactor: 1.0, medianIncome: 83_000, prefixes: [551, 553, 554, 555, 556, 560] },
  { label: 'St. Louis metro', cola: 0.93, rentFactor: 0.9, medianIncome: 66_000, prefixes: [630, 631, 633] },
  { label: 'Kansas City metro', cola: 0.93, rentFactor: 0.9, medianIncome: 71_000, prefixes: [640, 641, 662] },
  { label: 'Indianapolis metro', cola: 0.91, rentFactor: 0.85, medianIncome: 70_000, prefixes: [460, 461, 462] },
  { label: 'Louisville metro', cola: 0.9, rentFactor: 0.83, medianIncome: 67_000, prefixes: [400, 401, 402, 403] },
  { label: 'Omaha metro', cola: 0.91, rentFactor: 0.83, medianIncome: 76_000, prefixes: [680, 681] },
  { label: 'Des Moines metro', cola: 0.92, rentFactor: 0.88, medianIncome: 77_000, prefixes: [500, 501, 502, 503] },

  // ---- Texas / South Central ----
  { label: 'Dallas / Fort Worth', cola: 0.98, rentFactor: 1.02, medianIncome: 80_000, prefixes: [750, 751, 752, 753, 760, 761, 762] },
  { label: 'Houston metro', cola: 0.97, rentFactor: 0.93, medianIncome: 70_000, prefixes: [770, 773, 774, 775] },
  { label: 'Austin metro', cola: 0.99, rentFactor: 1.06, medianIncome: 82_000, prefixes: [786, 787] },
  { label: 'San Antonio metro', cola: 0.9, rentFactor: 0.84, medianIncome: 62_000, prefixes: [780, 781, 782] },
  { label: 'El Paso', cola: 0.85, rentFactor: 0.75, medianIncome: 53_000, prefixes: [799] },
  { label: 'Oklahoma City metro', cola: 0.88, rentFactor: 0.8, medianIncome: 62_000, prefixes: [730, 731] },
  { label: 'Tulsa metro', cola: 0.87, rentFactor: 0.78, medianIncome: 58_000, prefixes: [740, 741] },

  // ---- Mountain ----
  { label: 'Denver / Boulder', cola: 1.04, rentFactor: 1.28, medianIncome: 95_000, prefixes: [800, 801, 802, 803, 804, 805, 806] },
  { label: 'Phoenix metro', cola: 1.03, rentFactor: 1.08, medianIncome: 76_000, prefixes: [850, 851, 852, 853] },
  { label: 'Salt Lake City metro', cola: 0.95, rentFactor: 0.95, medianIncome: 79_000, prefixes: [840, 841, 844] },
  { label: 'Las Vegas metro', cola: 0.98, rentFactor: 1.0, medianIncome: 65_000, prefixes: [889, 890, 891] },
  { label: 'Albuquerque metro', cola: 0.9, rentFactor: 0.85, medianIncome: 62_000, prefixes: [870, 871] },
  { label: 'Boise metro', cola: 0.98, rentFactor: 1.1, medianIncome: 80_000, prefixes: [836, 837] },

  // ---- West Coast ----
  { label: 'Seattle / Tacoma', cola: 1.12, rentFactor: 1.45, medianIncome: 102_000, prefixes: [980, 981, 982, 983, 984, 985, 987] },
  { label: 'Portland metro', cola: 1.05, rentFactor: 1.15, medianIncome: 82_000, prefixes: [970, 971, 972, 973, 986] },
  { label: 'Sacramento metro', cola: 1.06, rentFactor: 1.15, medianIncome: 82_000, prefixes: [956, 957, 958] },
  { label: 'San Francisco Bay Area', cola: 1.42, rentFactor: 2.0, medianIncome: 128_000, prefixes: [940, 941, 942, 943, 944, 945, 946, 948, 949, 950, 951, 954] },
  { label: 'Los Angeles metro', cola: 1.22, rentFactor: 1.6, medianIncome: 87_000, prefixes: [900, 901, 902, 903, 904, 905, 906, 907, 908, 910, 911, 912, 913, 914, 915, 916, 917, 918, 928] },
  { label: 'San Diego metro', cola: 1.22, rentFactor: 1.6, medianIncome: 93_000, prefixes: [919, 920, 921, 922] },
  { label: 'Fresno / Bakersfield', cola: 0.94, rentFactor: 0.83, medianIncome: 65_000, prefixes: [936, 937, 932] },
  { label: 'Spokane metro', cola: 0.95, rentFactor: 0.98, medianIncome: 66_000, prefixes: [990, 992] },
  { label: 'Hawaii', cola: 1.15, rentFactor: 1.2, medianIncome: 94_000, prefixes: [967, 968] },
  { label: 'Anchorage / Alaska', cola: 1.12, rentFactor: 1.1, medianIncome: 89_000, prefixes: [995, 996, 997, 998, 999] },

  // ---- Territories / special ----
  { label: 'Puerto Rico', cola: 0.88, rentFactor: 0.7, medianIncome: 22_000, prefixes: [6, 7, 8, 9] },
]

/**
 * Broad regional fallbacks (ZIP3 ranges) so every 000–999 resolves even outside
 * the metros above. Ranges are evaluated after exact metro prefixes.
 */
const REGIONS: RegionEntry[] = [
  { label: 'New England (non-metro)', cola: 1.04, rentFactor: 1.1, medianIncome: 78_000, range: [10, 99] },
  { label: 'Northeast / Mid-Atlantic (non-metro)', cola: 0.96, rentFactor: 0.96, medianIncome: 70_000, range: [100, 199] },
  { label: 'Mid-Atlantic / South Atlantic (non-metro)', cola: 0.97, rentFactor: 0.95, medianIncome: 72_000, range: [200, 299] },
  { label: 'Southeast (non-metro)', cola: 0.93, rentFactor: 0.85, medianIncome: 65_000, range: [300, 399] },
  { label: 'Ohio Valley / Upper South', cola: 0.92, rentFactor: 0.88, medianIncome: 63_000, range: [400, 499] },
  { label: 'Upper Midwest', cola: 0.95, rentFactor: 0.92, medianIncome: 72_000, range: [500, 599] },
  { label: 'Midwest (non-metro)', cola: 0.93, rentFactor: 0.88, medianIncome: 65_000, range: [600, 699] },
  { label: 'South Central / Plains', cola: 0.9, rentFactor: 0.82, medianIncome: 60_000, range: [700, 799] },
  { label: 'Mountain West', cola: 0.97, rentFactor: 0.95, medianIncome: 72_000, range: [800, 899] },
  { label: 'West Coast / West (non-metro)', cola: 1.1, rentFactor: 1.15, medianIncome: 85_000, range: [900, 999] },
  { label: 'New England / non-contiguous (baseline)', cola: 1.0, rentFactor: 1.0, medianIncome: US_MEDIAN_HOUSEHOLD_INCOME, range: [0, 9] },
]

const ALL: RegionEntry[] = [...METROS, ...REGIONS]

function matches(e: RegionEntry, zip3: number): boolean {
  if (e.prefixes?.includes(zip3)) return true
  if (e.range && zip3 >= e.range[0] && zip3 <= e.range[1]) return true
  return false
}

/**
 * Resolve a ZIP to an area. Returns null until the input has 5 digits (so the
 * UI quietly waits while typing); valid 5-digit ZIPS always resolve because the
 * regional ranges cover the full space.
 */
export function locationForZip(zip: string): BudgetLocation | null {
  const digits = zip.replace(/\D/g, '').slice(0, 5)
  if (digits.length < 5) return null
  const zip3 = Number(digits.slice(0, 3))
  const entry = ALL.find((e) => matches(e, zip3)) ?? REGIONS[0]
  return {
    zip: digits,
    metro: entry.label,
    cola: entry.cola,
    rentFactor: entry.rentFactor,
    medianIncome: entry.medianIncome,
    matched: true,
  }
}