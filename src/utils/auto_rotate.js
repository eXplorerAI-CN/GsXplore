// import * as pc from '../../engine';
import * as pc from 'playcanvas';

function init(name = 'autoRotate') {

    // Add auto-rotation script
    const AutoRotate = pc.createScript(name);

    // Add script attributes
    AutoRotate.attributes.add('rotationSpeed', {
        type: 'number',
        default: 10,
        title: 'Rotation Speed'
    });

    // Initialize
    AutoRotate.prototype.initialize = function () {
        // Add initialization logic here
    };

    // Update every frame
    AutoRotate.prototype.update = function (dt) {
        // Rotate around Y axis, speed determined by rotationSpeed
        this.entity.rotate(0, this.rotationSpeed * dt, 0);
    };
    
    return AutoRotate;
}

export { init };
