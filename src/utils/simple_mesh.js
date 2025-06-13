// import * as pc from '../../engine';
import * as pc from 'playcanvas';
import { fetchWithProgress } from './fetch_with_progress';

function createSphereMesh(device, radius = 0.5, segments = 16, rings = 16) {
    const positions = [];
    const indices = [];
    const normals = [];

    // 创建顶点
    for (let lat = 0; lat <= rings; lat++) {
        const theta = lat * Math.PI / rings;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (let lon = 0; lon <= segments; lon++) {
            const phi = lon * 2 * Math.PI / segments;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            const x = cosPhi * sinTheta;
            const y = cosTheta;
            const z = sinPhi * sinTheta;

            const nx = x;
            const ny = y;
            const nz = z;

            positions.push(radius * x, radius * y, radius * z);
            normals.push(nx, ny, nz);
        }
    }

    // 创建索引
    for (let lat = 0; lat < rings; lat++) {
        for (let lon = 0; lon < segments; lon++) {
            const first = (lat * (segments + 1)) + lon;
            const second = first + segments + 1;

            indices.push(first, second, first + 1);
            indices.push(second, second + 1, first + 1);
        }
    }

    // 创建顶点格式
    const vertexFormat = new pc.VertexFormat(device, [
        {
            semantic: pc.SEMANTIC_POSITION,
            components: 3,
            type: pc.TYPE_FLOAT32
        },
        {
            semantic: pc.SEMANTIC_NORMAL,
            components: 3,
            type: pc.TYPE_FLOAT32
        }
    ]);

    // 创建顶点缓冲区
    const vertexBuffer = new pc.VertexBuffer(device, vertexFormat, positions.length / 3);
    const vertexData = new Float32Array(vertexBuffer.lock());
    
    // 填充顶点位置和法线数据
    for (let i = 0; i < positions.length / 3; i++) {
        // 位置数据
        vertexData[i * 6] = positions[i * 3];
        vertexData[i * 6 + 1] = positions[i * 3 + 1];
        vertexData[i * 6 + 2] = positions[i * 3 + 2];
        
        // 法线数据
        vertexData[i * 6 + 3] = normals[i * 3];
        vertexData[i * 6 + 4] = normals[i * 3 + 1];
        vertexData[i * 6 + 5] = normals[i * 3 + 2];
    }
    
    vertexBuffer.unlock();

    // 创建索引缓冲区
    const indexBuffer = new pc.IndexBuffer(device, pc.INDEXFORMAT_UINT16, indices.length);
    const indexData = new Uint16Array(indexBuffer.lock());
    indexData.set(indices);
    indexBuffer.unlock();

    const mesh = createMesh(device, vertexBuffer, indexBuffer, pc.PRIMITIVE_TRIANGLES);

    // 手动更新AABB
    mesh.aabb = new pc.BoundingBox();
    mesh.aabb.compute(positions);

    return mesh;
}

function createSphereShader(device, options = {}) {
    // 创建自定义着色器定义
    const shaderDefinition = {
        attributes: {
            aPosition: pc.SEMANTIC_POSITION,
            aUv0: pc.SEMANTIC_TEXCOORD0
        },
        vshader: `
                attribute vec3 aPosition;
                attribute vec2 aUv0;
                
                uniform mat4 matrix_model;
                uniform mat4 matrix_viewProjection;
                
                varying vec2 vUv0;
                
                void main(void) {
                    vUv0 = aUv0;
                    gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);
                }
            `,
        fshader: `
                precision mediump float;
                
                varying vec2 vUv0;
                uniform sampler2D uDiffuseMap;
                
                void main(void) {
                    gl_FragColor = texture2D(uDiffuseMap, vUv0);
                }
            `
    };

    // 创建着色器
    const shader = pc.createShaderFromCode(
        device,
        shaderDefinition.vshader,
        shaderDefinition.fshader,
        `simple-sphere-shader`,
        shaderDefinition.attributes
    );
    return shader;
}

function createTextureSphereInstance(device, texture, options = {}) {
    const {
        radius = 1,
        segments = 32,
    } = options;

    const shader = createSphereShader(device);

    const material = new pc.Material();
    material.shader = shader;
    material.setParameter('uDiffuseMap', texture);
    material.cull = pc.CULLFACE_NONE;
    material.depthWrite = true;
    material.update();
    // 创建球体网格并设置材质
    const mesh = createSphereMesh(device, { radius: radius, segments: segments });
    const sphereInstance = new pc.MeshInstance(mesh, material);

    sphereInstance.pickable = true;
    
    // // 正确计算AABB
    // const positions = [];
    // const vertexBuffer = mesh.vertexBuffer;
    // const vertexData = new Float32Array(vertexBuffer.lock());
    
    // // 从顶点缓冲区提取位置数据
    // const vertexFormat = vertexBuffer.format;
    // const positionElement = vertexFormat.elements.find(element => 
    //     element.name === pc.SEMANTIC_POSITION
    // );
    // const positionOffset = positionElement.offset / 4;
    // const stride = vertexFormat.size / 4;
    
    // // 从顶点缓冲区提取法线数据
    // const normalElement = vertexFormat.elements.find(element => 
    //     element.name === pc.SEMANTIC_NORMAL
    // );
    // const normalOffset = normalElement.offset / 4;
    
    // for (let i = 0; i < vertexData.length; i += stride) {
    //     positions.push(
    //         vertexData[i + positionOffset],
    //         vertexData[i + positionOffset + 1],
    //         vertexData[i + positionOffset + 2]
    //     );
    // }
    
    // vertexBuffer.unlock();

    // // 计算AABB
    // mesh.aabb = new pc.BoundingBox();
    // mesh.aabb.compute(positions);

    return sphereInstance;
}

// 新增函数：从 URL 创建纹理
async function createTextureFromUrl(app, url, onProgress) {
    const arrayBuffer = await fetchWithProgress(url, (percent, percentLabel) => {
        onProgress?.(percent, percentLabel);
    });
    const blob = new Blob([arrayBuffer]);
    const bitmap = await createImageBitmap(blob);

    const texture = new pc.Texture(app.graphicsDevice, {
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,
    });
    texture.setSource(bitmap);

    return { texture, bitmap };
}

