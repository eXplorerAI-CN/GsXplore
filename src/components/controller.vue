<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import nipplejs from 'nipplejs'

const props = defineProps({
  noJoystick: {
    type: Boolean,
    default: false,
  },
  noMove: {
    type: Boolean,
    default: false,
  },
  controlType: {
    type: String,
    default: 'orbit',
  },
})

const emit = defineEmits(['update:controlType'])

let viewer, canvasElement, joystick
const controlType = ref(props.controlType)
let isInteracting = false
let lastTouchX = 0
let lastTouchY = 0
let hasMovedDuringInteraction = false
let isPointerLocked = false
const speed = ref(10)
const speedLevel = ref(6) // 默认在中间位置（2-10 范围的中间值）
let angleUpdateInterval = null // 用于角度更新的定时器
const isDragging = ref(false)

// 计算实际速度值
function calculateSpeed(level) {
  const baseSpeed = 10
  const factor = 2
  if (level === 6) return baseSpeed
  if (level > 6) {
    return baseSpeed * Math.pow(factor, level - 6)
  }
  return baseSpeed / Math.pow(factor, 6 - level)
}

// 监听 speedLevel 变化
watch(speedLevel, (newLevel) => {
  speed.value = calculateSpeed(newLevel)
})

// 用于跟踪按键状态
const keyState = {
  arrowup: false,
  w: false,
  arrowleft: false,
  a: false,
  arrowdown: false,
  s: false,
  arrowright: false,
  d: false,
  shift: false, // 添加 Shift 键状态
  r: false, // 上升
  f: false, // 下降
}

async function init(_viewer, _canvas) {
  viewer = _viewer
  canvasElement = _canvas
  if (controlType.value === 'orbit') {
    //viewer.scene_reactive.camera.mode = 'orbit'
    //await viewer.sync_scene()
    viewer.takeoverCameraControl()
    viewer.switch_camera_script('orbitCamera')
  }
  else {
    //viewer.scene_reactive.camera.mode = 'fly'
    //await viewer.sync_scene()
    viewer.takeoverCameraControl()
    viewer.switch_camera_script('flyCamera')
  }
  
  addEventListeners()
}

function addEventListeners() {
  canvasElement.addEventListener('touchstart', handleTouchStart, false)
  canvasElement.addEventListener('touchmove', handleTouchMove, false)
  canvasElement.addEventListener('touchend', handleInteractionEnd, false)
  canvasElement.addEventListener('mousedown', handleMouseDown, false)
  document.addEventListener('mousemove', handlePointerMove, false)
  document.addEventListener('mouseup', handleMouseUp, false)
  document.addEventListener('pointerlockchange', handlePointerLockChange, false)
  if (!props.noMove) {
    canvasElement.addEventListener('wheel', handleWheel, false)
    document.addEventListener('keydown', handleKeyDown, false)
    document.addEventListener('keyup', handleKeyUp, false)
  }
}

function removeEventListeners() {
  try {
    canvasElement.removeEventListener('touchstart', handleTouchStart)
    document.removeEventListener('touchmove', handleTouchMove, { passive: true })
    canvasElement.removeEventListener('touchend', handleInteractionEnd)
    canvasElement.removeEventListener('wheel', handleWheel)
    canvasElement.removeEventListener('mousedown', handleMouseDown)
    document.removeEventListener('mouseup', handleMouseUp)
    document.removeEventListener('pointerlockchange', handlePointerLockChange)
    document.removeEventListener('pointermove', handlePointerMove)
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('keyup', handleKeyUp)
  }
  catch (error) {
    console.log(error)
  }
}

let currentFactor = 1 // 初始 factor 值
const sensitivity = 0.001 // 滚动灵敏度，可以根据需要调整

function handleWheel(event) {
  // 阻止默认滚动行为
  event.preventDefault()

  // 计算新的 factor 值
  // deltaY 为负表示向上滚动（放大），为正表示向下滚动（缩小）
  let newFactor = currentFactor - event.deltaY * sensitivity

  // 确保 factor 不小于 0
  newFactor = Math.max(0, newFactor)

  // 更新当前 factor 值
  currentFactor = newFactor

  // 调用 viewer.setOrbitCameraDistance 函数
  if(controlType.value === 'orbit'){
    viewer.setOrbitCameraDistance(event.deltaY > 0 ? 1.02 : 0.98)
  }
  else{
    viewer.moveFlyCamera(0 , 0 , event.deltaY > 0 ? 10 : -10)
  }
}

