import * as pc from 'playcanvas';
////////////////////////////////////////////////////////////////////////////////
//                             Orbit Camera Script                            //
////////////////////////////////////////////////////////////////////////////////

function genOrbitCameraScript(){

var OrbitCamera = pc.createScript('orbitCamera');

OrbitCamera.attributes.add('distanceMax', { type: 'number', default: 0, title: 'Distance Max', description: 'Setting this at 0 will give an infinite distance limit' });
OrbitCamera.attributes.add('distanceMin', { type: 'number', default: 0, title: 'Distance Min' });
OrbitCamera.attributes.add('pitchAngleMax', { type: 'number', default: 90, title: 'Pitch Angle Max (degrees)' });
OrbitCamera.attributes.add('pitchAngleMin', { type: 'number', default: -90, title: 'Pitch Angle Min (degrees)' });

OrbitCamera.attributes.add('inertiaFactor', {
    type: 'number',
    default: 0,
    title: 'Inertia Factor',
    description: 'Higher value means that the camera will continue moving after the user has stopped dragging. 0 is fully responsive.'
});

OrbitCamera.attributes.add('focusEntity', {
    type: 'entity',
    title: 'Focus Entity',
    description: 'Entity for the camera to focus on. If blank, then the camera will use the whole scene'
});

OrbitCamera.attributes.add('frameOnStart', {
    type: 'boolean',
    default: true,
    title: 'Frame on Start',
    description: 'Frames the entity or scene at the start of the application."'
});


// Property to get and set the distance between the pivot point and camera
// Clamped between this.distanceMin and this.distanceMax
Object.defineProperty(OrbitCamera.prototype, "distance", {
    get: function () {
        return this._targetDistance;
    },

    set: function (value) {
        this._targetDistance = this._clampDistance(value);
    }
});

// Property to get and set the camera orthoHeight
// Clamped above 0
Object.defineProperty(OrbitCamera.prototype, "orthoHeight", {
    get: function () {
        return this.entity.camera.orthoHeight;
    },

    set: function (value) {
        this.entity.camera.orthoHeight = Math.max(0, value);
    }
});


// Property to get and set the pitch of the camera around the pivot point (degrees)
// Clamped between this.pitchAngleMin and this.pitchAngleMax
// When set at 0, the camera angle is flat, looking along the horizon
Object.defineProperty(OrbitCamera.prototype, "pitch", {
    get: function () {
        return this._targetPitch;
    },

    set: function (value) {
        this._targetPitch = this._clampPitchAngle(value);
    }
});


// Property to get and set the yaw of the camera around the pivot point (degrees)
Object.defineProperty(OrbitCamera.prototype, "yaw", {
    get: function () {
        return this._targetYaw;
    },

    set: function (value) {
        this._targetYaw = value;

        // Ensure that the yaw takes the shortest route by making sure that
        // the difference between the targetYaw and the actual is 180 degrees
        // in either direction
        var diff = this._targetYaw - this._yaw;
        var reminder = diff % 360;
        if (reminder > 180) {
            this._targetYaw = this._yaw - (360 - reminder);
        } else if (reminder < -180) {
            this._targetYaw = this._yaw + (360 + reminder);
        } else {
            this._targetYaw = this._yaw + reminder;
        }
    }
});


// Property to get and set the world position of the pivot point that the camera orbits around
Object.defineProperty(OrbitCamera.prototype, "pivotPoint", {
    get: function () {
        return this._pivotPoint;
    },

    set: function (value) {
        this._pivotPoint.copy(value);
    }
});


// Moves the camera to look at an entity and all its children so they are all in the view
OrbitCamera.prototype.focus = function (focusEntity) {
    // Calculate an bounding box that encompasses all the models to frame in the camera view
    this._buildAabb(focusEntity);

    var halfExtents = this._modelsAabb.halfExtents;
    var radius = Math.max(halfExtents.x, Math.max(halfExtents.y, halfExtents.z));

    this.distance = (radius * 1.5) / Math.sin(0.5 * this.entity.camera.fov * pc.math.DEG_TO_RAD);

    this._removeInertia();

    this._pivotPoint.copy(this._modelsAabb.center);
};


OrbitCamera.distanceBetween = new pc.Vec3();

// Set the camera position to a world position and look at a world position
// Useful if you have multiple viewing angles to swap between in a scene
OrbitCamera.prototype.resetAndLookAtPoint = function (resetPoint, lookAtPoint) {
    this.pivotPoint.copy(lookAtPoint);
    this.entity.setPosition(resetPoint);

    this.entity.lookAt(lookAtPoint);

    var distance = OrbitCamera.distanceBetween;
    distance.sub2(lookAtPoint, resetPoint);
    this.distance = distance.length();

    this.pivotPoint.copy(lookAtPoint);

    var cameraQuat = this.entity.getRotation();
    this.yaw = this._calcYaw(cameraQuat);
    this.pitch = this._calcPitch(cameraQuat, this.yaw);

    this._removeInertia();
    this._updatePosition();
};


// Set camera position to a world position and look at an entity in the scene
// Useful if you have multiple models to swap between in a scene
OrbitCamera.prototype.resetAndLookAtEntity = function (resetPoint, entity) {
    this._buildAabb(entity);
    this.resetAndLookAtPoint(resetPoint, this._modelsAabb.center);
};


// Set the camera at a specific, yaw, pitch and distance without inertia (instant cut)
OrbitCamera.prototype.reset = function (yaw, pitch, distance) {
    this.pitch = pitch;
    this.yaw = yaw;
    this.distance = distance;

    this._removeInertia();
};

/////////////////////////////////////////////////////////////////////////////////////////////
// Private methods

OrbitCamera.prototype.initialize = function () {
    var self = this;
    var onWindowResize = function () {
        self._checkAspectRatio();
    };

    this._lastPosition = this.entity.getPosition().clone();
    this._lastRotation = this.entity.getRotation().clone();

    window.addEventListener('resize', onWindowResize, false);

    this._checkAspectRatio();

    // Find all the models in the scene that are under the focused entity
    this._modelsAabb = new pc.BoundingBox();
    this._buildAabb(this.focusEntity || this.app.root);

    this.entity.lookAt(this._modelsAabb.center);

    this._pivotPoint = new pc.Vec3();
    this._pivotPoint.copy(this._modelsAabb.center);

    // 添加 pivotVelocity 属性，用于存储 pivotPoint 的移动速度
    this._pivotVelocity = new pc.Vec3();

    // Calculate the camera euler angle rotation around x and y axes
    // This allows us to place the camera at a particular rotation to begin with in the scene
    var cameraQuat = this.entity.getRotation();

    // Preset the camera
    this._yaw = this._calcYaw(cameraQuat);
    this._pitch = this._clampPitchAngle(this._calcPitch(cameraQuat, this._yaw));
    this.entity.setLocalEulerAngles(this._pitch, this._yaw, 0);

    this._distance = 0;

    this._targetYaw = this._yaw;
    this._targetPitch = this._pitch;

    this.autoRotateYaw = 0;

    // If we have ticked focus on start, then attempt to position the camera where it frames
    // the focused entity and move the pivot point to entity's position otherwise, set the distance
    // to be between the camera position in the scene and the pivot point
    if (this.frameOnStart) {
        this.focus(this.focusEntity || this.app.root);
    } else {
        var distanceBetween = new pc.Vec3();
        distanceBetween.sub2(this.entity.getPosition(), this._pivotPoint);
        this._distance = this._clampDistance(distanceBetween.length());
    }

    this._targetDistance = this._distance;

    // Reapply the clamps if they are changed in the editor
    this.on('attr:distanceMin', function (value, prev) {
        this._distance = this._clampDistance(this._distance);
    });

    this.on('attr:distanceMax', function (value, prev) {
        this._distance = this._clampDistance(this._distance);
    });

    this.on('attr:pitchAngleMin', function (value, prev) {
        this._pitch = this._clampPitchAngle(this._pitch);
    });

    this.on('attr:pitchAngleMax', function (value, prev) {
        this._pitch = this._clampPitchAngle(this._pitch);
    });

    // Focus on the entity if we change the focus entity
    this.on('attr:focusEntity', function (value, prev) {
        if (this.frameOnStart) {
            this.focus(value || this.app.root);
        } else {
            this.resetAndLookAtEntity(this.entity.getPosition(), value || this.app.root);
        }
    });

    this.on('attr:frameOnStart', function (value, prev) {
        if (value) {
            this.focus(this.focusEntity || this.app.root);
        }
    });

    this.on('destroy', function () {
        window.removeEventListener('resize', onWindowResize, false);
    });
};


OrbitCamera.prototype.update = function (dt) {
    this.yaw += this.autoRotateYaw * dt;
    // Add inertia, if any
    var t = this.inertiaFactor === 0 ? 1 : Math.min(dt / this.inertiaFactor, 1);
    this._distance = pc.math.lerp(this._distance, this._targetDistance, t);
    this._yaw = pc.math.lerp(this._yaw, this._targetYaw, t);
    this._pitch = pc.math.lerp(this._pitch, this._targetPitch, t);

    // 应用 pivotVelocity 到 pivotPoint
    if (this._pivotVelocity.x !== 0 || this._pivotVelocity.y !== 0 || this._pivotVelocity.z !== 0) {
        this._pivotPoint.add(this._pivotVelocity);
    }

    this._updatePosition();
};

OrbitCamera.prototype.rotateCamera = function (dx, dy) {
    this.yaw += dx;
    this.pitch += dy;
    if (this.autoRotateYaw !== 0) {
        this.autoRotateYaw = 0;
        if (this.events) {
            this.events.fire('setAutoRotateYaw', {
                autoRotateYaw: this.autoRotateYaw,
            });
        }
    }
};

OrbitCamera.prototype.setAutoRotateYaw = function (yaw) {
    if (this.autoRotateYaw !== yaw) {
        this.autoRotateYaw = yaw;
        if (this.events) {
            this.events.fire('setAutoRotateYaw', {
                autoRotateYaw: this.autoRotateYaw,
            });
        }
    }
};

OrbitCamera.prototype.setDistance = function (distance) {
    if (this.distance !== distance) {
        this.distance = distance;
        if (this.events) {
            this.events.fire('setDistance', {
                distance: this.distance,
            });
        }
    }
};

OrbitCamera.prototype._updatePosition = function () {
    var eulers = this.entity.getLocalEulerAngles();
    // Work out the camera position based on the pivot point, pitch, yaw and distance
    this.entity.setLocalPosition(0, 0, 0);
    this.entity.setLocalEulerAngles(this._pitch, this._yaw, 0);

    var position = this.entity.getPosition();
    position.copy(this.entity.forward);
    position.mulScalar(-this._distance);
    position.add(this.pivotPoint);
    this.entity.setPosition(position);

    if (this.events) {
        const currentPosition = this.entity.getPosition();
        const currentRotation = this.entity.getRotation();
        
        if (!this._lastPosition.equals(currentPosition) || !this._lastRotation.equals(currentRotation)) {
            this.events.fire('cameraMove', {
            position: currentPosition.clone(),
            rotation: currentRotation.clone(),
            eulerAngles: this.entity.getEulerAngles().clone()
        });

        // 更新上一帧的位置和旋转
        this._lastPosition.copy(currentPosition);
        this._lastRotation.copy(currentRotation);
        }
    }
};


OrbitCamera.prototype._removeInertia = function () {
    this._yaw = this._targetYaw;
    this._pitch = this._targetPitch;
    this._distance = this._targetDistance;
};


OrbitCamera.prototype._checkAspectRatio = function () {
    var height = this.app.graphicsDevice.height;
    var width = this.app.graphicsDevice.width;

    // Match the axis of FOV to match the aspect ratio of the canvas so
    // the focused entities is always in frame
    this.entity.camera.horizontalFov = height > width;
};


OrbitCamera.prototype._buildAabb = function (entity) {
    var i, m, meshInstances = [];

    var renders = entity.findComponents("render");
    for (i = 0; i < renders.length; i++) {
        var render = renders[i];
        for (m = 0; m < render.meshInstances.length; m++) {
            meshInstances.push(render.meshInstances[m]);
        }
    }

    var models = entity.findComponents("model");
    for (i = 0; i < models.length; i++) {
        var model = models[i];
        for (m = 0; m < model.meshInstances.length; m++) {
            meshInstances.push(model.meshInstances[m]);
        }
    }

    var gsplats = entity.findComponents("gsplat");
    for (i = 0; i < gsplats.length; i++) {
        var gsplat = gsplats[i];
        var instance = gsplat.instance;
        if (instance?.meshInstance) {
            meshInstances.push(instance.meshInstance);
        }
    }

    for (i = 0; i < meshInstances.length; i++) {
        if (i === 0) {
            this._modelsAabb.copy(meshInstances[i].aabb);
        } else {
            this._modelsAabb.add(meshInstances[i].aabb);
        }
    }
};


OrbitCamera.prototype._calcYaw = function (quat) {
    var transformedForward = new pc.Vec3();
    quat.transformVector(pc.Vec3.FORWARD, transformedForward);

    return Math.atan2(-transformedForward.x, -transformedForward.z) * pc.math.RAD_TO_DEG;
};


OrbitCamera.prototype._clampDistance = function (distance) {
    if (this.distanceMax > 0) {
        return pc.math.clamp(distance, this.distanceMin, this.distanceMax);
    }
    return Math.max(distance, this.distanceMin);

};


OrbitCamera.prototype._clampPitchAngle = function (pitch) {
    // Negative due as the pitch is inversed since the camera is orbiting the entity
    return pc.math.clamp(pitch, -this.pitchAngleMax, -this.pitchAngleMin);
};


OrbitCamera.quatWithoutYaw = new pc.Quat();
OrbitCamera.yawOffset = new pc.Quat();

OrbitCamera.prototype._calcPitch = function (quat, yaw) {
    var quatWithoutYaw = OrbitCamera.quatWithoutYaw;
    var yawOffset = OrbitCamera.yawOffset;

    yawOffset.setFromEulerAngles(0, -yaw, 0);
    quatWithoutYaw.mul2(yawOffset, quat);

    var transformedForward = new pc.Vec3();

    quatWithoutYaw.transformVector(pc.Vec3.FORWARD, transformedForward);

    return Math.atan2(transformedForward.y, -transformedForward.z) * pc.math.RAD_TO_DEG;
};


////////////////////////////////////////////////////////////////////////////////
//                       Orbit Camera Mouse Input Script                      //
////////////////////////////////////////////////////////////////////////////////
var OrbitCameraInputMouse = pc.createScript('orbitCameraInputMouse');

OrbitCameraInputMouse.attributes.add('orbitSensitivity', {
    type: 'number',
    default: 0.3,
    title: 'Orbit Sensitivity',
    description: 'How fast the camera moves around the orbit. Higher is faster'
});

OrbitCameraInputMouse.attributes.add('distanceSensitivity', {
    type: 'number',
    default: 0.15,
    title: 'Distance Sensitivity',
    description: 'How fast the camera moves in and out. Higher is faster'
});

// initialize code called once per entity
OrbitCameraInputMouse.prototype.initialize = function () {
    this.orbitCamera = this.entity.script.orbitCamera;

    if (this.orbitCamera) {
        var self = this;

        var onMouseOut = function (e) {
            self.onMouseOut(e);
        };

        this.attachEvents();

        // Remove the listeners so if this entity is destroyed
        this.on('destroy', function () {
           this.detachEvents();
        });
    }

    // Disabling the context menu stops the browser displaying a menu when
    // you right-click the page
    this.app.mouse.disableContextMenu();

    this.lookButtonDown = false;
    this.panButtonDown = false;
    this.lastPoint = new pc.Vec2();
};

OrbitCameraInputMouse.prototype.attachEvents = function () {
    this.app.mouse.on(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
    this.app.mouse.on(pc.EVENT_MOUSEUP, this.onMouseUp, this);
    this.app.mouse.on(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
    this.app.mouse.on(pc.EVENT_MOUSEWHEEL, this.onMouseWheel, this);
    window.addEventListener('mouseout', this.onMouseOut, false);
}

OrbitCameraInputMouse.prototype.detachEvents = function () {
    this.app.mouse.off(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
    this.app.mouse.off(pc.EVENT_MOUSEUP, this.onMouseUp, this);
    this.app.mouse.off(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
    this.app.mouse.off(pc.EVENT_MOUSEWHEEL, this.onMouseWheel, this);
    window.removeEventListener('mouseout', this.onMouseOut, false);
}

OrbitCameraInputMouse.fromWorldPoint = new pc.Vec3();
OrbitCameraInputMouse.toWorldPoint = new pc.Vec3();
OrbitCameraInputMouse.worldDiff = new pc.Vec3();


OrbitCameraInputMouse.prototype.pan = function (screenPoint) {
    var fromWorldPoint = OrbitCameraInputMouse.fromWorldPoint;
    var toWorldPoint = OrbitCameraInputMouse.toWorldPoint;
    var worldDiff = OrbitCameraInputMouse.worldDiff;

    // For panning to work at any zoom level, we use screen point to world projection
    // to work out how far we need to pan the pivotEntity in world space
    var camera = this.entity.camera;
    var distance = this.orbitCamera.distance;

    camera.screenToWorld(screenPoint.x, screenPoint.y, distance, fromWorldPoint);
    camera.screenToWorld(this.lastPoint.x, this.lastPoint.y, distance, toWorldPoint);

    worldDiff.sub2(toWorldPoint, fromWorldPoint);

    this.orbitCamera.pivotPoint.add(worldDiff);
};


OrbitCameraInputMouse.prototype.onMouseDown = function (event) {
    switch (event.button) {
        case pc.MOUSEBUTTON_LEFT:
            this.lookButtonDown = true;
            break;
        case pc.MOUSEBUTTON_MIDDLE:
        case pc.MOUSEBUTTON_RIGHT:
            this.panButtonDown = true;
            break;
    }
};


OrbitCameraInputMouse.prototype.onMouseUp = function (event) {
    switch (event.button) {
        case pc.MOUSEBUTTON_LEFT:
            this.lookButtonDown = false;
            break;
        case pc.MOUSEBUTTON_MIDDLE:
        case pc.MOUSEBUTTON_RIGHT:
            this.panButtonDown = false;
            break;
    }
};


OrbitCameraInputMouse.prototype.onMouseMove = function (event) {
    if (this.lookButtonDown) {
        this.orbitCamera.pitch -= event.dy * this.orbitSensitivity;
        this.orbitCamera.yaw -= event.dx * this.orbitSensitivity;
        if (this.orbitCamera.autoRotateYaw !== 0) {
            this.orbitCamera.autoRotateYaw = 0;
            if (this.orbitCamera.events) {
                this.orbitCamera.events.fire('setAutoRotateYaw', {
                    autoRotateYaw: this.orbitCamera.autoRotateYaw,
                });
            }
        }
    } else if (this.panButtonDown) {
        if (this.orbitCamera.autoRotateYaw !== 0) {
            this.orbitCamera.autoRotateYaw = 0;
            if (this.orbitCamera.events) {
                this.orbitCamera.events.fire('setAutoRotateYaw', {
                    autoRotateYaw: this.orbitCamera.autoRotateYaw,
                });
            }
        }
        this.pan(event);
    }

    this.lastPoint.set(event.x, event.y);
};


OrbitCameraInputMouse.prototype.onMouseWheel = function (event) {
    if (this.entity.camera.projection === pc.PROJECTION_PERSPECTIVE) {
        this.orbitCamera.distance -= event.wheel * this.distanceSensitivity * (this.orbitCamera.distance * 0.1);
    } else {
        this.orbitCamera.orthoHeight -= event.wheel * this.distanceSensitivity;
    }
    event.event.preventDefault();
};


OrbitCameraInputMouse.prototype.onMouseOut = function (event) {
    this.lookButtonDown = false;
    this.panButtonDown = false;
};


////////////////////////////////////////////////////////////////////////////////
//                       Orbit Camera Touch Input Script                      //
////////////////////////////////////////////////////////////////////////////////
var OrbitCameraInputTouch = pc.createScript('orbitCameraInputTouch');

OrbitCameraInputTouch.attributes.add('orbitSensitivity', {
    type: 'number',
    default: 0.4,
    title: 'Orbit Sensitivity',
    description: 'How fast the camera moves around the orbit. Higher is faster'
});

OrbitCameraInputTouch.attributes.add('distanceSensitivity', {
    type: 'number',
    default: 0.2,
    title: 'Distance Sensitivity',
    description: 'How fast the camera moves in and out. Higher is faster'
});

// initialize code called once per entity
OrbitCameraInputTouch.prototype.initialize = function () {
    this.orbitCamera = this.entity.script.orbitCamera;

    // Store the position of the touch so we can calculate the distance moved
    this.lastTouchPoint = new pc.Vec2();
    this.lastPinchMidPoint = new pc.Vec2();
    this.lastPinchDistance = 0;

    if (this.orbitCamera && this.app.touch) {
        // Use the same callback for the touchStart, touchEnd and touchCancel events as they
        // all do the same thing which is to deal the possible multiple touches to the screen
        this.attachEvents();

        this.on('destroy', function () {
            this.detachEvents();
        });
    }
};


OrbitCameraInputTouch.prototype.attachEvents = function () {
    this.app.touch.on(pc.EVENT_TOUCHSTART, this.onTouchStartEndCancel, this);
    this.app.touch.on(pc.EVENT_TOUCHEND, this.onTouchStartEndCancel, this);
    this.app.touch.on(pc.EVENT_TOUCHCANCEL, this.onTouchStartEndCancel, this);

    this.app.touch.on(pc.EVENT_TOUCHMOVE, this.onTouchMove, this);
}


OrbitCameraInputTouch.prototype.detachEvents = function () {
    this.app.touch.off(pc.EVENT_TOUCHSTART, this.onTouchStartEndCancel, this);
    this.app.touch.off(pc.EVENT_TOUCHEND, this.onTouchStartEndCancel, this);
    this.app.touch.off(pc.EVENT_TOUCHCANCEL, this.onTouchStartEndCancel, this);

    this.app.touch.off(pc.EVENT_TOUCHMOVE, this.onTouchMove, this);
}

OrbitCameraInputTouch.prototype.getPinchDistance = function (pointA, pointB) {
    // Return the distance between the two points
    var dx = pointA.x - pointB.x;
    var dy = pointA.y - pointB.y;

    return Math.sqrt((dx * dx) + (dy * dy));
};


OrbitCameraInputTouch.prototype.calcMidPoint = function (pointA, pointB, result) {
    result.set(pointB.x - pointA.x, pointB.y - pointA.y);
    result.mulScalar(0.5);
    result.x += pointA.x;
    result.y += pointA.y;
};


OrbitCameraInputTouch.prototype.onTouchStartEndCancel = function (event) {
    // We only care about the first touch for camera rotation. As the user touches the screen,
    // we stored the current touch position
    var touches = event.touches;
    if (touches.length === 1) {
        this.lastTouchPoint.set(touches[0].x, touches[0].y);

    } else if (touches.length === 2) {
        // If there are 2 touches on the screen, then set the pinch distance
        this.lastPinchDistance = this.getPinchDistance(touches[0], touches[1]);
        this.calcMidPoint(touches[0], touches[1], this.lastPinchMidPoint);
    }
};


OrbitCameraInputTouch.fromWorldPoint = new pc.Vec3();
OrbitCameraInputTouch.toWorldPoint = new pc.Vec3();
OrbitCameraInputTouch.worldDiff = new pc.Vec3();


OrbitCameraInputTouch.prototype.pan = function (midPoint) {
    var fromWorldPoint = OrbitCameraInputTouch.fromWorldPoint;
    var toWorldPoint = OrbitCameraInputTouch.toWorldPoint;
    var worldDiff = OrbitCameraInputTouch.worldDiff;

    // For panning to work at any zoom level, we use screen point to world projection
    // to work out how far we need to pan the pivotEntity in world space
    var camera = this.entity.camera;
    var distance = this.orbitCamera.distance;

    camera.screenToWorld(midPoint.x, midPoint.y, distance, fromWorldPoint);
    camera.screenToWorld(this.lastPinchMidPoint.x, this.lastPinchMidPoint.y, distance, toWorldPoint);

    worldDiff.sub2(toWorldPoint, fromWorldPoint);

    this.orbitCamera.pivotPoint.add(worldDiff);
};


OrbitCameraInputTouch.pinchMidPoint = new pc.Vec2();

OrbitCameraInputTouch.prototype.onTouchMove = function (event) {
    var pinchMidPoint = OrbitCameraInputTouch.pinchMidPoint;

    // We only care about the first touch for camera rotation. Work out the difference moved since the last event
    // and use that to update the camera target position
    var touches = event.touches;
    if (touches.length === 1) {
        var touch = touches[0];

        this.orbitCamera.pitch -= (touch.y - this.lastTouchPoint.y) * this.orbitSensitivity;
        this.orbitCamera.yaw -= (touch.x - this.lastTouchPoint.x) * this.orbitSensitivity;

        this.lastTouchPoint.set(touch.x, touch.y);

    } else if (touches.length === 2) {
        // Calculate the difference in pinch distance since the last event
        var currentPinchDistance = this.getPinchDistance(touches[0], touches[1]);
        var diffInPinchDistance = currentPinchDistance - this.lastPinchDistance;
        this.lastPinchDistance = currentPinchDistance;

        this.orbitCamera.distance -= (diffInPinchDistance * this.distanceSensitivity * 0.1) * (this.orbitCamera.distance * 0.1);

        // Calculate pan difference
        this.calcMidPoint(touches[0], touches[1], pinchMidPoint);
        this.pan(pinchMidPoint);
        this.lastPinchMidPoint.copy(pinchMidPoint);
    }
};

// 添加 setPivotVelocity 函数，用于设置 pivotPoint 的移动速度
OrbitCamera.prototype.setPivotVelocity = function (dx, dy, dz) {
    // 获取相机的朝向向量
    var forward = this.entity.forward.clone().normalize();
    var right = this.entity.right.clone().normalize();
    var up = this.entity.up.clone().normalize();
    
    // 创建一个基于相机朝向的移动向量
    var moveVec = new pc.Vec3();
    
    // 前后移动 (z轴)
    if (dz !== 0) {
        var forwardVec = forward.clone().mulScalar(dz);
        moveVec.add(forwardVec);
    }
    
    // 左右移动 (x轴)
    if (dx !== 0) {
        var rightVec = right.clone().mulScalar(dx);
        moveVec.add(rightVec);
    }
    
    // 上下移动 (y轴)
    if (dy !== 0) {
        var upVec = up.clone().mulScalar(dy);
        moveVec.add(upVec);
    }
    
    // 设置结果到pivotVelocity
    this._pivotVelocity.copy(moveVec);
    
    // 如果设置了速度，则停止自动旋转
    if (dx !== 0 || dy !== 0 || dz !== 0) {
        if (this.autoRotateYaw !== 0) {
            this.autoRotateYaw = 0;
            if (this.events) {
                this.events.fire('setAutoRotateYaw', {
                    autoRotateYaw: this.autoRotateYaw,
                });
            }
        }
    }
};

OrbitCamera.prototype.movePivotVelocity = function (dx, dy, dz) {
    // 获取相机的朝向向量
    var forward = this.entity.forward.clone().normalize();
    var right = this.entity.right.clone().normalize();
    var up = this.entity.up.clone().normalize();

    // 创建一个基于相机朝向的移动向量
    var moveVec = new pc.Vec3();

    // 前后移动 (z轴)
    if (dz !== 0) {
        var forwardVec = forward.clone().mulScalar(dz);
        moveVec.add(forwardVec);
    }

    // 左右移动 (x轴)
    if (dx !== 0) {
        var rightVec = right.clone().mulScalar(dx);
        moveVec.add(rightVec);
    }

    // 上下移动 (y轴)
    if (dy !== 0) {
        var upVec = up.clone().mulScalar(dy);
        moveVec.add(upVec);
    }

    this._pivotPoint.add(moveVec);
};

}

export {genOrbitCameraScript}
