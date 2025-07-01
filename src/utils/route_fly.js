import { catmull_rom_curve } from './curves';
import * as simpleMesh from './simple_mesh';
import { Screenshot } from './screenshot_webgl2';

class RouteFly {
    constructor(app, device, canvas, camera, gizmoHandler) {
        this.app = app;
        this.device = device;
        this.canvas = canvas;
        this.camera = camera;
        this.gizmoHandler = gizmoHandler;
        this.routes = [];
        this.camera_marks = [];
        this.linePoints = [];
        this.app.on('update', () => {
            this.update();
        });
        this.lineColor = { r: 1, g: 1, b: 1, a: 1 };
        this.current_route = null;
        this.loop = false;

        // Add properties to track current fly state
        this.currentFlyFunction = null;
        this.isFlying = false;
        this.flyRecordVideo = false;
        this.flyScreenshotScript = null;
        this.cameraMeshSize = 0.5;

        // Listen for gizmo pointer up event, redraw flight path after moving camera mark
        if (this.gizmoHandler && this.gizmoHandler.eventHandler) {
            this.gizmoHandler.eventHandler.on('gizmo:pointer:up', (entity) => {
                // Get index of moved entity in camera marks
                const cameraMarkIndex = this.camera_marks.findIndex(mark => mark.entity === entity);
                if (cameraMarkIndex !== -1) {
                    this.draw_camera_line();
                }
            });
            this.gizmoHandler.eventHandler.on('gizmo:nodes:attach', (entity) => {
                const cameraMarkIndex = this.camera_marks.findIndex(mark => mark.entity === entity);
                if (cameraMarkIndex !== -1) {
                    this.app.events.fire('routeFly:cameraMarkSelected', {cameraMarkIndex: cameraMarkIndex, entity: entity});
                }
            });
        }
    }

    update() {
        if (this.linePoints.length > 0) {
            this.app.drawLines(this.linePoints, this.lineColor);
        }
    }

    fly(fill_count = 5, capture = false, recordVideo = false, frameRate = 30, autoDownload = true) {
        // If already flying, stop current flight first
        if (this.isFlying) {
            this.stopFly();
        }

        if (this.gizmoHandler) {
            this.gizmoHandler.clear();
            this.gizmoHandler._ignorePicker = true;
        }

        // If recording video, check canvas dimensions
        if (recordVideo) {
            const canvasWidth = this.canvas.width;
            const canvasHeight = this.canvas.height;

            if (canvasWidth % 2 !== 0 || canvasHeight % 2 !== 0) {
                console.warn(`Canvas dimensions are not even (${canvasWidth}x${canvasHeight}), H.264 encoding requires even dimensions`);
                console.warn('System will automatically adjust to nearest even dimensions');
            }
        }

        const keyPoints = this.camera_marks.map(c => {
            return {
                position: c.entity.getPosition(),
                rotation: c.entity.getRotation().clone(),
                fillCountFactor: c.fillCountFactor || 1
            }
        });
        let positions = keyPoints.map(p => p.position);
        let rotations = keyPoints.map(p => p.rotation);

        this.clean_line();
        this.camera_marks.forEach(c => {
            c.entity.enabled = false;
        });

        // Calculate insertion counts for different nodes
        let fillCounts = keyPoints.map(p => p.fillCountFactor * fill_count);

        positions = catmull_rom_curve(positions, fillCounts, this.loop);
        rotations = this.quaternionCurveInterpolation(rotations, fillCounts, this.loop);

        let cursorIndex = 0

        // Initialize screenshot or video recording
        if (capture || recordVideo) {
            if (!this.screenshotScript) {
                console.log('------------Initializing screenshot/recording tools------------');
                this.screenshotScript = new Screenshot(this.app, this.camera, this.canvas.width, this.canvas.height);
                this.screenshotScript.init();
            }
        }

        // If recording video, need asynchronous initialization
        if (recordVideo) {
            this.screenshotScript.initVideoRecording(frameRate).then(success => {
                if (success) {
                    console.log('Video recording initialized successfully, ready to start path flight');
                } else {
                    console.error('Video recording initialization failed, will use screenshot mode');
                    recordVideo = false;
                    capture = true;
                }
            }).catch(error => {
                console.error('Video recording initialization error:', error);
                recordVideo = false;
                capture = true;
            });
        }

        // Set flight state
        this.isFlying = true;
        this.flyRecordVideo = recordVideo;
        this.flyScreenshotScript = this.screenshotScript;

        // Create a named update function for later removal
        const updateFunction = () => {
            if (cursorIndex < positions.length) {
                this.camera.setPosition(positions[cursorIndex].x, positions[cursorIndex].y, positions[cursorIndex].z);
                this.camera.setRotation(rotations[cursorIndex]);

                if (this.screenshotScript) {
                    if (recordVideo && this.screenshotScript.isRecording) {
                        // Record video frame
                        this.screenshotScript.captureVideoFrame(cursorIndex);
                    } else if (capture) {
                        // Take screenshot
                        this.screenshotScript.capture('screenshot_' + cursorIndex);
                    }
                }
            }
            cursorIndex++;
            if (cursorIndex >= positions.length) {
                // Animation ended, clean up state
                this._finishFly(recordVideo, autoDownload);
            }
        };

        // Save current update function reference
        this.currentFlyFunction = updateFunction;
        
        // Register event with named function
        this.app.on('update', updateFunction);
    }

