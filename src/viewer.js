import * as pc from 'playcanvas';
import { Observer } from '@playcanvas/observer';
import { GSplatResource } from 'playcanvas';
import { reactive, watch } from 'vue';
import { default_scenes } from './configs/default_scene';

import { GizmoHandler } from './utils/gizmo_handler';
import { Screenshot } from './utils/screenshot_webgl2';
import { RouteFly } from './utils/route_fly';
import { genSplatEntity } from './utils/splat_entity';
import { genOrbitCameraScript } from './utils/orbit_camera';
import { genFlyCameraScript } from './utils/fly_camera';
import { Text } from './utils/text.js';

import { GSplatData } from './utils/gsplat-data';
import { splatParser } from './utils/splat_parser'; 
import { GridHelper } from './utils/grid_helper';
import * as simpleMesh from './utils/simple_mesh';
import * as autoRotate from './utils/auto_rotate';
import * as panorama from './utils/panorama';
import { md5 } from 'js-md5';
import { AmmoDebugDrawer } from './utils/ammo_debug_drawer';
import Ammo from './utils/ammo/ammo.wasm.js';
import { savePlyFile } from './utils/save_gsplat_data';
import { fetchWithProgress } from './utils/fetch_with_progress';
import { TraceScreenPosition } from './utils/trace_screen_position';
import { init_mini_stats } from './utils/mini_stats';
import {DistanceMeasure} from './utils/distance_measure'
import { RectanglePlane } from './utils/rectangle_plane'
import { plyParser } from './utils/ply_parser';
import { fetchPlyWithStreamParsing } from './utils/fetch_with_progress';

const scriptMapping = {
    'autoRotate': autoRotate
}

const data = new Observer({});


const deviceType = 'webgl2';
// const deviceType = 'webgpu';

/**
 * Create color material
 * @param {pc.Color} color - Color
 * @returns {pc.Material} - Standard material
 */
const createColorMaterial = (color) => {
    const material = new pc.StandardMaterial();
    material.diffuse = color;
    material.update();
    return material;
}

const createSplatInstance = (name, resource, px, py, pz, scale, vertex, fragment) => {
    // const splat = resource.instantiate({
    //     debugRender: false,
    //     fragment: fragment,
    //     vertex: vertex
    // });
    const splat = genSplatEntity(resource);
    splat.name = name;
    splat.setLocalPosition(px, py, pz);
    splat.setLocalScale(scale, scale, scale);
    return splat;
};

const getAssetKey = (input) => {
    if (typeof input === 'string') {
        return md5(input);
    } else if (Array.isArray(input)) {
        // Serialize points array to JSON string, then calculate MD5
        return md5(JSON.stringify(input));
    }
    return md5(JSON.stringify(input)); // Handle other types with serialization
};


class Viewer{
    constructor(canvas, message=null){
        this.canvas = canvas;
        this.events = new pc.EventHandler();
        this.canvas.style.backgroundColor = '#000000'; // Set canvas background color to black
        this.message = message;
        this.device = null;
        this.app = new pc.AppBase(this.canvas);
        this.app.events = this.events;
        this.camera = null;
        // this.screenshot_camera = null;
        this.gizmoHandler = null;
        this.points = [];
        this.camera_positions = [];
        // this.screenshotScriptEntity = null;
        this.rx = 180;
        this.ry = 0;
        this.rz = 0;
        this.scale = 1;
        this.useCustomShader = false;
        this.usePointClouds = false;
        this.loadDefault = false;
        this.selection = null;

        this.screenshotDelay = 0;
        this.shouldtakeScreenshot = true;
        this.screenshotScript = null;

        // this.particleSystem = null;

        this.captureTransitBegin = 0;
        this.captureTransitEnd = 0;
        this.should_conert_video = false;
        this.enable_grid = false;
        this.gridHelper = null;
        this.antialias = false;
        
        // Add toggle parameters
        this.showPointCloud = false;
        
        this.assets = {
            standartAssets: {},
            urlAssets: {},
            panoCubemaps:{},
            gsplatElements: {},
            presetAssets: {},
            imageTextures: {},
            simpleMeshes: {},
        };
        this.cameraControl = {
            fly: {
                px: 0,
                py: 0,
                pz: 0,
                ex: 0,
                ey: 0,
                ez: 0,
            },
            orbit: {
                lx: 0,
                ly: 0,
                lz: 0,
                ox: 0,
                oy: 0,
                oz: 0,
            },
        };
        this.routeFly = null;
        

        this.events.on('routeFly:cameraMarkSelected', (data) => {
            console.log('routeFly:cameraMarkSelected', data);
        });
    }

    // init_outline_renderer(){
    //     this.outlineRenderer = new pc.OutlineRenderer(this.app);
        
    //     app.on('update', (dt) => {
    //         // update the outline renderer each frame, and render the outlines inside the opaque sub-layer
    //         // of the immediate layer
    //         const immediateLayer = app.scene.layers.getLayerByName('Immediate');
    //         outlineRenderer.frameUpdate(cameraEntity, immediateLayer, false);
    //     });
    // }

    setCameraPosition(x, y, z){
        this.camera.setPosition(x, y, z);
    }

    async splatParser(url, onProgress){
        // Get file data
        // const response = await fetch(url);
        // if (!response.ok) {
        //     throw new Error(`HTTP error! status: ${response.status}`);
        // }
        // const arrayBuffer = await response.arrayBuffer();
        const arrayBuffer = await fetchWithProgress(url, (percent, percentLabel) => {
            onProgress?.(percent, percentLabel);
        });
        return splatParser(arrayBuffer);
    }

    async plyParser(url, onProgress){
        const arrayBuffer = await fetchWithProgress(url, (percent, percentLabel) => {
            onProgress?.(percent, percentLabel);
        });
        return plyParser(arrayBuffer);
    }

    // 新增流式PLY解析方法
    async plyStreamParser(url, onProgress, onVertexData) {
        return fetchPlyWithStreamParsing(
            url, 
            (percent, percentLabel, chunk, fileSize, extraInfo) => {
                onProgress?.(percent, percentLabel, extraInfo);
            },
            (vertexData, vertexIndex) => {
                onVertexData?.(vertexData, vertexIndex);
            }
        );
    }

    set_params(params){
        if (params.hasOwnProperty('rx')){
            this.rx = params.rx;
        }
        if (params.hasOwnProperty('ry')) {
            this.ry = params.ry;
        }
        if (params.hasOwnProperty('rz')) {
            this.rz = params.rz;
        }
        if (params.hasOwnProperty('scale')){
            this.scale = params.scale;
        }
        if (params.hasOwnProperty('loaddefault')) {
            this.loadDefault = params.loaddefault;
        }
        if (params.hasOwnProperty('screenshotDelay')){
            this.screenshotDelay = params.screenshotDelay;
        }
        if (params.hasOwnProperty('usePointClouds')) {
            this.usePointClouds = params.usePointClouds;
        }
        if (params.hasOwnProperty('captureTransitBegin')){
            this.captureTransitBegin = params.captureTransitBegin;
        }
        if (params.hasOwnProperty('captureTransitEnd')){
            this.captureTransitEnd = params.captureTransitEnd;
        }
        this.url_params = params;
    }

