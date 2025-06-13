// import * as pc from '../../engine';
import * as pc from 'playcanvas';
import { fetchWithProgress } from './fetch_with_progress';

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

// 新增函数：创建 cubemap 纹理
async function createPanoCubemap(app, url, size=1280) {
    // 使用新的纹理创建函数
    const { texture, bitmap } = await createTextureFromUrl(app, url, (percent, percentLabel) => {
        // console.log(`Loading progress: ${percentLabel}`);
    });
    const maxSize = app.graphicsDevice.maxCubeMapSize;

    const ret = new pc.Texture(app.graphicsDevice, {
        width: size,
        height: size,
        format: pc.PIXELFORMAT_RGB8,
        cubemap: true,
        // mipmaps: true,
        // minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
        mipmaps: false,
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        anisotropy: 0
    });

    pc.reprojectTexture(texture, ret, {
        numSamples: 32,
        sourceProjection: pc.TEXTUREPROJECTION_EQUIRECT,
        distribution: 'none'
    });

    // ret = await createPanoCubemapTiled(app, texture, ret, 512);

    // 清理资源
    texture.destroy();
    bitmap.close();

    return ret;
}

async function createPanoCubemapTiled(app, texture, finalTexture, tileSize = 512) {
    const device = app.graphicsDevice;
    const finalSize = texture.width;
    
    // 创建较小的临时纹理用于分块处理
    const tempTexture = new pc.Texture(device, {
        width: tileSize,
        height: tileSize,
        format: texture.format,
        cubemap: true
    });
    
    // // 创建最终的目标纹理
    // const finalTexture = new pc.Texture(device, {
    //     width: finalSize,
    //     height: finalSize,
    //     format: texture.format,
    //     cubemap: true
    // });

    try {
        // 分块处理每个面
        for (let face = 0; face < 6; face++) {
            for (let y = 0; y < finalSize; y += tileSize) {
                for (let x = 0; x < finalSize; x += tileSize) {
                    // 处理当前块
                    pc.reprojectTexture(texture, tempTexture, {
                        numSamples: 16,
                        sourceProjection: pc.TEXTUREPROJECTION_EQUIRECT,
                        distribution: 'none',
                        region: {
                            x, y,
                            width: Math.min(tileSize, finalSize - x),
                            height: Math.min(tileSize, finalSize - y),
                            face
                        }
                    });
                    
                    // 将处理后的块复制到最终纹理
                    device.copyTexture(tempTexture, finalTexture, {
                        srcFace: face,
                        dstFace: face,
                        srcX: 0,
                        srcY: 0,
                        dstX: x,
                        dstY: y
                    });
                }
            }
        }
    } finally {
        // 清理临时资源
        tempTexture.destroy();
    }
    
    return finalTexture;
}

function changePanoSkybox(app, cubemap, options = {}) {
    let skybox_type = pc.SKYTYPE_BOX;
    if (options.type) {
        switch (options.type) {
            case 'box':
                skybox_type = pc.SKYTYPE_BOX;
                break;
            case 'dome':
                skybox_type = pc.SKYTYPE_DOME;
                break;
            case 'infinite':
                skybox_type = pc.SKYTYPE_INFINITE;
                break;
            default:
                console.warn('unknown skybox type: ', options.type);
                break;
        }
    }

    options = {
        type: skybox_type,
        scale: [500, 500, 500],
        position: [0, -0.5, 0],
        nodeRotation: [0, 0, 0],
        // exposure: 1.0,
        rotation: 0,
        skyCenter: [0, 0.5, 0],
        // cubemapSize: 512,
        

        ...options
    };
    // 设置场景参数
    // app.scene.skyboxMip = 0;
    // app.scene.skyboxIntensity = 1.0;

    app.scene.skybox = cubemap;

    app.scene.sky.type = options.type;
    const scaledPosition = options.position.map((v, i) => (v) * options.scale[i]);
    app.scene.sky.node.setLocalPosition(new pc.Vec3(...scaledPosition));
    app.scene.sky.node.setLocalRotation(new pc.Quat(...options.nodeRotation));
    app.scene.sky.node.setLocalScale(new pc.Vec3(...options.scale));
    app.scene.sky.center = new pc.Vec3(...options.skyCenter);

    app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, options.rotation, 0);


    // 更新场景
    app.scene.updateShaders = true;
}

async function loadPanoramaSkybox(app, url, options = {}) {

    const cubemap = await createPanoCubemap(app, url, options.cubemapSize);
    changePanoSkybox(app, cubemap, options);
    return cubemap;
}

export { loadPanoramaSkybox, createPanoCubemap, changePanoSkybox };