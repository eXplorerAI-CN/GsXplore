import * as simpleMesh from './simple_mesh';
// import * as pc from '../../engine';
import * as pc from 'playcanvas';

class RectanglePlane {
    constructor(app, device, camera, gizmoHandler) {
        this.app = app;
        this.device = device;
        this.camera = camera;
        this.gizmoHandler = gizmoHandler;
        
        // 控制点数组
        this.controlPoints = [];
        
        // 矩形面的线条和面
        this.rectangleLines = [];
        this.rectangleMesh = null;
        this.rectangleEntity = null;
        
        // 异常状态线条（三点共线时显示）
        this.errorLine = [];
        
        // 颜色设置
        this.lineColor = {r: 0, g: 0, b: 1, a: 1}; // 蓝色线条
        this.errorLineColor = {r: 1, g: 0, b: 0, a: 1}; // 红色异常线条
        this.faceColor = [0, 0, 1, 0.3]; // 半透明蓝色面
        
        // 监听更新事件
        this.app.on('update', () => {
            this.update();
        });
        
        // 监听gizmo指针抬起事件，当移动控制点后重新计算矩形
        if (this.gizmoHandler && this.gizmoHandler.eventHandler) {
            this.gizmoHandler.eventHandler.on('gizmo:pointer:up', (entity) => {
                // 确保被移动的实体是控制点
                const isControlPoint = this.controlPoints.some(point => point.entity === entity);
                if (isControlPoint) {
                    console.log('控制点位置已更新，重新计算矩形面');
                    this.updateRectangle();
                }
            });
        }
    }

    update() {
        // 绘制矩形线条
        if (this.rectangleLines.length > 0) {
            this.app.drawLines(this.rectangleLines, this.lineColor);
        }
        
        // 绘制异常线条
        if (this.errorLine.length > 0) {
            this.app.drawLines(this.errorLine, this.errorLineColor);
        }
    }

    /**
     * 添加控制点
     * @param {pc.Vec3} position - 点的位置
     */
    addControlPoint(position) {
        if (this.controlPoints.length >= 3) {
            console.warn('已达到最大控制点数量(3个)');
            return;
        }

        // 创建锚点mesh
        const anchorMesh = simpleMesh.createAnchorMesh(this.device, { 
            size: 0.3, 
            renderMode: 'solid' 
        });
        
        // 根据点的序号设置不同颜色
        let color;
        if (this.controlPoints.length < 2) {
            color = [1, 0.5, 0, 1]; // 橙色 - 前两个点
        } else {
            color = [0, 1, 0, 1]; // 绿色 - 第三个点
        }
        
        const meshInstance = simpleMesh.createMeshInstance(anchorMesh, { 
            renderMode: 'solid', 
            color: color
        });
        
        const entity = new pc.Entity();
        entity.addComponent('render', {
            meshInstances: [meshInstance]
        });
        
        entity.setPosition(position.x, position.y, position.z);
        this.app.root.addChild(entity);
        
        this.controlPoints.push({ 
            entity: entity,
            index: this.controlPoints.length
        });
        
        // 如果有足够的点，计算矩形
        if (this.controlPoints.length >= 3) {
            this.updateRectangle();
        }
    }

    /**
     * 添加当前相机位置作为控制点
     */
    addCurrentCameraPosition() {
        const position = this.camera.getPosition().clone();
        this.addControlPoint(position);
    }

    /**
     * 移除最后一个控制点
     */
    removeLastPoint() {
        if (this.controlPoints.length > 0) {
            const lastPoint = this.controlPoints.pop();
            lastPoint.entity.destroy();
            this.updateRectangle();
        }
    }

    /**
     * 移除指定的控制点
     * @param {pc.Entity} entity - 要移除的控制点实体
     */
    removeControlPoint(entity) {
        const index = this.controlPoints.findIndex(point => point.entity === entity);
        if (index !== -1) {
            entity.destroy();
            this.controlPoints.splice(index, 1);
            // 重新设置剩余点的索引和颜色
            this.updatePointColors();
            this.updateRectangle();
        }
    }

    /**
     * 移除当前选中的控制点
     */
    removeCurrentControlPoint() {
        if (this.gizmoHandler && this.gizmoHandler._nodes.length > 0) {
            this.removeControlPoint(this.gizmoHandler._nodes[0]);
            this.gizmoHandler.clear();
        }
    }

