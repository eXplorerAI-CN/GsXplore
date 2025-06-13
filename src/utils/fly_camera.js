// import * as pc from '../../engine';
import * as pc from 'playcanvas';
////////////////////////////////////////////////////////////////////////////////
//                             Orbit Camera Script                            //
////////////////////////////////////////////////////////////////////////////////

// 方案1：使用矩阵分解
function convertToZeroZ(eulerAngles) {
    var quat = new pc.Quat();
    quat.setFromEulerAngles(eulerAngles.x, eulerAngles.y, eulerAngles.z);
    
    var forward = new pc.Vec3(0, 0, -1);
    quat.transformVector(forward, forward);
    
    var newEuler = new pc.Vec3();
    
    // 处理接近垂直向上或向下的情况
    if (Math.abs(forward.y) > 0.9999) {
        // 接近垂直时，保持当前的yaw值
        newEuler.y = eulerAngles.y;
        // 根据向上还是向下设置pitch
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
    // this.events = new pc.EventHandler();
    // 初始化时添加事件监听
    this.attachEvents();
    this.on('destroy', this.detachEvents);
    this.on('enable', this.attachEvents);
    this.on('disable', this.detachEvents);

    this._lastPosition = this.entity.getPosition().clone();
    this._lastRotation = this.entity.getRotation().clone();

    console.log('flyCamera initialized');

    this.collisionDetected = false;
    this.lastValidPosition = this.entity.getPosition().clone();
    
    // 监听碰撞事件
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
    // 更新相机的方向
    if (this.entity.rigidbody) {
        // if (this.rotated) {
        //     const targetRotation = new pc.Quat();
        //     targetRotation.setFromEulerAngles(this.ex, this.ey, 0);
        //     this.entity.rigidbody.teleport(this.entity.getPosition(), targetRotation);
        //     this.rotated = false;
        // }



        // // // 获取移动速度
        // // var speed = this.app.keyboard.isPressed(pc.KEY_SHIFT) ? this.fastSpeed : this.speed;
        // // speed *= 10;
        // const speed = 1;

        // // 如果有移动输入
        // if (!this.moveDirection.equals(pc.Vec3.ZERO)) {
        //     if (this.entity.rigidbody.type == 'static') {
        //         this.entity.rigidbody.type = 'dynamic';
        //     }

        //     const movement = new pc.Vec3();
        //     const normalizedDirection = this.moveDirection.clone();
        //     normalizedDirection.scale(speed);

        //     movement.add(this.entity.forward.clone().scale(normalizedDirection.z * -1));
        //     movement.add(this.entity.right.clone().scale(normalizedDirection.x));
        //     movement.add(this.entity.up.clone().scale(normalizedDirection.y));

        //     // console.log('movement', movement, movement.length())

        //     // 保存当前位置作为起点
        //     const from = this.entity.getPosition().clone();
        //     // 计算目标位置作为终点
        //     const radius = 0.6;
        //     const to = from.clone().add(movement.scale((movement.length() + radius)/movement.length()));

        //     // 执行射线检测
        //     const result = this.app.systems.rigidbody.raycastFirst(from, to);
        //     // console.log('result', result, from, to)
        //     if (result) {
        //         console.log('检测到碰撞:', {
        //             碰撞实体: result.entity.name,
        //             碰撞点: result.point,
        //             碰撞法线: result.normal
        //         }, result);
        //         console.log('pos', result.hitFraction * (movement.length() + radius) - radius)
        //     }

        //     // 保存当前位置作为回退点
        //     // this.lastValidPosition = this.entity.getPosition().clone();

        //     // 使用teleport移动到新位置
        //     // const newPosition = this.lastValidPosition.clone().add(movement);
        //     // this.entity.rigidbody.teleport(newPosition, this.entity.getRotation());
        //     this.entity.rigidbody.linearVelocity = movement;
        //     // this.entity.rigidbody.applyForce(movement, newPosition);
        // } else {
        //     if (this.entity.rigidbody.type == 'dynamic') {
        //         this.entity.rigidbody.type = 'static';
        //     }
        //     // this.entity.rigidbody.teleport(this.lastValidPosition, this.entity.getRotation());
        // }

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
            movement.add(this.entity.up.clone().scale(normalizedDirection.y));

            const y = this.entity.getPosition().y;

            // // 保存当前位置作为起点
            // const from = this.entity.getPosition().clone();
            // // 计算目标位置作为终点
            // const radius = 0.8;
            // const to = from.clone().add(movement.scale((movement.length() + radius) / movement.length()));

            // // 执行射线检测
            // const result = this.app.systems.rigidbody.raycastFirst(from, to);
            // // console.log('result', result, from, to)
            // if (result) {
            //     this.entity.rigidbody.type == 'dynamic'
            // } else {
            //     this.entity.rigidbody.type == 'static'
            //     const newPosition = this.entity.getPosition().clone().add(movement);
            //     newPosition.y = this.entity.getPosition().y;
            //     this.entity.rigidbody.teleport(newPosition, this.entity.getRotation());
            // }

            if (this.lockY) {
                movement.y = 0;
            }
            this.entity.rigidbody.linearVelocity = movement;
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
        // 没有刚体时，直接设置欧拉角
        this.entity.setLocalEulerAngles(this.ex, this.ey, 0);
        this.entity.setPosition(newPosition);
    }

    // // 检查是否处于输入状态
    // if (document.activeElement &&
    //     (document.activeElement.tagName === 'INPUT' ||
    //         document.activeElement.tagName === 'TEXTAREA' ||
    //         document.activeElement.isContentEditable)) {
    //     return;
    // }

    // 事件触发逻辑
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
        // 当模式为Lock(0)时，松开左键需要解除指针锁定
        if (!this.mode && pc.Mouse.isPointerLocked()) {
            this.app.mouse.disablePointerLock();
        }
    }
};

FlyCamera.prototype._onCollisionStart = function (result) {
    this.collisionDetected = true;
    
    // 计算碰撞法线
    const normal = result.contacts[0].normal;
    
    // 根据碰撞法线调整移动方向
    if (this.movement) {
        // 将移动向量投影到碰撞平面上
        const dot = this.movement.dot(normal);
        if (dot < 0) {
            this.movement.sub(normal.scale(dot));
        }
    }
    
    // 如果发生碰撞，回退到上一个有效位置
    this.entity.setPosition(this.lastValidPosition);
};

FlyCamera.prototype._onCollisionEnd = function () {
    this.collisionDetected = false;
};

FlyCamera.prototype.destroy = function () {
    // 移除碰撞事件监听
    if (this.entity.collision) {
        this.entity.collision.off('collisionstart', this._onCollisionStart, this);
        this.entity.collision.off('collisionend', this._onCollisionEnd, this);
    }
    this.detachKeyboardEvents();
};

    return FlyCamera;
}

export { genFlyCameraScript }