    /**
     * Internal method to complete flight action
     * @param {boolean} recordVideo - Whether recording video
     * @param {boolean} autoDownload - Whether to auto download
     */
    _finishFly(recordVideo, autoDownload) {
        // Remove event listener
        if (this.currentFlyFunction) {
            this.app.off('update', this.currentFlyFunction);
            this.currentFlyFunction = null;
        }

        // If recording video, complete recording
        if (recordVideo && this.flyScreenshotScript && this.flyScreenshotScript.isRecording) {
            this.flyScreenshotScript.finishVideoRecording('route_fly_video_' + Date.now(), autoDownload).then((result) => {
                if (result && result.arrayBuffer) {
                    console.log('Path flight video recording completed');
                    // Can manually download after recording
                    if (this.flyScreenshotScript) {
                        const arrayBuffer = result.arrayBuffer;
                        this.flyScreenshotScript.downloadVideo(arrayBuffer, 'my_custom_video');
                    }
                }
            }).catch(error => {
                console.error('Error completing video recording:', error);
            });
        }

        // Restore camera mark display and draw path line
        this.draw_camera_line();
        this.camera_marks.forEach(c => {
            c.entity.enabled = true;
        });

        // Reset flight state
        this.isFlying = false;
        this.flyRecordVideo = false;
        this.flyScreenshotScript = null;
        this.gizmoHandler._ignorePicker = false;
    }

    /**
     * Stop current flight action
     */
    stopFly() {
        if (!this.isFlying) {
            console.log('No flight action in progress');
            return;
        }

        console.log('Stopping flight action');
        
        // Complete flight immediately, skip video recording completion
        this._finishFly(false, false);
        
        // If recording video, stop recording but don't save
        if (this.flyRecordVideo && this.flyScreenshotScript && this.flyScreenshotScript.isRecording) {
            console.log('Stopping video recording');
            // May need to call stop recording method here, depends on Screenshot class implementation
            // this.flyScreenshotScript.stopRecording();
        }
    }

    getRoute() {
        const route = []
        this.camera_marks.forEach(c => {
            route.push({
                position: c.entity.getPosition(),
                eulerAngles: c.entity.getEulerAngles(),
            })
        })
        return route;
    }

    saveRoute(name) {
        const route = this.getRoute();
        if (this.current_route === null) {
            const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = Math.random() * 16 | 0;
                const v = (c === 'x') ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
            this.routes.push({ name: name, route: route, id: uuid });
        } else {
            const uuid = this.current_route.id;
            const index = this.routes.findIndex(r => r.id === uuid);
            if (index !== -1) {
                this.routes[index] = { name: name, route: route, id: uuid };
            } else {
                this.routes.push({ name: name, route: route, id: uuid });
            }
        }

    }

    clearRoute() {
        this.camera_marks.forEach(c => {
            c.entity.destroy();
        });
        this.camera_marks = [];
        this.clean_line();
    }

    loadRoute(route) {
        this.clearRoute();
        this.current_route = route;
        this.current_route.route.forEach(r => {
            this.addCameraMark(r.position, r.eulerAngles);
        });
        this.draw_camera_line();
    }

    removeCurrentCameraMark() {
        if (this.gizmoHandler._nodes.length > 0) {
            this.removeCameraMark(this.gizmoHandler._nodes[0]);
            this.gizmoHandler.clear();
        }
    }

    removeCameraMark(entity) {
        const index = this.camera_marks.findIndex(c => c.entity === entity);
        if (index !== -1) {
            entity.destroy();
            this.camera_marks.splice(index, 1);
        }
    }

    /**
     * Calculate lookat point position from Euler angles
     * @param {pc.Vec3} position - Camera position
     * @param {pc.Vec3} eulerAngles - Camera Euler angles (degrees)
     * @param {number} distance - Distance from camera to lookat point
     * @returns {pc.Vec3} World coordinates of lookat point
     */
    calculateLookAtFromEuler(position, eulerAngles, distance = 0.1) {
        // Create temporary quaternion for direction calculation from Euler angles
        const rotation = new pc.Quat().setFromEulerAngles(
            eulerAngles.x,
            eulerAngles.y,
            eulerAngles.z
        );

        // Calculate forward direction vector (negative Z axis)
        const forward = new pc.Vec3(0, 0, -1);
        rotation.transformVector(forward, forward).normalize();

        // Calculate lookat point based on forward direction and distance
        const lookAtPoint = new pc.Vec3();
        lookAtPoint.copy(forward).scale(distance).add(position);

        return lookAtPoint;
    }

