/**
 * Static BLS CPI-U series metadata: taxonomy, labels and relative importance.
 * Identifiers are the authoritative series ids — never match on titles.
 *
 * Relative importance = share of all-item CPI-U expenditure, stored as a
 * fraction 0..1. Figures are from BLS "Relative importance of components in the
 * Consumer Price Indexes: U.S. city average, December 2025" (2024 expenditure
 * weights). Where a number is not published at that level it is marked as a
 * derived approximation in `sourceNote` — display only, never used in math.
 */

import type { BlsSeries } from './types'

const RI = {
  /** Official relative importance (Dec 2025, 2024 weights). */
  all: 1.0,
  food: 0.13698,
  foodAtHome: 0.08325,
  foodAway: 0.13698 - 0.08325, // derived
  housing: 0.44469,
  shelter: 0.35625,
  rent: 0.0784,
  oer: 0.26204,
  lodging: 0.01289,
  transport: 0.16316,
  newVehicles: 0.03838,
  usedCars: 0.02759,
  motorFuel: 0.02981,
  mvMaint: 0.00514, // "motor vehicle maintenance and servicing"
  mvInsurance: 0.02754,
  publicTransport: 0.01485,
  airlineFares: 0.00881,
  medical: 0.08423,
  medicalServices: 0.06935,
  medicalCommodities: 0.01489,
  hospital: 0.08423 * 0.31, // ≈31% of medical care (-ish), derived
  physicians: 0.01684,
  rx: 0.00973,
  apparel: 0.025, // approx
  recreation: 0.058, // approx
  eduComm: 0.062, // approx
  otherGoods: 0.031, // approx
  core: 0.799, // "all items less food and energy", approx
  energy: 0.06, // approx
  energyServices: 0.03235, // electricity + piped gas + fuel oil, Sept 2025
  fuelsUtilities: 0.04, // derived approx (housing − shelter − lodging − tenant ins − furnishings)
  furnishings: 0.024, // derived approx
} as const

const sourceNote =
  'BLS CPI-U relative importance, Dec 2025 (2024 expenditure weights)'

const approxNote =
  sourceNote + ' · approx / derived — displayed for context, not used in calculations'

function s(
  id: string,
  label: string,
  group: string,
  level: number,
  relImportance: number | undefined,
  title: string,
  parentId?: string,
  note?: string,
): BlsSeries {
  return { id, label, group, level, relImportance, title, parentId, sourceNote: note }
}

