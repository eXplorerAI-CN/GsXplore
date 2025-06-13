import { pointCloudMesh } from './point_cloud_mesh.js';    
// import { Entity, createScript } from '../../engine';
import { Entity, createScript } from 'playcanvas';

const splatVertexShader = /* glsl */`
#include "gsplatCommonVS"

varying mediump vec2 gaussianUV;
varying mediump vec4 gaussianColor;
uniform float displayRadius;
uniform vec3 localCenter;

#ifndef DITHER_NONE
    varying float id;
#endif

mediump vec4 discardVec = vec4(0.0, 0.0, 2.0, 1.0);

#ifdef PREPASS_PASS
    varying float vLinearDepth;
#endif

void main(void) {
    // read gaussian details
    SplatSource source;
    if (!initSource(source)) {
        gl_Position = discardVec;
        return;
    }

    vec3 modelCenter = readCenter(source);

    // ---------display radius---------
    if (displayRadius > 0.0) {
        float distanceToCenter = length(modelCenter.xyz - localCenter.xyz);

        if (distanceToCenter > displayRadius) {
            gl_Position = discardVec;
            return;
        }
    }

    SplatCenter center;
    if (!initCenter(modelCenter, center)) {
        gl_Position = discardVec;
        return;
    }

    // project center to screen space
    SplatCorner corner;
    if (!initCorner(source, center, corner)) {
        gl_Position = discardVec;
        return;
    }

    // read color
    vec4 clr = readColor(source);

    #if GSPLAT_AA
        // apply AA compensation
        clr.a *= corner.aaFactor;
    #endif

    // evaluate spherical harmonics
    #if SH_BANDS > 0
        // calculate the model-space view direction
        vec3 dir = normalize(center.view * mat3(center.modelView));
        clr.xyz += evalSH(source, dir);
    #endif

    clipCorner(corner, clr.w);

    // write output
    gl_Position = center.proj + vec4(corner.offset, 0, 0);
    gaussianUV = corner.uv;
    gaussianColor = vec4(prepareOutputFromGamma(max(clr.xyz, 0.0)), clr.w);

    #ifndef DITHER_NONE
        id = float(source.id);
    #endif

    #ifdef PREPASS_PASS
        vLinearDepth = -center.view.z;
    #endif
}
`;