    genSplatEntity(elements, lodLevel = -1) {
        const device = this.device;
        console.log('device', device)
        const t_gsplat_data = new GSplatData(elements, {'lodLevel': lodLevel});

        // const t_gsplat_resource = new GSplatResource(device, t_gsplat_data);
        const t_gsplat_resource = new GSplatResource(this.app, t_gsplat_data);
        // const t_entity = t_gsplat_resource.instantiate();
        // t_entity.splatResource = { splatData: t_gsplat_data, device: device };
        // t_entity.gsplat.material.setParameter('minDisplayLength', 0);
        // t_entity.gsplat.gsplatData = t_gsplat_data;
        // return t_entity;

        const t_entity = createSplatInstance('test', t_gsplat_resource, 1, 0, 0, 10);
        return t_entity;
    }

    capture() {
        if (this.screenshotScript === null) {
            console.log('------------init capture------------');
            this.screenshotScript = new Screenshot(this.app, this.camera, this.canvas.width, this.canvas.height);
            this.screenshotScript.init();
        }
        if (this.gizmoHandler !== null) {
            this.gizmoHandler.clear();
        }
        if (this.captureTransitEnd > 0) {
            if (this.screenshotCount < this.captureTransitEnd * this.screenshotFillCount) {
                const totalSteps = (this.captureTransitEnd - this.captureTransitBegin) * (this.screenshotFillCount);
                const currentStep = this.screenshotCount - this.screenshotFillCount * this.captureTransitBegin;
                const entities = this.app.root.findByTag('gaussian');

                let t = currentStep / totalSteps; // Current time step ratio
                if (this.screenshotCount < this.screenshotFillCount * this.captureTransitBegin) {
                    t = 0;
                }

                entities.forEach((e) => {
                    // Use exponential function to adjust the increase rate, ensuring slow at first and fast later
                    e.script.pointCloud.setSplatTransit_2(t);
                });
            } else {
                const entities = this.app.root.findByTag('gaussian');
                entities.forEach((e) => {
                    e.script.pointCloud.setSplatTransit(1);
                });
            }
        }
        // this.app.render();

        this.screenshotScript.capture('screenshot_' + this.screenshotCount);
    }

    compressSplatData(entity_id, lodLevel = 1, gridSize = 1024) {
        const url = this.scene_reactive.data.entities[entity_id].url;
        const assetKey = getAssetKey(url);
        const elements = this.assets.gsplatElements[assetKey];
        console.log('orginal point count: ', elements[0].count)
        if (!elements) {
            console.warn(`No splat elements found for entity ID: ${entity_id}`);
            return null;
        }

        // Create new GSplatData instance for compression
        // Use higher LOD level (e.g. 4) to achieve greater compression ratio
        const compressedData = new GSplatData(elements, {
            lodLevel: lodLevel,  // Higher LOD level results in greater compression ratio
        }, gridSize);
        console.log('numSplats: ', compressedData.numSplats)

        savePlyFile(compressedData);
    }

    async loadPanoramaSkybox(url, options = {}) {
        await panorama.loadPanoramaSkybox(this.app, url, options);
    }

    async loadModel(url, filename) {
        const assetKey = getAssetKey(url);
        // First remove query parameters, then extract file extension
        let filetype = url.split('?')[0].split('.').pop().toLowerCase();
        if (filetype.length > 6){
            filetype = filename.split('.').pop().toLowerCase();;
        }
        let asset = this.assets.urlAssets[assetKey];    
        if (filetype !== 'ply'){
            if (!asset){
                // Create different assets based on file type
                if (filetype === 'ply') {
                    asset = new pc.Asset(filename, 'gsplat', { url: url });
                } else if (filetype === 'glb') {
                asset = new pc.Asset(filename, 'container', { url: url });
                } else if (filetype === 'obj') {
                    asset = new pc.Asset(filename, 'container', { 
                        url: url,
                        // OBJ files usually need format specification
                        format: 'obj'
                    });
                }

                if (asset) {
                    this.app.assets.add(asset);

                    // Wrap asset loading process with Promise
                    await new Promise((resolve, reject) => {
                        asset.once('load', () => resolve());
                        asset.once('error', (err) => reject(err));
                        this.app.assets.load(asset);
                    });
                    this.assets.urlAssets[assetKey] = asset;
                    console.log('-----------create new asset----------', url);
                }
            }
        }

        let entity = null;
        if (filetype === 'ply') {
            let entity_elements = this.assets.gsplatElements[assetKey];
            if (!entity_elements) {
                const onProgress = (percent, percentLabel) => {
                    const msg = {
                        url: url,
                        percent: percent,
                        entity_id: filename,
                    };
                    this.events.fire('load_progress', msg);
                }
                // entity_elements = await this.plyParser(url, onProgress);
                // entity_elements = entity_elements.data.elements;

                const streamResult = await this.plyStreamParser(url, onProgress, (vertexData, vertexIndex) => {
                    // 可以在这里实时处理每个顶点数据
                    // console.log('vertexData', vertexData);
                    // console.log('vertexIndex', vertexIndex);
                }); 
                console.log('流式解析结果:', streamResult);
                entity_elements = streamResult.elements;
                this.assets.gsplatElements[assetKey] = entity_elements;
                console.log('-----------create new ply asset----------', url);
            }
            entity = this.genSplatEntity(entity_elements);
            entity.tags.add('gaussian');
            
            // Generate point cloud mesh for ply file
            // const splatData = asset.resource.splailoudMesh(this.device, splatData, 10);
            // pointCloudMeshInstance.cull = false;
            
            // Create point cloud entity
            // const pointCloudEntity = new pc.Entity('pointCloud');
            // pointCloudEntity.addComponent('render', {
            //     meshInstances: [pointCloudMeshInstance]
            // });
            
            // Add point cloud entity as child of splat entity
            // entity.addChild(pointCloudEntity);
            // pointCloudEntity.tags.add('pointcloud');
            
            // Initial state: show splat, hide point cloud
            // entity.gsplat.enabled = !this.showPointCloud;
            // pointCloudEntity.render.enabled = this.showPointCloud;
            
        } else if (filetype === 'splat') {
            console.log('load splat file', url)
            let entity_elements = this.assets.gsplatElements[assetKey];
            if (!entity_elements){
                const onProgress = (percent, percentLabel) => {
                    const msg = {
                        url: url,
                        percent: percent,
                        entity_id: filename,
                    };  
                    this.events.fire('load_progress', msg);
                }
                entity_elements = await this.splatParser(url, onProgress);
                this.assets.gsplatElements[assetKey] = entity_elements;
                console.log('-----------create new asset----------', url);
            }
            entity = this.genSplatEntity(entity_elements);
            entity.tags.add('gaussian');
            
            // Generate point cloud mesh for splat file
            // const t_gsplat_data = new GSplatData(entity_elements, {'lodLevel': -1});
            // const pointCloudMeshInstance = pointCloudMesh(this.device, t_gsplat_data, 10);
            
            // Create point cloud entity
            // const pointCloudEntity = new pc.Entity('pointCloud');
            // pointCloudEntity.addComponent('render', {
            //     meshInstances: [pointCloudMeshInstance]
            // });
            
            // Add point cloud entity as child of splat entity
            // entity.addChild(pointCloudEntity);
            // pointCloudEntity.tags.add('pointcloud');
            
            // Initial state: show splat, hide point cloud
            // entity.gsplat.enabled = !this.showPointCloud;
            // pointCloudEntity.render.enabled = this.showPointCloud;
            
        } else if (filetype === 'glb' || filetype === 'obj') {
            // Create a new entity to carry the model
            entity = asset.resource.instantiateRenderEntity();
            
            // Process material to avoid scene color texture sampler error
            if (entity.render) {
                const meshInstances = entity.render.meshInstances;
                meshInstances.forEach(instance => {
                    if (instance.material) {
                        // Create new basic material
                        const newMaterial = new pc.StandardMaterial();
                        
                        // Copy basic attributes of original material
                        if (instance.material.diffuseMap) {
                            newMaterial.diffuseMap = instance.material.diffuseMap;
                        }
                        if (instance.material.normalMap) {
                            newMaterial.normalMap = instance.material.normalMap;
                        }
                        
                        // Set basic attributes
                        newMaterial.diffuse = instance.material.diffuse;
                        newMaterial.specular = instance.material.specular;
                        newMaterial.shininess = instance.material.shininess;
                        newMaterial.metalness = instance.material.metalness;
                        newMaterial.useMetalness = true;
                        
                        // Disable features that may cause problems
                        // newMaterial.useSceneColorMap = false;
                        newMaterial.useFog = false;
                        // newMaterial.useGammaToCineon = false;
                        // newMaterial.useSkybox = false;
                        
                        // Update material
                        newMaterial.update();
                        
                        // Apply new material
                        instance.material = newMaterial;
                    }
                });
            }
        }

        if (entity) {
            this.app.root.addChild(entity);
            entity.setLocalPosition(0, 0, 0);
            entity.rotate(this.rx, this.ry, this.rz);
            entity.setLocalScale(this.scale, this.scale, this.scale);
        }

        return entity;
    }

   