function createMeshFromPoints(device, points, options = {}) {
    const {
        mode = 'wireframe', // 'wireframe' 或 'solid'
        closed = true // 是否闭合图形
    } = options;

    // 确保points是有效的数组
    if (!Array.isArray(points) || points.length < 2) {
        throw new Error('需要至少2个点来创建mesh');
    }

    // 准备顶点位置数据
    const positions = [];
    for (const point of points) {
        positions.push(point[0], point[1], point[2]);
    }

    // 添加法线数据 - 默认指向Z轴正方向
    const normals = [];
    for (let i = 0; i < points.length; i++) {
        normals.push(0, 0, 1); // 默认法线指向Z轴正方向
    }

    let indices;
    let primitiveType;

    // 实体面模式 - 使用三角形扇形(Triangle Fan)算法
    indices = [];
    
    // 对于凸多边形,可以使用扇形三角化

    if (mode === 'wireframe') {
        for (let i = 0; i < points.length - 2; i+=1) {
            indices.push(i, i + 1);
            indices.push(i + 1, i + 2);
            indices.push(i + 2, i);
        }
        
        primitiveType = pc.PRIMITIVE_LINES;
    } else {
        for (let i = 0; i < points.length - 2; i++) {
            indices.push(i, i + 1, i + 2);
        }
        
        primitiveType = pc.PRIMITIVE_TRIANGLES;
    }

    // 创建顶点格式 - 添加法线属性
    const vertexFormat = new pc.VertexFormat(device, [
        {
            semantic: pc.SEMANTIC_POSITION,
            components: 3,
            type: pc.TYPE_FLOAT32
        },
        {
            semantic: pc.SEMANTIC_NORMAL,
            components: 3,
            type: pc.TYPE_FLOAT32
        }
    ]);

    // 创建顶点缓冲区
    const vertexBuffer = new pc.VertexBuffer(device, vertexFormat, positions.length / 3);
    const vertexData = new Float32Array(vertexBuffer.lock());
    
    // 填充顶点位置和法线数据
    for (let i = 0; i < positions.length / 3; i++) {
        // 位置数据 (每个顶点6个浮点数 - 3个位置 + 3个法线)
        vertexData[i * 6] = positions[i * 3];
        vertexData[i * 6 + 1] = positions[i * 3 + 1];
        vertexData[i * 6 + 2] = positions[i * 3 + 2];
        
        // 法线数据
        vertexData[i * 6 + 3] = normals[i * 3];
        vertexData[i * 6 + 4] = normals[i * 3 + 1];
        vertexData[i * 6 + 5] = normals[i * 3 + 2];
    }
    
    vertexBuffer.unlock();

    // 创建索引缓冲区
    const indexBuffer = new pc.IndexBuffer(device, pc.INDEXFORMAT_UINT16, indices.length);
    const indexData = new Uint16Array(indexBuffer.lock());
    indexData.set(indices);
    indexBuffer.unlock();

    const mesh = createMesh(device, vertexBuffer, indexBuffer, primitiveType, indices.length);

    // 手动更新AABB
    mesh.aabb = new pc.BoundingBox();
    mesh.aabb.compute(positions);  // 使用顶点位置数据计算AABB

    return mesh;
}

function createMesh(device, vertexBuffer, indexBuffer, primitiveType, count) {
    // 创建网格
    const mesh = new pc.Mesh(device);
    mesh.vertexBuffer = vertexBuffer;
    mesh.indexBuffer[0] = indexBuffer;
    mesh.primitive[0] = {
        type: primitiveType,
        base: 0,
        count: count,
        indexed: true
    };

    // 添加自定义销毁方法
    mesh.destroy = function() {
        if (this.vertexBuffer) {
            this.vertexBuffer.destroy();
            this.vertexBuffer = null;
        }
        if (this.indexBuffer && this.indexBuffer[0]) {
            this.indexBuffer[0].destroy();
            this.indexBuffer[0] = null;
        }
        // 调用原始的destroy方法
        pc.Mesh.prototype.destroy.call(this);
    };

    return mesh;
}
// 新增函数：创建盒子网格
function createBoxMesh(device, options = {}) {
    // 从 options 中解构参数，并提供默认值
    const {
        min={x:-0.5, y:-0.5, z:-0.5},
        max={x:0.5, y:0.5, z:0.5},
        mode = 'wireframe'
    } = options;

    // 检查必需参数
    if (!min || !max) {
        throw new Error('createBoxMesh: min 和 max 参数是必需的');
    }

    // 定义顶点位置数据
    const positions = [
        min.x, min.y, min.z,
        max.x, min.y, min.z,
        max.x, max.y, min.z,
        min.x, max.y, min.z,
        min.x, min.y, max.z,
        max.x, min.y, max.z,
        max.x, max.y, max.z,
        min.x, max.y, max.z
    ];

    // 定义顶点法线数据（为每个顶点添加法线）
    const normals = [
        // 前面法线 (指向-Z方向)
        0, 0, -1,
        0, 0, -1,
        0, 0, -1,
        0, 0, -1,
        // 后面法线 (指向+Z方向)
        0, 0, 1,
        0, 0, 1,
        0, 0, 1,
        0, 0, 1
    ];

    let indices;
    let primitiveType;

    if (mode === 'wireframe') {
        // 定义线框模式的索引数据
        indices = [
            0, 1, 1, 2, 2, 3, 3, 0, // 前面
            4, 5, 5, 6, 6, 7, 7, 4, // 后面
            0, 4, 1, 5, 2, 6, 3, 7  // 连接前后面
        ];
        primitiveType = pc.PRIMITIVE_LINES;
    } else if (mode === 'solid') {
        // 定义面模式的索引数据
        indices = [
            0, 1, 2, 0, 2, 3, // 前面
            4, 5, 6, 4, 6, 7, // 后面
            0, 1, 5, 0, 5, 4, // 底面
            2, 3, 7, 2, 7, 6, // 顶面
            1, 2, 6, 1, 6, 5, // 右侧面
            0, 3, 7, 0, 7, 4  // 左侧面
        ];
        primitiveType = pc.PRIMITIVE_TRIANGLES;
    }

    // 创建顶点格式，添加法线属性
    const vertexFormat = new pc.VertexFormat(device, [
        {
            semantic: pc.SEMANTIC_POSITION,
            components: 3,
            type: pc.TYPE_FLOAT32
        },
        {
            semantic: pc.SEMANTIC_NORMAL,
            components: 3,
            type: pc.TYPE_FLOAT32
        }
    ]);

    // 创建顶点缓冲区
    const vertexBuffer = new pc.VertexBuffer(device, vertexFormat, positions.length / 3);
    const vertexData = new Float32Array(vertexBuffer.lock());
    
    // 填充顶点位置和法线数据
    for (let i = 0; i < positions.length / 3; i++) {
        // 位置数据 (每个顶点6个浮点数 - 3个位置 + 3个法线)
        vertexData[i * 6] = positions[i * 3];
        vertexData[i * 6 + 1] = positions[i * 3 + 1];
        vertexData[i * 6 + 2] = positions[i * 3 + 2];
        
        // 法线数据
        vertexData[i * 6 + 3] = normals[i * 3];
        vertexData[i * 6 + 4] = normals[i * 3 + 1];
        vertexData[i * 6 + 5] = normals[i * 3 + 2];
    }
    
    vertexBuffer.unlock();

    // 创建索引缓冲区
    const indexBuffer = new pc.IndexBuffer(device, pc.INDEXFORMAT_UINT16, indices.length);
    const indexData = new Uint16Array(indexBuffer.lock());
    indexData.set(indices);
    indexBuffer.unlock();

    const mesh = createMesh(device, vertexBuffer, indexBuffer, primitiveType, indices.length);

    return mesh;
}