    draw_camera_line() {
        this.clean_line();

        if (this.camera_marks.length < 2) {
            return;
        }

        let positions = this.camera_marks.map(p => {
            return p.entity.getPosition();
        });

        const line = catmull_rom_curve(positions, new Array(positions.length).fill(12),this.loop);
        if(this.loop){
            line.push(positions[0]);
        }else{
            line.push(positions[positions.length - 1]);
        }
        this.add_line(line);
    }

    add_current_camera(index = -1) {
        const position = this.camera.getPosition().clone();
        const eulerAngles = this.camera.getLocalEulerAngles();
        return this.addCameraMark(position, eulerAngles, index);
    }

    // Add current camera position as camera mark, if index provided, insert after that position
    addCameraMark(position, eulerAngles, index = -1, size = null) {
        const color = [1, 0.5, 0, 1];
        size = size || this.cameraMeshSize;
        const t_mesh = simpleMesh.createCameraMesh(this.device, { size: size, renderMode: 'wireframe' });
        const camera_instance = simpleMesh.createMeshInstance(t_mesh, { renderMode: 'wireframe', color: color });
        
        const cube_size = size / 5;
        const left_point = new pc.Vec3(-cube_size / 2, cube_size * 1.5, -cube_size / 2);
        const cube_mesh = simpleMesh.createBoxMesh(this.device, { 
            min: {x: left_point.x, y: left_point.y, z: left_point.z}, 
            max: {x: left_point.x + cube_size, y: left_point.y + cube_size, z: left_point.z + cube_size}, 
            mode: 'solid' 
        });
        const cube_instance = simpleMesh.createMeshInstance(cube_mesh, {
            renderMode: 'solid',
            color: color // Orange semi-transparent
        });
        
        const mesh_entity = new pc.Entity();
        mesh_entity.addComponent('render', {
            meshInstances: [camera_instance, cube_instance]
        });
        mesh_entity.setPosition(position.x, position.y, position.z);
        mesh_entity.setEulerAngles(eulerAngles.x, eulerAngles.y, eulerAngles.z);

        // // Create selection helper cube, placed above camera
        // const cubeSize = 0.2;
        // const cube_mesh = simpleMesh.createBoxMesh(this.device, { size: cubeSize, solid: 'solid' });
        // const cube_instance = simpleMesh.createMeshInstance(cube_mesh, { 
        //     renderMode: 'solid', 
        //     color: [1, 0.5, 0, 1] // Orange semi-transparent
        // });
        // const cube_entity = new pc.Entity();
        // cube_entity.addComponent('render', {
        //     meshInstances: [cube_instance]
        // });
        // // Place small cube at offset position above camera
        // cube_entity.setLocalPosition(0, 0.8, 0);
        // mesh_entity.addChild(cube_entity);

        this.app.root.addChild(mesh_entity);
        if(index === -1){
            this.camera_marks.push({ 'entity': mesh_entity });
        }else{
            this.camera_marks.splice(index+1, 0, { 'entity': mesh_entity });
        }
        this.draw_camera_line();
    }
    
    removeCameraMark(index){
        if (index !== -1) {
            this.camera_marks[index].entity.destroy();
            this.camera_marks.splice(index, 1);
        }
        this.draw_camera_line();
    }

    clean_line() {
        this.linePoints = [];
    }

    add_line(points) {
        points = points.reduce((accumulator, current, index) => {
            const value = new pc.Vec3(current.x, current.y, current.z);
            if (index === 0 || index === points.length - 1) { // If first element, add only once
                accumulator.push(value);
            } else { // Otherwise, add element twice
                accumulator.push(value, value);
            }
            return accumulator;
        }, []);
        this.linePoints = [...this.linePoints, ...points];
    }

    clean_camera_marks() {
        if (this.camera_marks.length > 0) {
            this.camera_marks.forEach(c => {
                c.entity.destroy();
            });
            this.camera_marks = [];
            this.clean_line();
        }
    }

    // 新增四元数插值方法
    quaternionCurveInterpolation(quaternions, fillCounts, loop = false) {
        if (quaternions.length < 2) return quaternions;
        
        const result = [];
        
        for (let i = 0; i < quaternions.length - 1; i++) {
            const current = quaternions[i];
            const next = quaternions[(i + 1) % quaternions.length];
            const segments = fillCounts[i];
            
            // 添加当前点
            result.push(current.clone());
            
            // 在当前点和下一个点之间插值
            for (let j = 1; j < segments; j++) {
                const t = j / segments;
                const interpolated = new pc.Quat();
                interpolated.slerp(current, next, t);
                result.push(interpolated);
            }
        }
        
        // 添加最后一个点（除非是循环）
        if (!loop) {
            result.push(quaternions[quaternions.length - 1].clone());
        }
        
        return result;
    }

}

export { RouteFly };