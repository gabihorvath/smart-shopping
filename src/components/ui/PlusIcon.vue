<script setup lang="ts">
/** Geometrically centered + / − (text glyphs sit off-center due to font metrics). */
defineProps<{ minus?: boolean }>()
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    aria-hidden="true"
    class="size-[1em]"
  >
    <path d="M5 12h14" />
    <path v-if="!minus" d="M12 5v14" />
  </svg>
</template>
