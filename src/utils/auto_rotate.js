// import * as pc from '../../engine';
import * as pc from 'playcanvas';

function init(name = 'autoRotate') {

    // 添加自动旋转脚本
    const AutoRotate = pc.createScript(name);

    // 添加脚本属性
    AutoRotate.attributes.add('rotationSpeed', {
        type: 'number',
        default: 10,
        title: 'Rotation Speed'
    });

    // 初始化
    AutoRotate.prototype.initialize = function () {
        // 可以在这里添加初始化逻辑
    };

    // 每帧更新
    AutoRotate.prototype.update = function (dt) {
        // 围绕Y轴旋转，速度由rotationSpeed决定
        this.entity.rotate(0, this.rotationSpeed * dt, 0);
    };
    
    return AutoRotate;
}

export { init };