function createCameraMesh(device, options = {}) {
    // 从 options 中解构参数，并提供默认值
    const {
        size = 1,
        hFov = 60,
        vFov = 45,
        renderMode = 'wireframe' // 添加renderMode参数，默认为wireframe
    } = options;
    
    // 将FOV从角度转换为弧度
    const hFovRad = (hFov * Math.PI) / 180;
    const vFovRad = (vFov * Math.PI) / 180;

    // 相机主体的尺寸
    const bodySize = size * 0.2;
    // 视锥体的尺寸
    const frustumLength = size;

    // 计算视锥体远平面的尺寸
    const farPlaneHeight = 2 * frustumLength * Math.tan(vFovRad / 2);
    const farPlaneWidth = 2 * frustumLength * Math.tan(hFovRad / 2);
    const halfWidth = farPlaneWidth / 2;
    const halfHeight = farPlaneHeight / 2;

    // 定义顶点位置数据
    const positions = [
        // 相机主体（立方体）
        -bodySize, -bodySize, -bodySize,  // 0
        bodySize, -bodySize, -bodySize,   // 1
        bodySize, bodySize, -bodySize,    // 2
        -bodySize, bodySize, -bodySize,   // 3
        -bodySize, -bodySize, bodySize,   // 4
        bodySize, -bodySize, bodySize,    // 5
        bodySize, bodySize, bodySize,     // 6
        -bodySize, bodySize, bodySize,    // 7

        // 视锥体顶点
        0, 0, 0,                          // 8 (视锥顶点)
        // 视锥体远平面的四个角（根据FOV计算）
        -halfWidth, -halfHeight, -frustumLength,    // 9  左下
        halfWidth, -halfHeight, -frustumLength,     // 10 右下
        halfWidth, halfHeight, -frustumLength,      // 11 右上
        -halfWidth, halfHeight, -frustumLength,      // 12 左上

        // 添加向上箭头的顶点
        0, bodySize, 0,                    // 13 箭头底部中心
        -bodySize*0.3, bodySize*1.5, 0,    // 14 箭头左侧
        bodySize*0.3, bodySize*1.5, 0,     // 15 箭头右侧
        0, bodySize*2, 0                   // 16 箭头顶点
    ];

    // 添加法线数据
    const normals = [];
    
    if (renderMode === 'solid') {
        // 为每个顶点计算更合适的法线
        for (let i = 0; i < positions.length / 3; i++) {
            // 立方体部分 - 根据面的方向设置法线
            if (i < 8) {
                const x = positions[i * 3];
                const y = positions[i * 3 + 1];
                const z = positions[i * 3 + 2];
                // 简化的法线计算：将顶点坐标归一化作为法线方向
                const length = Math.sqrt(x * x + y * y + z * z);
                if (length === 0) {
                    normals.push(0, 1, 0);
                } else {
                    normals.push(x / length, y / length, z / length);
                }
            } else if (i >= 9 && i <= 12) {
                // 视锥体远平面 - 法线指向-Z方向
                normals.push(0, 0, 1);
            } else if (i >= 13 && i <= 16) {
                // 箭头部分 - 法线主要指向Y轴
                normals.push(0, 1, 0);
            } else {
                // 其他顶点使用默认向上的法线
                normals.push(0, 1, 0);
            }
        }
    } else {
        // 线框模式下使用统一法线
        for (let i = 0; i < positions.length / 3; i++) {
            normals.push(0, 1, 0);
        }
    }

    // 定义索引数据
    let indices;
    
    if (renderMode === 'solid') {
        // 实体模式的索引 - 使用三角形面
        indices = [
            // 相机主体（立方体）- 6个面，每个面2个三角形
            // 前面
            0, 1, 2,
            0, 2, 3,
            // 后面
            4, 6, 5,
            4, 7, 6,
            // 顶面
            3, 2, 6,
            3, 6, 7,
            // 底面
            0, 4, 5,
            0, 5, 1,
            // 右面
            1, 5, 6,
            1, 6, 2,
            // 左面
            0, 3, 7,
            0, 7, 4,
            
            // 视锥体 - 4个三角形组成的锥体
            8, 9, 10,   // 底部三角形
            8, 10, 11,  // 右侧三角形
            8, 11, 12,  // 顶部三角形
            8, 12, 9,   // 左侧三角形
            
            // 视锥体远平面 - 2个三角形组成的矩形
            9, 11, 10,
            9, 12, 11,
            
            // 向上箭头 - 2个三角形组成
            13, 14, 16,  // 左侧三角形
            13, 16, 15   // 右侧三角形
        ];
    } else {
        // 线框模式的索引
        indices = [
            // 相机主体
            0, 1, 1, 2, 2, 3, 3, 0,  // 前面
            4, 5, 5, 6, 6, 7, 7, 4,  // 后面
            0, 4, 1, 5, 2, 6, 3, 7,  // 连接线

            // 视锥体
            8, 9,  // 左下
            8, 10, // 右下
            8, 11, // 右上
            8, 12, // 左上

            // 视锥体远平面
            9, 10, 10, 11, 11, 12, 12, 9,

            // 添加向上箭头的线段
            13, 16,  // 箭头主干
            14, 16,  // 箭头左边
            15, 16   // 箭头右边
        ];
    }

    // 创建顶点格式，添加法线
    const vertexFormat = new pc.VertexFormat(device, [
        {
            semantic: pc.SEMANTIC_POSITION,
            components: 3,
            type: pc.TYPE_FLOAT32
        },
        {
            semantic: pc.SEMANTIC_NORMAL,
            components: 3,
            type: pc.TYPE_FLOAT32
        }
    ]);

    // 创建顶点缓冲区
    const vertexBuffer = new pc.VertexBuffer(device, vertexFormat, positions.length / 3);
    const vertexData = new Float32Array(vertexBuffer.lock());
    
    // 填充顶点位置和法线数据
    for (let i = 0; i < positions.length / 3; i++) {
        // 位置数据 (每顶点6个浮点数 - 3个位置 + 3个法线)
        vertexData[i * 6] = positions[i * 3];
        vertexData[i * 6 + 1] = positions[i * 3 + 1];
        vertexData[i * 6 + 2] = positions[i * 3 + 2];
        
        // 法线数据
        vertexData[i * 6 + 3] = normals[i * 3];
        vertexData[i * 6 + 4] = normals[i * 3 + 1];
        vertexData[i * 6 + 5] = normals[i * 3 + 2];
    }
    
    vertexBuffer.unlock();

    // 创建索引缓冲区
    const indexBuffer = new pc.IndexBuffer(device, pc.INDEXFORMAT_UINT16, indices.length);
    const indexData = new Uint16Array(indexBuffer.lock());
    indexData.set(indices);
    indexBuffer.unlock();

    // 根据渲染模式选择基元类型
    const primitiveType = renderMode === 'solid' ? pc.PRIMITIVE_TRIANGLES : pc.PRIMITIVE_LINES;
    
    const mesh = createMesh(device, vertexBuffer, indexBuffer, primitiveType, indices.length);
    return mesh;
}

