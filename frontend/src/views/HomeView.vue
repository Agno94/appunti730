<script setup>
</script>

<template>
  <main>
    <h2>App Appunti 730</h2>
    <hr/>
    <section class="columns">
      <section class="column is-narrow">
        <RouterLink to="/submit">
          <button class="button is-outlined is-link">
            Aggiungi nuova voce
          </button>
        </RouterLink>
      </section>
      <section class="column is-narrow">
        <RouterLink to="/list">
          <button class="button is-outlined is-link">
            Vedi elenco voci
          </button>
        </RouterLink>
      </section>
    </section>
  </main>
</template>
