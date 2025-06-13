import * as simpleMesh from './simple_mesh';
// import * as pc from '../../engine';
import * as pc from 'playcanvas';

class DistanceMeasure {
    constructor(app, device, camera, gizmoHandler) {
        this.app = app;
        this.device = device;
        this.camera = camera;
        this.gizmoHandler = gizmoHandler;
        
        // 测量点数组
        this.measurePoints = [];
        
        // 线段数组，用于绘制连接线
        this.linePoints = [];
        
        // 距离标签数组
        this.distanceLabels = [];
        
        // 测量设置
        this.scale = 1.0;  // 倍率
        this.unit = 'm';   // 单位
        this.lineColor = {r: 0, g: 1, b: 0, a: 1}; // 绿色线条
        
        // 监听更新事件
        this.app.on('update', () => {
            this.update();
        });
        
        // 监听gizmo指针抬起事件，当移动测量点后重新计算距离
        if (this.gizmoHandler && this.gizmoHandler.eventHandler) {
            this.gizmoHandler.eventHandler.on('gizmo:pointer:up', (entity) => {
                // 确保被移动的实体是测量点
                const isMeasurePoint = this.measurePoints.some(point => point.entity === entity);
                if (isMeasurePoint) {
                    console.log('测量点位置已更新，重新计算距离');
                    this.updateDistances();
                }
            });
        }
    }

    show_text(message, pos, euler = [0, 0, 1], color = [1, 1, 1, 1]) {
        // 先从app注册的全局asset里面查找字体
        let fontAsset = this.app.assets.find('font_arial', 'font');

        if (!fontAsset) {
            // 如果没找到，创建新的asset并异步加载
            fontAsset = new pc.Asset('font_arial', 'font', { url: '/fonts/arial.json' });
            this.app.assets.add(fontAsset);

            // 异步加载，加载完成后重新调用show_text
            new Promise((resolve, reject) => {
                fontAsset.once('load', () => resolve());
                fontAsset.once('error', (err) => reject(err));
                this.app.assets.load(fontAsset);
            }).then(() => {
                // 加载完成后，以相同参数再次运行show_text
                this.show_text(message, pos, euler, color);
            }).catch((err) => {
                console.error('Font loading failed:', err);
            });

            return null; // 异步加载情况下返回null
        }

        // Create a text element-based entity
        const text = new pc.Entity();
        text.addComponent('element', {
            anchor: [0.5, 0.5, 0.5, 0.5],
            fontAsset: fontAsset,
            fontSize: 0.3,
            pivot: [0, 0.5],
            text: message,
            type: pc.ELEMENTTYPE_TEXT,
            color: color,
        });
        text.setLocalPosition(pos[0], pos[1], pos[2]);
        text.setLocalEulerAngles(euler[0], euler[1], euler[2]);

        // 设置text为双面显示
        if (text.element && text.element.material) {
            text.element.material.cull = pc.CULLFACE_NONE;
            text.element.material.update();
        }
        console.log(text)

        this.app.root.addChild(text);
        
        return text; // 返回创建的text实体
    }


    update() {
        // 绘制连接线
        if (this.linePoints.length > 0) {
            this.app.drawLines(this.linePoints, this.lineColor);
        }
    }

    /**
     * 设置测量倍率和单位
     * @param {number} scale - 倍率
     * @param {string} unit - 单位
     */
    setScaleAndUnit(scale, unit) {
        this.scale = scale;
        this.unit = unit;
        this.updateDistances();
    }

    /**
     * 添加测量点
     * @param {pc.Vec3} position - 点的位置
     */
    addMeasurePoint(position) {
        // 创建锚点mesh
        const anchorMesh = simpleMesh.createAnchorMesh(this.device, { 
            size: 0.3, 
            renderMode: 'solid' 
        });
        
        const meshInstance = simpleMesh.createMeshInstance(anchorMesh, { 
            renderMode: 'solid', 
            color: [1, 0.5, 0, 1] // 橙色
        });
        
        const entity = new pc.Entity();
        entity.addComponent('render', {
            meshInstances: [meshInstance]
        });
        
        entity.setPosition(position.x, position.y, position.z);
        this.app.root.addChild(entity);
        
        this.measurePoints.push({ entity: entity });
        
        // 如果有多个点，重新计算距离
        if (this.measurePoints.length > 1) {
            this.updateDistances();
        }
    }

