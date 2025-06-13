import * as simpleMesh from './simple_mesh';
import * as pc from 'playcanvas';

class DistanceMeasure {
    constructor(app, device, camera, gizmoHandler) {
        this.app = app;
        this.device = device;
        this.camera = camera;
        this.gizmoHandler = gizmoHandler;
        
        // Array of measurement points
        this.measurePoints = [];
        
        // Array of line points for drawing connecting lines
        this.linePoints = [];
        
        // Array of distance labels
        this.distanceLabels = [];
        
        // Measurement settings
        this.scale = 1.0;  // Scale factor
        this.unit = 'm';   // Unit
        this.lineColor = {r: 0, g: 1, b: 0, a: 1}; // Green line
        
        // Listen for update event
        this.app.on('update', () => {
            this.update();
        });
        
        // Listen for gizmo pointer up event, recalculate distance after moving a measurement point
        if (this.gizmoHandler && this.gizmoHandler.eventHandler) {
            this.gizmoHandler.eventHandler.on('gizmo:pointer:up', (entity) => {
                // Ensure the moved entity is a measurement point
                const isMeasurePoint = this.measurePoints.some(point => point.entity === entity);
                if (isMeasurePoint) {
                    this.updateDistances();
                }
            });
        }
    }

    show_text(message, pos, euler = [0, 0, 1], color = [1, 1, 1, 1]) {
        // First, look for the font in the globally registered app assets
        let fontAsset = this.app.assets.find('font_arial', 'font');

        if (!fontAsset) {
            // If not found, create a new asset and load asynchronously
            fontAsset = new pc.Asset('font_arial', 'font', { url: '/fonts/arial.json' });
            this.app.assets.add(fontAsset);

            // Asynchronously load, and call show_text again after loading
            new Promise((resolve, reject) => {
                fontAsset.once('load', () => resolve());
                fontAsset.once('error', (err) => reject(err));
                this.app.assets.load(fontAsset);
            }).then(() => {
                // After loading, call show_text again with the same parameters
                this.show_text(message, pos, euler, color);
            }).catch((err) => {
                console.error('Font loading failed:', err);
            });

            return null; // Return null when loading asynchronously
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

        // Set text to be double-sided
        if (text.element && text.element.material) {
            text.element.material.cull = pc.CULLFACE_NONE;
            text.element.material.update();
        }
        console.log(text)

        this.app.root.addChild(text);
        
        return text; // Return the created text entity
    }


    update() {
        // Draw connecting lines
        if (this.linePoints.length > 0) {
            this.app.drawLines(this.linePoints, this.lineColor);
        }
    }

    /**
     * Set measurement scale and unit
     * @param {number} scale - Scale factor
     * @param {string} unit - Unit
     */
    setScaleAndUnit(scale, unit) {
        this.scale = scale;
        this.unit = unit;
        this.updateDistances();
    }

    /**
     * Add a measurement point
     * @param {pc.Vec3} position - Position of the point
     */
    addMeasurePoint(position) {
        // Create anchor mesh
        const anchorMesh = simpleMesh.createAnchorMesh(this.device, { 
            size: 0.3, 
            renderMode: 'solid' 
        });
        
        const meshInstance = simpleMesh.createMeshInstance(anchorMesh, { 
            renderMode: 'solid', 
            color: [1, 0.5, 0, 1] // Orange
        });
        
        const entity = new pc.Entity();
        entity.addComponent('render', {
            meshInstances: [meshInstance]
        });
        
        entity.setPosition(position.x, position.y, position.z);
        this.app.root.addChild(entity);
        
        this.measurePoints.push({ entity: entity });
        
        // If there are multiple points, recalculate distances
        if (this.measurePoints.length > 1) {
            this.updateDistances();
        }
    }

    /**
     * Add the current camera position as a measurement point
     */
    addCurrentCameraPosition() {
        const position = this.camera.getPosition().clone();
        this.addMeasurePoint(position);
    }

    /**
     * Remove the last measurement point
     */
    removeLastPoint() {
        if (this.measurePoints.length > 0) {
            const lastPoint = this.measurePoints.pop();
            lastPoint.entity.destroy();
            this.updateDistances();
        }
    }

    /**
     * Remove a specified measurement point
     * @param {pc.Entity} entity - The measurement point entity to remove
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
     * Remove the currently selected measurement point
     */
    removeCurrentMeasurePoint() {
        if (this.gizmoHandler && this.gizmoHandler._nodes.length > 0) {
            this.removeMeasurePoint(this.gizmoHandler._nodes[0]);
            this.gizmoHandler.clear();
        }
    }

    /**
     * Clear all measurement points
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
     * Clear all connecting lines
     */
    clearLines() {
        this.linePoints = [];
    }

    /**
     * Clear all distance labels
     */
    clearLabels() {
        this.distanceLabels.forEach(label => {
            if (label.entity) {
                // Clean up billboard update function
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
     * Update distance calculation and display
     */
    updateDistances() {
        this.clearLines();
        this.clearLabels();

        if (this.measurePoints.length < 2) {
            return;
        }

        // Calculate distance for each segment and create connecting lines
        for (let i = 0; i < this.measurePoints.length - 1; i++) {
            const point1 = this.measurePoints[i].entity.getPosition();
            const point2 = this.measurePoints[i + 1].entity.getPosition();

            // Add connecting line
            this.addLine(point1, point2);

            // Calculate distance
            const distance = point1.distance(point2);
            const scaledDistance = distance * this.scale;

            // Calculate midpoint of the segment
            const midPoint = new pc.Vec3();
            midPoint.add2(point1, point2).scale(0.5);

            // Create distance label
            this.createDistanceLabel(midPoint, scaledDistance, i);
        }
    }

    /**
     * Add a connecting line
     * @param {pc.Vec3} point1 - Start point
     * @param {pc.Vec3} point2 - End point
     */
    addLine(point1, point2) {
        this.linePoints.push(point1.clone(), point2.clone());
    }

    /**
     * Create a distance label
     * @param {pc.Vec3} position - Label position
     * @param {number} distance - Distance value
     * @param {number} segmentIndex - Segment index
     */
    createDistanceLabel(position, distance, segmentIndex) {
        // Format distance display
        const formattedDistance = distance.toFixed(2);
        const labelText = `${formattedDistance} ${this.unit}`;

        // Calculate the angle for the text to face the camera
        const cameraPosition = this.camera.getPosition();
        const direction = new pc.Vec3();
        direction.sub2(cameraPosition, position).normalize();

        // Calculate Y-axis rotation angle (horizontal facing)
        const yRotation = Math.atan2(direction.x, direction.z) * pc.math.RAD_TO_DEG;
        
        // Calculate X-axis rotation angle (vertical facing)
        const horizontalLength = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
        const xRotation = Math.atan2(direction.y, horizontalLength) * pc.math.RAD_TO_DEG;

        // Use show_text method to display text, passing Euler angles facing the camera
        const textEntity = this.show_text(
            labelText, 
            [position.x, position.y, position.z], 
            [xRotation, yRotation, 0], // Euler angles facing the camera
            [1, 1, 1, 1] // White text
        );

        // Store label information
        this.distanceLabels.push({
            entity: textEntity,
            segmentIndex: segmentIndex,
            distance: distance,
            position: position.clone(),
            text: labelText
        });

        // Add billboard behavior to make the text always face the camera
        if (textEntity) {
            this.addBillboardBehavior(textEntity);
        }
    }

    /**
     * Add billboard behavior to the label so it always faces the camera
     * @param {pc.Entity} entity - Label entity
     */
    addBillboardBehavior(entity) {
        const updateBillboard = () => {
            if (entity && this.camera && entity.element) {
                const cameraPosition = this.camera.getPosition();
                const labelPosition = entity.getPosition();
                
                // Calculate direction from label to camera
                const direction = new pc.Vec3();
                direction.sub2(cameraPosition, labelPosition).normalize();
                
                // Calculate Y-axis rotation angle (horizontal facing)
                const yRotation = Math.atan2(direction.x, direction.z) * pc.math.RAD_TO_DEG;
                
                // Calculate X-axis rotation angle (vertical facing)
                const horizontalLength = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
                const xRotation = Math.atan2(direction.y, horizontalLength) * pc.math.RAD_TO_DEG;

                // Set text to face the camera
                entity.setLocalEulerAngles(xRotation, yRotation, 0);
            }
        };

        // Adjust orientation on every update
        this.app.on('update', updateBillboard);

        // Store update function reference for later cleanup
        entity._billboardUpdate = updateBillboard;
    }

    /**
     * Get total distance
     * @returns {number} Total distance (after applying scale)
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
     * Get measurement information
     * @returns {Object} Information containing each segment distance and total distance
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
     * Set line color
     * @param {Object} color - Color object {r, g, b, a}
     */
    setLineColor(color) {
        this.lineColor = color;
    }

    /**
     * Export measurement data
     * @returns {Object} Serializable measurement data
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
     * Import measurement data
     * @param {Object} data - Measurement data
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
     * Destroy the distance measurement module
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

export { DistanceMeasure }; 