function genPointCloudScript(app) {
    
    // 检查是否已经存在 ztx_pointCloud 脚本
    const existingScript = app.scripts.get('ztx_pointCloud');
    if (existingScript) {
        return existingScript;
    }
    
    const PointCloud = createScript('ztx_pointCloud');
    PointCloud.prototype.initialize = function () {
    };

    PointCloud.prototype.createPointCloud = function (sample = 1) {
        // 检查是否已经存在render组件以及是否包含点云mesh
        if (this.entity.render && this.entity.render.meshInstances) {
            // 检查是否已经存在点云mesh（通过检查材质特征）
            const hasPointCloudMesh = this.entity.render.meshInstances.some(meshInstance => {
                return meshInstance.material && 
                    (meshInstance.material.name === 'gsplatPointCloudMaterial' || 
                        meshInstance.material.uniqueName === 'pointCloudShader');
            });
            
            if (hasPointCloudMesh) {
                return;
            }
        }
        
        const splatData = this.entity.splatResource.splatData;
        const device = this.entity.splatResource.app.graphicsDevice;
        const cloudMesh = pointCloudMesh(device, splatData, sample);
        this.entity.addComponent('render', {
            meshInstances: [cloudMesh]
        });
        // this.setLocalCenter(this.entity.splatInfo.localCenter);
    }

    PointCloud.prototype.showCloud = function () {
        this.createPointCloud();
        const gsplat = this.entity.gsplat;
        const cloudMesh = this.entity.render;
        
        let maxRadius = gsplat.customAabb.halfExtents;
        maxRadius = Math.max(maxRadius.x, maxRadius.y, maxRadius.z);
        // console.log('maxRadius--------------', gsplat.customAabb, maxRadius);
        
        gsplat.enabled = false;
        cloudMesh.enabled = true;
        cloudMesh.meshInstances[0].material.setParameter('alpha', 0);
        cloudMesh.meshInstances[0].material.setParameter('heightRatio', -1);
        cloudMesh.meshInstances[0].material.setParameter('maxRadius', maxRadius);
    }

    PointCloud.prototype.hideCloud = function () {
        const gsplat = this.entity.gsplat;
        const gsplatMaterial = gsplat.material;
        const cloudMesh = this.entity.render;
        gsplat.enabled = true;
        cloudMesh.enabled = false;
        console.log('adfadfadsfsdfa',cloudMesh.enabled);
        gsplatMaterial.setParameter('expansionFactor', 1);
    }

    PointCloud.prototype.setPointSize = function (pointSize) {
        const material = this.entity.render.meshInstances[0];
        material.setParameter('splatSize', pointSize);
    }

    PointCloud.prototype.setGrad = function (grad) {
        this.setSplatTransit(grad);
        this.setSplatTransit_2(grad);
    }

    PointCloud.prototype.setSplatTransit = function (grad) {
        this.showCloud();
        const cloudMesh = this.entity.render;
        const cloudMaterial = cloudMesh.meshInstances[0];
        const gsplat = this.entity.gsplat;
        const gsplatMaterial = gsplat.material;

        cloudMesh.enabled = false;
        let t_factor = 1;
        if (grad < 0.99){
            gsplat.enabled = true;
            const initialExpansionFactor = 0.001;
            const finalExpansionFactor = 0.4;
            t_factor = (Math.pow(1 + grad, 10) - 1) / (Math.pow(2, 10) - 1) * (finalExpansionFactor - initialExpansionFactor) // 使用指数函数调整变化率
            if (grad < 0.5) {
                cloudMesh.enabled = true;
                cloudMaterial.setParameter('alpha', 0.9 - grad);
            }
        } 
        gsplatMaterial.setParameter('expansionFactor', t_factor);
    }   

    PointCloud.prototype.setSplatTransit_2 = function (grad) {
        this.showCloud();
        const gsplat = this.entity.gsplat;
        const gsplatMaterial = gsplat.material;
        const cloudMesh = this.entity.render;
        const cloudMaterial = cloudMesh.meshInstances[0];

        if (grad > 0.95) {
            this.hideCloud();
            gsplatMaterial.setParameter('displayRadius', -1);
        } else if (grad < 0.05) {
            this.showCloud();
            cloudMaterial.setParameter('alpha', grad);
            // cloudMaterial.setParameter('heightRatio', grad / 0.95);
        } else {
            // cloudMaterial.setParameter('heightRatio', grad / 0.95);
            gsplatMaterial.setParameter('expansionFactor', 1);

            let maxRadius = gsplat.customAabb.halfExtents;
            maxRadius = Math.max(maxRadius.x, maxRadius.y, maxRadius.z);
            console.log('maxRadius', maxRadius, maxRadius * grad);

            gsplat.enabled = true;
            cloudMesh.enabled = true;
            cloudMaterial.setParameter('alpha', grad);

            gsplatMaterial.setParameter('displayRadius', maxRadius * grad);
        }
    }

    PointCloud.prototype.setLocalCenter = function (localCenter) {
        const cloudMesh = this.entity.render;
        const cloudMaterial = cloudMesh.meshInstances[0];
        cloudMaterial.setParameter('localCenter', localCenter);
    }

    PointCloud.prototype.clearPointCloud = function () {
        if (!this.entity.render || !this.entity.render.meshInstances) {
            console.log('没有找到render组件或meshInstances，跳过清除');
            return;
        }

        // 找到并移除点云相关的mesh实例
        const remainingMeshInstances = this.entity.render.meshInstances.filter(meshInstance => {
            const isPointCloudMesh = meshInstance.material && 
                                   (meshInstance.material.name === 'gsplatPointCloudMaterial' || 
                                    meshInstance.material.uniqueName === 'pointCloudShader');
            
            if (isPointCloudMesh) {
                // 释放mesh和材质资源
                if (meshInstance.mesh) {
                    meshInstance.mesh.destroy();
                }
                if (meshInstance.material) {
                    meshInstance.material.destroy();
                }
                console.log('清除点云mesh实例');
                return false; // 不保留此mesh实例
            }
            return true; // 保留非点云mesh实例
        });

        // 更新render组件的mesh实例
        this.entity.render.meshInstances = remainingMeshInstances;

        // 如果没有剩余的mesh实例，移除整个render组件
        if (remainingMeshInstances.length === 0) {
            this.entity.removeComponent('render');
            console.log('清除render组件（没有剩余mesh实例）');
        }
    }

    PointCloud.prototype.update = function (dt) {
        // console.log('update');
    };

    return PointCloud;
}


const options = {
    debugRender: false,
    fragment: null,
    vertex: null
}