    /**
     * 添加当前相机位置作为测量点
     */
    addCurrentCameraPosition() {
        const position = this.camera.getPosition().clone();
        this.addMeasurePoint(position);
    }

    /**
     * 移除最后一个测量点
     */
    removeLastPoint() {
        if (this.measurePoints.length > 0) {
            const lastPoint = this.measurePoints.pop();
            lastPoint.entity.destroy();
            this.updateDistances();
        }
    }

    /**
     * 移除指定的测量点
     * @param {pc.Entity} entity - 要移除的测量点实体
     */
    removeMeasurePoint(entity) {
        const index = this.measurePoints.findIndex(point => point.entity === entity);
        if (index !== -1) {
            entity.destroy();
            this.measurePoints.splice(index, 1);
            this.updateDistances();
        }
    }

    /**
     * 移除当前选中的测量点
     */
    removeCurrentMeasurePoint() {
        if (this.gizmoHandler && this.gizmoHandler._nodes.length > 0) {
            this.removeMeasurePoint(this.gizmoHandler._nodes[0]);
            this.gizmoHandler.clear();
        }
    }

    /**
     * 清除所有测量点
     */
    clearAllPoints() {
        this.measurePoints.forEach(point => {
            point.entity.destroy();
        });
        this.measurePoints = [];
        this.clearLines();
        this.clearLabels();
    }

    /**
     * 清除所有连接线
     */
    clearLines() {
        this.linePoints = [];
    }

    /**
     * 清除所有距离标签
     */
    clearLabels() {
        this.distanceLabels.forEach(label => {
            if (label.entity) {
                // 清理billboard更新函数
                if (label.entity._billboardUpdate) {
                    this.app.off('update', label.entity._billboardUpdate);
                    delete label.entity._billboardUpdate;
                }
                label.entity.destroy();
            }
        });
        this.distanceLabels = [];
    }

    /**
     * 更新距离计算和显示
     */
    updateDistances() {
        this.clearLines();
        this.clearLabels();

        if (this.measurePoints.length < 2) {
            return;
        }

        // 计算每段距离并创建连接线
        for (let i = 0; i < this.measurePoints.length - 1; i++) {
            const point1 = this.measurePoints[i].entity.getPosition();
            const point2 = this.measurePoints[i + 1].entity.getPosition();

            // 添加连接线
            this.addLine(point1, point2);

            // 计算距离
            const distance = point1.distance(point2);
            const scaledDistance = distance * this.scale;

            // 计算线段中点
            const midPoint = new pc.Vec3();
            midPoint.add2(point1, point2).scale(0.5);

            // 创建距离标签
            this.createDistanceLabel(midPoint, scaledDistance, i);
        }
    }

    /**
     * 添加连接线
     * @param {pc.Vec3} point1 - 起点
     * @param {pc.Vec3} point2 - 终点
     */
    addLine(point1, point2) {
        this.linePoints.push(point1.clone(), point2.clone());
    }

    /**
     * 创建距离标签
     * @param {pc.Vec3} position - 标签位置
     * @param {number} distance - 距离值
     * @param {number} segmentIndex - 线段索引
     */
    createDistanceLabel(position, distance, segmentIndex) {
        // 格式化距离显示
        const formattedDistance = distance.toFixed(2);
        const labelText = `${formattedDistance} ${this.unit}`;

        // 计算文字朝向摄像机的角度
        const cameraPosition = this.camera.getPosition();
        const direction = new pc.Vec3();
        direction.sub2(cameraPosition, position).normalize();

        // 计算Y轴旋转角度（水平朝向）
        const yRotation = Math.atan2(direction.x, direction.z) * pc.math.RAD_TO_DEG;
        
        // 计算X轴旋转角度（垂直朝向）
        const horizontalLength = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
        const xRotation = Math.atan2(direction.y, horizontalLength) * pc.math.RAD_TO_DEG;

        // 使用show_text方法显示文字，传入朝向摄像机的欧拉角
        const textEntity = this.show_text(
            labelText, 
            [position.x, position.y, position.z], 
            [xRotation, yRotation, 0], // 朝向摄像机的欧拉角
            [1, 1, 1, 1] // 白色文字
        );

        // 存储标签信息
        this.distanceLabels.push({
            entity: textEntity,
            segmentIndex: segmentIndex,
            distance: distance,
            position: position.clone(),
            text: labelText
        });

        // 添加billboard行为，使文字始终面向相机
        if (textEntity) {
            this.addBillboardBehavior(textEntity);
        }
    }

