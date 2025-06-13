import * as simpleMesh from './simple_mesh';
import * as pc from 'playcanvas';

class RectanglePlane {
    constructor(app, device, camera, gizmoHandler) {
        this.app = app;
        this.device = device;
        this.camera = camera;
        this.gizmoHandler = gizmoHandler;
        
        // Array of control points
        this.controlPoints = [];
        
        // Rectangle lines and face
        this.rectangleLines = [];
        this.rectangleMesh = null;
        this.rectangleEntity = null;
        
        // Error state lines (shown when three points are collinear)
        this.errorLine = [];
        
        // Color settings
        this.lineColor = {r: 0, g: 0, b: 1, a: 1}; // Blue lines
        this.errorLineColor = {r: 1, g: 0, b: 0, a: 1}; // Red error lines
        this.faceColor = [0, 0, 1, 0.3]; // Semi-transparent blue face
        
        // Listen for update events
        this.app.on('update', () => {
            this.update();
        });
        
        // Listen for gizmo pointer up event, recalculate rectangle after moving control points
        if (this.gizmoHandler && this.gizmoHandler.eventHandler) {
            this.gizmoHandler.eventHandler.on('gizmo:pointer:up', (entity) => {
                // Ensure the moved entity is a control point
                const isControlPoint = this.controlPoints.some(point => point.entity === entity);
                if (isControlPoint) {
                    console.log('Control point position updated, recalculating rectangle face');
                    this.updateRectangle();
                }
            });
        }
    }

    update() {
        // Draw rectangle lines
        if (this.rectangleLines.length > 0) {
            this.app.drawLines(this.rectangleLines, this.lineColor);
        }
        
        // Draw error lines
        if (this.errorLine.length > 0) {
            this.app.drawLines(this.errorLine, this.errorLineColor);
        }
    }

