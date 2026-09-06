<script setup lang="ts">
import { project } from '../generated/project';
</script>

<template>
  <footer class="site-footer">
    <div class="footer-inner">
      <AppLogo />
      <p>{{ project.description }}</p>
      <p class="copyright">© {{ new Date().getFullYear() }} {{ project.displayName }}</p>
    </div>
  </footer>
</template>
