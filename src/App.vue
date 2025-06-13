<script setup>
import { computed, onMounted, ref, reactive } from 'vue'
import {Viewer} from './viewer';
import controller from './components/controller.vue';
import recorder from './components/recorder.vue';
import helpPopup from './components/help-popup.vue';

const updateMemoryUsage = () => {
    if (performance.memory) {
        const usedJSHeapSize = performance.memory.usedJSHeapSize / 1048576; // Convert to MB
        document.getElementById('memoryUsage').innerText = `Memory: ${usedJSHeapSize.toFixed(2)} MB`;
    }
}

// Assume this is the model file path you want to load
const modelFilePath = '/model.ply';

const screenshotCount = ref(60);
const takeScreenshot = () => {
    viewer.routeFly.fly(screenshotCount.value, false, true);
};
const testFly = () => {
    viewer.routeFly.fly(screenshotCount.value);
}

const loadCamPos = ref(null);
const triggerLoadCamPos = () => {
    loadCamPos.value.click();
};
const uploadPositions = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            viewer.scene_reactive = JSON.parse(event.target.result);
            viewer.sync_scene();
            if (viewer.scene_reactive.routes && viewer.scene_reactive.routes.length > 0) {
                viewer.routeFly.routes = viewer.scene_reactive.routes;
                viewer.routeFly.loadRoute(viewer.routeFly.routes[viewer.routeFly.routes.length - 1]);
            }
        } catch (error) {
        }
    };
    reader.readAsText(file);
};

// Create a function to get URL parameters
const getUrlParams = () => {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    for (const [key, value] of params) {
        result[key] = value;
    }
    return result;
};