    setkeyboardEvent() {
        const gizmoHandler = this.gizmoHandler;
        // wrappers for control state changes
        const setType = (/** @type {string} */ value) => {
            data.set('gizmo.type', value);

            // call method from top context (same as controls)
            // @ts-ignore
            // window.top.setType(value);
        };
        const setProj = (/** @type {number} */ value) => {
            data.set('camera.proj', value + 1);

            // call method from top context (same as controls)
            // @ts-ignore
            // window.top.setProj(value);
        };

        // key event handlers
        const keydown = (/** @type {KeyboardEvent} */ e) => {
            gizmoHandler.gizmo.snap = !!e.shiftKey;
            gizmoHandler.gizmo.uniform = !e.ctrlKey;
        };
        const keyup = (/** @type {KeyboardEvent} */ e) => {
            gizmoHandler.gizmo.snap = !!e.shiftKey;
            gizmoHandler.gizmo.uniform = !e.ctrlKey;
        };
        const keypress = (/** @type {KeyboardEvent} */ e) => {
            switch (e.key) {
                case 'x':
                    data.set('gizmo.coordSpace', data.get('gizmo.coordSpace') === 'world' ? 'local' : 'world');
                    break;
                case '1':
                    setType('translate');
                    break;
                case '2':
                    setType('rotate');
                    break;
                case '3':
                    setType('scale');
                    break;
                case 'p':
                    setProj(pc.PROJECTION_PERSPECTIVE);
                    break;
                case 'o':
                    setProj(pc.PROJECTION_ORTHOGRAPHIC);
                    break;
            }
        };
        window.addEventListener('keydown', keydown);
        window.addEventListener('keyup', keyup);
        window.addEventListener('keypress', keypress);

        // gizmo and camera set handler
        const tmpC = new pc.Color();
        data.on('*:set', (/** @type {string} */ path, value) => {
            const pathArray = path.split('.');

            switch (pathArray[0]) {
                case 'camera':
                    switch (pathArray[1]) {
                        case 'proj':
                            camera.camera.projection = value - 1;
                            break;
                        case 'fov':
                            camera.camera.fov = value;
                            break;
                    }
                    return;
                case 'gizmo':
                    if (gizmoHandler.skipSetFire) {
                        return;
                    }
                    switch (pathArray[1]) {
                        case 'type':
                            gizmoHandler.switch(value);
                            break;
                        case 'xAxisColor':
                        case 'yAxisColor':
                        case 'zAxisColor':
                            // @ts-ignore
                            tmpC.set(...value);
                            gizmoHandler.gizmo[pathArray[1]] = tmpC;
                            break;
                        default:
                            gizmoHandler.gizmo[pathArray[1]] = value;
                            break;
                    }
                    break;
            }
        });
    }


    init_camera(){
        this.camera = new pc.Entity('camera');
        this.camera.addComponent('camera', {
            clearColor: new pc.Color(0, 0, 0, 1),
            requestSceneColorMap: true,
            // Add other camera options
            // farClip: 1000,
            // nearClip: 0.1,
            fov: 90
        });

        // Ensure correct camera hierarchy
        // this.camera.camera.layers = [pc.LAYERID_WORLD, pc.LAYERID_DEPTH, pc.LAYERID_SKYBOX, pc.LAYERID_UI];
        
        this.camera.addComponent('script');
        let orbitCamera1 = genOrbitCameraScript(this.app);
        let flyCamera = genFlyCameraScript(this.app);
        this.camera.script.create(flyCamera);
        this.camera.script.flyCamera.enabled = false;
        this.camera.script.flyCamera.events = this.events;

        const orbitCamera = this.camera.script.create('orbitCamera');
        this.OrbitCameraInputMouseScript = this.camera.script.create('orbitCameraInputMouse');
        this.OrbitCameraInputTouchScript = this.camera.script.create('orbitCameraInputTouch');
        this.camera.script.orbitCamera.events = this.events;

        this.camera.setPosition(1, 1, 1);
        this.app.root.addChild(this.camera);
        orbitCamera.distance = 14;


        // On fly camera entity
        const cameraCollision = this.camera.addComponent('collision');
        cameraCollision.type = 'capsule';  // Use capsule collider, more suitable for character/camera
        cameraCollision.height = 1.5;        // Reduce capsule height
        cameraCollision.radius = 1.5;      // Reduce capsule radius
        
        // Modify rigidbody component settings
        const cameraRigidbody = this.camera.addComponent('rigidbody');
        cameraRigidbody.type = 'static';  // Use kinematic rigidbody
        cameraRigidbody.mass = 1;
        cameraRigidbody.linearDamping = 0;
        cameraRigidbody.angularDamping = 0;
        cameraRigidbody.friction = 0;
        cameraRigidbody.restitution = 0;
        cameraRigidbody.gravity = new pc.Vec3(0, 0, 0);  // Disable gravity
        cameraRigidbody.angularFactor = new pc.Vec3(0, 0, 0);
        // cameraRigidbody.linearFactor = new pc.Vec3(1, 0, 1);


        // cameraRigidbody.body.setCcdMotionThreshold(0.2)
        // cameraRigidbody.body.setCcdSweptSphereRadius(0.2)
        // this.camera.script.create(Ccd);
    }
    startXR(){
        if (!this.app.xr.active){
            if (this.app.xr.isAvailable(pc.XRTYPE_VR)) {
                this.camera.camera.startXr(pc.XRTYPE_VR, pc.XRSPACE_LOCAL, {
                    callback: function (err) {
                        if (err) console.log(`WebXR Immersive VR failed to start: ${err.message}`);
                    }
                });
            } else {
                console.log('Immersive VR is not available');
            }
        }
    }
    endXR(){
        if (this.app.xr.active) {
            this.camera.camera.endXr()
        }
    }

    add_line(points){
        points = points.reduce((accumulator, current, index) => {
            const value = new pc.Vec3(current.x, current.y, current.z);
            if (index === 0 || index === points.length - 1) { // If it's the first element, add only once
                accumulator.push(value);
            } else { // Otherwise, add the element twice
                accumulator.push(value, value);
            }
            return accumulator;
        }, []);
        this.points = [...this.points, ...points];
    }

