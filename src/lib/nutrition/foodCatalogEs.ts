/**
 * Referencias orientativas por 100 g en español (valores típicos de tablas domésticas;
 * no reemplazan análisis de laboratorio). El entrenador puede ajustar antes de guardar.
 */
import type { NutritionFoodPortionBasis } from '@/types/database'

export interface FoodCatalogItemEs {
  id: string
  nombre: string
  grupo: string
  protein_g_per_100g: number
  fat_g_per_100g: number
  carbs_g_per_100g: number
  fiber_g_per_100g: number
  energy_kcal_per_100g: number
  portion_basis: NutritionFoodPortionBasis
}

export const FOOD_CATALOG_ES: FoodCatalogItemEs[] = [
  // Cereales y pan
  { id: 'arroz-blanco-cocido', nombre: 'Arroz blanco cocido', grupo: 'Cereales', protein_g_per_100g: 2.7, fat_g_per_100g: 0.3, carbs_g_per_100g: 28, fiber_g_per_100g: 0.4, energy_kcal_per_100g: 130, portion_basis: 'cocido' },
  { id: 'fideos-secos-cocidos', nombre: 'Fideos secos (cocidos)', grupo: 'Cereales', protein_g_per_100g: 3.5, fat_g_per_100g: 0.9, carbs_g_per_100g: 25, fiber_g_per_100g: 1.8, energy_kcal_per_100g: 131, portion_basis: 'cocido' },
  { id: 'avena-hojuela', nombre: 'Avena en hojuelas (seca)', grupo: 'Cereales', protein_g_per_100g: 13, fat_g_per_100g: 7, carbs_g_per_100g: 66, fiber_g_per_100g: 10, energy_kcal_per_100g: 389, portion_basis: 'crudo' },
  { id: 'quinoa-cocida', nombre: 'Quinoa cocida', grupo: 'Cereales', protein_g_per_100g: 4.4, fat_g_per_100g: 1.9, carbs_g_per_100g: 19, fiber_g_per_100g: 2.8, energy_kcal_per_100g: 120, portion_basis: 'cocido' },
  { id: 'pan-miga', nombre: 'Pan francés / miga', grupo: 'Cereales', protein_g_per_100g: 9, fat_g_per_100g: 3.2, carbs_g_per_100g: 49, fiber_g_per_100g: 2.7, energy_kcal_per_100g: 265, portion_basis: 'cocido' },
  { id: 'batata-cocida', nombre: 'Batata / camote cocida', grupo: 'Tubérculos', protein_g_per_100g: 1.6, fat_g_per_100g: 0.1, carbs_g_per_100g: 21, fiber_g_per_100g: 3, energy_kcal_per_100g: 90, portion_basis: 'cocido' },
  { id: 'papa-cocida', nombre: 'Papa cocida', grupo: 'Tubérculos', protein_g_per_100g: 1.7, fat_g_per_100g: 0.1, carbs_g_per_100g: 16, fiber_g_per_100g: 1.8, energy_kcal_per_100g: 77, portion_basis: 'cocido' },

  // Legumbres (cocidas)
  { id: 'lentejas-cocidas', nombre: 'Lentejas cocidas', grupo: 'Legumbres', protein_g_per_100g: 9, fat_g_per_100g: 0.4, carbs_g_per_100g: 20, fiber_g_per_100g: 7.9, energy_kcal_per_100g: 116, portion_basis: 'cocido' },
  { id: 'garbanzos-cocidos', nombre: 'Garbanzos cocidos', grupo: 'Legumbres', protein_g_per_100g: 8.9, fat_g_per_100g: 2.6, carbs_g_per_100g: 27, fiber_g_per_100g: 7.6, energy_kcal_per_100g: 164, portion_basis: 'cocido' },
  { id: 'porotos-cocidos', nombre: 'Porotos / judías cocidas', grupo: 'Legumbres', protein_g_per_100g: 8.7, fat_g_per_100g: 0.5, carbs_g_per_100g: 23, fiber_g_per_100g: 6.4, energy_kcal_per_100g: 127, portion_basis: 'cocido' },

  // Carnes y pescado (cocidos / referencia cocida)
  { id: 'pollo-pechuga-cocida', nombre: 'Pechuga de pollo sin piel (cocida)', grupo: 'Carnes', protein_g_per_100g: 31, fat_g_per_100g: 3.6, carbs_g_per_100g: 0, fiber_g_per_100g: 0, energy_kcal_per_100g: 165, portion_basis: 'cocido' },
  { id: 'carne-vacuna-magrasada', nombre: 'Carne vacuna magra (cocida)', grupo: 'Carnes', protein_g_per_100g: 31, fat_g_per_100g: 5, carbs_g_per_100g: 0, fiber_g_per_100g: 0, energy_kcal_per_100g: 175, portion_basis: 'cocido' },
  { id: 'carne-picada-cocida', nombre: 'Carne picada (cocida, ~90% magra)', grupo: 'Carnes', protein_g_per_100g: 26, fat_g_per_100g: 12, carbs_g_per_100g: 0, fiber_g_per_100g: 0, energy_kcal_per_100g: 220, portion_basis: 'cocido' },
  { id: 'cerdo-lomo-magro', nombre: 'Cerdo lomo magro (cocido)', grupo: 'Carnes', protein_g_per_100g: 29, fat_g_per_100g: 6, carbs_g_per_100g: 0, fiber_g_per_100g: 0, energy_kcal_per_100g: 180, portion_basis: 'cocido' },
  { id: 'pescado-blanco', nombre: 'Pescado blanco (cocido: merluza, abadejo)', grupo: 'Pescado', protein_g_per_100g: 19, fat_g_per_100g: 1.5, carbs_g_per_100g: 0, fiber_g_per_100g: 0, energy_kcal_per_100g: 90, portion_basis: 'cocido' },
  { id: 'atun-lata-agua', nombre: 'Atún en lata (al agua, escurrido)', grupo: 'Pescado', protein_g_per_100g: 24, fat_g_per_100g: 1, carbs_g_per_100g: 0, fiber_g_per_100g: 0, energy_kcal_per_100g: 116, portion_basis: 'cocido' },
  { id: 'huevo-entero', nombre: 'Huevo entero (crudo o cocido)', grupo: 'Huevos', protein_g_per_100g: 13, fat_g_per_100g: 11, carbs_g_per_100g: 1.1, fiber_g_per_100g: 0, energy_kcal_per_100g: 143, portion_basis: 'no_especificado' },
  { id: 'clara-huevo', nombre: 'Clara de huevo', grupo: 'Huevos', protein_g_per_100g: 11, fat_g_per_100g: 0.2, carbs_g_per_100g: 0.7, fiber_g_per_100g: 0, energy_kcal_per_100g: 52, portion_basis: 'no_especificado' },

  // Lácteos
  { id: 'leche-descremada', nombre: 'Leche descremada', grupo: 'Lácteos', protein_g_per_100g: 3.4, fat_g_per_100g: 0.1, carbs_g_per_100g: 5, fiber_g_per_100g: 0, energy_kcal_per_100g: 35, portion_basis: 'no_especificado' },
  { id: 'leche-entera', nombre: 'Leche entera', grupo: 'Lácteos', protein_g_per_100g: 3.3, fat_g_per_100g: 3.3, carbs_g_per_100g: 4.8, fiber_g_per_100g: 0, energy_kcal_per_100g: 64, portion_basis: 'no_especificado' },
  { id: 'yogur-natural', nombre: 'Yogur natural (sin azúcar añadida)', grupo: 'Lácteos', protein_g_per_100g: 4, fat_g_per_100g: 3.3, carbs_g_per_100g: 4.7, fiber_g_per_100g: 0, energy_kcal_per_100g: 66, portion_basis: 'no_especificado' },
  { id: 'queso-blanco-descremado', nombre: 'Queso blanco / ricotta descremada', grupo: 'Lácteos', protein_g_per_100g: 11, fat_g_per_100g: 4.6, carbs_g_per_100g: 3, fiber_g_per_100g: 0, energy_kcal_per_100g: 98, portion_basis: 'no_especificado' },
  { id: 'queso-cremoso', nombre: 'Queso cremoso tipo untable', grupo: 'Lácteos', protein_g_per_100g: 6, fat_g_per_100g: 23, carbs_g_per_100g: 4, fiber_g_per_100g: 0, energy_kcal_per_100g: 250, portion_basis: 'no_especificado' },

  // Verduras y frutas
  { id: 'banana', nombre: 'Banana', grupo: 'Frutas', protein_g_per_100g: 1.1, fat_g_per_100g: 0.3, carbs_g_per_100g: 23, fiber_g_per_100g: 2.6, energy_kcal_per_100g: 89, portion_basis: 'crudo' },
  { id: 'manzana', nombre: 'Manzana', grupo: 'Frutas', protein_g_per_100g: 0.3, fat_g_per_100g: 0.2, carbs_g_per_100g: 14, fiber_g_per_100g: 2.4, energy_kcal_per_100g: 52, portion_basis: 'crudo' },
  { id: 'naranja', nombre: 'Naranja', grupo: 'Frutas', protein_g_per_100g: 0.9, fat_g_per_100g: 0.1, carbs_g_per_100g: 12, fiber_g_per_100g: 2.4, energy_kcal_per_100g: 47, portion_basis: 'crudo' },
  { id: 'palta', nombre: 'Palta / aguacate', grupo: 'Frutas', protein_g_per_100g: 2, fat_g_per_100g: 15, carbs_g_per_100g: 9, fiber_g_per_100g: 6.7, energy_kcal_per_100g: 160, portion_basis: 'crudo' },
  { id: 'tomate', nombre: 'Tomate', grupo: 'Verduras', protein_g_per_100g: 0.9, fat_g_per_100g: 0.2, carbs_g_per_100g: 3.9, fiber_g_per_100g: 1.2, energy_kcal_per_100g: 18, portion_basis: 'crudo' },
  { id: 'lechuga', nombre: 'Lechuga', grupo: 'Verduras', protein_g_per_100g: 1.4, fat_g_per_100g: 0.2, carbs_g_per_100g: 2.9, fiber_g_per_100g: 1.3, energy_kcal_per_100g: 17, portion_basis: 'crudo' },
  { id: 'brocoli-cocido', nombre: 'Brócoli cocido', grupo: 'Verduras', protein_g_per_100g: 2.4, fat_g_per_100g: 0.4, carbs_g_per_100g: 7, fiber_g_per_100g: 3.3, energy_kcal_per_100g: 35, portion_basis: 'cocido' },
  { id: 'espinaca-cocida', nombre: 'Espinaca cocida', grupo: 'Verduras', protein_g_per_100g: 3, fat_g_per_100g: 0.5, carbs_g_per_100g: 3.8, fiber_g_per_100g: 2.4, energy_kcal_per_100g: 23, portion_basis: 'cocido' },

  // Frutos secos y aceites
  { id: 'almendras', nombre: 'Almendras', grupo: 'Frutos secos', protein_g_per_100g: 21, fat_g_per_100g: 50, carbs_g_per_100g: 22, fiber_g_per_100g: 12, energy_kcal_per_100g: 579, portion_basis: 'crudo' },
  { id: 'nueces', nombre: 'Nueces', grupo: 'Frutos secos', protein_g_per_100g: 15, fat_g_per_100g: 65, carbs_g_per_100g: 14, fiber_g_per_100g: 6.7, energy_kcal_per_100g: 654, portion_basis: 'crudo' },
  { id: 'mani', nombre: 'Maní / cacahuetes', grupo: 'Frutos secos', protein_g_per_100g: 26, fat_g_per_100g: 49, carbs_g_per_100g: 16, fiber_g_per_100g: 8.5, energy_kcal_per_100g: 567, portion_basis: 'crudo' },
  { id: 'aceite-oliva', nombre: 'Aceite de oliva', grupo: 'Grasas', protein_g_per_100g: 0, fat_g_per_100g: 100, carbs_g_per_100g: 0, fiber_g_per_100g: 0, energy_kcal_per_100g: 884, portion_basis: 'no_especificado' },

  // Otros útiles planificación
  { id: 'miel', nombre: 'Miel', grupo: 'Otros', protein_g_per_100g: 0.3, fat_g_per_100g: 0, carbs_g_per_100g: 82, fiber_g_per_100g: 0.2, energy_kcal_per_100g: 304, portion_basis: 'no_especificado' },
  { id: 'azucar', nombre: 'Azúcar blanca', grupo: 'Otros', protein_g_per_100g: 0, fat_g_per_100g: 0, carbs_g_per_100g: 100, fiber_g_per_100g: 0, energy_kcal_per_100g: 387, portion_basis: 'no_especificado' },
  { id: 'cacao-polvo-desgrasado', nombre: 'Cacao en polvo (sin azúcar)', grupo: 'Otros', protein_g_per_100g: 20, fat_g_per_100g: 11, carbs_g_per_100g: 58, fiber_g_per_100g: 33, energy_kcal_per_100g: 228, portion_basis: 'no_especificado' },
]

export function filterFoodCatalogEs(query: string): FoodCatalogItemEs[] {
  const q = query.trim().toLowerCase()
  if (!q) return FOOD_CATALOG_ES
  return FOOD_CATALOG_ES.filter(
    (f) =>
      f.nombre.toLowerCase().includes(q) ||
      f.grupo.toLowerCase().includes(q)
  )
}