const saveScene = () => {
    const settings = viewer.scene_reactive;
    if (viewer.routeFly.current_route === null) {
        viewer.routeFly.saveRoute('default');
    }
    if (viewer.routeFly.routes.length > 0) {
        settings.routes = viewer.routeFly.routes;
    }

    const positionsJSON = JSON.stringify(settings);
    const blob = new Blob([positionsJSON], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'scene_config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const modelInput = ref(null);

const loadModel = (event) => {
    if (event.target.files.length > 0) {
        console.log('loadModel')
        const file = event.target.files[0];
        const url = URL.createObjectURL(file);
        viewer.loadModel(url, file.name).then(()=>{
            URL.revokeObjectURL(url);
        });
        
    }
}
const triggerLoadModel = () => {
    modelInput.value.click();
}

const message = reactive({
    assets: [],
    lod: false,
    model_id: ''
});

const toggleLod = () => {
    message.lod = !message.lod; // Toggle LOD state
}

const formattedCount = (count) => {
    return new Intl.NumberFormat('en-US', {
        style: 'decimal', // Use regular decimal format
        minimumFractionDigits: 0, // Minimum decimal places
        maximumFractionDigits: 0  // Maximum decimal places
    }).format(count);
};

const sliderValue = ref(0.5); // Default value is 0.5

// Format the displayed value, keep two decimal places
const formattedValue = computed(() => {
    // Ensure the value is converted to numeric type before using number methods
    const numValue = Number(sliderValue.value);
    return numValue.toFixed(2); // Now it's safe to use toFixed
});

const updateValue = () => {
    viewer.setSliderValue(parseFloat(sliderValue.value));
};

const auto_screenshot = () => {
    viewer.auto_screenshot();
}

const clear_models = () => {
    viewer.clear_models();
}

const upload_video = () => {
    viewer.upload_current_video();
}

const loadModelAsync = async () => {
    const id = message.model_id || null;
    await viewer.load_zhitianxia_ply(id);
}
const showControlPanel = ref(false);

const showLoadModelButton = ref(true);

const loadModelFromMain = () => {
    triggerLoadModel();
    showLoadModelButton.value = false;
};
   
const showLoadPathButton = ref(true);

const loadPathFromMain = () => {
    triggerLoadCamPos();
    showLoadPathButton.value = false;
}

const isAnimating = ref(false);
const params = ref({});

const toggleMotion = () => {
    if (isAnimating.value) {
        viewer.stopAnimateCamera();
        isAnimating.value = false;
    } else {
        const animateFrames = params.urlParams.animate_frames || 60;
        viewer.startAnimateCamera(animateFrames);
        isAnimating.value = true;
    }
};

const refController = ref(null);
const refRecorder = ref(null);
const showRecorder = ref(false);

const toggleRecorder = () => {
    showRecorder.value = !showRecorder.value;
};

const showHelp = ref(false);
const toggleHelp = () => {
    showHelp.value = !showHelp.value;
};

const openGithub = () => {
    window.open('https://github.com/eXplorerAI-CN/GsXplore', '_blank');
};

onMounted(() => {
    const urlParams = getUrlParams();
    params.urlParams = urlParams;
    showControlPanel.value = urlParams.control_panel === '1';
    if (urlParams.control_panel === '1') {
        setInterval(updateMemoryUsage, 1000);
    }
    const canvas = document.getElementById('canvas');
    const viewer = new Viewer(canvas, message);
    window.viewer = viewer;
    viewer.set_params(urlParams);
    viewer.run(canvas).then(() => {
        console.log('------------- viewer started -------------');
        refController.value.init(viewer,canvas);
        refRecorder.value.init(viewer);
    });
    
});

</script>

<template>
    <div class="outwrap">
        <input type="file" ref="modelInput" @change="loadModel" accept=".fbx,.glb,.ply,.splat" style="display: none;">
        <input type="file" accept=".json" ref="loadCamPos" @change="uploadPositions" style="display: none;">
        <div v-if="showControlPanel" class="meters">
            <div>
                <div id="fpsCounter"></div>
                <div id="memoryUsage"></div>
            </div>
            <div id="info"></div>
            <ul>
                <li v-for="asset in message.assets" :key="asset.name">
                    Name: {{ asset.name }}, 
                    Count: {{ formattedCount(asset.count) }},
                    Size: {{ Math.round(asset.count * 70 / 1024/1024)}}M
                </li>
            </ul>
            <div>
  <!-- <button onclick="viewer.switch_camera_script();">set camera</button>     -->
                <button onclick="viewer.routeFly.add_current_camera();">add camera pos</button>
                <button onclick="viewer.routeFly.removeCurrentCameraMark(); event.stopPropagation(); event.preventDefault();">remove current mark</button>    
                frame rate<input type="number" v-model="screenshotCount" min="1" style="width: 50px; margin-left: 5px;">
                <button @click="takeScreenshot">screenshot</button>    
                <button @click="testFly">test fly</button>
            </div>  
            <div>
                <button @click=triggerLoadModel>Load Local Model</button>   
                <button onclick="viewer.clean_camera_pos();">clean camera pos</button>   
                <button @click="triggerLoadCamPos">Load scene</button>
                <button @click="saveScene">Save scene</button>  
                <!-- <button @click="toggleLod">{{ message.lod ? 'Disable LOD' : 'Enable LOD' }}</button>   -->
                
            </div>
            <!-- <div>
                <button @click="auto_screenshot">auto screenshot</button>
                <input v-model="message.model_id" placeholder="model id">
                <button @click="loadModelAsync">load model</button>
                <button @click="clear_models">clear models</button>
                <button @click="upload_video">upload_video</button>
            </div> -->
            <div>
                <input type="range" min="0" max="1" step="0.01" v-model="sliderValue" 
                    @input="updateValue" 
                    @click.stop 
                    @mousedown.stop="handleStart"
                    @mousemove.stop
                    @mouseup.stop>
                <span>{{ formattedValue }}</span>
            </div>
            <div>

            </div>
        </div>

        <div v-else class="menu-container">
            <div class="main-menu">
                <button 
                    @click="triggerLoadModel" 
                    class="menu-item"
                >
                    <div class="i-ri-folder-open-line menu-icon"></div>
                    <span>Load Model</span>
                </button>
                <button 
                    @click="toggleRecorder" 
                    :class="[
                        'menu-item',
                        showRecorder ? 'menu-item-active' : ''
                    ]"
                >
                    <div class="i-ri-video-line mxenu-icon"></div>
                    <span>Camera Route</span>
                </button>
                <button 
                    @click="toggleHelp" 
                    :class="['menu-item', showHelp ? 'menu-item-active' : '']"
                >
                    <div class="i-ri-question-line menu-icon"></div>
                    <span>Help</span>
                </button>
                <button 
                    class="menu-item"
                    @click="openGithub"
                >
                    <div class="i-ri-github-line menu-icon"></div>
                </button>
                <help-popup :show="showHelp" />
            </div>
        </div>

        <canvas id="canvas"></canvas>
        
        <controller ref="refController" control-type="fly" :no-joystick="true" />
        <recorder ref="refRecorder" :show="showRecorder" /> 
    </div>
</template>

<style scoped>
canvas {
    width: 100%;
    height: 100%;
    background-color: black;
    position: absolute;
    top: 0;
    left: 0;
}
.meters{
    position: absolute;
    /* display: None; */
    top: 0;
    left: 0;
    color: white;
    font-size: 12px;
    padding: 5px;
    background-color: rgba(0, 0, 0, 0.5);
}
input[type="range"] {
  width: 300px; /* Control the width of the slider */
}

.menu-container {
    position: absolute;
    top: 2rem;
    left: 2rem;
    display: flex;
    justify-content: flex-start;
    align-items: center;
    z-index: 100;
}

.main-menu {
    display: flex;
    gap: 8px;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 16px;
    padding: 8px;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08), 
                0 1px 4px rgba(0, 0, 0, 0.04);
}

.menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: transparent;
    border: none;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    color: #1d1d1f;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    user-select: none;
    -webkit-user-select: none;
}

.menu-item:hover {
    background: rgba(0, 0, 0, 0.05);
    transform: translateY(-1px);
}

.menu-item:active {
    transform: translateY(0);
    background: rgba(0, 0, 0, 0.08);
}

.menu-item-active {
    background: rgba(0, 122, 255, 0.1) !important;
    color: #007aff !important;
}

.menu-item-active:hover {
    background: rgba(0, 122, 255, 0.15) !important;
}

.menu-icon {
    font-size: 16px;
    color: inherit;
}
</style>