    clean_line(){
        this.points = [];
    }   
    
    switch_camera_script(camera_script_id){
        const scripts = ['orbitCamera', 'flyCamera'];
        let ret = null;

        // Disable all scripts, enable required scripts
        scripts.forEach(script => {
            if (this.camera.script.has(script)) {
                this.camera.script[script].enabled = (script === camera_script_id);
                if (script === camera_script_id){
                    ret = this.camera.script[script];
                }
            }
        });
        return ret;

        // // 如果所需脚本不存在，添加它
        // if (!this.camera.script.has(camera_script_id)) {
        //     this.camera.script.create(camera_script_id);
        // }
    }

    init_gizmoHandler(){
        // create layers
        const gizmoLayer = new pc.Layer({
            name: 'Gizmo',
            clearDepthBuffer: true,
            opaqueSortMode: pc.SORTMODE_NONE,
            transparentSortMode: pc.SORTMODE_NONE
        });
        const layers = this.app.scene.layers;
        layers.push(gizmoLayer);
        this.camera.camera.layers = this.camera.camera.layers.concat(gizmoLayer.id);

        // create gizmo
        this.gizmoHandler = new GizmoHandler(this.app, this.camera.camera, gizmoLayer, data, this.events);
        // this.gizmoHandler.switch('scale');
        // gizmoHandler.add(box);
        this.setkeyboardEvent();

        // picker
        const picker = new pc.Picker(this.app, this.canvas.clientWidth, this.canvas.clientHeight);
        const worldLayer = layers.getLayerByName('World');
        const pickerLayers = [worldLayer];
        const gizmoHandler = this.gizmoHandler;
        const canvas = this.canvas;
        const app = this.app;
        const camera = this.camera
        const onPointerDown = (/** @type {PointerEvent} */ e) => {
            if (gizmoHandler.ignorePicker) {
                return;
            }

            if (picker) {
                picker.resize(canvas.clientWidth, canvas.clientHeight);
                picker.prepare(camera.camera, app.scene, pickerLayers);
            }

            const selection = picker.getSelection(e.clientX - 1, e.clientY - 1, 2, 2);
            console.log('selection', selection)
            if (!selection[0]) {
                gizmoHandler.clear();
                this.selection = null;
                return;
            }
            if (selection[0].node.name == 'box') {
                gizmoHandler.clear();
                this.selection = null;
                return;
            }
            this.selection = selection[0].node;

            this.events.fire('entityClick', {
                entity: selection[0].node,
                position: selection[0].node.getPosition().clone(),
                name: selection[0].node.name
            });

            gizmoHandler.add(selection[0].node, !e.ctrlKey && !e.metaKey);
        };

        window.addEventListener('pointerdown', onPointerDown);
    }

    genLodSplat(elements, lodLevel, gridSize = 1024){
        const t_gsplat_data = new GSplatData(elements, lodLevel, gridSize);
        const t_entity = genLodSplat(this.device, t_gsplat_data.elements, lodLevel, gridSize);
        return t_entity;
    }

    to_last_node(){
        if (this.last_node){
            this.camera.setPosition(this.last_node.getPosition());
            this.camera.script.flyCamera.setEulerAngles(this.last_node.getLocalEulerAngles());
        }
    }

    setFlyCameraVelocity(dx, dy, dz){
        this.camera.script.flyCamera.setCameraVelocity(dx, dy, dz);
    }  

    moveFlyCamera(dx, dy, dz) {
        this.camera.script.flyCamera.moveCamera(dx, dy, dz);
    }  

    setFlyCameraEulerAngles(ex, ey, ez){
        this.camera.script.flyCamera.rotateCamera(ex, ey, ez);
    }

    rotateOrbitCamera(ex, ey, ez){
        this.camera.script.orbitCamera.rotateCamera(ex, ey);
    }

    setOrbitCameraAutoRotateYaw(yaw){
        this.camera.script.orbitCamera.setAutoRotateYaw(yaw);
    }

    oribitCameraLookAt(screenPos, y){
        this.camera.script.orbitCamera.resetAndLookAtPosition(this.camera.getPosition(), entity);
    }

    setOrbitCameraDistance(factor){
        const distance = this.camera.script.orbitCamera.distance;
        this.camera.script.orbitCamera.setDistance(distance * factor);
    }
    setOrbitCameraPivotVelocity(dx, dy, dz){
        this.camera.script.orbitCamera.setPivotVelocity(dx, dy, dz);
    }

    moveOrbitCameraPivot(dx, dy, dz) {
        this.camera.script.orbitCamera.movePivotVelocity(dx, dy, dz);
    }

    takeoverCameraControl(){
        this.camera.script.flyCamera.speed = 1;
        this.camera.script.flyCamera.detachKeyboardEvents();
        this.camera.script.flyCamera.detachEvents();
        this.OrbitCameraInputMouseScript.detachEvents();
        this.OrbitCameraInputTouchScript.detachEvents();
    }


    setSliderValue(value){
        const splates = this.app.root.findByTag('gaussian');
        splates.forEach(splat => {
            // splat.script.pointCloud.setSplatTransit(value);
            splat.script.pointCloud.setSplatTransit_2(value);
        });
    }


    // shape: box, sphere, cylinder, cone, plane, disc, capsule
    // color: new pc.Color(1, 1, 0.8)
    add_shape(position, lookAt, shape, color){
        const entity = new pc.Entity(shape);
        entity.addComponent('render', {
            type: shape,
            material: createColorMaterial(color)
        });
        entity.setPosition(position.x, position.y, position.z);
        // entity.rotate(0, 0, 90);
        // entity.up.set(270, 0, 0); 
        entity.setLocalScale(0.25, 0.15, 0.4);
        if (lookAt != null){
            entity.lookAt(lookAt.x, lookAt.y, lookAt.z);
        }
        this.app.root.addChild(entity)
        return entity
    }

    get_splats(){
        // const ret = []
        // this.app.root.children.forEach((a) => {
        //     if (a.gsplat && a.gsplat.material.name === 'splatMaterial') {
        //         ret.push(a.gsplat);
        //     }
        // })
        const ret = this.app.root.findByTag('gaussian');
        return ret;
    }

    init_listeners(){
        const assets = this.app.assets._assets;
        watch(() => this.message.lod, (newVal, oldVal) => {
            // console.log(`LOD changed from ${oldVal} to ${newVal}`);
            this.app.root.children.forEach((a) => {
                if (a.gsplat && a.gsplat.material.name === 'splatMaterial') {
                    a.gsplat.material.setParameter('enableLod', newVal);
                }
            })
        });
    }

    bind_script(entity, script_name, attributes){
        if (!entity.script){
            entity.addComponent('script');
        }
        if (this.app.scripts.has(script_name)){
            // console.log(`script '${script_name}' already exists, skipping creation`)
        } else {
            scriptMapping[script_name].init();
        }
        if (entity.script.has(script_name)){
            // console.log(`entity already has script '${script_name}', skipping creation`)
            const script = entity.script.get(script_name);
            for (const [key, value] of Object.entries(attributes)){
                if (script.__attributes.hasOwnProperty(key) && script[key] !== value){
                    console.log(`script '${script_name}' attribute '${key}' changed from ${script[key]} to ${value}`)
                    script[key] = value;
                }
            }
        } else {
            entity.script.create(script_name, {
                attributes: attributes
            });
        }
        return entity.script.get(script_name);
    }

    async loadDefaultAssets(index = 0) {
        this.scene_reactive = default_scenes[index];
        this.sync_scene(this.scene_reactive);
    }