function createAnchorMesh(device, options = {}) {
    // 从 options 中解构参数，并提供默认值
    const {
        size = 1,
        renderMode = 'wireframe' // 默认为wireframe模式
    } = options;
    
    const halfSize = size / 2;
    
    // 定义三个相互垂直正方形的顶点位置数据
    const positions = [
        // XY平面正方形 (Z=0) - 垂直于Z轴
        -halfSize, -halfSize, 0,  // 0: 左下
        halfSize, -halfSize, 0,   // 1: 右下
        halfSize, halfSize, 0,    // 2: 右上
        -halfSize, halfSize, 0,   // 3: 左上
        
        // XZ平面正方形 (Y=0) - 垂直于Y轴
        -halfSize, 0, -halfSize,  // 4: 左下
        halfSize, 0, -halfSize,   // 5: 右下
        halfSize, 0, halfSize,    // 6: 右上
        -halfSize, 0, halfSize,   // 7: 左上
        
        // YZ平面正方形 (X=0) - 垂直于X轴
        0, -halfSize, -halfSize,  // 8: 左下
        0, halfSize, -halfSize,   // 9: 右下
        0, halfSize, halfSize,    // 10: 右上
        0, -halfSize, halfSize    // 11: 左上
    ];
    
    // 为每个正方形计算法线
    const normals = [
        // XY平面法线 (指向+Z方向)
        0, 0, 1,
        0, 0, 1,
        0, 0, 1,
        0, 0, 1,
        
        // XZ平面法线 (指向+Y方向)
        0, 1, 0,
        0, 1, 0,
        0, 1, 0,
        0, 1, 0,
        
        // YZ平面法线 (指向+X方向)
        1, 0, 0,
        1, 0, 0,
        1, 0, 0,
        1, 0, 0
    ];
    
    let indices;
    let primitiveType;
    
    if (renderMode === 'solid') {
        // 实体模式 - 每个正方形用2个三角形组成
        indices = [
            // XY平面 (2个三角形)
            0, 1, 2, 0, 2, 3,
            // XZ平面 (2个三角形)
            4, 5, 6, 4, 6, 7,
            // YZ平面 (2个三角形)
            8, 9, 10, 8, 10, 11
        ];
        primitiveType = pc.PRIMITIVE_TRIANGLES;
    } else {
        // 线框模式 - 每个正方形用4条线组成
        indices = [
            // XY平面的四条边
            0, 1, 1, 2, 2, 3, 3, 0,
            // XZ平面的四条边
            4, 5, 5, 6, 6, 7, 7, 4,
            // YZ平面的四条边
            8, 9, 9, 10, 10, 11, 11, 8
        ];
        primitiveType = pc.PRIMITIVE_LINES;
    }
    
    // 创建顶点格式，包含位置和法线
    const vertexFormat = new pc.VertexFormat(device, [
        {
            semantic: pc.SEMANTIC_POSITION,
            components: 3,
            type: pc.TYPE_FLOAT32
        },
        {
            semantic: pc.SEMANTIC_NORMAL,
            components: 3,
            type: pc.TYPE_FLOAT32
        }
    ]);

    // 创建顶点缓冲区
    const vertexBuffer = new pc.VertexBuffer(device, vertexFormat, positions.length / 3);
    const vertexData = new Float32Array(vertexBuffer.lock());
    
    // 填充顶点位置和法线数据
    for (let i = 0; i < positions.length / 3; i++) {
        // 位置数据 (每个顶点6个浮点数 - 3个位置 + 3个法线)
        vertexData[i * 6] = positions[i * 3];
        vertexData[i * 6 + 1] = positions[i * 3 + 1];
        vertexData[i * 6 + 2] = positions[i * 3 + 2];
        
        // 法线数据
        vertexData[i * 6 + 3] = normals[i * 3];
        vertexData[i * 6 + 4] = normals[i * 3 + 1];
        vertexData[i * 6 + 5] = normals[i * 3 + 2];
    }
    
    vertexBuffer.unlock();

    // 创建索引缓冲区
    const indexBuffer = new pc.IndexBuffer(device, pc.INDEXFORMAT_UINT16, indices.length);
    const indexData = new Uint16Array(indexBuffer.lock());
    indexData.set(indices);
    indexBuffer.unlock();

    // 根据渲染模式选择基元类型
    const mesh = createMesh(device, vertexBuffer, indexBuffer, primitiveType, indices.length);
    
    // 手动更新AABB
    mesh.aabb = new pc.BoundingBox();
    mesh.aabb.compute(positions);
    
    return mesh;
}

function createMeshInstance(mesh, options = {}) {
    let {
        renderMode = 'wireframe', // 'wireframe' 或 'solid'
        color = new pc.Color(1, 1, 1, 1),
        opacity = 1,
        visible = true,
    } = options;

    // 处理颜色参数
    let finalColor;
    if (Array.isArray(color)) {
        // 如果color是数组,转换为pc.Color
        finalColor = new pc.Color(color[0], color[1], color[2], color[3] || 1);
    } else {
        // 否则直接使用color
        finalColor = color;
    }

    const material = new pc.StandardMaterial();

    if (finalColor.a && finalColor.a < 1){
        opacity = finalColor.a;
    }

    material.opacity = opacity;

    if (opacity < 1) {
        material.blendType = pc.BLEND_NORMAL;
        material.depthWrite = false;
    }

    if (renderMode === 'solid') {
        // 面渲染模式的材质设置
        material.diffuse = finalColor;
        material.emissive = finalColor;  // 设置发光为0
        material.ambient = new pc.Color(0.2, 0.2, 0.2);
        material.specular = new pc.Color(0.4, 0.4, 0.4);
        material.shininess = 32;
        material.useLighting = true;
        material.wireframe = false;
        // material.cull = pc.CULLFACE_BACK; 
        material.cull = pc.CULLFACE_NONE;  // 关闭背面剔除
    } else {
        // 线框模式的材质设置
        material.emissive = finalColor;
        material.ambient = new pc.Color(0, 0, 0);
        material.diffuse = new pc.Color(0, 0, 0);
        material.wireframe = true;
       
    }
    material.update();

    const meshInstance = new pc.MeshInstance(mesh, material);
    // meshInstance.visible = visible;

    // 确保正的渲染状态
    if (renderMode === 'solid') {
        meshInstance.renderStyle = pc.RENDERSTYLE_SOLID;
    } else {
        meshInstance.renderStyle = pc.RENDERSTYLE_WIREFRAME;
    }

    return meshInstance;
}

