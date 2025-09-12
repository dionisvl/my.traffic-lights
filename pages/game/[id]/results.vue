<template>
  <main class="container" v-if="data">
    <h1>Результаты</h1>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Вопрос</th>
          <th>P1 Ответ</th>
          <th>P1 Коммент</th>
          <th>P2 Ответ</th>
          <th>P2 Коммент</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(a,i) in data.answers" :key="i">
          <td>{{ a.questionIndex + 1 }}</td>
          <td>{{ a.questionText }}</td>
          <td>{{ a.player1.answer || '—' }}</td>
          <td>{{ a.player1.comment || '—' }}</td>
          <td>{{ a.player2.answer || '—' }}</td>
          <td>{{ a.player2.comment || '—' }}</td>
        </tr>
      </tbody>
    </table>
  </main>
  <main v-else class="container">Загрузка…</main>
  
</template>

<script setup lang="ts">
const route = useRoute()
const gameId = route.params.id as string
const config = useRuntimeConfig()
const base = (config.public as any).apiBase || 'http://localhost:4000'
const { data } = await useFetch(`${base}/game/${gameId}`)
</script>

<style scoped>
.container { max-width: 960px; margin: 2rem auto; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #ddd; padding: .5rem; vertical-align: top; }
</style>