    removeEntityById(id){
        const entity = this.scene_mapping.entities[id];
        if (entity){
            const tracker = this.camera.script['traceScreenPosition'];
            if (tracker){
                tracker.removeEntity(entity.ref);
            }
            entity.ref.destroy();
            delete this.scene_mapping.entities[id];
            console.log('removeEntityById success', id)
            return true;
        }
    }

    async sync_scene() {
        if (!this.scene_version) {
            this.scene_version = 0;
        }
        this.scene_version += 1;
        const current_version = this.scene_version;
        if (window.gc) {
            window.gc();
        }
        const scene = this.scene_reactive;
        if (!this.scene_mapping) {
            this.scene_mapping = {
                entities: {},
                skybox:{}
            };
        }
        const scene_mapping = this.scene_mapping;


        // ------------ gizmo ------------
        if (scene.gizmo.enabled) {
            if (!this.gizmoHandler) {
                this.init_gizmoHandler();
            }
            if (['scale', 'translate', 'rotate'].includes(scene.gizmo.mode)) {
                this.gizmoHandler.switch(scene.gizmo.mode);
            }
        } else if (this.gizmoHandler) {
            this.gizmoHandler.destroy();
            this.gizmoHandler = null;
        }

        // ------------ camera ------------
        if (scene.camera.mode) {
            let camera_script = null;
            const pos = scene.camera.position || [1, 1, 1];
            if (['fly', 'orbit'].includes(scene.camera.mode)) {
                camera_script = this.switch_camera_script(scene.camera.mode + 'Camera');
                
            }

            if (camera_script){
                const flyCamera = this.camera.script.flyCamera;
                if (scene.camera.fov) {
                    console.log('set fov', scene.camera.fov)
                    this.camera.camera.fov = scene.camera.fov;
                }
                if (scene.camera.cameraCollision) {
                    if (scene.camera.cameraCollision.radius) {  
                        this.camera.rigidbody.radius = scene.camera.cameraCollision.radius;
                    } else {
                        this.camera.rigidbody.radius = 1.5;
                    }
                    if (scene.camera.cameraCollision.height) {
                        this.camera.rigidbody.height = scene.camera.cameraCollision.height;
                    } else {
                        this.camera.rigidbody.height = 1.5;
                    }
                }
                if (scene.camera.flyCamera) {
                    if (scene.camera.flyCamera.eXMax) {
                        flyCamera.eXMax = scene.camera.flyCamera.eXMax;
                    } else {
                        flyCamera.eXMax = 90;
                    }
                    if (scene.camera.flyCamera.eXMin) {
                        flyCamera.eXMin = scene.camera.flyCamera.eXMin;
                    } else {
                        flyCamera.eXMin = -90;
                    }
                }
                if (scene.camera.clearColor) {
                    this.camera.camera.clearColor = new pc.Color(scene.camera.clearColor[0], scene.camera.clearColor[1], scene.camera.clearColor[2], scene.camera.clearColor[3]);
                } else {
                    this.camera.camera.clearColor = new pc.Color(0, 0, 0, 1);
                }
                if (scene.camera.lockY) { 
                    flyCamera.lockY = true;
                    this.camera.rigidbody.linearFactor = new pc.Vec3(1, 0, 1);

                } else {
                    flyCamera.lockY = false;
                    this.camera.rigidbody.linearFactor = new pc.Vec3(1, 1, 1);
                }
                switch (scene.camera.mode){
                    case 'fly':
                        const newPosition = new pc.Vec3(pos[0], pos[1], pos[2]);
                        if (!this.camera.getPosition().equals(newPosition)) {
                            this.camera.setPosition(pos[0], pos[1], pos[2]);
                            this.camera.rigidbody.teleport(newPosition, this.camera.getRotation());
                        }
                        const eulerAngles = scene.camera.eulerAngles;
                        if (eulerAngles) {
                            this.camera.setLocalEulerAngles(eulerAngles[0], eulerAngles[1], eulerAngles[2]);
                            camera_script.setEulerAngles({x:eulerAngles[0], y:eulerAngles[1], z:eulerAngles[2]});
                        }
                        
                        break;
                    case 'orbit':
                        const lookat = scene.camera.lookat || [0, 0, 0];
                        camera_script.resetAndLookAtPoint(
                            new pc.Vec3(pos[0], pos[1], pos[2]),
                            new pc.Vec3(lookat[0], lookat[1], lookat[2])
                        );
                        
                        // Set camera distance and pitch angle limits
                        if (scene.camera.distanceMax !== undefined) {
                            camera_script.distanceMax = scene.camera.distanceMax;
                        } else {
                            camera_script.distanceMax = 0;
                        }
                        if (scene.camera.distanceMin !== undefined) {
                            camera_script.distanceMin = scene.camera.distanceMin;
                        } else {
                            camera_script.distanceMin = 0;
                        }
                        if (scene.camera.pitchAngleMax !== undefined) {
                            camera_script.pitchAngleMax = scene.camera.pitchAngleMax;
                        } else {
                            camera_script.pitchAngleMax = 90;
                        }
                        if (scene.camera.pitchAngleMin !== undefined) {
                            camera_script.pitchAngleMin = scene.camera.pitchAngleMin;
                        } else {
                            camera_script.pitchAngleMin = -90;
                        }
                        // if (scene.camera.distance !== undefined) {
                        //     camera_script.distance = scene.camera.distance;
                        // }
                        break;
                }
            }

            if (scene.camera.ammoDebugDrawer && scene.camera.ammoDebugDrawer.enabled){
                const renderer = new AmmoDebugDrawer({
                    limit: {
                        entity: this.camera,
                        distance: 50
                    }
                });
                renderer.enabled = true;
            }
        }

        let cubemap = null;
        // ------------ skybox ------------
        if (scene.skybox && scene.skybox.url && (scene_mapping.skybox.url !== scene.skybox.url)) {
            scene_mapping.skybox.url = scene.skybox.url;
            cubemap = this.assets.panoCubemaps[scene.skybox.url];
            if (!cubemap){  
                cubemap = await panorama.createPanoCubemap(this.app, scene.skybox.url);
                const assetKey = getAssetKey(scene.skybox.url);
                this.assets.panoCubemaps[assetKey] = cubemap;
            }
            panorama.changePanoSkybox(this.app, cubemap, scene.skybox);

            // ------------ skybox projected ------------

            // const mesh = this.assets.simpleMeshes['mesh1'];
            // const viewPosition = new pc.Vec3(0, 1, 5);

            // // 假设你已经有了skyboxTexture和自定义mesh
            // const skyboxProjectedEntity = simpleMesh.createSkyboxProjectedEntity(this.app, mesh, cubemap, {
            //     position: new pc.Vec3(0, 0, 0),
            //     rotation: new pc.Vec3(0, 0, 0),
            //     scale: new pc.Vec3(1, 1, 1),
            //     materialOptions: {
            //         viewPosition: viewPosition,
            //         reflectivity: 1.0,
            //         metalness: 1.0,
            //         useEnvironment: true,
            //         useReflection: true
            //     }
            // });
            // // 将实体添加到场景
            // this.app.root.addChild(skyboxProjectedEntity.entity);
            // this.currentEntity = skyboxProjectedEntity.entity;
        }


        // ------------ entities ------------
        // 1. Remove entities that are no longer needed
        for (const [id, entity] of Object.entries(scene_mapping.entities)) {
            if (!scene.data.entities[id]) {
                console.log('removeEntityById based on key', id)
                this.removeEntityById(id);
            }
        }

        // 2. Create new entities or update existing ones
        for (const [id, entityData] of Object.entries(scene.data.entities)) {
            if (this.scene_version !== current_version) {
                return;
            }
            let entity = null;
            let entity_mapping = scene_mapping.entities[id];
            if (entity_mapping) {
                if ( entity_mapping.type !== entityData.type || entity_mapping.url !== entityData.url) {
                    console.log('removeEntityById based on url or type', id)
                    this.removeEntityById(id);
                } else {
                    entity = entity_mapping.ref;
                }
            }

            // If the entity does not exist or the URL has changed, create a new entity
            if (!entity) {
                if (['gsplat', 'glb'].includes(entityData.type)) {
                    entity = await this.loadModel(entityData.url, id);
                    entity.url = entityData.url;
                    scene_mapping.entities[id] = { ref: entity, type: entityData.type, url: entityData.url };
                } else if (entityData.type === 'presetObj') {
                    let presetResource = this.assets.presetAssets[entityData.presetKey];
                    if (!presetResource || !presetResource.vertexBuffer) {
                        if (entityData.presetKey === 'cameraMesh') {
                            presetResource = simpleMesh.createCameraMesh(this.device, entityData);
                            this.assets.presetAssets[entityData.presetKey] = presetResource;
                        } else if (entityData.presetKey === 'boxMesh') {
                            presetResource = simpleMesh.createBoxMesh(this.device, entityData);
                            this.assets.presetAssets[entityData.presetKey] = presetResource;
                        } else if (entityData.presetKey === 'invisibleMesh') {
                            presetResource = simpleMesh.createInvisibleMesh(this.device, entityData);
                            this.assets.presetAssets[entityData.presetKey] = presetResource;
                        }
                        else {
                            console.warn('preset resource not found: ', entityData.presetKey);
                        }
                    }
                    const mesh_instance = simpleMesh.createMeshInstance(presetResource);
                    entity = new pc.Entity();
                    entity.addComponent('render', {
                        meshInstances: [mesh_instance]
                    });
                    this.app.root.addChild(entity);
                    scene_mapping.entities[id] = { ref: entity, type: entityData.type, presetKey: entityData.presetKey};
                } else if (entityData.type === 'imageSquare') {
                    const resource_key = getAssetKey(entityData.url);
                    console.log('resource_key', entityData.url, resource_key)
                    let texture = this.assets.imageTextures[resource_key];
                    if (!texture) {
                        const { texture: t } = await simpleMesh.createTextureFromUrl(this.app, entityData.url);
                        texture = t;
                        this.assets.imageTextures[resource_key] = texture;
                    }
                    entity = await simpleMesh.createBitmapEntity(this.app, texture, entityData);
                    this.app.root.addChild(entity);
                    scene_mapping.entities[id] = { ref: entity, type: entityData.type, url: entityData.url };

                    // Set the bounding box for the entity
                    if (entity.render && entity.render.meshInstances[0]) {
                        const aabb = entity.render.meshInstances[0].aabb;
                        aabb.halfExtents.set(
                            entityData.width / 2,
                            0.05,                 // Half of the thickness
                            entityData.height / 2
                        );
                        // Ensure the bounding box center is correct
                        aabb.center.set(0, 0, 0);

                        // Update the mesh instance's bounding box
                        entity.render.meshInstances[0].setCustomAabb(aabb);
                    }
                } else if (entityData.type === 'simpleMesh') {
                    let presetResource = this.assets.simpleMeshes[id];
                    if (!presetResource || !presetResource.vertexBuffer) {
                        presetResource = simpleMesh.createMeshFromPoints(this.device, entityData.points, entityData);
                        this.assets.simpleMeshes[id] = presetResource;
                    }
                    const mesh_instance = simpleMesh.createMeshInstance(presetResource, entityData);
                    mesh_instance.material.cull = pc.CULLFACE_NONE;
                    mesh_instance.material.update();

                    entity = new pc.Entity();
                    entity.addComponent('render', {
                        meshInstances: [mesh_instance]
                    });

                    this.app.root.addChild(entity);
                    scene_mapping.entities[id] = { ref: entity, type: entityData.type, presetKey: entityData.presetKey };
                } else if (entityData.type === 'textureSphere' && entityData.url) {
                    console.log('generate textureSphere', entityData.url)
                    const resource_key = getAssetKey(entityData.url);
                    let texture = this.assets.imageTextures[resource_key];
                    if (!texture) {
                        const { texture: t } = await simpleMesh.createTextureFromUrl(this.app, entityData.url);
                        texture = t;
                        this.assets.imageTextures[resource_key] = texture;
                    }
                    console.log('texture----', entityData.url, texture)

                    // texture = await simpleMesh.createTextureFromUrl(this.app, '/pano2.jpg'); 
                    const sphereInstance = simpleMesh.createTextureSphereInstance(this.device, texture);
                    entity = new pc.Entity();
                    entity.addComponent('render', {
                        meshInstances: [sphereInstance]
                    });
                    this.app.root.addChild(entity);
                    scene_mapping.entities[id] = { ref: entity, type: entityData.type, url: entityData.url };

                    if (entity.render && entity.render.meshInstances[0]) {
                        const aabb = entity.render.meshInstances[0].aabb;
                        aabb.halfExtents.set(
                            entityData.width / 2,
                            0.05,                 // Half of the thickness
                            entityData.height / 2
                        );
                        // Ensure the bounding box center is correct
                        aabb.center.set(0, 0, 0);

                        // Update the mesh instance's bounding box
                        entity.render.meshInstances[0].setCustomAabb(aabb);
                    }
                } else {
                    console.warn('entity type not supported: ', entityData.type);
                }
            }

            // 如果需要，更新entity的属性
            if (entity) {
                if (!entity.tags.has(id)) {
                    entity.tags.add(id);
                }
                entity.scene_id = 'entity_' + id;

                if (entityData.visible === false) {
                    entity.render.enabled = false;  // Disable rendering
                } else {
                    if (entity.render) {
                        entity.render.enabled = true;  // Enable rendering
                    }
                }

                // --------------- Update entity transform ---------------
                const pos = entityData.position;
                const rot = entityData.rotation;
                const scale = entityData.scale;

                if (pos && !entity.getPosition().equals(new pc.Vec3(pos[0], pos[1], pos[2]))) {
                    entity.setPosition(pos[0], pos[1], pos[2]);
                }

                const currentRot = entity.getEulerAngles();
                if (rot && (currentRot.x !== rot[0] || currentRot.y !== rot[1] || currentRot.z !== rot[2])) {
                    entity.setEulerAngles(rot[0], rot[1], rot[2]);
                }

                const currentScale = entity.getLocalScale();
                if (scale && !currentScale.equals(new pc.Vec3(scale[0], scale[1], scale[2]))) {
                    entity.setLocalScale(scale[0], scale[1], scale[2]);
                }
                // --------------- Update entity transform ---------------

                if (entityData.scripts) {
                    for (const [script_name, attributes] of Object.entries(entityData.scripts)) {
                        const script = this.bind_script(entity, script_name, attributes);
                        if (attributes.hasOwnProperty('enabled') && script) {
                            script.enabled = attributes.enabled;
                        }
                    }
                }
                if (entityData.enabled !== undefined) {
                    entity.enabled = entityData.enabled;
                }

                if (entityData.collision !== undefined) {
                    const collisionSettings = entityData.collision;
                    // Add collision component
                    let shouldUpdateCollision = false;

                    // Check if the entity already has a collision component
                    const existingCollision = entity.collision;
                    const existingRigidbody = entity.rigidbody;
                    const collision_type = collisionSettings.type || 'box';

                    // Check if collision settings have changed
                    if (!existingCollision ||
                        existingCollision.type !== collision_type) {

                        shouldUpdateCollision = true;

                        // If an existing collision component exists, remove it
                        if (existingCollision) {
                            entity.ref.removeComponent('collision');
                        }
                        if (existingRigidbody) {
                            entity.ref.removeComponent('rigidbody');
                        }


                    }

                    if (shouldUpdateCollision) {
                        switch (collision_type) {
                            case 'box':
                                const collision = entity.addComponent('collision', {
                                    type: 'box',
                                });
                                if (entity.render) {
                                    const meshInstances = entity.render.meshInstances;
                                    if (meshInstances.length > 0) {
                                        const aabb = meshInstances[0].aabb;
                                        collision.halfExtents = aabb.halfExtents.clone();
                                    }
                                } else if (entity.gsplat) {
                                    console.log('entity----------', entity)
                                    collision.halfExtents = entity.gsplat.customAabb.halfExtents.clone();
                                }
                                break;
                            case 'mesh':
                                if (entity.render) {
                                    let presetResource = this.assets.simpleMeshes[id];
                                    const collision = entity.addComponent(
                                        'collision', {
                                        type: 'mesh',
                                        render: { meshes: [presetResource] },
                                        // convexHull: true
                                    });
                                }
                                break;
                            default:
                                console.warn('collision type not supported: ', collisionSettings.type);
                        }

                        // Add rigidbody component
                        const rigidbody = entity.addComponent('rigidbody');
                        const rigidbodyType = collisionSettings.rigidbody?.type || 'static';
                        rigidbody.type = rigidbodyType; // Static rigidbody, will not move
                        rigidbody.friction = collisionSettings.rigidbody?.friction || 0.5;
                        rigidbody.restitution = collisionSettings.rigidbody?.restitution || 0.5;
                    }
                }
            }
        }

    }