function createBitmapMesh(device, options = {}) {
    // 从 options 中解构参数，并提供默认值
    const {
        width = 1,
        height = 1,
        flipY = true,
        thickness = 0,
    } = options;

    let positions, uvs, indices;

    if (thickness <= 0) {
        // 计算半宽和半高
        const halfWidth = width / 2;
        const halfHeight = height / 2;

        // 定义顶点位置数据
        positions = [
            -halfWidth, -halfHeight, 0,
            halfWidth, -halfHeight, 0,
            halfWidth, halfHeight, 0,
            -halfWidth, halfHeight, 0
        ];

        // 定义UV坐标（根据flipY决定UV方向）
        uvs = flipY ? [
            0, 1,
            1, 1,
            1, 0,
            0, 0
        ] : [
            0, 0,
            1, 0,
            1, 1,
            0, 1
        ];

        // 定义索引数据（两个三角形组成一个矩形）
        indices = [
            0, 1, 2,
            0, 2, 3
        ];
    } else {
        // 创建厚度为thickness的bitmap

        const halfWidth = width / 2;
        const halfHeight = height / 2;
        const halfThickness = thickness / 2;

        // 修改顶点位置，添加厚度
        positions = [
            // 上表面
            -halfWidth, halfThickness, -halfHeight,
            halfWidth, halfThickness, -halfHeight,
            halfWidth, halfThickness, halfHeight,
            -halfWidth, halfThickness, halfHeight,

            // 下表面
            -halfWidth, -halfThickness, -halfHeight,
            halfWidth, -halfThickness, -halfHeight,
            halfWidth, -halfThickness, halfHeight,
            -halfWidth, -halfThickness, halfHeight
        ];

        uvs = flipY ? [
            0, 1,
            1, 1,
            1, 0,
            0, 0,
            0, 1,
            1, 1,
            1, 0,
            0, 0
        ] : [
            0, 0,
            1, 0,
            1, 1,
            0, 1,
            0, 0,
            1, 0,
            1, 1,
            0, 1
        ];

        // 修改索引以创建完整的盒子
        indices = [
            // 上表面
            0, 1, 2,
            0, 2, 3,
            // 下表面
            4, 6, 5,
            4, 7, 6,
            // 侧面
            0, 4, 1,
            1, 4, 5,
            1, 5, 2,
            2, 5, 6,
            2, 6, 3,
            3, 6, 7,
            3, 7, 0,
            0, 7, 4
        ];
    }

    // 创建顶点格式（包含位置和UV坐标）
    const vertexFormat = new pc.VertexFormat(device, [
        {
            semantic: pc.SEMANTIC_POSITION,
            components: 3,
            type: pc.TYPE_FLOAT32
        },
        {
            semantic: pc.SEMANTIC_NORMAL,
            components: 3,
            type: pc.TYPE_FLOAT32
        },
        {
            semantic: pc.SEMANTIC_TEXCOORD0,
            components: 2,
            type: pc.TYPE_FLOAT32
        }
    ]);

    // 创建顶点缓冲区
    const vertexBuffer = new pc.VertexBuffer(device, vertexFormat, positions.length / 3);
    const vertexData = new Float32Array(vertexBuffer.lock());
    
    // 填充顶点数据（位置、法线和UV）
    const numVertices = positions.length / 3;
    for (let i = 0; i < numVertices; i++) {
        const vertexIndex = i * 8; // 每个顶点8个浮点数（3个位置 + 3个法线 + 2个UV）
        
        // 位置
        vertexData[vertexIndex] = positions[i * 3];
        vertexData[vertexIndex + 1] = positions[i * 3 + 1];
        vertexData[vertexIndex + 2] = positions[i * 3 + 2];
        
        // 法线 (默认朝上或朝Z轴正方向)
        vertexData[vertexIndex + 3] = 0;
        vertexData[vertexIndex + 4] = 0;
        vertexData[vertexIndex + 5] = 1;
        
        // UV坐标
        vertexData[vertexIndex + 6] = uvs[i * 2];
        vertexData[vertexIndex + 7] = uvs[i * 2 + 1];
    }
    vertexBuffer.unlock();

    // 创建索引缓冲区
    const indexBuffer = new pc.IndexBuffer(device, pc.INDEXFORMAT_UINT16, indices.length);
    const indexData = new Uint16Array(indexBuffer.lock());
    indexData.set(indices);
    indexBuffer.unlock();

    const mesh = createMesh(device, vertexBuffer, indexBuffer, pc.PRIMITIVE_TRIANGLES, indices.length);
    console.log('UV coordinates:', uvs);
    return mesh;
}

// 添加新函数用于创建bitmap材质
function createBitmapMaterial(texture, options = {}) {
    const { transparent = false } = options;
    const material = new pc.StandardMaterial();

    // 基础纹理设置
    material.diffuseMap = texture;
    material.emissiveMap = texture;
    material.emissive = new pc.Color(1, 1, 1); // 设置自发光颜色为白色
    material.emissiveIntensity = 1;

    // 关闭光照计算
    material.useLighting = false;
    material.useGammaTonemap = false;

    // 设置双面渲染
    material.cull = pc.CULLFACE_NONE;

    if (transparent) {
        // 启用透明度支持
        material.blendType = pc.BLEND_NORMAL;
        material.opacityMap = texture;  // 使用纹理的 alpha 通道作为透明度
        material.alphaTest = 0.1;  // 设置透明度测试阈值
        material.depthWrite = false;  // 对于透明物体，通常需要关闭深度写入
    } else {
        // 禁用透明度支持以提高性能
        material.blendType = pc.BLEND_NONE;
        material.opacityMap = null;
        material.alphaTest = 0;
        material.depthWrite = true;
    }

    material.depthTest = true;

    // 禁用其他可能影响渲染的特性
    material.useMetalness = false;
    material.occludeSpecular = pc.SPECOCC_NONE;
    material.diffuse = new pc.Color(1, 1, 1);
    material.ambient = new pc.Color(1, 1, 1);

    material.update();
    return material;
}

// 添加一个创建完整bitmap实体的辅助函数
async function createBitmapEntity(app, texture, options = {}) {
    
    // 创建mesh
    const mesh = createBitmapMesh(app.graphicsDevice, options);
    
    // 创建材质
    const material = createBitmapMaterial(texture, options);
    
    // 创建mesh实例
    const meshInstance = new pc.MeshInstance(mesh, material);
    
    // 创建实体
    const entity = new pc.Entity();
    entity.addComponent('render', {
        meshInstances: [meshInstance],
        castShadows: false
    });
    
    return entity;
}


function createInvisibleMesh(device, size = 0.1) {
    // 创建一个很小的三角形mesh作为标记点
    const positions = [
        -size, -size, 0,
        size, -size, 0,
        0, size, 0
    ];

    // 简单的UV坐标
    const uvs = [
        0, 0,
        1, 0,
        0.5, 1
    ];

    // 创建简单的顶点格式
    const vertexFormat = new pc.VertexFormat(device, [
        {
            semantic: pc.SEMANTIC_POSITION,
            components: 3,
            type: pc.TYPE_FLOAT32
        },
        {
            semantic: pc.SEMANTIC_NORMAL,
            components: 3,
            type: pc.TYPE_FLOAT32
        },
        {
            semantic: pc.SEMANTIC_TEXCOORD0,
            components: 2,
            type: pc.TYPE_FLOAT32
        }
    ]);

    // 创建顶点缓冲区
    const vertexBuffer = new pc.VertexBuffer(device, vertexFormat, 3);
    const vertexData = new Float32Array(vertexBuffer.lock());

    // 填充顶点数据
    for (let i = 0; i < 3; i++) {
        const offset = i * 8;  // 每个顶点8个浮点数（3个位置 + 3个法线 + 2个UV）
        vertexData[offset] = positions[i * 3];
        vertexData[offset + 1] = positions[i * 3 + 1];
        vertexData[offset + 2] = positions[i * 3 + 2];
        
        // 添加法线数据 (指向Z轴正方向)
        vertexData[offset + 3] = 0;
        vertexData[offset + 4] = 0;
        vertexData[offset + 5] = 1;
        
        vertexData[offset + 6] = uvs[i * 2];
        vertexData[offset + 7] = uvs[i * 2 + 1];
    }
    vertexBuffer.unlock();

    // 创建索引缓冲区
    const indices = [0, 1, 2];
    const indexBuffer = new pc.IndexBuffer(device, pc.INDEXFORMAT_UINT16, 3);
    const indexData = new Uint16Array(indexBuffer.lock());
    indexData.set(indices);
    indexBuffer.unlock();

    return createMesh(device, vertexBuffer, indexBuffer, pc.PRIMITIVE_TRIANGLES, indices.length);
}