function handleKeyDown(event) {
  if (event.repeat)
    return // 忽略按键重复事件
  const key = event.key.toLowerCase()
  if (key === 'shift') {
    keyState.shift = true
    handleShiftChange()
  }
  else if (Object.prototype.hasOwnProperty.call(keyState, key)) {
    keyState[key] = true
    
    // 检查是否为方向键，如果是则启动角度更新
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      startAngleUpdate()
    } else {
      updateMovement()
    }
  }
}

function handleKeyUp(event) {
  const key = event.key.toLowerCase()
  if (key === 'shift') {
    keyState.shift = false
    handleShiftChange()
  }
  else if (Object.prototype.hasOwnProperty.call(keyState, key)) {
    keyState[key] = false
    
    // 检查是否为方向键，如果是则可能需要停止角度更新
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      // 检查是否还有其他方向键在按下，如果没有则停止角度更新
      const hasArrowKeyPressed = keyState.arrowup || keyState.arrowdown || 
                                keyState.arrowleft || keyState.arrowright
      if (!hasArrowKeyPressed) {
        stopAngleUpdate()
      }
    } else {
      updateMovement()
    }
  }
}

function updateMovement() {
  // 处理其他移动键（WASD、RF）
  let x = 0
  let y = 0
  let z = 0
  if (keyState.w)
    z -= speed.value
  if (keyState.s)
    z += speed.value
  if (keyState.a)
    x -= speed.value
  if (keyState.d)
    x += speed.value
  if (keyState.r)
    y += speed.value
  if (keyState.f)
    y -= speed.value

  if(controlType.value === 'orbit'){
    viewer.setOrbitCameraPivotVelocity(x/50, y/50, -z/50)
  }
  else{
    console.log('执行移动', x, y, z)
    viewer.setFlyCameraVelocity(x, y, z)
  }
}

function startAngleUpdate() {
  if (angleUpdateInterval) return // 如果已经在运行，不重复启动
  
  angleUpdateInterval = setInterval(() => {
    let angleX = 0
    let angleY = 0
    
    if (keyState.arrowup)
      angleY -= 2 // 向上看
    if (keyState.arrowdown)
      angleY += 2 // 向下看
    if (keyState.arrowleft)
      angleX -= 2 // 向左转
    if (keyState.arrowright)
      angleX += 2 // 向右转
    
    // 如果有方向键按下，调用 updateCameraAngle
    if (angleX !== 0 || angleY !== 0) {
      updateCameraAngle(angleX, angleY)
    } else {
      // 如果没有方向键按下，停止定时器
      stopAngleUpdate()
    }
  }, 16) // 约60fps的更新频率
}

function stopAngleUpdate() {
  if (angleUpdateInterval) {
    clearInterval(angleUpdateInterval)
    angleUpdateInterval = null
  }
}

function handleShiftChange() {
  // 在这里处理 Shift 键状态变化
  speed.value = keyState.shift ? 40 : 20
  // 例如，可以在这里改变移动速度
  updateMovement()
}

function initJoystick() {
  joystick = nipplejs.create({
    zone: document.getElementById('joystickContainer'),
    fadeTime: 0,
    mode: 'static',
    position: { left: '50%', bottom: '50%' },
    size: 150,
  })

  joystick.on('move', handleJoystickMove)
  joystick.on('end', handleJoystickEnd)
}

function handleJoystickMove(evt, data) {
  const maxSpeed = speed.value // 最大速度
  const deadzone = 0.1 // 死区，防止微小移动

  // 计算速度向量
  let speedX = 0
  let speedZ = 0

  if (data.force > deadzone) {
    // 将角度转换为弧度
    const radians = data.angle.radian

    const excuteForce = Math.min(data.force, 2)
    // 计算 X 和 Z 方向的速度
    // 注意：这里我们直接使用 cos 和 sin，不需要额外的角度调整
    speedX = Math.cos(radians) * excuteForce * maxSpeed
    speedZ = Math.sin(radians) * excuteForce * maxSpeed
  }

  // 应用速度到相机
  viewer.setFlyCameraVelocity(speedX, 0, -speedZ)
}

function handleJoystickEnd() {
  viewer.setFlyCameraVelocity(0, 0, 0)
}

let initialZoomDistance = 0
let lastZoomDistance = 0
let isZooming = false

function getZoomDistance(touch1, touch2) {
  const dx = touch1.clientX - touch2.clientX
  const dy = touch1.clientY - touch2.clientY
  return Math.sqrt(dx * dx + dy * dy)
}

