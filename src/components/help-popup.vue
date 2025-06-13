<script setup>
defineProps({
  show: {
    type: Boolean,
    default: false
  }
})
</script>

<template>
  <transition name="fade">
    <div v-if="show" class="help-popup">
      <div class="help-content">
        <div>Left Mouse - Rotate</div>
        <div>Right Mouse - Pan</div>
        <div>Mouse Wheel - Zoom</div>
        <div>W/A/S/D - Move</div>
        <div>R/F - Move Up/Down</div>
        <div>↑/←/↓/→ - Rotate</div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.help-popup {
  position: absolute;
  left: 100%;
  top: 0;
  margin-left: 24px;
  background: rgba(255,255,255,0.95);
  border-radius: 18px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 1.5px 6px rgba(0,0,0,0.06);
  padding: 16px;
  z-index: 9999;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: 'SF Pro Display', 'SF Pro Icons', 'Helvetica Neue', Arial, sans-serif;
  font-size: 15px;
  color: #222;
  animation: fadeIn 0.2s cubic-bezier(0.4,0,0.2,1);
}

.help-content > div {
  margin: 8px 0;
  letter-spacing: 0.5px;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style> 