    /**
     * Add a control point
     * @param {pc.Vec3} position - Position of the point
     */
    addControlPoint(position) {
        if (this.controlPoints.length >= 3) {
            console.warn('Maximum number of control points reached (3)');
            return;
        }

        // Create anchor mesh
        const anchorMesh = simpleMesh.createAnchorMesh(this.device, { 
            size: 0.3, 
            renderMode: 'solid' 
        });
        
        // Set different colors based on point index
        let color;
        if (this.controlPoints.length < 2) {
            color = [1, 0.5, 0, 1]; // Orange - first two points
        } else {
            color = [0, 1, 0, 1]; // Green - third point
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
        
        // If enough points, calculate rectangle
        if (this.controlPoints.length >= 3) {
            this.updateRectangle();
        }
    }

    /**
     * Add current camera position as a control point
     */
    addCurrentCameraPosition() {
        const position = this.camera.getPosition().clone();
        this.addControlPoint(position);
    }

    /**
     * Remove the last control point
     */
    removeLastPoint() {
        if (this.controlPoints.length > 0) {
            const lastPoint = this.controlPoints.pop();
            lastPoint.entity.destroy();
            this.updateRectangle();
        }
    }

    /**
     * Remove a specific control point
     * @param {pc.Entity} entity - Entity to remove
     */
    removeControlPoint(entity) {
        const index = this.controlPoints.findIndex(point => point.entity === entity);
        if (index !== -1) {
            entity.destroy();
            this.controlPoints.splice(index, 1);
            // Reset indices and colors of remaining points
            this.updatePointColors();
            this.updateRectangle();
        }
    }

    /**
     * Remove currently selected control point
     */
    removeCurrentControlPoint() {
        if (this.gizmoHandler && this.gizmoHandler._nodes.length > 0) {
            this.removeControlPoint(this.gizmoHandler._nodes[0]);
            this.gizmoHandler.clear();
        }
    }

    /**
     * Update point colors
     */
    updatePointColors() {
        this.controlPoints.forEach((point, index) => {
            point.index = index;
            let color = index < 2 ? [1, 0.5, 0, 1] : [0, 1, 0, 1];
            
            // Update mesh instance color
            if (point.entity.render && point.entity.render.meshInstances[0]) {
                const material = point.entity.render.meshInstances[0].material;
                material.diffuse.set(color[0], color[1], color[2]);
                material.update();
            }
        });
    }

    /**
     * Clear all control points
     */
    clearAllPoints() {
        this.controlPoints.forEach(point => {
            point.entity.destroy();
        });
        this.controlPoints = [];
        this.clearRectangle();
    }

    /**
     * Clear rectangle display
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
     * Check if three points are collinear
     * @param {pc.Vec3} p1 - First point
     * @param {pc.Vec3} p2 - Second point
     * @param {pc.Vec3} p3 - Third point
     * @returns {boolean} Whether points are collinear
     */
    arePointsCollinear(p1, p2, p3) {
        // Calculate vectors
        const v1 = new pc.Vec3().sub2(p2, p1);
        const v2 = new pc.Vec3().sub2(p3, p1);
        
        // Calculate cross product
        const cross = new pc.Vec3().cross(v1, v2);
        
        // If cross product magnitude is close to 0, points are collinear
        const tolerance = 0.001;
        return cross.length() < tolerance;
    }

    /**
     * Calculate distance from point to line
     * @param {pc.Vec3} point - Target point
     * @param {pc.Vec3} lineStart - Line start point
     * @param {pc.Vec3} lineEnd - Line end point
     * @returns {number} Distance
     */
    pointToLineDistance(point, lineStart, lineEnd) {
        const lineVec = new pc.Vec3().sub2(lineEnd, lineStart);
        const pointVec = new pc.Vec3().sub2(point, lineStart);
        
        const cross = new pc.Vec3().cross(lineVec, pointVec);
        return cross.length() / lineVec.length();
    }

    /**
     * Calculate rectangle vertices
     * @param {pc.Vec3} p1 - First control point
     * @param {pc.Vec3} p2 - Second control point
     * @param {pc.Vec3} p3 - Third control point
     * @returns {Array} Rectangle vertices
     */
    calculateRectangleVertices(p1, p2, p3) {
        // Base vector
        const baseVec = new pc.Vec3().sub2(p2, p1);
        
        // Projection point from third point to base
        const pointToP1 = new pc.Vec3().sub2(p3, p1);
        const projection = baseVec.clone().scale(pointToP1.dot(baseVec) / baseVec.dot(baseVec));
        const projectionPoint = new pc.Vec3().add2(p1, projection);
        
        // Height vector (from projection point to third point)
        const heightVec = new pc.Vec3().sub2(p3, projectionPoint);
        
        // Calculate rectangle vertices
        const vertices = [
            p1.clone(),                           // Vertex 1
            p2.clone(),                           // Vertex 2
            new pc.Vec3().add2(p2, heightVec),    // Vertex 3
            new pc.Vec3().add2(p1, heightVec)     // Vertex 4
        ];
        
        return vertices;
    }

    /**
     * Create rectangle face mesh
     * @param {Array} vertices - Rectangle vertices
     */
    createRectangleMesh(vertices) {
        // Clear previous rectangle entity
        if (this.rectangleEntity) {
            this.rectangleEntity.destroy();
            this.rectangleEntity = null;
        }

        // Create vertex data
        const positions = [];
        const indices = [];
        const normals = [];
        const uvs = [];

        // Add vertex positions
        vertices.forEach(vertex => {
            positions.push(vertex.x, vertex.y, vertex.z);
            uvs.push(0, 0); // Simple UV coordinates
        });

        // Calculate normal vector
        const v1 = new pc.Vec3().sub2(vertices[1], vertices[0]);
        const v2 = new pc.Vec3().sub2(vertices[3], vertices[0]);
        const normal = new pc.Vec3().cross(v1, v2).normalize();

        // Add normal for each vertex
        for (let i = 0; i < 4; i++) {
            normals.push(normal.x, normal.y, normal.z);
        }

        // Define two triangles (double-sided)
        indices.push(
            0, 1, 2,  // First triangle
            0, 2, 3,  // Second triangle
            // Back face
            2, 1, 0,  
            3, 2, 0   
        );

        // Create mesh
        const mesh = new pc.Mesh(this.device);
        mesh.clear(true, false);
        
        // Set vertex data
        mesh.setPositions(positions);
        mesh.setNormals(normals);
        mesh.setUvs(0, uvs);
        mesh.setIndices(indices);
        mesh.update();

        // Create material
        const material = new pc.StandardMaterial();
        material.diffuse.set(this.faceColor[0], this.faceColor[1], this.faceColor[2]);
        material.opacity = this.faceColor[3];
        
        // Correctly set transparency - use blendType instead of transparent property
        if (this.faceColor[3] < 1.0) {
            material.blendType = pc.BLEND_NORMAL;
        }
        
        material.cull = pc.CULLFACE_NONE; // Double-sided display
        material.update();

        // Create mesh instance
        const meshInstance = new pc.MeshInstance(mesh, material);

        // Create entity
        this.rectangleEntity = new pc.Entity();
        this.rectangleEntity.addComponent('render', {
            meshInstances: [meshInstance]
        });

        this.app.root.addChild(this.rectangleEntity);
    }

    /**
     * Update rectangle display
     */
    updateRectangle() {
        this.clearRectangle();

        if (this.controlPoints.length < 3) {
            return;
        }

        const p1 = this.controlPoints[0].entity.getPosition();
        const p2 = this.controlPoints[1].entity.getPosition();
        const p3 = this.controlPoints[2].entity.getPosition();

        // Check if points are collinear
        if (this.arePointsCollinear(p1, p2, p3)) {
            // Show red error lines
            this.errorLine = [p1.clone(), p3.clone()];
            console.log('Warning: Three control points are collinear, cannot form rectangle face');
            return;
        }

        // Calculate rectangle vertices
        const vertices = this.calculateRectangleVertices(p1, p2, p3);

        // Create rectangle wireframe
        this.rectangleLines = [
            vertices[0].clone(), vertices[1].clone(),
            vertices[1].clone(), vertices[2].clone(),
            vertices[2].clone(), vertices[3].clone(),
            vertices[3].clone(), vertices[0].clone()
        ];

        // Create rectangle face
        this.createRectangleMesh(vertices);
    }

    /**
     * Set face color
     * @param {Array} color - Color array [r, g, b, a]
     */
    setFaceColor(color) {
        this.faceColor = color;
        this.updateRectangle();
    }

    /**
     * Set line color
     * @param {Object} color - Color object {r, g, b, a}
     */
    setLineColor(color) {
        this.lineColor = color;
    }

    /**
     * Get rectangle information
     * @returns {Object} Detailed rectangle information
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
                error: 'Three points are collinear, cannot form rectangle'
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
     * Export rectangle data
     * @returns {Object} Serializable rectangle data
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
     * Import rectangle data
     * @param {Object} data - Rectangle data
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
     * Destroy rectangle plane module
     */
    destroy() {
        this.clearAllPoints();
        
        // Remove event listeners
        this.app.off('update');
        
        if (this.gizmoHandler && this.gizmoHandler.eventHandler) {
            this.gizmoHandler.eventHandler.off('gizmo:pointer:up');
        }
    }
}

export { RectanglePlane }; 