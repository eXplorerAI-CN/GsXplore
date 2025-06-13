import * as pc from 'playcanvas';

class TraceScreenPosition extends pc.ScriptType {
    initialize() {
        // Initialize properties
        this.canvasRect = this.app.graphicsDevice.canvas.getBoundingClientRect();
        this.occlusionUpdateInterval = -1;

        // Add ResizeObserver to monitor canvas size changes
        this.resizeObserver = new ResizeObserver(() => {
            const t = this.app.graphicsDevice.canvas.getBoundingClientRect();
            this.canvasRect.width = t.width;
            this.canvasRect.height = t.height;
        });
        this.resizeObserver.observe(this.app.graphicsDevice.canvas);

        // Cache picker instance
        this.picker = new pc.Picker(this.app, this.app.graphicsDevice.canvas.clientWidth, this.app.graphicsDevice.canvas.clientHeight);
        this.worldLayer = this.app.scene.layers.getLayerByName('World');
        this.pickerLayers = [this.worldLayer];

        // Initialize entity list
        this.trackedEntities = new Set();

        // Control detection frequency
        this.lastUpdateTime = 0;
        this.camera = null;
        this.syncAll = false;
    }

    // Add new entity to track
    addEntity(entity) {
        if (!this.trackedEntities.has(entity)) {
            this.trackedEntities.add(entity);
            return true;
        }
        return false;
    }

    // Remove tracked entity
    removeEntity(entity) {
        return this.trackedEntities.delete(entity);
    }

    // Clear all tracked entities
    clearEntities() {
        this.trackedEntities.clear();
    }

    update(dt) {
        const currentTime = new Date().getTime();
        const screenPos = new pc.Vec3();
        if (!this.camera) {
            this.camera = this.app.root.findByName('camera').camera;
        }
        
        // Iterate through all tracked entities
        this.trackedEntities.forEach(entity => {
            this.camera.worldToScreen(entity.getPosition(), screenPos);

            const currentPos = {
                top: screenPos.y / this.canvasRect.height,
                left: screenPos.x / this.canvasRect.width,
                distance: screenPos.z,
                occluded: false
            };

            // Get or initialize the entity's last position information
            if (!entity._lastScreenPos) {
                entity._lastScreenPos = {
                    top: 0,
                    left: 0,
                    distance: 0,
                    visible: false,
                    occluded: false
                };
            }

            // Check if within screen bounds
            currentPos.visible = (currentPos.left > 0 && 
                                currentPos.top > 0 && 
                                currentPos.left < 1 && 
                                currentPos.top < 1) &&
                                currentPos.distance > 0;

            // Check if position has changed
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
                            // Update picker dimensions (if canvas size changed)
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

    // Set occlusion detection interval
    setOcclusionInterval(interval) {
        this.occlusionUpdateInterval = interval;
    }

    destroy() {
        // Clean up resources
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        this.trackedEntities.clear();
        this.off('update', this.updateScreenPos);
        super.destroy();
    }
}

// Define script attributes
TraceScreenPosition.attributes.add('occlusionUpdateInterval', {
    type: 'number',
    default: -1,
    title: 'Occlusion Detection Interval (ms)',
    description: 'Set the time interval for occlusion detection, -1 means no occlusion detection'
});

// // Register script
// pc.registerScript(TraceScreenPosition, 'traceScreenPosition');

// Export script class for use elsewhere
export { TraceScreenPosition }; 