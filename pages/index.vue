<template>
  <main class="container">
    <h1>Traffic Light — Create Game</h1>
    <label class="row">
      <input type="checkbox" v-model="adult" />
      <span>I'm 18+</span>
    </label>

    <textarea v-model="raw" rows="8" placeholder="Enter questions, one per line"></textarea>
    <div class="row">
      <button :disabled="!canCreate" @click="create">Create Game</button>
    </div>

    <p v-if="link" class="row">
      <span>Link for the second player: <NuxtLink :to="link">{{ link }}</NuxtLink></span>
      <button @click="copy">Copy</button>
    </p>
  </main>
</template>

<script setup lang="ts">
const adult = ref(false)
const raw = ref('')
const link = ref<string| null>(null)

const canCreate = computed(() => adult.value && raw.value.trim().length > 0)

async function create() {
  const questions = raw.value
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
  if (questions.length < 1) return
  const config = useRuntimeConfig()
  const base = (config.public as any).apiBase || 'http://localhost:4000'
  const res = await $fetch<{ gameId: string }>(`${base}/game`, {
    method: 'POST',
    body: { questions },
  })
  link.value = `/game/${res.gameId}`
  await navigateTo(link.value)
}

async function copy() {
  if (!link.value) return
  await navigator.clipboard.writeText(new URL(link.value, location.origin).toString())
}
</script>

<style scoped>
.container { max-width: 720px; margin: 2rem auto; display: grid; gap: 1rem; }
.row { display: flex; align-items: center; gap: .5rem; }
textarea { width: 100%; }
button { padding: .5rem 1rem; }
</style>
