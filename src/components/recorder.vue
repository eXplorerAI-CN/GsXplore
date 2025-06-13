<script setup>
import { ref, nextTick } from 'vue'

// Props定义
const props = defineProps({
    show: {
        type: Boolean,
        default: true
    }
})

let viewer = null
const cameraList = ref([])
const selectedCameraIndex = ref(-1)
const isLooping = ref(false)
const isPlaying = ref(false)
const isRecording = ref(false)
const isCollapsed = ref(false)
const cameraListContainer = ref(null)

const init = (_viewer) => {
    viewer = _viewer
    viewer.events.on('routeFly:cameraMarkSelected', (event) => {
        selectedCameraIndex.value = Number(event.cameraMarkIndex)
        // 滚动到选中的机位
        scrollToSelectedCamera()
    })
}

const handleAddCamera = () => {
    viewer.routeFly.add_current_camera()
    cameraList.value.push({
        id: Date.now(),
        index: cameraList.value.length + 1,
        duration: 1
    })
    console.log('routers',viewer.routeFly.camera_marks)
}

const insertCamera = (index) => {
    viewer.routeFly.add_current_camera(index)
    const newCamera = {
        id: Date.now(),
        index: index + 1,
        duration: 1
    }
    cameraList.value.splice(index, 0, newCamera)
    // 更新后续机位的序号
    updateCameraIndexes()
}

const deleteCamera = (index) => {
    if (!confirm('Are you sure you want to delete the current position?')) {
        return
    }
    
    // 如果正在播放或录制，先停止
    if (isPlaying.value || isRecording.value) {
        viewer.routeFly.stopFly()
        isPlaying.value = false
        isRecording.value = false
    }
    
    viewer.routeFly.removeCameraMark(index)
    cameraList.value.splice(index, 1)
    // 更新序号
    updateCameraIndexes()
}

const updateCameraIndexes = () => {
    cameraList.value.forEach((camera, index) => {
        camera.index = index + 1
    })
}

const selectCamera = (index) => {
    selectedCameraIndex.value = index
    console.log('选中机位:', index + 1)
    console.log('camera_marks:', viewer.routeFly.camera_marks)
    
    // 从camera_marks获取对应机位的状态
    if (viewer.routeFly.camera_marks && viewer.routeFly.camera_marks[index]) {
        const cameraData = viewer.routeFly.camera_marks[index]
        console.log('移动到机位数据:', cameraData)
        
        // 移动相机到指定位置
        const cameraEntity = cameraData.entity
        const cameraPosition = cameraEntity.getPosition()
        const cameraRotation = cameraEntity.getEulerAngles()   
        viewer.camera.setPosition(cameraPosition.x, cameraPosition.y, cameraPosition.z)
        viewer.camera.setEulerAngles(cameraRotation.x, cameraRotation.y, cameraRotation.z)
        console.log('viewer.camera.script',viewer.camera)
        viewer.camera.script.orbitCamera.resetAndLookAtPoint(cameraPosition,new pc.Vec3(0,0,0))
        viewer.camera.script.flyCamera.setEulerAngles(cameraRotation) 
        
    }
}

const handlePlay = () => {
    if (isPlaying.value) {
        // 当前正在播放，点击暂停
        viewer.routeFly.stopFly()
        isPlaying.value = false
        console.log('暂停路径飞行')
    } else {
        // 如果正在录制，先停止录制
        if (isRecording.value) {
            viewer.routeFly.stopFly()
            isRecording.value = false
        }
        
        // 当前未播放，点击开始播放
        if (cameraList.value.length > 0) {
            viewer.routeFly.fly(30)
            isPlaying.value = true
            console.log('开始路径飞行')
            
            // 监听飞行结束事件，重置播放状态
            // 由于fly方法会自动结束，我们需要定期检查状态
            const checkFlyStatus = () => {
                if (viewer.routeFly && !viewer.routeFly.isFlying && isPlaying.value) {
                    isPlaying.value = false
                    console.log('路径飞行自动结束')
                } else if (isPlaying.value) {
                    // 如果还在播放，继续检查
                    setTimeout(checkFlyStatus, 100)
                }
            }
            setTimeout(checkFlyStatus, 100)
        } else {
            console.log('请先添加摄像机位')
        }
    }
}