function calcLocalCenterAndPCA(splatData) {
    const sumPosition = new pc.Vec3();
    const numPoints = splatData.numSplats;
    const x = splatData.getProp('x');
    const y = splatData.getProp('y');
    const z = splatData.getProp('z');

    const sampleSize = Math.min(1000, numPoints);
    const step = Math.floor(numPoints / sampleSize);

    let validSamples = 0;
    const points = [];

    // 计算中心点
    for (let i = 0; i < numPoints; i += step) {
        if (!isNaN(x[i]) && !isNaN(y[i]) && !isNaN(z[i])) {
            sumPosition.x += x[i];
            sumPosition.y += y[i];
            sumPosition.z += z[i];
            points.push([x[i], y[i], z[i]]);
            validSamples++;
        }
    }

    const localCenter = new pc.Vec3(
        sumPosition.x / validSamples,
        sumPosition.y / validSamples,
        sumPosition.z / validSamples
    );

    // 执行PCA
    const covarianceMatrix = calculateCovarianceMatrix(points, [localCenter.x, localCenter.y, localCenter.z]);
    console.log('covarianceMatrix', covarianceMatrix);
    let eigenVectors = calculateEigenVectors(covarianceMatrix);
    console.log('eigenVectors', eigenVectors);

    // 确保主轴按照最大方差到最小方差的顺序排列
    // eigenVectors.sort((a, b) => b.length() - a.length());

    // // 调整主轴方向
    // const up = new pc.Vec3(0, 1, 0);
    // if (eigenVectors[1].dot(up) < 0) {
    //     eigenVectors[1].scale(-1);
    // }
    // console.log('eigenVectors[0]', eigenVectors[0]);
    // console.log('eigenVectors[1]', eigenVectors[1]);
    // console.log('eigenVectors[2]', eigenVectors[2]);
    // // eigenVectors[0].cross(eigenVectors[1])

    // // 确保右手坐标系
    // eigenVectors[2] = eigenVectors[0].cross(eigenVectors[1]).normalize();

    return {
        localCenter: localCenter,
        principalAxes: eigenVectors
    };
}

function calculateCovarianceMatrix(points, center) {
    const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    // let validPoints = 0;
    // let isValidPoint = true;
    for (const point of points) {
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                cov[i][j] += (point[i] - center[i]) * (point[j] - center[j]);
            }
        }
    }
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            cov[i][j] /= points.length;
        }
    }
    return cov;
}

function calculateEigenVectors(matrix) {
    // 注意：这里使用了简化的方法来计算特征向量
    // 对于更精确的结果，您可能需要使用专门的数学库
    const [a, b, c] = matrix[0];
    const [d, e, f] = matrix[1];
    const [g, h, i] = matrix[2];

    const v1 = new pc.Vec3(a, d, g).normalize();
    const v2 = new pc.Vec3(b, e, h).normalize();
    const v3 = new pc.Vec3(c, f, i).normalize();

    return [v1, v2, v3];
}

function genSplatEntity(resource) { 
    const entity = new Entity();
    entity.splatResource = resource;

    const options = {
        vertex: splatVertexShader
    };
    const splatInstance = resource.createInstance(options);
    // instantiate guitar with a custom shader
    const component = entity.addComponent('gsplat', {
        instance: splatInstance
    });
    splatInstance.material.setParameter('expansionFactor', 1);
    splatInstance.material.setParameter('enableLod', false);
    // splatInstance.material.setParameter('minDisplayLength', 0);
    component.customAabb = splatInstance.splat.aabb.clone();

    const splatData = entity.splatResource.splatData;
    const { localCenter, principalAxes } = calcLocalCenterAndPCA(splatData);
    entity.splatInfo = {
        localCenter: localCenter,
        principalAxes: principalAxes
    }

    splatInstance.material.setParameter('localCenter', new Float32Array([localCenter.x, localCenter.y, localCenter.z]));
    component.customAabb.localCenter = localCenter;

    entity.addComponent("script");


    const PointCloud = genPointCloudScript(window.viewer.app);
    const pointCloudScript = entity.script.create(PointCloud);
    // pointCloudScript.showCloud();


    // // 创建旋转矩阵
    // const rotationMatrix = new pc.Mat4();
    // rotationMatrix.set([
    //     principalAxes[0].x, principalAxes[1].x, principalAxes[2].x, 0,
    //     principalAxes[0].y, principalAxes[1].y, principalAxes[2].y, 0,
    //     principalAxes[0].z, principalAxes[1].z, principalAxes[2].z, 0,
    //     0, 0, 0, 1
    // ]);

    // // 从旋转矩阵创建四元数
    // const quaternion = new pc.Quat();
    // quaternion.setFromMat4(rotationMatrix);

    // // 应用旋转到实体
    // entity.setRotation(quaternion);

    // component.customAabb.setFromTransformedAabb(component.customAabb, entity.getWorldTransform());

    return entity;
}

export { genSplatEntity, genPointCloudScript, calcLocalCenterAndPCA };