function handleTouchStart(event) {
  for (const item of event.touches) {
    if (item.target.id === 'canvas') {
      const touch = item
      lastTouchX = touch.clientX
      lastTouchY = touch.clientY
      isInteracting = true
      hasMovedDuringInteraction = false
    }
  }

  // 双指缩放
  if (controlType.value === 'orbit' && event.touches.length === 2) {
    isZooming = true
    initialZoomDistance = getZoomDistance(event.touches[0], event.touches[1])
    lastZoomDistance = initialZoomDistance
  }
}

function handleTouchMove(event) {
  if (isZooming && event.touches.length === 2) {
    event.preventDefault() // 阻止默认的缩放行为

    const currentDistance = getZoomDistance(event.touches[0], event.touches[1])
    const delta = currentDistance - lastZoomDistance

    // 模拟 deltaY，放大时为负，缩小时为正
    const simulatedDeltaY = -delta

    // 计算新的 factor 值
    let newFactor = currentFactor - simulatedDeltaY * sensitivity

    // 确保 factor 不小于 0
    newFactor = Math.max(0, newFactor)

    // 更新当前 factor 值
    currentFactor = newFactor

    // 调用 viewer.setOrbitCameraDistance 函数
    viewer.setOrbitCameraDistance(delta < 0 ? 1.01 : 0.99)

    lastZoomDistance = currentDistance
  }
  else {
    if (!isInteracting)
      return
    for (const item of event.touches) {
      if (item.target.id === 'canvas') {
        const touch = item
        const movementX = touch.clientX - lastTouchX
        const movementY = touch.clientY - lastTouchY
        lastTouchX = touch.clientX
        lastTouchY = touch.clientY
        updateCameraAngle(movementX, movementY)
        hasMovedDuringInteraction = true
        event.preventDefault()
      }
    }
  }
}

let mouseDownButtonIndex = 0
function handleMouseDown(event) {
  if (event.button !== 0 && event.button !== 2)
    return
  mouseDownButtonIndex = event.button
  isInteracting = true
  hasMovedDuringInteraction = false
  if (controlType.value === 'fly')
    canvasElement.requestPointerLock()
}

function handleMouseUp(event) {
  if (event.button !== 0 && event.button !== 2)
    return
  handleInteractionEnd()
}

function handlePointerLockChange() {
  isPointerLocked = document.pointerLockElement === canvasElement
  if (isPointerLocked) {
    document.addEventListener('pointermove', handlePointerMove, false)
  }
  else {
    document.removeEventListener('pointermove', handlePointerMove, false)
    if (isInteracting) {
      handleInteractionEnd()
    }
  }
}

function handlePointerMove(event) {
  if (!isInteracting)
    return
  const movementX = event.movementX || event.mozMovementX || 0
  const movementY = event.movementY || event.mozMovementY || 0
  if (Math.abs(movementX) > 0 || Math.abs(movementY) > 0) {
    /* if (controlType.value === 'fly') {
      canvasElement.requestPointerLock()
    } */
    if (mouseDownButtonIndex === 0) {
      updateCameraAngle(movementX, movementY)
      hasMovedDuringInteraction = true
    }
    else if (mouseDownButtonIndex === 2) {
      if(controlType.value === 'orbit'){
        // 鼠标平移（对应键盘平移是setOrbitCameraPivotVelocity方法）
        viewer.moveOrbitCameraPivot(-movementX / 50, movementY / 50, 0)
      }
      else{
        viewer.moveFlyCamera(-movementX , movementY , 0)
      }
      hasMovedDuringInteraction = true
    }
  }
}

function handleInteractionEnd(_event) {
  if (isInteracting && !hasMovedDuringInteraction) {
    console.log('Clicked or tapped without moving')
  }
  isInteracting = false
  if (isPointerLocked) {
    document.exitPointerLock()
  }
  // 双指缩放停止
  isZooming = false
  // 停止orbit平移
  viewer.setOrbitCameraPivotVelocity(0, 0, 0)
}

function updateCameraAngle(movementX, movementY) {
  if (controlType.value === 'orbit') {
    viewer.rotateOrbitCamera(-movementX / 5, -movementY / 5, 0)
  }
  else {
    viewer.setFlyCameraEulerAngles(movementX / 5, -movementY / 5, 0)
  }
}

async function toggleControlMode() {
  const newMode = controlType.value === 'orbit' ? 'fly' : 'orbit'
  controlType.value = newMode
  emit('update:controlType', newMode)
  if (newMode === 'orbit') {
    viewer.takeoverCameraControl()
    viewer.switch_camera_script('orbitCamera')
  }
  else {
    viewer.takeoverCameraControl()
    viewer.switch_camera_script('flyCamera')
  }
}