// 添加新的函数来创建环境映射材质
function createEnvironmentMappedMaterial(app, skyboxTexture) {
    const material = new pc.StandardMaterial();
    
    // 设置环境贴图
    material.cubeMap = skyboxTexture;
    material.useSkybox = true;
    
    // 设置反射属性
    material.metalness = 1.0;  // 金属度设为1以获得最大反射
    material.shininess = 100;  // 高光度
    material.reflectivity = 1.0;
    
    // 更新材质
    material.update();
    
    return material;
}

// 创建一个带环境映射的mesh实体
async function createEnvironmentMappedEntity(app, mesh, skyboxTexture, options = {}) {
    const material = createEnvironmentMappedMaterial(app, skyboxTexture);
    
    // 创建mesh实例
    const meshInstance = new pc.MeshInstance(mesh, material);
    
    // 创建实体
    const entity = new pc.Entity();
    entity.addComponent('render', {
        meshInstances: [meshInstance]
    });
    
    // 应用选项中的变换
    if (options.position) {
        entity.setPosition(options.position);
    }
    if (options.rotation) {
        entity.setEulerAngles(options.rotation);
    }
    if (options.scale) {
        entity.setLocalScale(options.scale);
    }
    
    return entity;
}


// 创建投影纹理材质
function createProjectionMaterial(app, panoramaTexture) {
    // 创建自定义着色器
    const shaderDefinition = {
        attributes: {
            aPosition: pc.SEMANTIC_POSITION,
            aNormal: pc.SEMANTIC_NORMAL
        },
        vshader: `
            attribute vec3 aPosition;
            attribute vec3 aNormal;
            
            uniform mat4 matrix_model;
            uniform mat4 matrix_viewProjection;
            
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            
            void main(void) {
                vec4 worldPos = matrix_model * vec4(aPosition, 1.0);
                vWorldPos = worldPos.xyz;
                vNormal = mat3(matrix_model) * aNormal;
                gl_Position = matrix_viewProjection * worldPos;
            }
        `,
        fshader: `
            precision mediump float;
            
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            
            uniform sampler2D uDiffuseMap;
            uniform vec3 view_position;
            
            const float PI = 3.14159265359;
            
            vec2 directionToUV(vec3 direction) {
                // 计算从中心点到表面点的方向
                vec3 dir = normalize(direction);
                
                // 将方向转换为球面坐标
                float phi = atan(dir.z, dir.x);  // 方位角
                float theta = acos(dir.y);       // 天顶角
                
                // 转换到UV坐标 [0,1] 范围
                float u = (phi + PI) / (2.0 * PI);
                float v = theta / PI;
                
                return vec2(u, v);
            }
            
            void main(void) {
                // 计算从中心点到表面点的方向
                vec3 direction = normalize(vWorldPos);
                
                // 获取对应的UV坐标
                vec2 uv = directionToUV(direction);
                
                // 采样全景图
                gl_FragColor = texture2D(uDiffuseMap, uv);
            }
        `
    };

    // 创建着色器
    const shader = pc.createShaderFromCode(
        app.graphicsDevice,
        shaderDefinition.vshader,
        shaderDefinition.fshader,
        `panoramaProjection-${Date.now()}`,
        shaderDefinition.attributes
    );

    // 创建材质
    const material = new pc.Material();
    material.shader = shader;
    material.setParameter('uDiffuseMap', panoramaTexture);
    material.cull = pc.CULLFACE_NONE;
    material.depthWrite = true;
    material.depthTest = true;
    material.update();

    return material;
}

// 创建建筑物mesh
function createBuildingMesh(device, points, options = {}) {
    const { height = 2 } = options;
    
    const positions = [];
    const normals = [];
    const indices = [];
    
    // 假设points是按顺序排列的平面轮廓点
    const numPoints = points.length;
    
    // 生成侧面
    for (let i = 0; i < numPoints; i++) {
        const current = points[i];
        const next = points[(i + 1) % numPoints];
        
        // 底部顶点
        positions.push(current.x, 0, current.z);
        positions.push(next.x, 0, next.z);
        // 顶部顶点
        positions.push(next.x, height, next.z);
        positions.push(current.x, height, current.z);
        
        // 计算法线 (面向外)
        const dx = next.x - current.x;
        const dz = next.z - current.z;
        const length = Math.sqrt(dx * dx + dz * dz);
        const nx = dz / length;
        const nz = -dx / length;
        
        // 每个顶点的法线
        for (let j = 0; j < 4; j++) {
            normals.push(nx, 0, nz);
        }
        
        // 索引
        const baseIndex = i * 4;
        indices.push(
            baseIndex, baseIndex + 1, baseIndex + 2,
            baseIndex, baseIndex + 2, baseIndex + 3
        );
    }

    // 添加顶面
    const baseIndex = positions.length / 3;
    for (let i = 0; i < numPoints; i++) {
        const point = points[i];
        positions.push(point.x, height, point.z);
        normals.push(0, 1, 0);  // 顶面法线朝上
    }

    // 添加顶面的三角形
    for (let i = 2; i < numPoints; i++) {
        indices.push(
            baseIndex,
            baseIndex + i - 1,
            baseIndex + i
        );
    }
    
    // 创建顶点格式
    const vertexFormat = new pc.VertexFormat(device, [
        {
            semantic: pc.SEMANTIC_POSITION,
            components: 3,
            type: pc.TYPE_FLOAT32
        },
        {
            semantic: pc.SEMANTIC_NORMAL,
            components: 3,
            type: pc.TYPE_FLOAT32
        }
    ]);
    
    // 创建顶点缓冲区
    const vertexBuffer = new pc.VertexBuffer(device, vertexFormat, positions.length / 3);
    const vertexData = new Float32Array(vertexBuffer.lock());
    
    // 填充顶点数据
    for (let i = 0; i < positions.length / 3; i++) {
        const vOffset = i * 6;  // 6 = 3(position) + 3(normal)
        const pOffset = i * 3;
        
        // 位置
        vertexData[vOffset] = positions[pOffset];
        vertexData[vOffset + 1] = positions[pOffset + 1];
        vertexData[vOffset + 2] = positions[pOffset + 2];
        
        // 法线
        vertexData[vOffset + 3] = normals[pOffset];
        vertexData[vOffset + 4] = normals[pOffset + 1];
        vertexData[vOffset + 5] = normals[pOffset + 2];
    }
    vertexBuffer.unlock();
    
    // 创建索引缓冲区
    const indexBuffer = new pc.IndexBuffer(device, pc.INDEXFORMAT_UINT16, indices.length);
    const indexData = new Uint16Array(indexBuffer.lock());
    indexData.set(indices);
    indexBuffer.unlock();
    
    return createMesh(device, vertexBuffer, indexBuffer, pc.PRIMITIVE_TRIANGLES, indices.length);
}

