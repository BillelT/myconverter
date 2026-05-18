<script setup>
import { computed } from "vue";
import { CATEGORY_LABELS } from "../converters/registry.js";

const props = defineProps({
  item: { type: Object, required: true },
});
const emit = defineEmits(["change-target", "remove", "download"]);

const it = computed(() => props.item);

const pct = computed(() =>
  it.value.progress != null ? Math.round(it.value.progress * 100) : null,
);

const isMedia = computed(
  () => it.value.category === "audio" || it.value.category === "video",
);

const runningLabel = computed(() => {
  if (pct.value != null) return `Conversion ${pct.value}%`;
  // Média + pas encore de % = le coeur ffmpeg (~30 Mo) se télécharge
  // et s'initialise. C'est la phase qui semble "infinie" la 1re fois.
  if (isMedia.value)
    return "Préparation du moteur ffmpeg (~30 Mo, 1re fois)…";
  return "Conversion…";
});
</script>

<template>
  <div class="file-row">
    <div class="file-row__thumb">
      <img v-if="it.thumbUrl" :src="it.thumbUrl" alt="" />
      <span v-else class="caption">{{ it.ext.toUpperCase() }}</span>
    </div>

    <div class="file-row__main">
      <span class="file-row__name" :title="it.name">{{ it.name }}</span>

      <div class="file-row__meta">
        <span class="pill">{{ CATEGORY_LABELS[it.category] }}</span>

        <span v-if="it.targets.length" class="file-row__convert">
          <span class="caption">{{ it.ext }}</span>
          <span class="file-row__arrow" aria-hidden="true">→</span>
          <select
            class="select format-select"
            :value="it.to"
            :disabled="it.status === 'running'"
            @change="emit('change-target', it.id, $event.target.value)"
          >
            <option
              v-for="t in it.targets"
              :key="t.to"
              :value="t.to"
            >
              {{ t.label }}{{ t.heavy ? " ·" : "" }}
            </option>
          </select>
        </span>
        <span v-else class="caption">Format non pris en charge</span>
      </div>

      <div v-if="it.status !== 'idle'" class="file-row__meta">
        <span v-if="it.status === 'running'" class="status">
          <span class="spinner" aria-hidden="true"></span>
          {{ runningLabel }}
        </span>
        <span v-else-if="it.status === 'done'" class="status status--done">
          ✓ {{ it.result.filename }}
        </span>
        <span
          v-else-if="it.status === 'error'"
          class="status status--error"
          :title="it.error"
        >
          Échec — {{ it.error }}
        </span>
      </div>
    </div>

    <div class="file-row__actions">
      <button
        v-if="it.status === 'done'"
        class="btn btn-secondary btn--sm"
        @click="emit('download', it.id)"
      >
        Télécharger
      </button>
      <button
        class="btn-link"
        :disabled="it.status === 'running'"
        @click="emit('remove', it.id)"
      >
        Retirer
      </button>
    </div>
  </div>
</template>
