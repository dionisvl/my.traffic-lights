<template>
  <main class="container">
    <h1>Traffic Lights — Create Game</h1>
    <label class="row">
      <input type="checkbox" v-model="adult" />
      <span>I'm 18+</span>
    </label>

    <textarea v-model="raw" rows="8" placeholder="Enter questions, one per line"></textarea>

    <div v-if="files.length" class="server-files">
      <span class="muted">Or pick from server files:</span>
      <div class="row wrap">
        <button v-for="f in files" :key="f.name" class="secondary" @click="loadFile(f.name)">{{ f.name }}</button>
      </div>
    </div>

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
const files = ref<{ name: string }[]>([])

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

onMounted(async () => {
  await fetchFiles()
})

async function fetchFiles() {
  try {
    const config = useRuntimeConfig()
    const base = (config.public as any).apiBase || 'http://localhost:4000'
    const res = await $fetch<{ files: { name: string }[] }>(`${base}/questions`)
    files.value = res.files || []
  } catch {
    files.value = []
  }
}

async function loadFile(name: string) {
  try {
    const config = useRuntimeConfig()
    const base = (config.public as any).apiBase || 'http://localhost:4000'
    const res = await $fetch<{ content: string }>(`${base}/questions/${encodeURIComponent(name)}`)
    raw.value = res.content || ''
  } catch (e) {
    alert('Failed to load file')
  }
}
</script>

<style scoped>
.container {
  max-width: 720px;
  margin: 2rem auto;
  display: grid;
  gap: 1.5rem; /* Increased gap for better spacing */
  padding: 2rem; /* Add some padding */
  background-color: #f9f9f9; /* Light background */
  border-radius: 12px; /* Rounded corners */
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); /* Subtle shadow */
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; /* Modern font */
  color: #333; /* Darker text for readability */
}

h1 {
  text-align: center;
  color: #2c3e50; /* Darker heading color */
  font-size: 2.2em;
}

.row {
  display: flex;
  align-items: center;
  gap: .75rem; /* Slightly increased gap */
}

.wrap { flex-wrap: wrap; }

textarea {
  width: 100%;
  padding: 0.8rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 1em;
  min-height: 120px;
  resize: vertical;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.06);
  transition: border-color 0.3s ease;
}

textarea:focus {
  border-color: #007bff; /* Highlight on focus */
  outline: none;
}

button {
  padding: 0.8rem 1.5rem;
  border: none;
  border-radius: 8px;
  background-color: #007bff; /* Primary button color */
  color: white;
  font-size: 1.1em;
  cursor: pointer;
  transition: background-color 0.3s ease, transform 0.1s ease;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.secondary {
  background: #e9ecef;
  color: #333;
}

.server-files {
  display: grid;
  gap: .5rem;
}

.muted { color: #666; font-size: .9em; }

button:hover {
  background-color: #0056b3; /* Darker on hover */
  transform: translateY(-1px); /* Slight lift */
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

input[type="checkbox"] {
  width: 1.2em;
  height: 1.2em;
  accent-color: #007bff; /* Checkbox color */
}

p.row {
  background-color: #e9ecef;
  padding: 0.8rem 1.2rem;
  border-radius: 8px;
  word-break: break-all; /* Ensure long links wrap */
  font-size: 0.95em;
  color: #555;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
}

p.row span {
  flex-grow: 1;
}

.row NuxtLink {
  color: #007bff;
  text-decoration: none;
  font-weight: bold;
}

.row NuxtLink:hover {
  text-decoration: underline;
}
</style>