// 创建带有投影纹理的mesh实体
function createProjectedMeshEntity(app, mesh, panoramaTexture, options = {}) {
    // 创建投影材质
    const material = createProjectionMaterial(app, panoramaTexture);
    
    // 创建mesh实例
    const meshInstance = new pc.MeshInstance(mesh, material);
    
    // 创建实体
    const entity = new pc.Entity();
    entity.addComponent('render', {
        meshInstances: [meshInstance]
    });
    
    // 应用变换
    if (options.position) {
        entity.setPosition(options.position);
    }
    if (options.rotation) {
        entity.setEulerAngles(options.rotation);
    }
    if (options.scale) {
        entity.setLocalScale(options.scale);
    }

    // 设置投影中心点（默认为原点）
    const projectionCenter = options.projectionCenter || new pc.Vec3(0, 0, 0);
    material.setParameter('view_position', [
        projectionCenter.x,
        projectionCenter.y,
        projectionCenter.z
    ]);
    
    return entity;
}

// 创建使用 cubemap 的投影材质
function createCubemapProjectionMaterial(app, cubemap) {
    // 创建自定义着色器
    const shaderDefinition = {
        attributes: {
            aPosition: pc.SEMANTIC_POSITION,
            aNormal: pc.SEMANTIC_NORMAL
        },
        vshader: `
            attribute vec3 aPosition;
            attribute vec3 aNormal;
            
            uniform mat4 matrix_model;
            uniform mat4 matrix_viewProjection;
            
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            
            void main(void) {
                vec4 worldPos = matrix_model * vec4(aPosition, 1.0);
                vWorldPos = worldPos.xyz;
                vNormal = mat3(matrix_model) * aNormal;
                gl_Position = matrix_viewProjection * worldPos;
            }
        `,
        fshader: `
            precision mediump float;
            
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            
            uniform samplerCube uCubemap;
            uniform vec3 view_position;
            
            void main(void) {
                // 计算从投影中心到表面点的方向向量
                vec3 direction = normalize(vWorldPos - view_position);
                
                // 使用这个方向向量直接采样 cubemap
                gl_FragColor = textureCube(uCubemap, direction);
            }
        `
    };

    // 创建着色器
    const shader = pc.createShaderFromCode(
        app.graphicsDevice,
        shaderDefinition.vshader,
        shaderDefinition.fshader,
        `cubemapProjection-${Date.now()}`,
        shaderDefinition.attributes
    );

    // 创建材质
    const material = new pc.Material();
    material.shader = shader;
    material.setParameter('uCubemap', cubemap);
    material.cull = pc.CULLFACE_NONE;
    material.depthWrite = true;
    material.depthTest = true;
    material.update();

    return material;
}

// 创建平面多边形 mesh
function createPolygonMesh(device, points, options = {}) {
    const positions = [];
    const normals = [];
    const indices = [];
    
    // 假设 points 是平面上的点，按顺序排列
    const numPoints = points.length;
    
    // 计算平面法线（假设所有点都在同一平面上）
    const p1 = new pc.Vec3(points[0].x, points[0].y, points[0].z);
    const p2 = new pc.Vec3(points[1].x, points[1].y, points[1].z);
    const p3 = new pc.Vec3(points[2].x, points[2].y, points[2].z);
    
    const v1 = new pc.Vec3().sub2(p2, p1);
    const v2 = new pc.Vec3().sub2(p3, p1);
    const normal = new pc.Vec3().cross(v1, v2).normalize();
    
    // 添加顶点
    for (let i = 0; i < numPoints; i++) {
        const point = points[i];
        positions.push(point.x, point.y, point.z);
        normals.push(normal.x, normal.y, normal.z);
    }
    
    // 创建三角形（使用扇形三角化）
    for (let i = 1; i < numPoints - 1; i++) {
        indices.push(0, i, i + 1);
    }
    
    // 创建顶点格式
    const vertexFormat = new pc.VertexFormat(device, [
        {
            semantic: pc.SEMANTIC_POSITION,
            components: 3,
            type: pc.TYPE_FLOAT32
        },
        {
            semantic: pc.SEMANTIC_NORMAL,
            components: 3,
            type: pc.TYPE_FLOAT32
        }
    ]);
    
    // 创建顶点缓冲区
    const vertexBuffer = new pc.VertexBuffer(device, vertexFormat, positions.length / 3);
    const vertexData = new Float32Array(vertexBuffer.lock());
    
    // 填充顶点数据
    for (let i = 0; i < positions.length / 3; i++) {
        const vOffset = i * 6;  // 6 = 3(position) + 3(normal)
        const pOffset = i * 3;
        
        // 位置
        vertexData[vOffset] = positions[pOffset];
        vertexData[vOffset + 1] = positions[pOffset + 1];
        vertexData[vOffset + 2] = positions[pOffset + 2];
        
        // 法线
        vertexData[vOffset + 3] = normals[pOffset];
        vertexData[vOffset + 4] = normals[pOffset + 1];
        vertexData[vOffset + 5] = normals[pOffset + 2];
    }
    vertexBuffer.unlock();
    
    // 创建索引缓冲区
}

// 创建使用天空盒纹理的材质
function createSkyboxProjectedMaterial_backup(app, skyboxTexture, options = {}) {
    const {
        reflectivity = 1.0,
        metalness = 1.0,
        useEnvironment = true,
        useReflection = true
    } = options;

    const material = new pc.StandardMaterial();

    // 确保天空盒纹理格式正确
    if (skyboxTexture) {
        material.cubeMap = skyboxTexture;
        material.useSkybox = true;

        // 设置合适的采样器类型
        material.samplerType = pc.TEXTURETYPE_DEFAULT;
    }

    // 基础材质设置
    material.metalness = metalness;
    material.reflectivity = reflectivity;
    material.shininess = 100;
    material.useMetalness = true;

    // 确保双面渲染
    material.cull = pc.CULLFACE_NONE;

    // 更新材质
    material.update();

    return material;
}

function createSkyboxProjectedMaterial(app, skyboxTexture, options = {}) {
    const {
        reflectivity = 1.0,
        metalness = 1.0,
        viewPosition = new pc.Vec3(0, 0, 0), // 默认观测点
        useEnvironment = true,
        useReflection = true
    } = options;

    // 创建自定义着色器
    const shaderDefinition = {
        attributes: {
            aPosition: pc.SEMANTIC_POSITION,
            aNormal: pc.SEMANTIC_NORMAL
        },
        vshader: `
            attribute vec3 aPosition;
            attribute vec3 aNormal;
            
            uniform mat4 matrix_model;
            uniform mat4 matrix_viewProjection;
            
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            
            void main(void) {
                vec4 worldPos = matrix_model * vec4(aPosition, 1.0);
                vWorldPos = worldPos.xyz;
                // 确保法线变换正确
                vNormal = normalize(mat3(matrix_model) * aNormal);
                gl_Position = matrix_viewProjection * worldPos;
            }
        `,
        fshader: `
            precision highp float;
            
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            
            uniform samplerCube uCubemap;
            uniform vec3 uViewPosition;
            
            void main(void) {
                vec3 normal = normalize(vNormal);
                vec3 viewDir = normalize(vWorldPos - uViewPosition);
                
                // 计算反射方向
                vec3 reflectDir = reflect(viewDir, normal);
                
                // 确保反射方向是正确的
                reflectDir = vec3(reflectDir.x, reflectDir.y, -reflectDir.z);
                
                // 采样cubemap并输出颜色
                vec4 cubeColor = textureCube(uCubemap, reflectDir);
                gl_FragColor = cubeColor;
                
                // 调试输出
                // gl_FragColor = vec4(normalize(reflectDir) * 0.5 + 0.5, 1.0); // 用于调试反射方向
                // gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0); // 用于调试法线
            }
        `
    };

    // 创建着色器
    const shader = pc.createShaderFromCode(
        app.graphicsDevice,
        shaderDefinition.vshader,
        shaderDefinition.fshader,
        `skyboxProjection-${Date.now()}`,
        shaderDefinition.attributes
    );

    // 创建材质
    const material = new pc.Material();
    material.shader = shader;
    
    // 确保 cubemap 纹理正确设置
    if (skyboxTexture && skyboxTexture instanceof pc.Texture) {
        material.setParameter('uCubemap', skyboxTexture);
    } else {
        console.error('Invalid skybox texture:', skyboxTexture);
    }
    
    material.setParameter('uViewPosition', [viewPosition.x, viewPosition.y, viewPosition.z]);

    // 设置材质属性
    material.cull = pc.CULLFACE_NONE;
    material.depthWrite = true;
    material.depthTest = true;
    material.blendType = pc.BLEND_NONE;

    material.update();

    return material;
}

