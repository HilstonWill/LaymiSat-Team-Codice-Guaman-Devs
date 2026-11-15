/** Utilidades compartidas por el planificador de rotaciones y la tarjeta de Hoy. */

export type Family = 'papa' | 'tuberculo' | 'grano' | 'leguminosa' | 'descanso'

// Familia de cada cultivo: alternar familias corta plagas (papa) y repone nitrógeno (leguminosas, descanso).
export const FAMILY: Record<string, Family> = {
  papa: 'papa',
  papa_amarga: 'papa',
  oca: 'tuberculo',
  cebada: 'grano',
  avena: 'grano',
  quinua: 'grano',
  tarwi: 'leguminosa',
  haba: 'leguminosa',
  descanso: 'descanso',
}

export const FAMILIES: Family[] = ['papa', 'tuberculo', 'grano', 'leguminosa', 'descanso']

/** Nombre corto para las fichas de campaña (el nombre completo va en el menú y en el lector de pantalla). */
export const SHORT_CROP: Record<'es' | 'en', Record<string, string>> = {
  es: {
    papa: 'Papa nativa',
    papa_amarga: "Ruk'i",
    oca: 'Oca / olluco',
    cebada: 'Cebada',
    avena: 'Avena',
    quinua: 'Quinua',
    tarwi: 'Tarwi',
    haba: 'Haba',
    descanso: 'Descanso',
  },
  en: {
    papa: 'Native potato',
    papa_amarga: "Ruk'i",
    oca: 'Oca / olluco',
    cebada: 'Barley',
    avena: 'Oats',
    quinua: 'Quinoa',
    tarwi: 'Tarwi',
    haba: 'Faba bean',
    descanso: 'Fallow',
  },
}

/**
 * Campañas reales en lugar de "Año 1, Año 2…": la campaña andina va de agosto a julio,
 * así que desde agosto ya corre la campaña del año en curso (nov 2026 → 2026–27, 2027–28, …).
 */
export function campaignLabels(n: number, today = new Date()): string[] {
  const start = today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1
  return Array.from({ length: n }, (_, i) => `${start + i}–${String((start + i + 1) % 100).padStart(2, '0')}`)
}