function resetCamera() {
  viewer.camera.setPosition(0,3,5)
  viewer.camera.setEulerAngles(-30,0,0)
  viewer.camera.script.orbitCamera.resetAndLookAtPoint(new pc.Vec3(0,3,5),new pc.Vec3(0,0,0))
  viewer.camera.script.flyCamera.setEulerAngles(new pc.Vec3(-30,0,0)) 
}

onMounted(() => {
  if (!props.noJoystick) {
    initJoystick()
  }
})

onUnmounted(() => {
  removeEventListeners()
  stopAngleUpdate() // 清理角度更新定时器
  if (joystick) {
    joystick.destroy()
  }
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
})

const joystickShow = ref(true)
function toggleJoystick(show) {
  joystickShow.value = show
}

// 控制说明提示的显示状态
const showControlTips = ref(false)
function toggleControlTips() {
  showControlTips.value = !showControlTips.value
}

// 处理拖拽
function startDrag(event) {
  isDragging.value = true
  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
  handleDrag(event)
}

function handleDrag(event) {
  if (!isDragging.value) return
  
  const slider = document.querySelector('.slider-container')
  if (!slider) return
  
  const rect = slider.getBoundingClientRect()
  // 限制鼠标位置在滑块范围内
  const mouseY = Math.max(rect.top, Math.min(event.clientY, rect.bottom))
  const percentage = 1 - (mouseY - rect.top) / rect.height
  const level = Math.max(2, Math.min(10, Math.round(percentage * 8) + 2)) // 修改范围为 2-10
  speedLevel.value = level
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
}

defineExpose({
  init,
  toggleJoystick,
})
</script>

<template>
  <div  class="main-content">
    <div v-if="!props.noJoystick" class="joystick-wrapper pointer-events-none">
      <div class="no-select pointer-events-auto">
        <div
          v-show="joystickShow"
          id="joystickContainer"
          class="joystick-container"
          :class="deviceClass"
          @contextmenu.prevent
        />
      </div>
    </div>
    <!-- 控制说明按钮 -->
    <div v-if="false" class="control-tips-button pointer-events-auto" @click="toggleControlTips">
      <div class="tips-icon">
        <div class="i-ri-question-line text-xl"></div>
      </div>
    </div>
    
    <!-- 控制说明提示区域 -->
    <div v-if="showControlTips" class="control-tips-panel pointer-events-auto">
      <div class="tips-content">
        <div class="tip-item">
          <span class="tip-key">Left Mouse</span>
          <span class="tip-action">- Rotate</span>
        </div>
        <div class="tip-item">
          <span class="tip-key">Right Mouse</span>
          <span class="tip-action">- Pan</span>
        </div>
        <div class="tip-item">
          <span class="tip-key">Mouse Wheel</span>
          <span class="tip-action">- Zoom</span>
        </div>
        <div class="tip-item">
          <span class="tip-key">W/A/S/D</span>
          <span class="tip-action">- Move</span>
        </div>
        <div class="tip-item">
          <span class="tip-key">R/F</span>
          <span class="tip-action">- Move Up/Down</span>
        </div>
        <div class="tip-item">
          <span class="tip-key">↑/←/↓/→</span>
          <span class="tip-action">- Rotate</span>
        </div>
      </div>
    </div>

    <!-- 重置按钮 -->
    <div class="reset-button pointer-events-auto group" @click="resetCamera">
      <div class="reset-icon">
        <div class="i-ri-restart-line text-xl"></div>
      </div>
      <div class="reset-tip opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute right-full mr-2 whitespace-nowrap bg-black/60 backdrop-blur-sm text-white text-sm px-2 py-1 rounded top-1/2 -translate-y-1/2">
        Reset Camera
      </div>
    </div>

    <!-- 速度滑动条 -->
    <div class="speed-slider pointer-events-auto">
      <div class="slider-container">
        <div class="slider-track">
          <div class="slider-progress" :style="{ height: `${(speedLevel - 1) * 10}%` }"></div>
          <div 
            class="slider-handle"
            :style="{ bottom: `calc(${Math.min((speedLevel - 1) * 10, 100)}% - 12px)`, transform: 'translateX(-50%)' }"
            @mousedown="startDrag"
          >
            <div class="i-mdi-run-fast text-sm"></div>
          </div>
        </div>
        <div class="slider-tip">
          Speed Setting <!-- {{ speedLevel }} {{ speed }} -->
        </div>
      </div>
    </div>

    <div class="control-mode-toggle pointer-events-auto" @click="toggleControlMode">
      <div class="toggle-icon" :class="{ 'orbit-mode': controlType === 'orbit' }">
        <div v-if="controlType === 'orbit'" class="i-mdi-rotate-orbit text-xl"></div>
        <div v-else class="i-eos-drone text-xl"></div>
      </div>
      <!-- <div class="mode-label">{{ controlType === 'orbit' ? 'orbit' : 'fly' }}</div> -->
    </div>
  </div>