    update_scene_reactive(){
        const scene_mapping = this.scene_mapping;
        if (this.scene_reactive){
            // -------------- entities --------------
            for (const [id, entity] of Object.entries(scene_mapping.entities)){
                const scene_entity = this.scene_reactive.data.entities[id];
                scene_entity.url = entity.url;
                let t = entity.ref.getPosition()
                scene_entity.position = [t.x, t.y, t.z];
                t = entity.ref.getEulerAngles();
                scene_entity.rotation = [t.x, t.y, t.z];
                t = entity.ref.getLocalScale();
                scene_entity.scale = [t.x, t.y, t.z];
                scene_entity.enabled = entity.ref.enabled;

                if (scene_entity.scripts){
                    for (const [script_name, attributes] of Object.entries(scene_entity.scripts)){
                        if (scene_entity.hasOwnProperty(script_name)){
                            for (const [key, value] of Object.entries(attributes)){
                                scene_entity[script_name][key] = value;
                            }
                        }
                    }
                }
            }

            // --------------- camera ---------------
            const camera = this.scene_reactive.camera;
            camera.position = [this.camera.localPosition.x, this.camera.localPosition.y, this.camera.localPosition.z];
            // camera.lookAt = [this.camera.localEulerAngles.x, this.camera.localEulerAngles.y, this.camera.localEulerAngles.z];
            const eulerAngles = this.camera.getEulerAngles();
            camera.eulerAngles = [eulerAngles.x, eulerAngles.y, eulerAngles.z];
        }
        return this.scene_reactive;
    }

