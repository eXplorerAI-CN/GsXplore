// import * as pc from '../../engine';
import * as pc from 'playcanvas';
// 添加视频录制相关的导入
// import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

const screenshot_api_host = 'https://192.168.1.99';

class Screenshot {
    constructor(app, camera, screenshotWidth, screenshotHeight) {
        this.app = app;
        this.device = this.app.graphicsDevice;
        this.camera = camera;
        // 确保尺寸为偶数（H.264要求）
        this.screenshotWidth = screenshotWidth % 2 === 0 ? screenshotWidth : screenshotWidth - 1;
        this.screenshotHeight = screenshotHeight % 2 === 0 ? screenshotHeight : screenshotHeight - 1;
        // 视频录制相关属性
        this.isRecording = false;
        this.videoFrames = [];
        this.frameRate = 30;
        this.muxer = null;
        this.encoder = null;
    }

    init() {
        console.log(`截图/录制尺寸: ${this.screenshotWidth} x ${this.screenshotHeight}`);
        
        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d');
        if (!this.context) {
            throw new Error('No context');
        }

        this.canvas.width = this.screenshotWidth;
        this.canvas.height = this.screenshotHeight;

        this.linkElement = document.createElement('a');
        // this.linkElement.id = 'link';
        // document.body.appendChild(this.linkElement);

        // Create a new texture based on the current width and height
        this.colorBuffer = new pc.Texture(this.device, {
            width: this.screenshotWidth,
            height: this.screenshotHeight,
            format: pc.PIXELFORMAT_R8_G8_B8_A8,
        });

        this.depthBuffer = new pc.Texture(this.device, {
            format: pc.PIXELFORMAT_DEPTHSTENCIL,
            width: this.screenshotWidth,
            height: this.screenshotHeight,
            mipmaps: false,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE,
        });

        this.colorBuffer.minFilter = pc.FILTER_LINEAR;
        this.colorBuffer.magFilter = pc.FILTER_LINEAR;
        this.renderTarget = new pc.RenderTarget({
            colorBuffer: this.colorBuffer,
            depthBuffer: this.depthBuffer,
            // samples: 4, // Enable anti-alias
            samples: 1, // disable anti-alias
        });
        this.pixels = new Uint8Array(this.screenshotWidth * this.screenshotHeight * 4);

        this.frameBuffer = this.device.gl.createFramebuffer();
        this.gl = this.device.gl;
    }

    copyUIntToImageData = (data, imageData, width, height) => {
        const bytesPerRow = width * 4;  // 每行数据的字节数（每个像素RGBA占4个字节）

        for (let y = 0; y < height; y++) {
            let inputRowStart = y * bytesPerRow;  // 当前行的起始索引（未翻转）
            let outputRowStart = (height - 1 - y) * bytesPerRow;  // 翻转后的行的起始索引

            for (let x = 0; x < bytesPerRow; x += 4) {
                // 计算在原始数据和目标ImageData中的实际索引位置
                let inputIndex = inputRowStart + x;
                let outputIndex = outputRowStart + x;

                // 将像素数据从输入复制到输出，实现Y轴翻转
                imageData.data[outputIndex] = data[inputIndex]; // Red
                imageData.data[outputIndex + 1] = data[inputIndex + 1]; // Green
                imageData.data[outputIndex + 2] = data[inputIndex + 2]; // Blue
                imageData.data[outputIndex + 3] = 255; // Alpha固定为不透明
            }
        }
    };