    /**
     * 更新点的颜色
     */
    updatePointColors() {
        this.controlPoints.forEach((point, index) => {
            point.index = index;
            let color = index < 2 ? [1, 0.5, 0, 1] : [0, 1, 0, 1];
            
            // 更新mesh实例的颜色
            if (point.entity.render && point.entity.render.meshInstances[0]) {
                const material = point.entity.render.meshInstances[0].material;
                material.diffuse.set(color[0], color[1], color[2]);
                material.update();
            }
        });
    }

    /**
     * 清除所有控制点
     */
    clearAllPoints() {
        this.controlPoints.forEach(point => {
            point.entity.destroy();
        });
        this.controlPoints = [];
        this.clearRectangle();
    }

    /**
     * 清除矩形显示
     */
    clearRectangle() {
        this.rectangleLines = [];
        this.errorLine = [];
        
        if (this.rectangleEntity) {
            this.rectangleEntity.destroy();
            this.rectangleEntity = null;
        }
    }

    /**
     * 检查三点是否共线
     * @param {pc.Vec3} p1 - 第一个点
     * @param {pc.Vec3} p2 - 第二个点
     * @param {pc.Vec3} p3 - 第三个点
     * @returns {boolean} 是否共线
     */
    arePointsCollinear(p1, p2, p3) {
        // 计算向量
        const v1 = new pc.Vec3().sub2(p2, p1);
        const v2 = new pc.Vec3().sub2(p3, p1);
        
        // 计算叉积
        const cross = new pc.Vec3().cross(v1, v2);
        
        // 如果叉积的模长接近0，则三点共线
        const tolerance = 0.001;
        return cross.length() < tolerance;
    }

    /**
     * 计算点到直线的距离
     * @param {pc.Vec3} point - 目标点
     * @param {pc.Vec3} lineStart - 直线起点
     * @param {pc.Vec3} lineEnd - 直线终点
     * @returns {number} 距离
     */
    pointToLineDistance(point, lineStart, lineEnd) {
        const lineVec = new pc.Vec3().sub2(lineEnd, lineStart);
        const pointVec = new pc.Vec3().sub2(point, lineStart);
        
        const cross = new pc.Vec3().cross(lineVec, pointVec);
        return cross.length() / lineVec.length();
    }

    /**
     * 计算矩形的四个顶点
     * @param {pc.Vec3} p1 - 第一个控制点
     * @param {pc.Vec3} p2 - 第二个控制点
     * @param {pc.Vec3} p3 - 第三个控制点
     * @returns {Array} 矩形的四个顶点
     */
    calculateRectangleVertices(p1, p2, p3) {
        // 底边向量
        const baseVec = new pc.Vec3().sub2(p2, p1);
        
        // 从第三个点到底边的投影点
        const pointToP1 = new pc.Vec3().sub2(p3, p1);
        const projection = baseVec.clone().scale(pointToP1.dot(baseVec) / baseVec.dot(baseVec));
        const projectionPoint = new pc.Vec3().add2(p1, projection);
        
        // 高度向量（从投影点到第三个点）
        const heightVec = new pc.Vec3().sub2(p3, projectionPoint);
        
        // 计算矩形的四个顶点
        const vertices = [
            p1.clone(),                           // 顶点1
            p2.clone(),                           // 顶点2
            new pc.Vec3().add2(p2, heightVec),    // 顶点3
            new pc.Vec3().add2(p1, heightVec)     // 顶点4
        ];
        
        return vertices;
    }

