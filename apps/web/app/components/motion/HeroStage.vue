<script setup lang="ts">
import { usePreferredReducedMotion } from '@vueuse/core';

const root = useTemplateRef<HTMLElement>('root');
const preferredMotion = usePreferredReducedMotion();
let cleanup: (() => void) | undefined;

onMounted(async () => {
  if (!root.value || preferredMotion.value === 'reduce') return;
  const { gsap } = await import('gsap');
  const context = gsap.context(() => {
    gsap
      .timeline({ defaults: { ease: 'power3.out' } })
      .from('[data-stage-grid]', { opacity: 0, scale: 0.96, duration: 0.8 })
      .from('[data-stage-window]', { opacity: 0, y: 32, scale: 0.94, duration: 0.9 }, '-=0.55')
      .from('[data-stage-item]', { opacity: 0, y: 12, stagger: 0.08, duration: 0.55 }, '-=0.5');
    gsap.to('[data-stage-orbit]', {
      rotation: 360,
      duration: 24,
      ease: 'none',
      repeat: -1,
      transformOrigin: 'center',
    });
  }, root.value);
  cleanup = () => context.revert();
});

onBeforeUnmount(() => cleanup?.());
</script>

<template>
  <div ref="root" class="hero-stage" aria-hidden="true">
    <div data-stage-grid class="stage-grid" />
    <div data-stage-orbit class="stage-orbit"><i /><i /><i /></div>
    <div data-stage-window class="stage-window">
      <div class="stage-toolbar"><span /><span /><span /><b>product.app</b></div>
      <div class="stage-body">
        <aside><i data-stage-item /><i data-stage-item /><i data-stage-item /></aside>
        <div class="stage-content">
          <small data-stage-item>OVERVIEW</small>
          <strong data-stage-item>清晰，从第一屏开始。</strong>
          <div data-stage-item class="stage-metric"><b>99.9%</b><span>可用性基线</span></div>
          <div data-stage-item class="stage-lines"><i /><i /><i /></div>
        </div>
      </div>
    </div>
  </div>
</template>