</template>

<style lang="scss" scoped>
.main-content {
  width: 100vw;
  height: 100vh;
}

.joystick-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: end;
  justify-content: space-between;
}

.joystick-container {
  position: fixed;
  bottom: 50px;
  left: 50px;
  width: 100px;
  height: 100px;

  .back {
    background-color: red !important;
  }

  &.is-mobile.is-portrait {
    left: 50%;
    transform: translateX(-50%);
    bottom: 90px;
  }
  &.is-mobile.is-landscape {
    bottom: 25px;
    left: 25px;
  }
}

.no-select {
  -webkit-user-select: none; /* Chrome, Safari, Opera */
  -moz-user-select: none; /* Firefox */
  -ms-user-select: none; /* Internet Explorer/Edge */
  user-select: none; /* Non-prefixed version, currently supported by Chrome, Edge, Opera and Firefox */
}

.pointer-events-none {
  pointer-events: none;
}

.pointer-events-auto {
  pointer-events: auto;
}

.control-tips-button {
  position: fixed;
  right: 20px;
  top: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  z-index: 1000;
  pointer-events: auto;

  .tips-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    color: #fff;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    &:active {
      transform: scale(0.95);
    }
  }
}

.control-tips-panel {
  position: fixed;
  right: 75px;
  top: 25px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 16px;
  min-width: 180px;
  z-index: 999;
  color: #fff;
  font-size: 14px;
  animation: fadeInRight 0.3s ease;

  .tips-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .tip-item {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    
    .tip-key {
      font-weight: 600;
      color: #1b1b1c;
      /* min-width: 80px; */
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    }
    
    .tip-action {
      color: #1b1b1c;
    }
  }
}

@keyframes fadeInRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.reset-button {
  position: fixed;
  right: 20px;
  bottom: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  z-index: 1000;
  pointer-events: auto;

  .reset-icon {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    color: #fff;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    &:active {
      transform: scale(0.95);
    }
  }
}

.speed-slider {
  position: fixed;
  right: 20px;
  bottom: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  z-index: 1000;
  pointer-events: auto;

  .slider-container {
    width: 40px;
    height: 200px;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: 20px;
    position: relative;
    padding: 5px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;

    &:hover .slider-tip {
      opacity: 1;
    }

    .slider-track {
      width: 100%;
      height: 100%;
      position: relative;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      overflow: hidden;

      .slider-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        background: rgba(255, 255, 255, 0.3);
        transition: height 0.1s ease;
      }

      .slider-handle {
        position: absolute;
        left: 50%;
        width: 24px;
        height: 24px;
        background: rgba(255, 255, 255, 0.9);
        border-radius: 50%;
        cursor: grab;
        transition: all 0.2s ease;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(0, 0, 0, 0.6);

        &:hover {
          background: #fff;
          transform: translateX(-50%) scale(1.1) !important;
          color: rgba(0, 0, 0, 0.8);
        }

        &:active {
          cursor: grabbing;
          transform: translateX(-50%) scale(0.95) !important;
        }
      }
    }

    .slider-tip {
      position: absolute;
      right: 100%;
      top: 50%;
      transform: translateY(-50%);
      margin-right: 10px;
      white-space: nowrap;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(10px);
      color: #fff;
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
  }
}

.control-mode-toggle {
  position: fixed;
  right: 20px;
  bottom: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  z-index: 1000;
  pointer-events: auto;

  .toggle-icon {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    color: #fff;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    &:active {
      transform: scale(0.95);
    }

    svg {
      width: 24px;
      height: 24px;
    }
  }

  .mode-label {
    font-size: 12px;
    color: #fff;
    opacity: 0.8;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }
}
</style>

<style>
.joystick-container {
  .nipple {
    opacity: 1 !important;
  }
  .back {
    /* background: url('@/assets/images/joy-back@3x.png') center/cover no-repeat !important; */
    opacity: 1 !important;
  }
  .front {
    background-color: rgba(180,142,100, 0.75) !important;
  }
}
</style>
