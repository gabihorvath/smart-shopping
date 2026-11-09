import type { Aisle, CatalogItem, Id, Shop, Unit } from './types'

const UNIT_STEPS: [string, number][] = [
  ['Stk', 1],
  ['g', 100],
  ['kg', 0.5],
  ['ml', 100],
  ['l', 0.5],
  ['Pkg', 1],
  ['Dose', 1],
  ['Glas', 1],
  ['Flasche', 1],
  ['Bund', 1],
  ['Beutel', 1],
]

const SEED_AISLES: [string, [string, string][]][] = [
  [
    'Obst & Gemüse',
    [
      ['Äpfel', 'kg'],
      ['Bananen', 'kg'],
      ['Zitronen', 'Stk'],
      ['Tomaten', 'kg'],
      ['Gurke', 'Stk'],
      ['Paprika', 'Stk'],
      ['Zwiebeln', 'kg'],
      ['Kartoffeln', 'kg'],
      ['Karotten', 'kg'],
      ['Salat', 'Stk'],
      ['Knoblauch', 'Stk'],
    ],
  ],
  [
    'Brot & Backwaren',
    [
      ['Brot', 'Stk'],
      ['Brötchen', 'Stk'],
      ['Toast', 'Pkg'],
    ],
  ],
  [
    'Milchprodukte & Eier',
    [
      ['Milch', 'l'],
      ['Butter', 'Stk'],
      ['Joghurt', 'g'],
      ['Käse', 'g'],
      ['Eier', 'Pkg'],
      ['Sahne', 'ml'],
      ['Quark', 'g'],
    ],
  ],
  [
    'Fleisch & Fisch',
    [
      ['Hähnchenbrust', 'g'],
      ['Hackfleisch', 'g'],
      ['Wurst', 'g'],
      ['Schinken', 'g'],
      ['Lachs', 'g'],
    ],
  ],
  [
    'Tiefkühl',
    [
      ['Tiefkühlgemüse', 'Pkg'],
      ['Pizza', 'Stk'],
      ['Eis', 'Pkg'],
    ],
  ],
  [
    'Nudeln, Reis & Konserven',
    [
      ['Nudeln', 'g'],
      ['Reis', 'g'],
      ['Tomaten passiert', 'Dose'],
      ['Mais', 'Dose'],
      ['Bohnen', 'Dose'],
      ['Mehl', 'kg'],
      ['Zucker', 'kg'],
    ],
  ],
  [
    'Frühstück & Aufstrich',
    [
      ['Müsli', 'Pkg'],
      ['Marmelade', 'Glas'],
      ['Honig', 'Glas'],
      ['Nutella', 'Glas'],
    ],
  ],
  [
    'Gewürze & Öle',
    [
      ['Salz', 'Pkg'],
      ['Pfeffer', 'Stk'],
      ['Olivenöl', 'Flasche'],
      ['Essig', 'Flasche'],
    ],
  ],
  [
    'Snacks & Süßes',
    [
      ['Schokolade', 'Stk'],
      ['Chips', 'Beutel'],
      ['Kekse', 'Pkg'],
    ],
  ],
  [
    'Getränke',
    [
      ['Wasser', 'Flasche'],
      ['Saft', 'l'],
      ['Bier', 'Flasche'],
      ['Kaffee', 'Pkg'],
      ['Tee', 'Pkg'],
    ],
  ],
  [
    'Drogerie & Haushalt',
    [
      ['Toilettenpapier', 'Pkg'],
      ['Küchenrolle', 'Pkg'],
      ['Spülmittel', 'Flasche'],
      ['Zahnpasta', 'Stk'],
      ['Duschgel', 'Flasche'],
      ['Müllbeutel', 'Pkg'],
    ],
  ],
]

export interface SeedData {
  units: Unit[]
  aisles: Aisle[]
  items: CatalogItem[]
  shop: Shop
}

export function buildSeed(newId: () => Id = () => crypto.randomUUID()): SeedData {
  const units: Unit[] = UNIT_STEPS.map(([name, step]) => ({ id: newId(), name, step }))
  const unitByName = new Map(units.map((u) => [u.name, u]))
  const aisles: Aisle[] = []
  const items: CatalogItem[] = []
  SEED_AISLES.forEach(([name, list], i) => {
    const aisle: Aisle = { id: newId(), name, sortKey: i + 1 }
    aisles.push(aisle)
    for (const [itemName, unitName] of list) {
      const unit = unitByName.get(unitName)
      if (!unit) throw new Error(`Unknown seed unit ${unitName}`)
      items.push({ id: newId(), name: itemName, unitId: unit.id, aisleId: aisle.id })
    }
  })
  const shop: Shop = { id: newId(), name: 'Standard', aisleIds: aisles.map((a) => a.id) }
  return { units, aisles, items, shop }
}
