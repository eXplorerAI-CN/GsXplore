import * as pc from 'playcanvas';

// Solution 1: Use matrix decomposition
function convertToZeroZ(eulerAngles) {
    var quat = new pc.Quat();
    quat.setFromEulerAngles(eulerAngles.x, eulerAngles.y, eulerAngles.z);
    
    var forward = new pc.Vec3(0, 0, -1);
    quat.transformVector(forward, forward);
    
    var newEuler = new pc.Vec3();
    
    // Handle cases close to vertical up or down
    if (Math.abs(forward.y) > 0.9999) {
        // When close to vertical, keep current yaw value
        newEuler.y = eulerAngles.y;
        // Set pitch based on up or down
        newEuler.x = forward.y > 0 ? 90 : -90;
    } else {
        newEuler.y = Math.atan2(-forward.x, -forward.z) * pc.math.RAD_TO_DEG;
        var forwardLength = Math.sqrt(forward.x * forward.x + forward.z * forward.z);
        newEuler.x = Math.atan2(forward.y, forwardLength) * pc.math.RAD_TO_DEG;
    }
    
    newEuler.z = 0;
    
    return newEuler;
}

function genFlyCameraScript() {

var FlyCamera = pc.createScript('flyCamera');

FlyCamera.attributes.add('speed', {
    type: 'number',
    default: 10
});

FlyCamera.attributes.add('fastSpeed', {
    type: 'number',
    default: 1
});

FlyCamera.attributes.add('mode', {
    type: 'number',
    default: 0,
    enum: [{
        'Lock': 0
    }, {
        'Drag': 1
    }]
});

FlyCamera.prototype.initialize = function () {
    // Add event listeners on initialization
    this.attachEvents();
    this.on('destroy', this.detachEvents);
    this.on('enable', this.attachEvents);
    this.on('disable', this.detachEvents);

    this._lastPosition = this.entity.getPosition().clone();
    this._lastRotation = this.entity.getRotation().clone();

    console.log('flyCamera initialized');

    this.collisionDetected = false;
    this.lastValidPosition = this.entity.getPosition().clone();
    
    // Listen for collision events
    this.entity.collision.on('collisionstart', this._onCollisionStart, this);
    this.entity.collision.on('collisionend', this._onCollisionEnd, this);

    this.moveDirection = new pc.Vec3();
    this.attachKeyboardEvents();

    this.deltaEx = 0;
    this.deltaEy = 0;
    this.eXMax = 70;
    this.eXMin = -70;
    this.lockY = false;
    this.resetAfterMove = false;
    this.accumMoveFactor = new pc.Vec3(0,0,0);

    if (this.entity.rigidbody) {
        this.entity.rigidbody.teleport(this.entity.getPosition(), this.entity.getRotation());
    }
};

FlyCamera.prototype.setEulerAngles = function (eulerAngles) {   
    var newEulers = convertToZeroZ(eulerAngles);
    this.entity.setLocalEulerAngles(newEulers);

    // var eulers = this.entity.getLocalEulerAngles();
    var eulers = newEulers;
    this.ex = eulers.x;
    this.ey = eulers.y;
}

FlyCamera.prototype.attachEvents = function() {

    var currentEulers = this.entity.getLocalEulerAngles();
    this.setEulerAngles(currentEulers);

    this.moved = false;
    this.lmbDown = false;
    // Disabling the context menu stops the browser displaying a menu when
    // you right-click the page
    this.app.mouse.disableContextMenu();
    this.app.mouse.on(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
    this.app.mouse.on(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
    this.app.mouse.on(pc.EVENT_MOUSEUP, this.onMouseUp, this);
};

FlyCamera.prototype.detachEvents = function() {
    // this.app.mouse.enableContextMenu();
    this.app.mouse.off(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
    this.app.mouse.off(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
    this.app.mouse.off(pc.EVENT_MOUSEUP, this.onMouseUp, this);
};

FlyCamera.prototype.onEnable = function() {
    this.attachEvents();
};

FlyCamera.prototype.onDisable = function() {
    this.detachEvents();
};

FlyCamera.prototype.attachKeyboardEvents = function() {
    this.app.keyboard.on(pc.EVENT_KEYDOWN, this.onKeyDown, this);
    this.app.keyboard.on(pc.EVENT_KEYUP, this.onKeyUp, this);
};

FlyCamera.prototype.detachKeyboardEvents = function() {
    this.app.keyboard.off(pc.EVENT_KEYDOWN, this.onKeyDown, this);
    this.app.keyboard.off(pc.EVENT_KEYUP, this.onKeyUp, this);
};

FlyCamera.prototype.onKeyDown = function(event) {
    switch(event.key) {
        case pc.KEY_UP:
        case pc.KEY_W:
            this.moveDirection.z = -1;
            break;
        case pc.KEY_DOWN:
        case pc.KEY_S:
            this.moveDirection.z = 1;
            break;
        case pc.KEY_LEFT:
        case pc.KEY_A:
            this.moveDirection.x = -1;
            break;
        case pc.KEY_RIGHT:
        case pc.KEY_D:
            this.moveDirection.x = 1;
            break;
        case pc.KEY_R:
            this.moveDirection.y = 1;
            break;
        case pc.KEY_F:
            this.moveDirection.y = -1;
            break;
    }
};

FlyCamera.prototype.onKeyUp = function(event) {
    switch(event.key) {
        case pc.KEY_UP:
        case pc.KEY_W:
        case pc.KEY_DOWN:
        case pc.KEY_S:
            this.moveDirection.z = 0;
            break;
        case pc.KEY_LEFT:
        case pc.KEY_A:
        case pc.KEY_RIGHT:
        case pc.KEY_D:
            this.moveDirection.x = 0;
            break;
        case pc.KEY_R:
        case pc.KEY_F:
            this.moveDirection.y = 0;
            break;
    }
};

FlyCamera.prototype.update = function (dt) {
    // Update camera direction
    if (this.entity.rigidbody) {
        if (this.deltaEx != 0 || this.deltaEy != 0) {
            if (this.entity.rigidbody.type == 'static') {
                this.entity.rigidbody.type = 'dynamic';
            }
            this.ex += this.deltaEx;
            // this.ex = pc.math.clamp(this.ex, -90, 90);
            this.ex = pc.math.clamp(this.ex, this.eXMin, this.eXMax);
            this.ey -= this.deltaEy;

            this.entity.rigidbody.teleport(this.entity.getPosition(), new pc.Quat().setFromEulerAngles(this.ex, this.ey, 0));
            this.deltaEx = 0;
            this.deltaEy = 0;
        }

        if (!this.moveDirection.equals(pc.Vec3.ZERO) || this.resetAfterMove) {
            if (this.entity.rigidbody.type == 'static') {
                this.entity.rigidbody.type = 'dynamic';
            }
            const movement = new pc.Vec3();
            const normalizedDirection = this.moveDirection.clone();

            // const speed = 0.0001;
            normalizedDirection.scale(this.speed);

            if (this.resetAfterMove) {
                normalizedDirection.add(this.accumMoveFactor);
            }

            movement.add(this.entity.forward.clone().scale(normalizedDirection.z * -1));
            movement.add(this.entity.right.clone().scale(normalizedDirection.x));
            movement.add(this.entity.up.clone().scale(normalizedDirection.y+0.15));

            if (this.lockY) {
                movement.y = 0;
            }
            this.entity.rigidbody.linearVelocity = movement;

            // const newPosition = this.entity.getPosition().clone().add(movement.scale(0.01));
            // this.entity.rigidbody.teleport(newPosition, this.entity.getRotation());

            if (this.resetAfterMove) {
                this.resetAfterMove = false;
                this.accumMoveFactor.x = 0;
                this.accumMoveFactor.y = 0;
                this.accumMoveFactor.z = 0;
            }
        } else {
            if (this.entity.rigidbody.type == 'dynamic') {
                this.entity.rigidbody.type = 'static';
            }
        }

    } else {
        // If there is no rigidbody, directly set Euler angles
        this.entity.setLocalEulerAngles(this.ex, this.ey, this.ez);
        this.entity.setPosition(newPosition);
    }

    // // Check if in input state
    // if (document.activeElement &&
    //     (document.activeElement.tagName === 'INPUT' ||
    //         document.activeElement.tagName === 'TEXTAREA' ||
    //         document.activeElement.isContentEditable)) {
    //     return;
    // }

    // Event trigger logic
    if (this.events) {
        const currentPosition = this.entity.getPosition();
        const currentRotation = this.entity.getRotation();

        if (!this._lastPosition.equals(currentPosition) || !this._lastRotation.equals(currentRotation)) {
            this.events.fire('cameraMove', {
                position: currentPosition.clone(),
                rotation: currentRotation.clone(),
                eulerAngles: this.entity.getEulerAngles().clone()
            });

            this._lastPosition.copy(currentPosition);
            this._lastRotation.copy(currentRotation);
        }
    }
};

FlyCamera.prototype.setCameraVelocity = function (dx, dy, dz) {
    this.moveDirection.x = dx;
    this.moveDirection.y = dy;
    this.moveDirection.z = dz;
}

FlyCamera.prototype.moveCamera = function (dx, dy, dz) {
    this.accumMoveFactor.x += dx;
    this.accumMoveFactor.y += dy;
    this.accumMoveFactor.z += dz;
    this.resetAfterMove = true;
}

FlyCamera.prototype.rotateCamera = function (dx, dy, dz) {
    if (dx != 0 || dy != 0) {
        this.ex += dy;
        this.ex = pc.math.clamp(this.ex, this.eXMin, this.eXMax);
        this.ey -= dx;

        this.deltaEx += dy;
        this.deltaEy += dx;
    }
}   


FlyCamera.prototype.onMouseMove = function (event) {
    if (!this.mode) {
        if (!pc.Mouse.isPointerLocked()) {
            return;
        }
    } else {
        if (!this.lmbDown) {
            return;
        }
    }

    if (!this.lmbDown) {
        return;
    }


    // Update the current Euler angles, clamp the pitch.
    if (!this.moved) {
        // first move event can be very large
        this.moved = true;
        return;
    }
    // this.ex -= event.dy / 5;
    // this.ex = pc.math.clamp(this.ex, -90, 90);
    // this.ey -= event.dx;
    this.rotateCamera(event.dx / 5, -event.dy / 5, 0);
};

FlyCamera.prototype.onMouseDown = function (event) {
    const canvas = this.app.graphicsDevice.canvas;
    if (event.event.target !== canvas) {
        return;
    }
    if (event.button === 0) {
        this.lmbDown = true;

        // When the mouse button is clicked try and capture the pointer
        if (!this.mode && !pc.Mouse.isPointerLocked()) {
            this.app.mouse.enablePointerLock();
        }
    }
};

FlyCamera.prototype.onMouseUp = function (event) {
    if (event.button === 0) {
        this.lmbDown = false;
        // When mode is Lock(0), release pointer lock on left mouse button up
        if (!this.mode && pc.Mouse.isPointerLocked()) {
            this.app.mouse.disablePointerLock();
        }
    }
};

FlyCamera.prototype._onCollisionStart = function (result) {
    this.collisionDetected = true;
    
    // Calculate collision normal
    const normal = result.contacts[0].normal;
    
    // Adjust movement direction based on collision normal
    if (this.movement) {
        // Project movement vector onto collision plane
        const dot = this.movement.dot(normal);
        if (dot < 0) {
            this.movement.sub(normal.scale(dot));
        }
    }
    
    // If collision occurs, revert to last valid position
    this.entity.setPosition(this.lastValidPosition);
};

FlyCamera.prototype._onCollisionEnd = function () {
    this.collisionDetected = false;
};

FlyCamera.prototype.destroy = function () {
    // Remove collision event listeners
    if (this.entity.collision) {
        this.entity.collision.off('collisionstart', this._onCollisionStart, this);
        this.entity.collision.off('collisionend', this._onCollisionEnd, this);
    }
    this.detachKeyboardEvents();
};

    return FlyCamera;
}

export { genFlyCameraScript }