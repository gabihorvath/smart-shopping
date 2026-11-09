import { ref } from 'vue'

export type CatalogTab = 'items' | 'units' | 'aisles'

/** Selected catalog tab; module-level so it survives leaving and re-entering the catalog. */
export const catalogTab = ref<CatalogTab>('items')
