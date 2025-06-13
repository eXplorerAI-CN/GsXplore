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

        // 添加用于跟踪当前 fly 状态的属性
        this.currentFlyFunction = null;
        this.isFlying = false;
        this.flyRecordVideo = false;
        this.flyScreenshotScript = null;
        this.cameraMeshSize = 0.5;

        // 监听gizmo指针抬起事件，当移动camera mark后重新绘制飞行路径
        if (this.gizmoHandler && this.gizmoHandler.eventHandler) {
            this.gizmoHandler.eventHandler.on('gizmo:pointer:up', (entity) => {
                // 获取被移动实体在camera marks中的索引
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
        // 如果已经在飞行中，先停止当前的飞行
        if (this.isFlying) {
            this.stopFly();
        }

        if (this.gizmoHandler) {
            this.gizmoHandler.clear();
            this.gizmoHandler._ignorePicker = true;
        }

        // 如果要录制视频，检查canvas尺寸
        if (recordVideo) {
            const canvasWidth = this.canvas.width;
            const canvasHeight = this.canvas.height;

            if (canvasWidth % 2 !== 0 || canvasHeight % 2 !== 0) {
                console.warn(`Canvas尺寸不是偶数(${canvasWidth}x${canvasHeight})，H.264编码要求偶数尺寸`);
                console.warn('系统将自动调整为最接近的偶数尺寸');
            }
        }

        const keyPoints = this.camera_marks.map(c => {
            return {
                position: c.entity.getPosition(),
                eulerAngles: c.entity.getEulerAngles(),
                fillCountFactor: c.fillCountFactor || 1
            }
        });
        let positions = keyPoints.map(p => p.position);

        this.clean_line();
        this.camera_marks.forEach(c => {
            c.entity.enabled = false;
        });

        // 计算每个关键点的lookat点
        let lookAtPoints = keyPoints.map(p => {
            return this.calculateLookAtFromEuler(p.position, p.eulerAngles);
        });
        
        // 计算不同节点的插入数量
        let fillCounts = keyPoints.map(p => p.fillCountFactor * fill_count);

        positions = catmull_rom_curve(positions, fillCounts, this.loop);
        // 对lookat点也进行插值
        lookAtPoints = catmull_rom_curve(lookAtPoints, fillCounts, this.loop);

        let cursorIndex = 0

        // 初始化截图或视频录制
        if (capture || recordVideo) {
            if (!this.screenshotScript) {
                console.log('------------初始化截图/录制工具------------');
                this.screenshotScript = new Screenshot(this.app, this.camera, this.canvas.width, this.canvas.height);
                this.screenshotScript.init();
            }
        }

        // 如果是录制视频，需要异步初始化
        if (recordVideo) {
            this.screenshotScript.initVideoRecording(frameRate).then(success => {
                if (success) {
                    console.log('视频录制初始化成功，准备开始录制路径飞行');
                } else {
                    console.error('视频录制初始化失败，将使用截图模式');
                    recordVideo = false;
                    capture = true;
                }
            }).catch(error => {
                console.error('视频录制初始化错误:', error);
                recordVideo = false;
                capture = true;
            });
        }

        // 设置飞行状态
        this.isFlying = true;
        this.flyRecordVideo = recordVideo;
        this.flyScreenshotScript = this.screenshotScript;

        // 创建一个具名的更新函数，以便后续能够移除它
        const updateFunction = () => {
            if (cursorIndex < positions.length) {
                this.camera.setPosition(positions[cursorIndex].x, positions[cursorIndex].y, positions[cursorIndex].z);
                this.camera.lookAt(lookAtPoints[cursorIndex].x, lookAtPoints[cursorIndex].y, lookAtPoints[cursorIndex].z);

                if (this.screenshotScript) {
                    if (recordVideo && this.screenshotScript.isRecording) {
                        // 录制视频帧
                        this.screenshotScript.captureVideoFrame(cursorIndex);
                    } else if (capture) {
                        // 截图
                        this.screenshotScript.capture('screenshot_' + cursorIndex);
                    }
                }
            }
            cursorIndex++;
            if (cursorIndex >= positions.length) {
                // 动画结束，清理状态
                this._finishFly(recordVideo, autoDownload);
            }
        };

        // 保存当前的更新函数引用
        this.currentFlyFunction = updateFunction;
        
        // 使用具名函数注册事件
        this.app.on('update', updateFunction);
    }

    /**
     * 完成飞行动作的内部方法
     * @param {boolean} recordVideo - 是否录制视频
     * @param {boolean} autoDownload - 是否自动下载
     */
    _finishFly(recordVideo, autoDownload) {
        // 移除事件监听器
        if (this.currentFlyFunction) {
            this.app.off('update', this.currentFlyFunction);
            this.currentFlyFunction = null;
        }

        // 如果是录制视频，完成录制
        if (recordVideo && this.flyScreenshotScript && this.flyScreenshotScript.isRecording) {
            this.flyScreenshotScript.finishVideoRecording('route_fly_video_' + Date.now(), autoDownload).then((result) => {
                if (result && result.arrayBuffer) {
                    console.log('路径飞行视频录制完成');
                    // 录制后可以手动下载
                    if (this.flyScreenshotScript) {
                        const arrayBuffer = result.arrayBuffer;
                        this.flyScreenshotScript.downloadVideo(arrayBuffer, 'my_custom_video');
                    }
                }
            }).catch(error => {
                console.error('视频录制完成时出错:', error);
            });
        }

        // 恢复相机标记显示并绘制路径线
        this.draw_camera_line();
        this.camera_marks.forEach(c => {
            c.entity.enabled = true;
        });

        // 重置飞行状态
        this.isFlying = false;
        this.flyRecordVideo = false;
        this.flyScreenshotScript = null;
        this.gizmoHandler._ignorePicker = false;
    }

    /**
     * 停止当前的飞行动作
     */
    stopFly() {
        if (!this.isFlying) {
            console.log('当前没有正在进行的飞行动作');
            return;
        }

        console.log('停止飞行动作');
        
        // 立即完成飞行，不进行视频录制的完成操作
        this._finishFly(false, false);
        
        // 如果正在录制视频，停止录制但不保存
        if (this.flyRecordVideo && this.flyScreenshotScript && this.flyScreenshotScript.isRecording) {
            console.log('停止视频录制');
            // 这里可能需要调用停止录制的方法，具体取决于 Screenshot 类的实现
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
     * 从欧拉角计算lookat点的位置
     * @param {pc.Vec3} position - 相机位置
     * @param {pc.Vec3} eulerAngles - 相机欧拉角(度)
     * @param {number} distance - lookat点距离相机的距离
     * @returns {pc.Vec3} lookat点的世界坐标
     */
    calculateLookAtFromEuler(position, eulerAngles, distance = 0.1) {
        // 创建一个临时的四元数，用于从欧拉角计算方向
        const rotation = new pc.Quat().setFromEulerAngles(
            eulerAngles.x,
            eulerAngles.y,
            eulerAngles.z
        );

        // 计算前向方向向量 (负Z轴)
        const forward = new pc.Vec3(0, 0, -1);
        rotation.transformVector(forward, forward).normalize();

        // 根据前向方向和距离计算lookat点
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

    // 添加当前相机位置为机位，如传入index，则在index的机位位置后插入
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
            color: color // 橙色半透明
        });
        
        const mesh_entity = new pc.Entity();
        mesh_entity.addComponent('render', {
            meshInstances: [camera_instance, cube_instance]
        });
        mesh_entity.setPosition(position.x, position.y, position.z);
        mesh_entity.setEulerAngles(eulerAngles.x, eulerAngles.y, eulerAngles.z);

        // // 创建选择辅助小正方体，放置在摄像机上方
        // const cubeSize = 0.2;
        // const cube_mesh = simpleMesh.createBoxMesh(this.device, { size: cubeSize, solid: 'solid' });
        // const cube_instance = simpleMesh.createMeshInstance(cube_mesh, { 
        //     renderMode: 'solid', 
        //     color: [1, 0.5, 0, 1] // 橙色半透明
        // });
        // const cube_entity = new pc.Entity();
        // cube_entity.addComponent('render', {
        //     meshInstances: [cube_instance]
        // });
        // // 将小正方体放置在摄像机上方偏移位置
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
            if (index === 0 || index === points.length - 1) { // 如果是第一个元素，仅添加一次
                accumulator.push(value);
            } else { // 否则，将元素添加两次
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

}

export { RouteFly };