const handleRecord = () => {
    if (isRecording.value) {
        // 当前正在录制，点击停止
        viewer.routeFly.stopFly()
        isRecording.value = false
        console.log('停止视频录制')
    } else {
        // 如果正在播放，先停止播放
        if (isPlaying.value) {
            viewer.routeFly.stopFly()
            isPlaying.value = false
        }
        
        // 当前未录制，点击开始录制
        if (cameraList.value.length > 0) {
            viewer.routeFly.fly(30, false, true)
            isRecording.value = true
            console.log('开始视频录制')
            
            // 监听录制结束事件，重置录制状态
            const checkRecordStatus = () => {
                if (viewer.routeFly && !viewer.routeFly.isFlying && isRecording.value) {
                    isRecording.value = false
                    console.log('视频录制自动结束')
                } else if (isRecording.value) {
                    // 如果还在录制，继续检查
                    setTimeout(checkRecordStatus, 100)
                }
            }
            setTimeout(checkRecordStatus, 100)
        } else {
            console.log('请先添加摄像机位')
        }
    }
}

const updateCameraDuration = (index, newDuration) => {
    // 更新前端列表的时长
    cameraList.value[index].duration = newDuration
    
    // 同步更新camera_marks中对应项目的fillcountFactor
    if (viewer.routeFly.camera_marks && viewer.routeFly.camera_marks[index]) {
        viewer.routeFly.camera_marks[index].fillCountFactor = newDuration
        console.log(`更新机位 ${index + 1} 的fillCountFactor为:`, newDuration)
    }
}

const toggleLoop = () => {
    // 如果正在播放或录制，先停止
    if (isPlaying.value || isRecording.value) {
        viewer.routeFly.stopFly()
        isPlaying.value = false
        isRecording.value = false
    }
    
    isLooping.value = !isLooping.value
    if (viewer.routeFly) {
        viewer.routeFly.loop = isLooping.value
        viewer.routeFly.draw_camera_line()
    }
    console.log('循环状态切换为:', isLooping.value)
}

const handleClearAll = () => {
    // 确认操作
    if (!confirm('Are you sure you want to clear all positions?')) {
        return
    }
    
    // 如果正在播放或录制，先停止
    if (isPlaying.value || isRecording.value) {
        viewer.routeFly.stopFly()
        isPlaying.value = false
        isRecording.value = false
    }
    
    // 清空所有机位
    viewer.routeFly.clean_camera_marks()
    cameraList.value = []
    selectedCameraIndex.value = -1
    console.log('已清空所有机位')
}

const handleSave = () => {
    // 保存当前机位配置
    const camerasSetting = []
    for(let i = 0; i < cameraList.value.length; i++){
        camerasSetting.push({
            duration: cameraList.value[i].duration,
            position: viewer.routeFly.camera_marks[i].entity.getPosition(),
            eulerAngles: viewer.routeFly.camera_marks[i].entity.getEulerAngles()
        })
    }
    
    // 保存cameraSaveData的json文件并下载
    const blob = new Blob([JSON.stringify(camerasSetting)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'CameraRouteSetting.json'
    a.click()
    URL.revokeObjectURL(url)
}

const handleLoad = () => {
    // 创建文件输入框
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
        const file = e.target.files[0]
        if (!file) return
        
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const camerasSetting = JSON.parse(e.target.result)
                loadCameraConfig(camerasSetting)
            } catch (error) {
                console.error('JSON文件格式错误:', error)
                alert('JSON file format error, please check the file content')
            }
        }
        reader.readAsText(file)
    }
    input.click()
}

