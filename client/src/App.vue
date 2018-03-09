<template>
  <div id="app">
    <app-header v-if="!['Login', 'Register'].includes($route.name)"></app-header>
    <div class="container">
      <router-view/>
    </div>
  </div>
</template>

<script>
import header from './components/Header'
export default {
  name: 'app',
  components: {
    'app-header': header
  }
}
</script>

<style>

</style>