    traceScreenPosition(entity, occlusionUpdateInterval = -1) {
        // 1. Ensure the script type is registered
        if (!this.camera.script.has('traceScreenPosition')) {
            pc.registerScript(TraceScreenPosition, 'traceScreenPosition');
            this.camera.script.create('traceScreenPosition');
            const tracker = this.camera.script['traceScreenPosition'];
            tracker.events = this.events;
        }
        
        // 2. Get the global script instance
        const tracker = this.camera.script['traceScreenPosition'];
        
        // 3. Handle the input entity (supports string ID or entity object)
        let targetEntity = entity;
        if (typeof entity === 'string') {
            if (!this.scene_mapping?.entities?.[entity]?.ref) {
                throw new Error(`Cannot find entity with ID "${entity}"`);
            }
            targetEntity = this.scene_mapping.entities[entity].ref;
        }
        
        // 4. Set occlusion detection interval (if provided)
        if (occlusionUpdateInterval >= 0) {
            tracker.setOcclusionInterval(occlusionUpdateInterval);
        }
        
        // 5. Add entity to tracking list
        tracker.addEntity(targetEntity);
        return true;
    }

    syncAllScreenPos(){
        const tracker = this.camera.script['traceScreenPosition'];
        if (tracker){
            tracker.syncAll = true;
        }
    }

    sync_asset_info(){
        const assets = this.app.assets._assets;
        const ret = []
        assets.forEach((a) =>{
            if (a.type === "gsplat" & a.resource){
                ret.push({ 
                    name: a._name, 
                    count: a.resource.splatData.numSplats 
                })
            }
        })

        // Add marker for 'gaussian_copy' entity information
        const gaussianCopies = this.app.root.findByTag('gsplat_copy');
        gaussianCopies.forEach((entity) => {
            if (entity.gsplat) {
                ret.push({
                    name: entity.name + ' (copy)',
                    count: entity.gsplat.instance.gsplatData.numSplats
                });
            }
        });
        
        this.message['assets'] = ret;
        return ret;
    }