    /**
     * 创建矩形面mesh
     * @param {Array} vertices - 矩形的四个顶点
     */
    createRectangleMesh(vertices) {
        // 清除之前的矩形实体
        if (this.rectangleEntity) {
            this.rectangleEntity.destroy();
            this.rectangleEntity = null;
        }

        // 创建顶点数据
        const positions = [];
        const indices = [];
        const normals = [];
        const uvs = [];

        // 添加顶点位置
        vertices.forEach(vertex => {
            positions.push(vertex.x, vertex.y, vertex.z);
            uvs.push(0, 0); // 简单的UV坐标
        });

        // 计算法向量
        const v1 = new pc.Vec3().sub2(vertices[1], vertices[0]);
        const v2 = new pc.Vec3().sub2(vertices[3], vertices[0]);
        const normal = new pc.Vec3().cross(v1, v2).normalize();

        // 为每个顶点添加法向量
        for (let i = 0; i < 4; i++) {
            normals.push(normal.x, normal.y, normal.z);
        }

        // 定义两个三角形（双面）
        indices.push(
            0, 1, 2,  // 第一个三角形
            0, 2, 3,  // 第二个三角形
            // 反面
            2, 1, 0,  
            3, 2, 0   
        );

        // 创建mesh
        const mesh = new pc.Mesh(this.device);
        mesh.clear(true, false);
        
        // 设置顶点数据
        mesh.setPositions(positions);
        mesh.setNormals(normals);
        mesh.setUvs(0, uvs);
        mesh.setIndices(indices);
        mesh.update();

        // 创建材质
        const material = new pc.StandardMaterial();
        material.diffuse.set(this.faceColor[0], this.faceColor[1], this.faceColor[2]);
        material.opacity = this.faceColor[3];
        
        // 正确设置透明度 - 使用blendType而不是transparent属性
        if (this.faceColor[3] < 1.0) {
            material.blendType = pc.BLEND_NORMAL;
        }
        
        material.cull = pc.CULLFACE_NONE; // 双面显示
        material.update();

        // 创建mesh实例
        const meshInstance = new pc.MeshInstance(mesh, material);

        // 创建实体
        this.rectangleEntity = new pc.Entity();
        this.rectangleEntity.addComponent('render', {
            meshInstances: [meshInstance]
        });

        this.app.root.addChild(this.rectangleEntity);
    }

    /**
     * 更新矩形显示
     */
    updateRectangle() {
        this.clearRectangle();

        if (this.controlPoints.length < 3) {
            return;
        }

        const p1 = this.controlPoints[0].entity.getPosition();
        const p2 = this.controlPoints[1].entity.getPosition();
        const p3 = this.controlPoints[2].entity.getPosition();

        // 检查是否共线
        if (this.arePointsCollinear(p1, p2, p3)) {
            // 显示红色异常线条
            this.errorLine = [p1.clone(), p3.clone()];
            console.log('警告：三个控制点共线，无法形成矩形面');
            return;
        }

        // 计算矩形顶点
        const vertices = this.calculateRectangleVertices(p1, p2, p3);

        // 创建矩形线框
        this.rectangleLines = [
            vertices[0].clone(), vertices[1].clone(),
            vertices[1].clone(), vertices[2].clone(),
            vertices[2].clone(), vertices[3].clone(),
            vertices[3].clone(), vertices[0].clone()
        ];

        // 创建矩形面
        this.createRectangleMesh(vertices);
    }

    /**
     * 设置面的颜色
     * @param {Array} color - 颜色数组 [r, g, b, a]
     */
    setFaceColor(color) {
        this.faceColor = color;
        this.updateRectangle();
    }

    /**
     * 设置线条颜色
     * @param {Object} color - 颜色对象 {r, g, b, a}
     */
    setLineColor(color) {
        this.lineColor = color;
    }

    /**
     * 获取矩形信息
     * @returns {Object} 矩形的详细信息
     */
    getRectangleInfo() {
        if (this.controlPoints.length < 3) {
            return null;
        }

        const p1 = this.controlPoints[0].entity.getPosition();
        const p2 = this.controlPoints[1].entity.getPosition();
        const p3 = this.controlPoints[2].entity.getPosition();

        if (this.arePointsCollinear(p1, p2, p3)) {
            return {
                isValid: false,
                error: '三点共线，无法形成矩形'
            };
        }

        const vertices = this.calculateRectangleVertices(p1, p2, p3);
        const baseLength = p1.distance(p2);
        const height = this.pointToLineDistance(p3, p1, p2);
        const area = baseLength * height;

        return {
            isValid: true,
            controlPoints: [p1.clone(), p2.clone(), p3.clone()],
            vertices: vertices,
            baseLength: baseLength,
            height: height,
            area: area
        };
    }

    /**
     * 导出矩形数据
     * @returns {Object} 可序列化的矩形数据
     */
    exportRectangle() {
        const points = this.controlPoints.map(point => ({
            position: point.entity.getPosition().clone(),
            index: point.index
        }));

        return {
            controlPoints: points,
            rectangleInfo: this.getRectangleInfo()
        };
    }

    /**
     * 导入矩形数据
     * @param {Object} data - 矩形数据
     */
    importRectangle(data) {
        this.clearAllPoints();

        if (data.controlPoints) {
            data.controlPoints.forEach(pointData => {
                this.addControlPoint(pointData.position);
            });
        }
    }

    /**
     * 销毁矩形面模块
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

export { RectanglePlane }; 