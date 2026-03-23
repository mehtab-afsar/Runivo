export interface FoodItem {
  id: string;
  name: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  defaultServing: string;
  defaultServingG: number;
  category: 'protein' | 'carbs' | 'dairy' | 'fruit' | 'veg' | 'fat' | 'drink' | 'other';
}

export const COMMON_FOODS: FoodItem[] = [
  // ── Protein ───────────────────────────────────────────────────────────────
  { id: 'chicken-breast',     name: 'Chicken breast (cooked)', kcalPer100g: 165, proteinPer100g: 31, carbsPer100g: 0,  fatPer100g: 3.6, defaultServing: '150g', defaultServingG: 150, category: 'protein' },
  { id: 'chicken-thigh',      name: 'Chicken thigh (cooked)',  kcalPer100g: 209, proteinPer100g: 26, carbsPer100g: 0,  fatPer100g: 11,  defaultServing: '120g', defaultServingG: 120, category: 'protein' },
  { id: 'ground-beef',        name: 'Ground beef (80/20)',     kcalPer100g: 254, proteinPer100g: 26, carbsPer100g: 0,  fatPer100g: 17,  defaultServing: '100g', defaultServingG: 100, category: 'protein' },
  { id: 'beef-steak',         name: 'Beef steak (grilled)',    kcalPer100g: 271, proteinPer100g: 29, carbsPer100g: 0,  fatPer100g: 17,  defaultServing: '200g', defaultServingG: 200, category: 'protein' },
  { id: 'salmon',             name: 'Salmon (cooked)',         kcalPer100g: 208, proteinPer100g: 20, carbsPer100g: 0,  fatPer100g: 13,  defaultServing: '150g', defaultServingG: 150, category: 'protein' },
  { id: 'tuna-canned',        name: 'Tuna (canned in water)',  kcalPer100g: 116, proteinPer100g: 26, carbsPer100g: 0,  fatPer100g: 1,   defaultServing: '85g',  defaultServingG: 85,  category: 'protein' },
  { id: 'shrimp',             name: 'Shrimp (cooked)',         kcalPer100g: 99,  proteinPer100g: 24, carbsPer100g: 0,  fatPer100g: 0.3, defaultServing: '100g', defaultServingG: 100, category: 'protein' },
  { id: 'whole-egg',          name: 'Egg (whole, large)',      kcalPer100g: 143, proteinPer100g: 13, carbsPer100g: 1,  fatPer100g: 10,  defaultServing: '1 egg (50g)', defaultServingG: 50, category: 'protein' },
  { id: 'egg-white',          name: 'Egg whites',              kcalPer100g: 52,  proteinPer100g: 11, carbsPer100g: 0.7,fatPer100g: 0.2, defaultServing: '3 whites (100g)', defaultServingG: 100, category: 'protein' },
  { id: 'turkey-breast',      name: 'Turkey breast (cooked)',  kcalPer100g: 135, proteinPer100g: 30, carbsPer100g: 0,  fatPer100g: 1,   defaultServing: '120g', defaultServingG: 120, category: 'protein' },
  { id: 'whey-protein',       name: 'Whey protein shake',      kcalPer100g: 373, proteinPer100g: 73, carbsPer100g: 7,  fatPer100g: 5,   defaultServing: '1 scoop (30g)', defaultServingG: 30, category: 'protein' },
  { id: 'tofu',               name: 'Tofu (firm)',             kcalPer100g: 76,  proteinPer100g: 8,  carbsPer100g: 2,  fatPer100g: 4.8, defaultServing: '150g', defaultServingG: 150, category: 'protein' },
  { id: 'lentils',            name: 'Lentils (cooked)',        kcalPer100g: 116, proteinPer100g: 9,  carbsPer100g: 20, fatPer100g: 0.4, defaultServing: '150g', defaultServingG: 150, category: 'protein' },
  { id: 'black-beans',        name: 'Black beans (cooked)',    kcalPer100g: 132, proteinPer100g: 9,  carbsPer100g: 24, fatPer100g: 0.5, defaultServing: '150g', defaultServingG: 150, category: 'protein' },
  { id: 'chickpeas',          name: 'Chickpeas (cooked)',      kcalPer100g: 164, proteinPer100g: 9,  carbsPer100g: 27, fatPer100g: 2.6, defaultServing: '150g', defaultServingG: 150, category: 'protein' },

  // ── Carbs ─────────────────────────────────────────────────────────────────
  { id: 'white-rice',         name: 'White rice (cooked)',     kcalPer100g: 130, proteinPer100g: 2.7,carbsPer100g: 28, fatPer100g: 0.3, defaultServing: '200g', defaultServingG: 200, category: 'carbs' },
  { id: 'brown-rice',         name: 'Brown rice (cooked)',     kcalPer100g: 112, proteinPer100g: 2.6,carbsPer100g: 23, fatPer100g: 0.9, defaultServing: '200g', defaultServingG: 200, category: 'carbs' },
  { id: 'pasta',              name: 'Pasta (cooked)',          kcalPer100g: 158, proteinPer100g: 5.8,carbsPer100g: 31, fatPer100g: 0.9, defaultServing: '200g', defaultServingG: 200, category: 'carbs' },
  { id: 'whole-wheat-pasta',  name: 'Whole-wheat pasta (cooked)', kcalPer100g: 149, proteinPer100g: 5.5, carbsPer100g: 29, fatPer100g: 1, defaultServing: '200g', defaultServingG: 200, category: 'carbs' },
  { id: 'white-bread',        name: 'White bread',            kcalPer100g: 266, proteinPer100g: 9,  carbsPer100g: 51, fatPer100g: 3.2, defaultServing: '1 slice (30g)', defaultServingG: 30, category: 'carbs' },
  { id: 'whole-wheat-bread',  name: 'Whole-wheat bread',      kcalPer100g: 247, proteinPer100g: 13, carbsPer100g: 41, fatPer100g: 3.4, defaultServing: '1 slice (30g)', defaultServingG: 30, category: 'carbs' },
  { id: 'oats',               name: 'Oats / porridge (dry)',  kcalPer100g: 389, proteinPer100g: 17, carbsPer100g: 66, fatPer100g: 7,   defaultServing: '50g', defaultServingG: 50, category: 'carbs' },
  { id: 'granola',            name: 'Granola',                kcalPer100g: 471, proteinPer100g: 11, carbsPer100g: 64, fatPer100g: 20,  defaultServing: '50g', defaultServingG: 50, category: 'carbs' },
  { id: 'tortilla-wrap',      name: 'Flour tortilla (wrap)',  kcalPer100g: 312, proteinPer100g: 9,  carbsPer100g: 50, fatPer100g: 8,   defaultServing: '1 wrap (45g)', defaultServingG: 45, category: 'carbs' },
  { id: 'sweet-potato',       name: 'Sweet potato (baked)',   kcalPer100g: 90,  proteinPer100g: 2,  carbsPer100g: 21, fatPer100g: 0.1, defaultServing: '150g', defaultServingG: 150, category: 'carbs' },
  { id: 'white-potato',       name: 'White potato (boiled)',  kcalPer100g: 87,  proteinPer100g: 1.9,carbsPer100g: 20, fatPer100g: 0.1, defaultServing: '150g', defaultServingG: 150, category: 'carbs' },
  { id: 'quinoa',             name: 'Quinoa (cooked)',        kcalPer100g: 120, proteinPer100g: 4.4,carbsPer100g: 22, fatPer100g: 1.9, defaultServing: '150g', defaultServingG: 150, category: 'carbs' },

  // ── Dairy ─────────────────────────────────────────────────────────────────
  { id: 'whole-milk',         name: 'Whole milk',             kcalPer100g: 61,  proteinPer100g: 3.2,carbsPer100g: 4.8,fatPer100g: 3.3, defaultServing: '250ml', defaultServingG: 250, category: 'dairy' },
  { id: 'skim-milk',          name: 'Skimmed milk',           kcalPer100g: 35,  proteinPer100g: 3.5,carbsPer100g: 5,  fatPer100g: 0.1, defaultServing: '250ml', defaultServingG: 250, category: 'dairy' },
  { id: 'greek-yogurt',       name: 'Greek yogurt (full fat)',kcalPer100g: 97,  proteinPer100g: 9,  carbsPer100g: 4,  fatPer100g: 5,   defaultServing: '150g', defaultServingG: 150, category: 'dairy' },
  { id: 'greek-yogurt-0fat',  name: 'Greek yogurt (0% fat)',  kcalPer100g: 59,  proteinPer100g: 10, carbsPer100g: 3.6,fatPer100g: 0.4, defaultServing: '150g', defaultServingG: 150, category: 'dairy' },
  { id: 'cheddar-cheese',     name: 'Cheddar cheese',         kcalPer100g: 403, proteinPer100g: 25, carbsPer100g: 1.3,fatPer100g: 33,  defaultServing: '30g', defaultServingG: 30, category: 'dairy' },
  { id: 'cottage-cheese',     name: 'Cottage cheese (low fat)',kcalPer100g: 81, proteinPer100g: 11, carbsPer100g: 3.4,fatPer100g: 2.3, defaultServing: '150g', defaultServingG: 150, category: 'dairy' },
  { id: 'mozzarella',         name: 'Mozzarella',             kcalPer100g: 280, proteinPer100g: 28, carbsPer100g: 2,  fatPer100g: 17,  defaultServing: '50g', defaultServingG: 50, category: 'dairy' },

  // ── Fruit ─────────────────────────────────────────────────────────────────
  { id: 'banana',             name: 'Banana',                 kcalPer100g: 89,  proteinPer100g: 1.1,carbsPer100g: 23, fatPer100g: 0.3, defaultServing: '1 medium (120g)', defaultServingG: 120, category: 'fruit' },
  { id: 'apple',              name: 'Apple',                  kcalPer100g: 52,  proteinPer100g: 0.3,carbsPer100g: 14, fatPer100g: 0.2, defaultServing: '1 medium (180g)', defaultServingG: 180, category: 'fruit' },
  { id: 'orange',             name: 'Orange',                 kcalPer100g: 47,  proteinPer100g: 0.9,carbsPer100g: 12, fatPer100g: 0.1, defaultServing: '1 medium (150g)', defaultServingG: 150, category: 'fruit' },
  { id: 'blueberries',        name: 'Blueberries',            kcalPer100g: 57,  proteinPer100g: 0.7,carbsPer100g: 14, fatPer100g: 0.3, defaultServing: '100g', defaultServingG: 100, category: 'fruit' },
  { id: 'strawberries',       name: 'Strawberries',           kcalPer100g: 32,  proteinPer100g: 0.7,carbsPer100g: 7.7,fatPer100g: 0.3, defaultServing: '150g', defaultServingG: 150, category: 'fruit' },
  { id: 'mango',              name: 'Mango',                  kcalPer100g: 60,  proteinPer100g: 0.8,carbsPer100g: 15, fatPer100g: 0.4, defaultServing: '150g', defaultServingG: 150, category: 'fruit' },
  { id: 'grapes',             name: 'Grapes',                 kcalPer100g: 69,  proteinPer100g: 0.7,carbsPer100g: 18, fatPer100g: 0.2, defaultServing: '100g', defaultServingG: 100, category: 'fruit' },
  { id: 'avocado',            name: 'Avocado',                kcalPer100g: 160, proteinPer100g: 2,  carbsPer100g: 9,  fatPer100g: 15,  defaultServing: '½ avocado (100g)', defaultServingG: 100, category: 'fruit' },

  // ── Vegetables ────────────────────────────────────────────────────────────
  { id: 'broccoli',           name: 'Broccoli (steamed)',     kcalPer100g: 35,  proteinPer100g: 2.4,carbsPer100g: 7,  fatPer100g: 0.4, defaultServing: '150g', defaultServingG: 150, category: 'veg' },
  { id: 'spinach',            name: 'Spinach (raw)',          kcalPer100g: 23,  proteinPer100g: 2.9,carbsPer100g: 3.6,fatPer100g: 0.4, defaultServing: '100g', defaultServingG: 100, category: 'veg' },
  { id: 'carrots',            name: 'Carrots (raw)',          kcalPer100g: 41,  proteinPer100g: 0.9,carbsPer100g: 10, fatPer100g: 0.2, defaultServing: '100g', defaultServingG: 100, category: 'veg' },
  { id: 'bell-pepper',        name: 'Bell pepper (red)',      kcalPer100g: 31,  proteinPer100g: 1,  carbsPer100g: 6,  fatPer100g: 0.3, defaultServing: '1 medium (120g)', defaultServingG: 120, category: 'veg' },
  { id: 'cucumber',           name: 'Cucumber',               kcalPer100g: 16,  proteinPer100g: 0.7,carbsPer100g: 3.6,fatPer100g: 0.1, defaultServing: '100g', defaultServingG: 100, category: 'veg' },
  { id: 'tomato',             name: 'Tomato',                 kcalPer100g: 18,  proteinPer100g: 0.9,carbsPer100g: 3.9,fatPer100g: 0.2, defaultServing: '1 medium (120g)', defaultServingG: 120, category: 'veg' },
  { id: 'lettuce',            name: 'Lettuce (romaine)',      kcalPer100g: 17,  proteinPer100g: 1.2,carbsPer100g: 3.3,fatPer100g: 0.3, defaultServing: '100g', defaultServingG: 100, category: 'veg' },
  { id: 'onion',              name: 'Onion (raw)',            kcalPer100g: 40,  proteinPer100g: 1.1,carbsPer100g: 9.3,fatPer100g: 0.1, defaultServing: '50g', defaultServingG: 50, category: 'veg' },
  { id: 'mushrooms',          name: 'Mushrooms (raw)',        kcalPer100g: 22,  proteinPer100g: 3.1,carbsPer100g: 3.3,fatPer100g: 0.3, defaultServing: '100g', defaultServingG: 100, category: 'veg' },
  { id: 'kale',               name: 'Kale (raw)',             kcalPer100g: 49,  proteinPer100g: 4.3,carbsPer100g: 9,  fatPer100g: 0.9, defaultServing: '100g', defaultServingG: 100, category: 'veg' },
  { id: 'corn',               name: 'Sweet corn (cooked)',    kcalPer100g: 86,  proteinPer100g: 3.2,carbsPer100g: 19, fatPer100g: 1.2, defaultServing: '100g', defaultServingG: 100, category: 'veg' },

  // ── Fats ──────────────────────────────────────────────────────────────────
  { id: 'olive-oil',          name: 'Olive oil',              kcalPer100g: 884, proteinPer100g: 0,  carbsPer100g: 0,  fatPer100g: 100, defaultServing: '1 tbsp (13g)', defaultServingG: 13, category: 'fat' },
  { id: 'butter',             name: 'Butter',                 kcalPer100g: 717, proteinPer100g: 0.9,carbsPer100g: 0.1,fatPer100g: 81,  defaultServing: '1 tbsp (14g)', defaultServingG: 14, category: 'fat' },
  { id: 'peanut-butter',      name: 'Peanut butter',          kcalPer100g: 588, proteinPer100g: 25, carbsPer100g: 20, fatPer100g: 50,  defaultServing: '2 tbsp (32g)', defaultServingG: 32, category: 'fat' },
  { id: 'almonds',            name: 'Almonds',                kcalPer100g: 579, proteinPer100g: 21, carbsPer100g: 22, fatPer100g: 50,  defaultServing: '30g', defaultServingG: 30, category: 'fat' },
  { id: 'walnuts',            name: 'Walnuts',                kcalPer100g: 654, proteinPer100g: 15, carbsPer100g: 14, fatPer100g: 65,  defaultServing: '30g', defaultServingG: 30, category: 'fat' },
  { id: 'cashews',            name: 'Cashews',                kcalPer100g: 553, proteinPer100g: 18, carbsPer100g: 30, fatPer100g: 44,  defaultServing: '30g', defaultServingG: 30, category: 'fat' },
  { id: 'chia-seeds',         name: 'Chia seeds',             kcalPer100g: 486, proteinPer100g: 17, carbsPer100g: 42, fatPer100g: 31,  defaultServing: '2 tbsp (20g)', defaultServingG: 20, category: 'fat' },
  { id: 'sunflower-seeds',    name: 'Sunflower seeds',        kcalPer100g: 584, proteinPer100g: 21, carbsPer100g: 20, fatPer100g: 51,  defaultServing: '30g', defaultServingG: 30, category: 'fat' },
  { id: 'coconut-oil',        name: 'Coconut oil',            kcalPer100g: 862, proteinPer100g: 0,  carbsPer100g: 0,  fatPer100g: 100, defaultServing: '1 tbsp (13g)', defaultServingG: 13, category: 'fat' },

  // ── Drinks ────────────────────────────────────────────────────────────────
  { id: 'coffee-black',       name: 'Coffee (black)',         kcalPer100g: 2,   proteinPer100g: 0.3,carbsPer100g: 0,  fatPer100g: 0,   defaultServing: '240ml', defaultServingG: 240, category: 'drink' },
  { id: 'coffee-latte',       name: 'Latte (whole milk)',     kcalPer100g: 50,  proteinPer100g: 2.4,carbsPer100g: 5,  fatPer100g: 2,   defaultServing: '360ml', defaultServingG: 360, category: 'drink' },
  { id: 'orange-juice',       name: 'Orange juice',           kcalPer100g: 45,  proteinPer100g: 0.7,carbsPer100g: 10, fatPer100g: 0.2, defaultServing: '240ml', defaultServingG: 240, category: 'drink' },
  { id: 'water',              name: 'Water',                  kcalPer100g: 0,   proteinPer100g: 0,  carbsPer100g: 0,  fatPer100g: 0,   defaultServing: '500ml', defaultServingG: 500, category: 'drink' },
  { id: 'sports-drink',       name: 'Sports drink (Gatorade)',kcalPer100g: 26,  proteinPer100g: 0,  carbsPer100g: 7,  fatPer100g: 0,   defaultServing: '500ml', defaultServingG: 500, category: 'drink' },
  { id: 'protein-shake-ready',name: 'Protein shake (ready-to-drink)', kcalPer100g: 42, proteinPer100g: 6, carbsPer100g: 3, fatPer100g: 0.5, defaultServing: '330ml', defaultServingG: 330, category: 'drink' },

  // ── Other ─────────────────────────────────────────────────────────────────
  { id: 'protein-bar',        name: 'Protein bar',            kcalPer100g: 380, proteinPer100g: 30, carbsPer100g: 40, fatPer100g: 10,  defaultServing: '1 bar (65g)', defaultServingG: 65, category: 'other' },
  { id: 'dark-chocolate',     name: 'Dark chocolate (70%)',   kcalPer100g: 598, proteinPer100g: 8,  carbsPer100g: 46, fatPer100g: 43,  defaultServing: '30g', defaultServingG: 30, category: 'other' },
  { id: 'honey',              name: 'Honey',                  kcalPer100g: 304, proteinPer100g: 0.3,carbsPer100g: 82, fatPer100g: 0,   defaultServing: '1 tbsp (21g)', defaultServingG: 21, category: 'other' },
  { id: 'hummus',             name: 'Hummus',                 kcalPer100g: 177, proteinPer100g: 8,  carbsPer100g: 14, fatPer100g: 11,  defaultServing: '3 tbsp (60g)', defaultServingG: 60, category: 'other' },
  { id: 'pizza-margherita',   name: 'Pizza margherita',       kcalPer100g: 266, proteinPer100g: 11, carbsPer100g: 33, fatPer100g: 10,  defaultServing: '2 slices (200g)', defaultServingG: 200, category: 'other' },
  { id: 'burger',             name: 'Burger (beef + bun)',    kcalPer100g: 295, proteinPer100g: 17, carbsPer100g: 24, fatPer100g: 14,  defaultServing: '1 burger (200g)', defaultServingG: 200, category: 'other' },
  { id: 'caesar-salad',       name: 'Caesar salad (with dressing)', kcalPer100g: 110, proteinPer100g: 4, carbsPer100g: 7, fatPer100g: 8, defaultServing: '200g', defaultServingG: 200, category: 'other' },
  { id: 'sushi-roll',         name: 'Sushi roll (salmon)',    kcalPer100g: 143, proteinPer100g: 6,  carbsPer100g: 22, fatPer100g: 3,   defaultServing: '6 pieces (200g)', defaultServingG: 200, category: 'other' },
  { id: 'scrambled-eggs',     name: 'Scrambled eggs (2 eggs, butter)', kcalPer100g: 149, proteinPer100g: 10, carbsPer100g: 1.5, fatPer100g: 11, defaultServing: '150g', defaultServingG: 150, category: 'other' },
];