    async run(){
        pc.WasmModule.setConfig('Ammo', {
            glueUrl: `/scripts/ammo/ammo.wasm.js`,
            wasmUrl: `/scripts/ammo/ammo.wasm.wasm`,
            fallbackUrl: `/scripts/ammo/ammo.js`
        });
        await new Promise((resolve) => {
            pc.WasmModule.getInstance('Ammo', () => resolve());
        });
        

        window.pc = pc;
        // class for handling gizmos

        const gfxOptions = {
            deviceTypes: [deviceType],
            // glslangUrl: '/scripts/lib/glslang/glslang.js',
            // twgslUrl: '/scripts/lib/twgsl/twgsl.js',

            antialias: this.antialias,
        };

        const device = await pc.createGraphicsDevice(this.canvas, gfxOptions);
        this.device = device;
        device.antialias = this.antialias;
        const createOptions = new pc.AppOptions();
        createOptions.xr = pc.XrManager;
        createOptions.graphicsDevice = device;
        createOptions.mouse = new pc.Mouse(this.canvas);
        createOptions.touch = new pc.TouchDevice(this.canvas);
        createOptions.keyboard = new pc.Keyboard(window, {
            // preventDefault: true,
            // stopPropagation: true,
            // capture: true,
            // Only capture keyboard events on the canvas element
            element: this.canvas
        });
        createOptions.lightmapper = pc.Lightmapper;

        // Add rendering options
        createOptions.graphicsDeviceOptions = {
            preferWebGl2: true,
            antialias: this.antialias,
            alpha: false,
            preserveDrawingBuffer: false
        };

        createOptions.physics = {
            enabled: true,
            engine: Ammo
        };

        // Set scene rendering options
        this.app.scene = new pc.Scene(device);
        // this.app.scene.gammaCorrection = pc.GAMMA_SRGB;
        // this.app.scene.toneMapping = pc.TONEMAP_ACES;
        this.app.scene.exposure = 1;

        // this.app.scene.skyboxMip = 3;
        // this.app.scene.skyboxIntensity = 0.6;
        // this.app.scene.envAtlas = assets.helipad.resource;

        createOptions.componentSystems = [
            pc.RenderComponentSystem,
            pc.CameraComponentSystem,
            pc.LightComponentSystem,
            pc.ScriptComponentSystem,
            pc.GSplatComponentSystem,
            // pc.ParticleSystemComponentSystem,
            pc.ElementComponentSystem,
            pc.ScreenComponentSystem,
            pc.CollisionComponentSystem,
            pc.RigidBodyComponentSystem,
        ];
        createOptions.resourceHandlers = [
            pc.TextureHandler, 
            pc.ContainerHandler, 
            pc.ScriptHandler, 
            pc.GSplatHandler,
            pc.JsonHandler,
            pc.FontHandler
        ];

        this.app.init(createOptions);

        this.app.systems.rigidbody.fixedTimeStep = 1 / 60;
        this.app.systems.rigidbody.maxSubSteps = 1;
        const device_1 = pc.Application.getApplication().graphicsDevice;
        // if (highTierDevice) {
        //     // Use the default device pixel ratio of the device
        //     device.maxPixelRatio = window.devicePixelRatio;
        // } else {
        //     // Use the CSS resolution device pixel ratio
        //     device.maxPixelRatio = 1;
        // }
        
        if (this.message.maxPixelRatio){
            device_1.maxPixelRatio = this.message.maxPixelRatio;
        } else {
            device_1.maxPixelRatio = 1.5;
        }

        // set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        this.app.setCanvasResolution(pc.RESOLUTION_AUTO);

        // ensure canvas is resized when window changes size
        const resize = () => this.app.resizeCanvas();
        window.addEventListener('resize', resize);

        this.app.start();

        this.init_camera();
        this.init_gizmoHandler();
        this.routeFly = new RouteFly(this.app, this.device, this.canvas, this.camera, this.gizmoHandler);
        
        // this.initParticleSystem();

        // create 3-point lighting
        const backLight = new pc.Entity('light');
        backLight.addComponent('light', {
            intensity: 0.5
        });
        this.app.root.addChild(backLight);
        backLight.setEulerAngles(-60, 0, 90);

        const fillLight = new pc.Entity('light');
        fillLight.addComponent('light', {
            intensity: 0.5
        });
        this.app.root.addChild(fillLight);
        fillLight.setEulerAngles(45, 0, 0);

        const keyLight = new pc.Entity('light');
        keyLight.addComponent('light', {
            intensity: 1
        });
        this.app.root.addChild(keyLight);
        keyLight.setEulerAngles(0, 0, -60);


        // Initialize grid helper
        this.gridHelper = new GridHelper(this.app);

        this.app.on('update', () => {
            if (this.enable_grid) {
                this.gridHelper.draw();
            }
            if (this.points.length > 0) {
                this.app.drawLines(this.points, pc.Color.WHITE);
            }
            // this.update_scene_reactive()
        });

        this.app.on('destroy', () => {
            this.gizmoHandler.destroy();
            window.removeEventListener('resize', resize);
            window.removeEventListener('keydown', keydown);
            window.removeEventListener('keyup', keyup);
            window.removeEventListener('keypress', keypress);
            window.removeEventListener('pointerdown', onPointerDown);
        });

        this.init_listeners()

        if (this.loadDefault) {
            console.log('loadDefault', this.loadDefault)
            this.loadDefaultAssets(this.loadDefault -1);
        }else{
            this.loadDefaultAssets(0);
        }
    }

    // captureCurrentView() {
    //     if (!this.currentEntity) return;

    //     const texture = simpleMesh.captureAndApplyTexture(this.app, this.currentEntity, {
    //         width: 1024,
    //         height: 1024,
    //         camera: this.camera.camera,
    //         padding: 0.1  // 10% boundary padding
    //     });

    //     // 可选：保存纹理
    //     this.saveTextureToFile(texture, 'captured-texture.png');
    // }

    showMiniStats(){
        if (!this.mini_stats){
            this.mini_stats = init_mini_stats(this.app);
        }
        this.mini_stats.enabled = true;
    }

    hideMiniStats(){
        if (this.mini_stats){
            this.mini_stats.enabled = false;
        }
    }


    reset_ammo(){
        this.app.systems.rigidbody.destroy();
        this.app.systems.collision.destroy();

        // Recreate rigidbody and collision systems
        this.app.systems.rigidbody = new pc.RigidBodyComponentSystem(this.app);
        this.app.systems.collision = new pc.CollisionComponentSystem(this.app);
    }

    show_text(message, pos, euler=[0, 0, 1], color=[1, 1, 1, 1]){
        // First look for font in app's registered global assets
        let fontAsset = this.app.assets.find('font_arial', 'font');
        
        if (!fontAsset) {
            // If not found, create new asset and load asynchronously
            fontAsset = new pc.Asset('font_arial', 'font', { url: '/fonts/arial.json' });
            this.app.assets.add(fontAsset);
            
            // Load asynchronously, call show_text again after loading
            new Promise((resolve, reject) => {
                fontAsset.once('load', () => resolve());
                fontAsset.once('error', (err) => reject(err));
                this.app.assets.load(fontAsset);
            }).then(() => {
                // After loading, run show_text again with same parameters
                this.show_text(message, pos, euler, color);
            }).catch((err) => {
                console.error('Font loading failed:', err);
            });
            
            return; // Wait for asynchronous loading to complete before calling again
        }

        // Create a text element-based entity
        const text = new pc.Entity();
        text.addComponent('element', {
            anchor: [0.5, 0.5, 0.5, 0.5],
            fontAsset: fontAsset,
            fontSize: 1,
            pivot: [0, 0.5],
            text: message,
            type: pc.ELEMENTTYPE_TEXT,
            color: color,
        });
        text.setLocalPosition(pos[0], pos[1], pos[2]);
        text.setLocalEulerAngles(euler[0], euler[1], euler[2]);
        
        // Set text to be double-sided
        if (text.element && text.element.material) {
            text.element.material.cull = pc.CULLFACE_NONE;
            text.element.material.update();
        }
        console.log(text)
        
        this.app.root.addChild(text);
    }

    // Get all splat entities
    getSplatEntities() {
        return this.app.root.findByTag('gaussian');
    }

    testDistance() {
        const distanceMeasure = new DistanceMeasure(this.app, this.device, this.camera, this.gizmoHandler);

        // Set scale and unit (e.g., convert scene units to centimeters)
        distanceMeasure.setScaleAndUnit(1.5, 'm');

        // Add measurement points
        distanceMeasure.addMeasurePoint(new pc.Vec3(0, 0, 0));
        distanceMeasure.addMeasurePoint(new pc.Vec3(1, 0, 0));
        distanceMeasure.addMeasurePoint(new pc.Vec3(2, 1, 0));
    }

    testRectangle(){
        // Instantiate
        const rectanglePlane = new RectanglePlane(this.app, this.device, this.camera, this.gizmoHandler);

        // Add three control points
        rectanglePlane.addControlPoint(new pc.Vec3(0, 0, 0));
        rectanglePlane.addControlPoint(new pc.Vec3(5, 0, 0));
        rectanglePlane.addControlPoint(new pc.Vec3(2, 3, 0));

        // Get rectangle information
        const info = rectanglePlane.getRectangleInfo();
        console.log('Rectangle area:', info.area);
    }

}

export { Viewer };