const loadCameraConfig = (camerasSetting) => {
    // 清空现有配置
    viewer.routeFly.clean_camera_marks()
    cameraList.value = []
    selectedCameraIndex.value = -1
    
    // 加载新配置
    camerasSetting.forEach((setting, index) => {
        // 创建相机实体并设置位置和角度
        viewer.routeFly.addCameraMark(setting.position, setting.eulerAngles)
        
        // 设置机位时长
        viewer.routeFly.camera_marks[index].fillCountFactor = setting.duration || 1
        
        // 添加到前端列表
        cameraList.value.push({
            id: Date.now() + index,
            index: index + 1,
            duration: setting.duration || 1
        })
    })
    
    console.log('已加载机位配置:', camerasSetting)
}

const toggleCollapse = () => {
    isCollapsed.value = !isCollapsed.value
}

// 滚动到选中的机位
const scrollToSelectedCamera = async () => {
    if (selectedCameraIndex.value >= 0 && !isCollapsed.value) {
        await nextTick()
        
        // 获取选中机位的DOM元素
        const cameraItems = cameraListContainer.value?.querySelectorAll('.camera-item')
        if (cameraItems && cameraItems[selectedCameraIndex.value]) {
            const selectedItem = cameraItems[selectedCameraIndex.value]
            
            // 滚动到选中项，使其在视窗中央
            selectedItem.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            })
        }
    }
}