export const BLS_SERIES: BlsSeries[] = [
  s('CUUR0000SA0', 'All items', 'All items', 0, RI.all,
    'All items in U.S. city average, all urban consumers', undefined, sourceNote),

  s('CUUR0000SA0L1E', 'All items less food and energy', 'All items', 1, RI.core,
    'All items less food and energy in U.S. city average, all urban consumers',
    'CUUR0000SA0', approxNote),
  s('CUUR0000SA0E', 'Energy', 'All items', 1, RI.energy,
    'Energy in U.S. city average, all urban consumers', 'CUUR0000SA0', approxNote),

  s('CUUR0000SAF1', 'Food', 'Food', 1, RI.food,
    'Food in U.S. city average, all urban consumers', 'CUUR0000SA0', sourceNote),
  s('CUUR0000SAF11', 'Food at home', 'Food', 2, RI.foodAtHome,
    'Food at home in U.S. city average, all urban consumers', 'CUUR0000SAF1', sourceNote),
  s('CUUR0000SEFV', 'Food away from home', 'Food', 2, RI.foodAway,
    'Food away from home in U.S. city average, all urban consumers', 'CUUR0000SAF1', approxNote),

  s('CUUR0000SAH', 'Housing', 'Housing', 1, RI.housing,
    'Housing in U.S. city average, all urban consumers', 'CUUR0000SA0', sourceNote),
  s('CUUR0000SAH1', 'Shelter', 'Housing', 2, RI.shelter,
    'Shelter in U.S. city average, all urban consumers', 'CUUR0000SAH', sourceNote),
  s('CUUR0000SEHA', 'Rent of primary residence', 'Housing', 3, RI.rent,
    'Rent of primary residence in U.S. city average, all urban consumers', 'CUUR0000SAH1', sourceNote),
  s('CUUR0000SEHC', "Owners' equivalent rent", 'Housing', 3, RI.oer,
    "Owners' equivalent rent of residences in U.S. city average, all urban consumers",
    'CUUR0000SAH1', sourceNote),
  s('CUUR0000SEHB', 'Lodging away from home', 'Housing', 3, RI.lodging,
    'Lodging away from home in U.S. city average, all urban consumers', 'CUUR0000SAH', sourceNote),
  s('CUUR0000SAH2', 'Fuels and utilities', 'Housing', 2, RI.fuelsUtilities,
    'Fuels and utilities in U.S. city average, all urban consumers', 'CUUR0000SAH', approxNote),
  s('CUUR0000SEHF', 'Energy services', 'Housing', 3, RI.energyServices,
    'Energy services in U.S. city average, all urban consumers', 'CUUR0000SAH2', approxNote),
  s('CUUR0000SAH3', 'Household furnishings and operations', 'Housing', 2, RI.furnishings,
    'Household furnishings and operations in U.S. city average, all urban consumers',
    'CUUR0000SAH', approxNote),

  s('CUUR0000SAT', 'Transportation', 'Transportation', 1, RI.transport,
    'Transportation in U.S. city average, all urban consumers', 'CUUR0000SA0', sourceNote),
  s('CUUR0000SETA01', 'New vehicles', 'Transportation', 2, RI.newVehicles,
    'New vehicles in U.S. city average, all urban consumers', 'CUUR0000SAT', sourceNote),
  s('CUUR0000SETA02', 'Used cars and trucks', 'Transportation', 2, RI.usedCars,
    'Used cars and trucks in U.S. city average, all urban consumers', 'CUUR0000SAT', sourceNote),
  s('CUUR0000SETB01', 'Motor fuel', 'Transportation', 2, RI.motorFuel,
    'Motor fuel in U.S. city average, all urban consumers', 'CUUR0000SAT', sourceNote),
  s('CUUR0000SETD', 'Motor vehicle maintenance and repair', 'Transportation', 2, RI.mvMaint,
    'Motor vehicle maintenance and repair in U.S. city average, all urban consumers',
    'CUUR0000SAT', sourceNote),
  s('CUUR0000SETE', 'Motor vehicle insurance', 'Transportation', 2, RI.mvInsurance,
    'Motor vehicle insurance in U.S. city average, all urban consumers', 'CUUR0000SAT', sourceNote),
  s('CUUR0000SETG', 'Public transportation', 'Transportation', 2, RI.publicTransport,
    'Public transportation in U.S. city average, all urban consumers', 'CUUR0000SAT', sourceNote),
  s('CUUR0000SETG01', 'Airline fares', 'Transportation', 3, RI.airlineFares,
    'Airline fares in U.S. city average, all urban consumers', 'CUUR0000SETG', sourceNote),

  s('CUUR0000SAM', 'Medical care', 'Medical care', 1, RI.medical,
    'Medical care in U.S. city average, all urban consumers', 'CUUR0000SA0', sourceNote),
  s('CUUR0000SAM1', 'Medical care services', 'Medical care', 2, RI.medicalServices,
    'Medical care services in U.S. city average, all urban consumers', 'CUUR0000SAM', sourceNote),
  s('CUUR0000SEMD01', 'Hospital and related services', 'Medical care', 3, RI.hospital,
    'Hospital and related services in U.S. city average, all urban consumers',
    'CUUR0000SAM1', approxNote),
  s('CUUR0000SEMC01', "Physicians' services", 'Medical care', 3, RI.physicians,
    "Physicians' services in U.S. city average, all urban consumers",
    'CUUR0000SAM1', sourceNote),
  s('CUUR0000SAM2', 'Medical care commodities', 'Medical care', 2, RI.medicalCommodities,
    'Medical care commodities in U.S. city average, all urban consumers', 'CUUR0000SAM', sourceNote),
  s('CUUR0000SEMF01', 'Prescription drugs', 'Medical care', 3, RI.rx,
    'Prescription drugs in U.S. city average, all urban consumers', 'CUUR0000SAM2', sourceNote),

  s('CUUR0000SAA', 'Apparel', 'Apparel', 1, RI.apparel,
    'Apparel in U.S. city average, all urban consumers', 'CUUR0000SA0', approxNote),
  s('CUUR0000SAR', 'Recreation', 'Recreation', 1, RI.recreation,
    'Recreation in U.S. city average, all urban consumers', 'CUUR0000SA0', approxNote),
  s('CUUR0000SAE', 'Education and communication', 'Education & communication', 1, RI.eduComm,
    'Education and communication in U.S. city average, all urban consumers',
    'CUUR0000SA0', approxNote),
  s('CUUR0000SAG', 'Other goods and services', 'Other', 1, RI.otherGoods,
    'Other goods and services in U.S. city average, all urban consumers', 'CUUR0000SA0', approxNote),
]

export const blsSeriesById: Record<string, BlsSeries> = Object.fromEntries(
  BLS_SERIES.map((x) => [x.id, x]),
)

/** The BLS series used for the app's "All items" comparison. */
export const ALL_ITEMS_ID = 'CUUR0000SA0'

/** Direct (level ≥ 1) leaf series usable in mappings — excludes aggregates whose
 *  components are all covered by deeper series here. */
export const LEAF_SERIES = BLS_SERIES.filter(
  (x) => x.level >= 2 && x.parentId,
)