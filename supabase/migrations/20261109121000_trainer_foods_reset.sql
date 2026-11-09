-- Alimentos del entrenador (pedido oct-7): se borra SOLO la lista de alimentos de las cuentas con rol
-- entrenador y se cargan los 19 de prueba, con pesajes en crudo y su porción de referencia.
-- La lista del nutricionista (y de cualquier otro rol) no se toca.
--
-- Los planes ya armados no se rompen: guardan una copia del nombre y de los macros de cada alimento.
--
-- Cómo se guarda cada alimento (igual que si se cargara a mano en la Guía):
--   · Por gramos: macros de la porción de referencia (macro_ref_basis_g, casi siempre 100 g).
--     En el plan se escribe cualquier gramaje (ej. 35 g) y los macros se recalculan en proporción.
--   · Por unidad (yema, clara, cucharada, rebanada): macros de 1 unidad y macro_ref_basis_g = gramos
--     de esa unidad. En el plan se pone 1, 2 o 3 unidades (o se pasa a gramos) y se recalcula.
--
-- ANTES DE CORRER: revisá a quién se le borra. Esta consulta tiene que mostrar solo al entrenador:
--   SELECT p.id, p.full_name, p.role, count(f.id) AS alimentos
--   FROM public.profiles p LEFT JOIN public.nutrition_food_library f ON f.owner_id = p.id
--   WHERE p.role = 'trainer' GROUP BY p.id, p.full_name, p.role;

BEGIN;

DELETE FROM public.nutrition_food_library f
USING public.profiles p
WHERE f.owner_id = p.id
  AND p.role = 'trainer';

INSERT INTO public.nutrition_food_library (
  owner_id, display_name, category, external_source,
  energy_kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g,
  macro_ref_basis_g, macro_qty_presentation, portion_basis, source_label, notes
)
SELECT p.id, v.display_name, v.category, 'manual',
       v.kcal, v.prot, v.carbs, v.fat, v.fiber,
       v.basis, v.presentation, v.portion_basis, 'Entrenador (oct-7)', v.notes
FROM public.profiles p
CROSS JOIN (VALUES
  -- Proteínas
  ('Pollo - pechuga cruda sin piel', 'Proteínas', 110::numeric, 23::numeric, 0::numeric, 1.2::numeric, NULL::numeric, 100::float8, 'grams', 'crudo', NULL::text),
  ('Yema', 'Proteínas', 55, 2.7, 0.6, 4.5, NULL, 17, 'units', 'crudo', '1 yema = 17 g'),
  ('Clara', 'Proteínas', 17, 3.6, 0.2, 0.1, NULL, 33, 'units', 'crudo', '1 clara = 33 g'),
  ('Carne magra - lomo / bola de lomo / cuadril', 'Proteínas', 135, 21, 0, 5, NULL, 100, 'grams', 'crudo', NULL),
  ('Pescado blanco - merluza / lenguado', 'Proteínas', 90, 19, 0, 1.5, NULL, 100, 'grams', 'crudo', NULL),
  -- Grasas buenas
  ('Crema de maní natural', 'Grasas buenas', 120, 5, 4, 10, 1.2, 20, 'units', 'no_especificado', '1 cucharada sopera colmada = 20 g'),
  ('Aceite - oliva / girasol', 'Grasas buenas', 108, 0, 0, 12, NULL, 12, 'units', 'no_especificado', '1 cucharada sopera = 12 ml · 100 ml = 884 kcal'),
  ('Palta', 'Grasas buenas', 160, 2, 9, 15, NULL, 100, 'grams', 'crudo', '1/2 palta grande = 100 g · 1 palta mediana entera = 200 g'),
  -- Carbohidratos
  ('Dulce de leche', 'Carbohidratos', 63, 1.2, 11, 1.4, NULL, 20, 'units', 'no_especificado', '1 cucharada sopera = 20 g'),
  ('Avena instantánea', 'Carbohidratos', 389, 17, 66, 7, NULL, 100, 'grams', 'crudo', '1 scoop / 1/2 taza = 40 g'),
  ('Pan lactal blanco', 'Carbohidratos', 66, 2.2, 12, 0.9, NULL, 25, 'units', 'no_especificado', '1 rebanada = 25 g'),
  ('Pan lactal integral', 'Carbohidratos', 74, 3.9, 12.3, 1, 2.1, 30, 'units', 'no_especificado', '1 rebanada = 30 g'),
  ('Arroz blanco', 'Carbohidratos', 365, 7, 80, 0.6, NULL, 100, 'grams', 'crudo', NULL),
  ('Arroz integral', 'Carbohidratos', 370, 7.5, 76, 2.7, 3.5, 100, 'grams', 'crudo', NULL),
  ('Fideos secos', 'Carbohidratos', 371, 13, 75, 1.5, NULL, 100, 'grams', 'crudo', NULL),
  ('Cereales - copos de maíz / tipo Zucaritas', 'Carbohidratos', 113, 2, 25, 0.3, NULL, 30, 'grams', 'no_especificado', '1 taza = 30 g'),
  -- Frutas y verduras
  ('Hortalizas A - lechuga, tomate, pepino, zapallito, rúcula, apio', 'Frutas y verduras', 20, 1, 4, 0.2, NULL, 100, 'grams', 'crudo', 'Libres, no se pesan.'),
  ('Hortalizas B - zanahoria, zapallo, calabaza, remolacha', 'Frutas y verduras', 40, 1.5, 8.5, 0.3, NULL, 100, 'grams', 'crudo', 'Papa, batata y choclo se pesan aparte.'),
  ('Papa / batata / choclo', 'Frutas y verduras', 80, NULL, 18, NULL, NULL, 100, 'grams', 'crudo', 'Del grupo Hortalizas B, pero se pesan aparte. Proteína y grasa sin dato.'),
  ('Frutos rojos - frutilla, arándano, frambuesa, mora', 'Frutas y verduras', 45, 0.8, 10, 0.3, NULL, 100, 'grams', 'crudo', '1 puñado = 50 g')
) AS v(display_name, category, kcal, prot, carbs, fat, fiber, basis, presentation, portion_basis, notes)
WHERE p.role = 'trainer';

COMMIT;