    capture(filename){
        const screenshotWidth = this.screenshotWidth;
        const screenshotHeight = this.screenshotHeight;
        const canvas = this.canvas;
        const renderTarget = this.renderTarget;
        const colorBuffer = this.colorBuffer;
        const depthBuffer = this.depthBuffer;
        const pixels = this.pixels;
        const fb = this.frameBuffer;
        const gl = this.gl;
        const cameraRenderTarget = this.camera.camera.renderTarget;

        this.camera.camera.renderTarget = renderTarget;
        const imageData = this.context.createImageData(
            screenshotWidth,
            screenshotHeight
        );

        this.app.render();

        // We are accessing a private property here that has changed between
        // Engine v1.51.7 and v1.52.2
        const colorGlTexture = colorBuffer.impl
            ? colorBuffer.impl._glTexture
            : // @ts-ignore
            colorBuffer._glTexture;
        const depthGlTexture = depthBuffer.impl
            ? depthBuffer.impl._glTexture
            : // @ts-ignore
            depthBuffer._glTexture;

        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            colorGlTexture,
            0
        );
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.DEPTH_STENCIL_ATTACHMENT,
            gl.TEXTURE_2D,
            depthGlTexture,
            0
        );
        gl.readPixels(
            0,
            0,
            screenshotWidth,
            screenshotHeight,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            pixels
        );

        // gl.deleteFramebuffer(fb);

        // // Gamma correction if needed
        // for (var i = 0; i < pixels.length; i += 4) {
        //     // pixels[i] = Math.pow(pixels[i] / 255.0, 1.0 / 2.2) * 255;    // Red
        //     // pixels[i + 1] = Math.pow(pixels[i + 1] / 255.0, 1.0 / 2.2) * 255;  // Green
        //     // pixels[i + 2] = Math.pow(pixels[i + 2] / 255.0, 1.0 / 2.2) * 255;  // Blue
        //     pixels[i + 3] = 255; // Alpha channel remains unchanged
        // }

        this.copyUIntToImageData(pixels, imageData, screenshotWidth, screenshotHeight);
        this.context.putImageData(imageData, 0, 0);

        if (filename) {
            const image = canvas.toDataURL('image/png');
            
            // const b64 = image.replace("image/png", "image/octet-stream");

            // // Download link setup
            // this.linkElement.setAttribute('download', filename + '.png');
            // this.linkElement.setAttribute('href', b64);
            // this.linkElement.click();

            fetch(`${screenshot_api_host}/upload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ image, filename })
            })
                .then(response => response.json())
                .then(data => console.log('保存成功:', data))
                .catch(error => console.error('错误:', error));
        }
        this.camera.camera.renderTarget = cameraRenderTarget;
    }

    calculateOptimalBitrate(width, height, quality = 'high') {
        const pixels = width * height;
        const megapixels = pixels / 1000000; // 转换为百万像素

        // 基于像素数的幂函数拟合
        const baseBitrate = 1200000 * Math.pow(megapixels, 0.75) * 2;

        // 质量系数
        const qualityMultipliers = {
            'low': 0.6,      // 节省带宽
            'medium': 1.0,   // 标准质量
            'high': 1.6,     // 高质量
            'ultra': 2.5     // 极高质量
        };

        return Math.round(baseBitrate * qualityMultipliers[quality]);
    }

    // initVideoRecording() {
    // }

    async initVideoRecording(frameRate = 30, bitrate = null) {
        if (!bitrate) {
            bitrate = this.calculateOptimalBitrate(this.screenshotWidth, this.screenshotHeight, 'ultra');
        }
        // 检查浏览器是否支持VideoEncoder API
        if (typeof VideoEncoder === 'undefined') {
            console.error('当前浏览器不支持VideoEncoder API，视频录制功能不可用。请使用Chrome 94+版本。');
            return false;
        }

        // 验证尺寸是否为偶数
        if (this.screenshotWidth % 2 !== 0 || this.screenshotHeight % 2 !== 0) {
            console.error(`视频录制要求偶数尺寸，当前尺寸: ${this.screenshotWidth} x ${this.screenshotHeight}`);
            return false;
        }

        this.frameRate = frameRate;
        this.isRecording = true;
        this.videoFrames = [];

        try {
            // 动态导入mp4-muxer，避免在不需要时加载
            const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
            
            console.log(`初始化视频录制: ${this.screenshotWidth}x${this.screenshotHeight}, ${frameRate}fps, ${Math.round(bitrate/1000000)}Mbps`);
            
            this.muxer = new Muxer({
                target: new ArrayBufferTarget(),
                video: {
                    codec: 'avc',
                    width: this.screenshotWidth,
                    height: this.screenshotHeight
                },
                fastStart: 'in-memory',
                firstTimestampBehavior: 'offset'
            });

            this.encoder = new VideoEncoder({
                output: (chunk, meta) => {
                    this.muxer.addVideoChunk(chunk, meta);
                },
                error: (error) => {
                    console.error('视频编码错误:', error);
                    console.error('编码参数:', {
                        width: this.screenshotWidth,
                        height: this.screenshotHeight,
                        frameRate: this.frameRate,
                        bitrate: bitrate
                    });
                }
            });

            this.encoder.configure({
                codec: this.screenshotHeight < 1080 ? 'avc1.420028' : 'avc1.640033',
                width: this.screenshotWidth,
                height: this.screenshotHeight,
                bitrate
            });

            console.log('视频录制初始化成功');
            return true;
        } catch (error) {
            console.error('初始化视频录制失败:', error);
            this.isRecording = false;
            return false;
        }
    }

    captureVideoFrame(frameIndex = 0) {
        if (!this.isRecording || !this.encoder) {
            return;
        }

        try {
            const screenshotWidth = this.screenshotWidth;
            const screenshotHeight = this.screenshotHeight;
            const renderTarget = this.renderTarget;
            const colorBuffer = this.colorBuffer;
            const depthBuffer = this.depthBuffer;
            const pixels = this.pixels;
            const fb = this.frameBuffer;
            const gl = this.gl;
            const cameraRenderTarget = this.camera.camera.renderTarget;

            // 设置渲染目标
            this.camera.camera.renderTarget = renderTarget;
            
            // 渲染当前帧
            this.app.render();

            // 获取纹理句柄
            const colorGlTexture = colorBuffer.impl
                ? colorBuffer.impl._glTexture
                : colorBuffer._glTexture;
            const depthGlTexture = depthBuffer.impl
                ? depthBuffer.impl._glTexture
                : depthBuffer._glTexture;

            // 绑定帧缓冲并读取像素
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.COLOR_ATTACHMENT0,
                gl.TEXTURE_2D,
                colorGlTexture,
                0
            );
            gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.DEPTH_STENCIL_ATTACHMENT,
                gl.TEXTURE_2D,
                depthGlTexture,
                0
            );
            
            gl.readPixels(
                0,
                0,
                screenshotWidth,
                screenshotHeight,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                pixels
            );

            // 翻转Y轴（OpenGL坐标系与视频坐标系相反）
            const flippedPixels = new Uint8Array(pixels.length);
            const bytesPerRow = screenshotWidth * 4;
            
            for (let y = 0; y < screenshotHeight; y++) {
                const srcOffset = y * bytesPerRow;
                const dstOffset = (screenshotHeight - 1 - y) * bytesPerRow;
                flippedPixels.set(pixels.subarray(srcOffset, srcOffset + bytesPerRow), dstOffset);
            }

            // 创建VideoFrame并编码
            const timestamp = Math.floor(1e6 * frameIndex / this.frameRate);
            const duration = Math.floor(1e6 / this.frameRate);
            
            const videoFrame = new VideoFrame(flippedPixels, {
                format: 'RGBA',
                codedWidth: screenshotWidth,
                codedHeight: screenshotHeight,
                timestamp: timestamp,
                duration: duration
            });

            this.encoder.encode(videoFrame);
            videoFrame.close();

            // 恢复原来的渲染目标
            this.camera.camera.renderTarget = cameraRenderTarget;
            
        } catch (error) {
            console.error('捕获视频帧失败:', error);
        }
    }

    async finishVideoRecording(filename = 'route_fly_video', autoDownload = true) {
        if (!this.isRecording || !this.encoder || !this.muxer) {
            console.warn('没有正在进行的视频录制');
            return;
        }

        try {
            console.log('正在完成视频录制...');
            
            // 刷新编码器并完成混合
            await this.encoder.flush();
            this.muxer.finalize();

            // 获取视频数据
            const arrayBuffer = this.muxer.target.buffer;
            
            // 上传到服务器或下载
            if (screenshot_api_host) {
                // 转换为base64上传
                const blob = new Blob([arrayBuffer], { type: 'video/mp4' });
                const reader = new FileReader();
                reader.onload = () => {
                    const base64Data = reader.result.split(',')[1];
                    fetch(`${screenshot_api_host}/upload_video`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ 
                            video: base64Data, 
                            filename: filename + '.mp4' 
                        })
                    })
                    .then(response => response.json())
                    .then(data => console.log('视频保存成功:', data))
                    .catch(error => {
                        console.error('视频上传错误:', error);
                        // 如果上传失败且允许自动下载，则下载到本地
                        if (autoDownload) {
                            this.downloadVideo(arrayBuffer, filename);
                        }
                    });
                };
                reader.readAsDataURL(blob);
            } else if (autoDownload) {
                // 本地下载
                this.downloadVideo(arrayBuffer, filename);
            }

            // 清理资源
            this.encoder.close();
            this.encoder = null;
            this.muxer = null;
            this.isRecording = false;
            this.videoFrames = [];
            
            console.log('视频录制完成');
            return { arrayBuffer, filename }; // 返回数据供外部使用
            
        } catch (error) {
            console.error('完成视频录制失败:', error);
            this.isRecording = false;
            return false;
        }
    }

    // 新增：单独的下载方法
    downloadVideo(arrayBuffer, filename) {
        const blob = new Blob([arrayBuffer], { type: 'video/mp4' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.download = filename + '.mp4';
        a.href = url;
        a.click();
        window.URL.revokeObjectURL(url);
        console.log(`视频已下载: ${filename}.mp4`);
    }

    release(){
        this.camera.camera.renderTarget = null;
    }

    destory(){
        this.colorBuffer.destroy();
        this.depthBuffer.destroy();
        this.renderTarget.destroy();
        this.gl.deleteFramebuffer(this.frameBuffer);
        delete this.canvas;
        delete this.linkElement;
        this.pixels = null;
    }
}

export { Screenshot };