// 创建使用天空盒纹理的mesh实体
function createSkyboxProjectedEntity(app, mesh, skyboxTexture, options = {}) {
    const {
        position,
        rotation,
        scale,
        materialOptions = {}
    } = options;

    // 验证输入参数
    if (!mesh || !(mesh instanceof pc.Mesh)) {
        console.error('Invalid mesh:', mesh);
        return null;
    }

    if (!skyboxTexture || !(skyboxTexture instanceof pc.Texture)) {
        console.error('Invalid skybox texture:', skyboxTexture);
        return null;
    }

    // 创建材质
    const material = createSkyboxProjectedMaterial(app, skyboxTexture, materialOptions);
    
    // 创建mesh实例
    const meshInstance = new pc.MeshInstance(mesh, material);
    
    // 创建实体
    const entity = new pc.Entity();
    entity.addComponent('render', {
        meshInstances: [meshInstance],
        castShadows: false,  // 通常环境映射的物体不需要投射阴影
        receiveShadows: false
    });
    
    // 应用变换
    if (position) entity.setPosition(position);
    if (rotation) entity.setEulerAngles(rotation);
    if (scale) entity.setLocalScale(scale);
    
    return {
        entity,
        material,
        meshInstance
    };
}

// 通过3个点创建矩形网格
// p1和p2定义矩形的底边，p3定义矩形的高度
function createRectangleFromPoints(device, p1, p2, p3, options = {}) {
    const {
        mode = 'solid', // 默认为实体模式
        color = new pc.Color(1, 1, 1, 1)
    } = options;

    // 创建基准向量：底边向量
    const baseVec = new pc.Vec3().sub2(p2, p1).normalize();
    
    // 计算p3到底边的垂足
    // 首先找到p3到线段p1-p2的垂足
    const p1ToP3 = new pc.Vec3().sub2(p3, p1);
    const projection = baseVec.clone().scale(p1ToP3.dot(baseVec));
    const heightVec = new pc.Vec3().sub2(p3, new pc.Vec3().add2(p1, projection));
    
    // 计算四个顶点
    const points = [
        [p1.x, p1.y, p1.z],                                           // 左下
        [p2.x, p2.y, p2.z],                                           // 右下
        [p2.x + heightVec.x, p2.y + heightVec.y, p2.z + heightVec.z], // 右上
        [p1.x + heightVec.x, p1.y + heightVec.y, p1.z + heightVec.z]  // 左上
    ];

    // 计算法线（根据叉积确定）
    const normal = new pc.Vec3().cross(baseVec, heightVec).normalize();
    
    // 准备顶点位置数据
    const positions = [];
    for (const point of points) {
        positions.push(point[0], point[1], point[2]);
    }

    // 添加法线数据
    const normals = [];
    for (let i = 0; i < points.length; i++) {
        normals.push(normal.x, normal.y, normal.z);
    }

    let indices;
    let primitiveType;

    if (mode === 'wireframe') {
        // 线框模式的索引
        indices = [
            0, 1, 1, 2, 2, 3, 3, 0
        ];
        primitiveType = pc.PRIMITIVE_LINES;
    } else {
        // 实体模式的索引（两个三角形组成一个矩形）
        indices = [
            0, 1, 2,
            0, 2, 3
        ];
        primitiveType = pc.PRIMITIVE_TRIANGLES;
    }

    // 创建顶点格式
    const vertexFormat = new pc.VertexFormat(device, [
        {
            semantic: pc.SEMANTIC_POSITION,
            components: 3,
            type: pc.TYPE_FLOAT32
        },
        {
            semantic: pc.SEMANTIC_NORMAL,
            components: 3,
            type: pc.TYPE_FLOAT32
        }
    ]);

    // 创建顶点缓冲区
    const vertexBuffer = new pc.VertexBuffer(device, vertexFormat, positions.length / 3);
    const vertexData = new Float32Array(vertexBuffer.lock());
    
    // 填充顶点位置和法线数据
    for (let i = 0; i < positions.length / 3; i++) {
        // 位置数据
        vertexData[i * 6] = positions[i * 3];
        vertexData[i * 6 + 1] = positions[i * 3 + 1];
        vertexData[i * 6 + 2] = positions[i * 3 + 2];
        
        // 法线数据
        vertexData[i * 6 + 3] = normals[i * 3];
        vertexData[i * 6 + 4] = normals[i * 3 + 1];
        vertexData[i * 6 + 5] = normals[i * 3 + 2];
    }
    
    vertexBuffer.unlock();

    // 创建索引缓冲区
    const indexBuffer = new pc.IndexBuffer(device, pc.INDEXFORMAT_UINT16, indices.length);
    const indexData = new Uint16Array(indexBuffer.lock());
    indexData.set(indices);
    indexBuffer.unlock();

    const mesh = createMesh(device, vertexBuffer, indexBuffer, primitiveType, indices.length);

    // 手动更新AABB
    mesh.aabb = new pc.BoundingBox();
    mesh.aabb.compute(positions);

    return mesh;
}

// 创建矩形实体
function createRectangleEntity(app, p1, p2, p3, options = {}) {
    const mesh = createRectangleFromPoints(app.graphicsDevice, p1, p2, p3, options);
    const meshInstance = createMeshInstance(mesh, options);
    
    // 创建实体
    const entity = new pc.Entity();
    entity.addComponent('render', {
        meshInstances: [meshInstance],
        castShadows: false
    });
    
    return entity;
}

// 修改导出
export {
    createMeshInstance,
    createBoxMesh,
    createCameraMesh,
    createAnchorMesh,
    createBitmapMesh,
    createTextureFromUrl,
    createBitmapEntity,  // 导出新函数
    createBitmapMaterial, // 导出新函数
    createInvisibleMesh,
    createEnvironmentMappedMaterial,
    createEnvironmentMappedEntity,
    createProjectionMaterial,
    createProjectedMeshEntity,
    createBuildingMesh,
    createPolygonMesh,
    createMeshFromPoints,
    createSkyboxProjectedMaterial,
    createSkyboxProjectedEntity,
    createSphereMesh,
    createSphereShader,
    createTextureSphereInstance,
    createRectangleFromPoints,
    createRectangleEntity
};