defineExpose({
    init
})
</script>
 
 <template>
    <div v-if="props.show">
        <!-- 右侧摄像机位列表 -->
        <div class="absolute top-28 left-8 w-95 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-gray-200">
            <div class="p-x-6 p-y-2">
                <!-- 标题 -->
                <div class="flex items-center justify-between">
                    <!-- 标题 -->
                    <h3 class="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <div class="i-ri-camera-3-line text-xl"></div>
                        Camera Route
                    </h3>
                    <!-- 右侧操作按钮 -->
                    <div class="flex items-center gap-2">
                        <!-- 收起/展开按钮 -->
                        <button 
                            @click="toggleCollapse"
                            class="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            :title="isCollapsed ? 'Expand List' : 'Collapse List'"
                        >
                            <div :class="[
                                'text-lg text-gray-600 transition-transform duration-200',
                                isCollapsed ? 'i-ri-arrow-down-s-line' : 'i-ri-arrow-up-s-line'
                            ]"></div>
                        </button>
                    </div>
                </div>
                
                <!-- 控制栏 -->
                <div 
                    class="flex items-center justify-center gap-3 py-3 my-4 bg-gray-50 rounded-xl border border-gray-100"
                >
                    <button 
                        @click="handleAddCamera"
                        class="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                        title="Add Camera Position"
                    >
                        <div class="i-ri-add-line text-lg text-gray-600"></div>
                    </button>
                
                    <button 
                        @click="handlePlay"
                        :class="[
                            'p-2 rounded-lg transition-colors',
                            isPlaying 
                                ? 'bg-red-100 hover:bg-red-200' 
                                : 'hover:bg-gray-200'
                        ]"
                        :title="isPlaying ? 'Pause' : 'Play'"
                    >
                        <div :class="[
                            'text-lg',
                            isPlaying 
                                ? 'i-ri-pause-fill text-red-600' 
                                : 'i-ri-play-fill text-gray-600'
                        ]"></div>
                    </button>
                    
                    <button 
                        @click="handleRecord"
                        :class="[
                            'p-2 rounded-lg transition-colors',
                            isRecording 
                                ? 'bg-red-100 hover:bg-red-200' 
                                : 'hover:bg-gray-200'
                        ]"
                        :title="isRecording ? 'Stop' : 'Output Video'"
                    >
                        <div :class="[
                            'text-lg',
                            isRecording 
                                ? 'i-ri-stop-fill text-red-600' 
                                : 'i-ri-video-download-line text-gray-600'
                        ]"></div>
                    </button>
                    
                    <button 
                        @click="toggleLoop"
                        :class="[
                            'p-2 rounded-lg transition-colors',
                            isLooping 
                                ? 'bg-blue-100 hover:bg-blue-200' 
                                : 'hover:bg-gray-200'
                        ]"
                        title="Toggle Loop"
                    >
                        <div :class="[
                            'i-ri-repeat-line text-lg',
                            isLooping ? 'text-blue-600' : 'text-gray-600'
                        ]"></div>
                    </button>
                    
                    <!-- 分隔线 -->
                    <div class="w-px h-6 bg-gray-300 mx-1"></div>
                    
                    <!-- 当列表为空时显示加载按钮 -->
                    <button 
                        v-if="cameraList.length === 0"
                        @click="handleLoad"
                        class="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                        title="Load Configuration"
                    >
                        <div class="i-ri-folder-settings-line text-lg text-gray-600"></div>
                    </button>
                    
                    <!-- 当列表不为空时显示保存按钮 -->
                    <button 
                        v-if="cameraList.length > 0"
                        @click="handleSave"
                        class="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                        title="Save Configuration"
                    >
                        <div class="i-ri-save-line text-lg text-gray-600"></div>
                    </button>
                    
                </div>
                
                <!-- 摄像机位列表 -->
                <div 
                    v-if="!isCollapsed"
                    ref="cameraListContainer"
                    class="space-y-4 overflow-y-auto transition-all duration-300" 
                    style="max-height: calc(100vh - 310px);"
                >
                    <div 
                        v-for="(camera, index) in cameraList" 
                        :key="camera.id"
                        :class="[
                            'camera-item p-4 rounded-xl border transition-colors',
                            selectedCameraIndex === index 
                                ? 'bg-blue-50 border-blue-200 shadow-md' 
                                : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                        ]"
                        
                    >
                        <!-- 机位信息行：序号、时长设置和操作按钮 -->
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2 cursor-pointer" @click.stop="selectCamera(index)">
                                <span :class="[
                                    'text-sm font-medium',
                                    selectedCameraIndex === index ? 'text-blue-700' : 'text-gray-700'
                                ]">Position {{ camera.index }}</span>
                                <!-- <div v-if="selectedCameraIndex === index" class="w-2 h-2 bg-blue-500 rounded-full"></div> -->
                            </div>
                            <div class="flex items-center gap-3">
                                <!-- 插入机位按钮 -->
                                <button 
                                    @click.stop="insertCamera(index)"
                                    class="p-1 hover:bg-blue-50 rounded-md transition-colors"
                                    title="Insert Position Below"
                                >
                                    <div class="i-ri-add-line text-sm text-blue-600"></div>
                                </button>
                                <!-- 时长设置 -->
                                <div class="flex items-center gap-2 text-sm text-gray-600">
                                    <span>Duration</span>
                                    <input 
                                        v-model.number="camera.duration"
                                        type="number" 
                                        min="0.1" 
                                        step="0.1"
                                        @click.stop
                                        @input="updateCameraDuration(index, camera.duration)"
                                        class="w-8 px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                                    >
                                    <span>s</span>
                                </div>
                                <!-- 删除按钮 -->
                                <button 
                                    @click.stop="deleteCamera(index)"
                                    class="p-1 hover:bg-red-50 rounded-md transition-colors"
                                    title="Delete Current Position"
                                >
                                    <div class="i-ri-delete-bin-line text-sm text-red-600"></div>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 清空所有机位按钮 -->
                    <div v-if="cameraList.length > 0" class="pt-4 mt-4 border-t border-gray-200">
                        <button 
                            @click="handleClearAll"
                            class="w-full p-3 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200 flex items-center justify-center gap-2"
                            title="Clear All Positions"
                        >
                            <div class="i-ri-delete-bin-6-line text-lg text-red-500"></div>
                            <span class="text-sm font-medium text-red-600">Clear All Positions</span>
                        </button>
                    </div>
                    
                    <!-- 空状态 -->
                    <div v-if="cameraList.length === 0" class="text-center py-8 text-gray-500">
                        <div class="i-ri-camera-off-line text-3xl mb-2 text-gray-300"></div>
                        <p class="text-sm">No Camera Positions</p>
                        <p class="text-xs text-gray-400 mt-1">Click + button to add position</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

