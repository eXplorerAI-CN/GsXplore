import * as pc from 'playcanvas';

class TraceScreenPosition extends pc.ScriptType {
    initialize() {
        // 初始化属性
        this.canvasRect = this.app.graphicsDevice.canvas.getBoundingClientRect();
        this.occlusionUpdateInterval = -1;

        // 添加ResizeObserver监听canvas大小变化
        this.resizeObserver = new ResizeObserver(() => {
            const t = this.app.graphicsDevice.canvas.getBoundingClientRect();
            this.canvasRect.width = t.width;
            this.canvasRect.height = t.height;
        });
        this.resizeObserver.observe(this.app.graphicsDevice.canvas);

        // 缓存picker实例
        this.picker = new pc.Picker(this.app, this.app.graphicsDevice.canvas.clientWidth, this.app.graphicsDevice.canvas.clientHeight);
        this.worldLayer = this.app.scene.layers.getLayerByName('World');
        this.pickerLayers = [this.worldLayer];

        // 初始化实体列表
        this.trackedEntities = new Set();

        // 控制检测频率
        this.lastUpdateTime = 0;
        this.camera = null;
        this.syncAll = false;
    }

    // 添加新的监听实体
    addEntity(entity) {
        if (!this.trackedEntities.has(entity)) {
            this.trackedEntities.add(entity);
            return true;
        }
        return false;
    }

    // 移除监听实体
    removeEntity(entity) {
        return this.trackedEntities.delete(entity);
    }

    // 清空所有监听实体
    clearEntities() {
        this.trackedEntities.clear();
    }

    update(dt) {
        const currentTime = new Date().getTime();
        const screenPos = new pc.Vec3();
        if (!this.camera) {
            this.camera = this.app.root.findByName('camera').camera;
        }
        
        // 遍历所有被跟踪的实体
        this.trackedEntities.forEach(entity => {
            this.camera.worldToScreen(entity.getPosition(), screenPos);

            const currentPos = {
                top: screenPos.y / this.canvasRect.height,
                left: screenPos.x / this.canvasRect.width,
                distance: screenPos.z,
                occluded: false
            };

            // 获取或初始化该实体的上一次位置信息
            if (!entity._lastScreenPos) {
                entity._lastScreenPos = {
                    top: 0,
                    left: 0,
                    distance: 0,
                    visible: false,
                    occluded: false
                };
            }

            // 检查是否在屏幕范围内
            currentPos.visible = (currentPos.left > 0 && 
                                currentPos.top > 0 && 
                                currentPos.left < 1 && 
                                currentPos.top < 1) &&
                                currentPos.distance > 0;

            // 检查位置是否发生变化
            const hasChanged = (
                (currentPos.visible === false && entity._lastScreenPos.visible === true) || 
                (currentPos.visible === true && (
                    currentPos.top      !== entity._lastScreenPos.top ||
                    currentPos.left     !== entity._lastScreenPos.left ||
                    currentPos.distance !== entity._lastScreenPos.distance
                    )
                )
            );

            if (hasChanged || this.syncAll) {
                if (this.occlusionUpdateInterval > 0){ 
                    if (currentTime - this.lastUpdateTime > this.occlusionUpdateInterval) {
                            if (currentPos.visible) {
                            // 更新picker的尺寸（如果canvas尺寸改变）
                            if (this.picker.width !== this.app.graphicsDevice.canvas.clientWidth ||
                                this.picker.height !== this.app.graphicsDevice.canvas.clientHeight) {
                                this.picker.resize(this.app.graphicsDevice.canvas.clientWidth, this.app.graphicsDevice.canvas.clientHeight);
                            }
                            this.picker.prepare(camera.camera, this.app.scene, this.pickerLayers);

                            const selection = this.picker.getSelection(
                                screenPos.x,
                                screenPos.y,
                                1, 1
                            );

                            if (selection && selection.length > 0 && selection[0] && selection[0].node && selection[0].node !== entity) {
                                currentPos.occluded = true;
                                currentPos.visible = false;
                            }
                            this.lastUpdateTime = currentTime;
                        }
                    } else {
                        if (entity._lastScreenPos.occluded) {
                            currentPos.occluded = true;
                            currentPos.visible = false;
                        }
                    }   
                }                

                entity._lastScreenPos = { ...currentPos };
                if (this.events) {
                    this.events.fire('ScreenPosChange', {
                        screenPos: currentPos,
                        scene_id: entity.scene_id
                    });
                }
            }
        });
        
        this.syncAll = false;
    }

    // 设置遮挡检测间隔
    setOcclusionInterval(interval) {
        this.occlusionUpdateInterval = interval;
    }

    destroy() {
        // 清理资源
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        this.trackedEntities.clear();
        this.off('update', this.updateScreenPos);
        super.destroy();
    }
}

// 定义脚本属性
TraceScreenPosition.attributes.add('occlusionUpdateInterval', {
    type: 'number',
    default: -1,
    title: '遮挡检测间隔(ms)',
    description: '设置遮挡检测的时间间隔，-1表示不检测遮挡'
});

// // 注册脚本
// pc.registerScript(TraceScreenPosition, 'traceScreenPosition');

// 导出脚本类，以便其他地方可以使用
export { TraceScreenPosition }; 