    /**
     * 为标签添加billboard行为，使其始终面向相机
     * @param {pc.Entity} entity - 标签实体
     */
    addBillboardBehavior(entity) {
        const updateBillboard = () => {
            if (entity && this.camera && entity.element) {
                const cameraPosition = this.camera.getPosition();
                const labelPosition = entity.getPosition();
                
                // 计算从标签到相机的方向
                const direction = new pc.Vec3();
                direction.sub2(cameraPosition, labelPosition).normalize();
                
                // 计算Y轴旋转角度（水平朝向）
                const yRotation = Math.atan2(direction.x, direction.z) * pc.math.RAD_TO_DEG;
                
                // 计算X轴旋转角度（垂直朝向）
                const horizontalLength = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
                const xRotation = Math.atan2(direction.y, horizontalLength) * pc.math.RAD_TO_DEG;

                // 设置文字朝向相机
                entity.setLocalEulerAngles(xRotation, yRotation, 0);
            }
        };

        // 在每次更新时调整朝向
        this.app.on('update', updateBillboard);

        // 存储更新函数引用，以便后续清理
        entity._billboardUpdate = updateBillboard;
    }

    /**
     * 获取总距离
     * @returns {number} 总距离（已应用倍率）
     */
    getTotalDistance() {
        let totalDistance = 0;
        
        for (let i = 0; i < this.measurePoints.length - 1; i++) {
            const point1 = this.measurePoints[i].entity.getPosition();
            const point2 = this.measurePoints[i + 1].entity.getPosition();
            totalDistance += point1.distance(point2);
        }
        
        return totalDistance * this.scale;
    }

    /**
     * 获取测量信息
     * @returns {Object} 包含各段距离和总距离的信息
     */
    getMeasurementInfo() {
        const segments = [];
        let totalDistance = 0;

        for (let i = 0; i < this.measurePoints.length - 1; i++) {
            const point1 = this.measurePoints[i].entity.getPosition();
            const point2 = this.measurePoints[i + 1].entity.getPosition();
            const distance = point1.distance(point2) * this.scale;
            
            segments.push({
                index: i,
                distance: distance,
                formattedDistance: `${distance.toFixed(2)} ${this.unit}`,
                startPoint: point1.clone(),
                endPoint: point2.clone()
            });
            
            totalDistance += distance;
        }

        return {
            segments: segments,
            totalDistance: totalDistance,
            formattedTotalDistance: `${totalDistance.toFixed(2)} ${this.unit}`,
            pointCount: this.measurePoints.length,
            scale: this.scale,
            unit: this.unit
        };
    }

    /**
     * 设置线条颜色
     * @param {Object} color - 颜色对象 {r, g, b, a}
     */
    setLineColor(color) {
        this.lineColor = color;
    }

    /**
     * 导出测量数据
     * @returns {Object} 可序列化的测量数据
     */
    exportMeasurement() {
        const points = this.measurePoints.map(point => ({
            position: point.entity.getPosition().clone()
        }));

        return {
            points: points,
            scale: this.scale,
            unit: this.unit,
            measurementInfo: this.getMeasurementInfo()
        };
    }

    /**
     * 导入测量数据
     * @param {Object} data - 测量数据
     */
    importMeasurement(data) {
        this.clearAllPoints();
        
        if (data.scale !== undefined) this.scale = data.scale;
        if (data.unit !== undefined) this.unit = data.unit;

        data.points.forEach(pointData => {
            this.addMeasurePoint(pointData.position);
        });
    }

    /**
     * 销毁测距模块
     */
    destroy() {
        this.clearAllPoints();
        
        // 移除事件监听器
        this.app.off('update');
        
        if (this.gizmoHandler && this.gizmoHandler.eventHandler) {
            this.gizmoHandler.eventHandler.off('gizmo:pointer:up');
        }
    }
}

export { DistanceMeasure }; 