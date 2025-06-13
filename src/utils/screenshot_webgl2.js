import * as pc from 'playcanvas';
// Add video recording related imports
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

const screenshot_api_host = 'https://192.168.1.99';

class Screenshot {
    constructor(app, camera, screenshotWidth, screenshotHeight) {
        this.app = app;
        this.device = this.app.graphicsDevice;
        this.camera = camera;
        // Ensure dimensions are even (H.264 requirement)
        this.screenshotWidth = screenshotWidth % 2 === 0 ? screenshotWidth : screenshotWidth - 1;
        this.screenshotHeight = screenshotHeight % 2 === 0 ? screenshotHeight : screenshotHeight - 1;
        // Video recording related properties
        this.isRecording = false;
        this.videoFrames = [];
        this.frameRate = 30;
        this.muxer = null;
        this.encoder = null;
    }

    init() {
        console.log(`Screenshot/recording dimensions: ${this.screenshotWidth} x ${this.screenshotHeight}`);
        
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
        const bytesPerRow = width * 4;  // Bytes per row (4 bytes per pixel for RGBA)

        for (let y = 0; y < height; y++) {
            let inputRowStart = y * bytesPerRow;  // Current row start index (unflipped)
            let outputRowStart = (height - 1 - y) * bytesPerRow;  // Flipped row start index

            for (let x = 0; x < bytesPerRow; x += 4) {
                // Calculate actual index positions in source and target ImageData
                let inputIndex = inputRowStart + x;
                let outputIndex = outputRowStart + x;

                // Copy pixel data from input to output, implementing Y-axis flip
                imageData.data[outputIndex] = data[inputIndex]; // Red
                imageData.data[outputIndex + 1] = data[inputIndex + 1]; // Green
                imageData.data[outputIndex + 2] = data[inputIndex + 2]; // Blue
                imageData.data[outputIndex + 3] = 255; // Alpha fixed to opaque
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
                .then(data => console.log('Saved successfully:', data))
                .catch(error => console.error('Error:', error));
        }
        this.camera.camera.renderTarget = cameraRenderTarget;
    }

    calculateOptimalBitrate(width, height, quality = 'high') {
        const pixels = width * height;
        const megapixels = pixels / 1000000; // Convert to megapixels

        // Power function fitting based on pixel count
        const baseBitrate = 1200000 * Math.pow(megapixels, 0.75) * 2;

        // Quality multipliers
        const qualityMultipliers = {
            'low': 0.6,      // Save bandwidth
            'medium': 1.0,   // Standard quality
            'high': 1.6,     // High quality
            'ultra': 2.5     // Ultra high quality
        };

        return Math.round(baseBitrate * qualityMultipliers[quality]);
    }

    // initVideoRecording() {
    // }

    async initVideoRecording(frameRate = 30, bitrate = null) {
        if (!bitrate) {
            bitrate = this.calculateOptimalBitrate(this.screenshotWidth, this.screenshotHeight, 'ultra');
        }
        // Check if browser supports VideoEncoder API
        if (typeof VideoEncoder === 'undefined') {
            console.error('Current browser does not support VideoEncoder API, video recording is unavailable. Please use Chrome 94+ version.');
            return false;
        }

        // Verify dimensions are even
        if (this.screenshotWidth % 2 !== 0 || this.screenshotHeight % 2 !== 0) {
            console.error(`Video recording requires even dimensions, current dimensions: ${this.screenshotWidth} x ${this.screenshotHeight}`);
            return false;
        }

        this.frameRate = frameRate;
        this.isRecording = true;
        this.videoFrames = [];

        try {
            
            console.log(`Initializing video recording: ${this.screenshotWidth}x${this.screenshotHeight}, ${frameRate}fps, ${Math.round(bitrate/1000000)}Mbps`);
            
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
                    console.error('Video encoding error:', error);
                    console.error('Encoding parameters:', {
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

            console.log('Video recording initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize video recording:', error);
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

            // Set render target
            this.camera.camera.renderTarget = renderTarget;
            
            // Render current frame
            this.app.render();

            // Get texture handles
            const colorGlTexture = colorBuffer.impl
                ? colorBuffer.impl._glTexture
                : colorBuffer._glTexture;
            const depthGlTexture = depthBuffer.impl
                ? depthBuffer.impl._glTexture
                : depthBuffer._glTexture;

            // Bind framebuffer and read pixels
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

            // Flip Y-axis (OpenGL coordinates are opposite to video coordinates)
            const flippedPixels = new Uint8Array(pixels.length);
            const bytesPerRow = screenshotWidth * 4;
            
            for (let y = 0; y < screenshotHeight; y++) {
                const srcOffset = y * bytesPerRow;
                const dstOffset = (screenshotHeight - 1 - y) * bytesPerRow;
                flippedPixels.set(pixels.subarray(srcOffset, srcOffset + bytesPerRow), dstOffset);
            }

            // Create VideoFrame and encode
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

            // Restore original render target
            this.camera.camera.renderTarget = cameraRenderTarget;
            
        } catch (error) {
            console.error('Failed to capture video frame:', error);
        }
    }

    async finishVideoRecording(filename = 'route_fly_video', autoDownload = true) {
        if (!this.isRecording || !this.encoder || !this.muxer) {
            console.warn('No video recording in progress');
            return;
        }

        try {
            console.log('Completing video recording...');
            
            // Flush encoder and finalize muxing
            await this.encoder.flush();
            this.muxer.finalize();

            // Get video data
            const arrayBuffer = this.muxer.target.buffer;
            
            // Upload to server or download
            if (screenshot_api_host) {
                // Convert to base64 for upload
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
                    .then(data => console.log('Video saved successfully:', data))
                    .catch(error => {
                        console.error('Video upload error:', error);
                        // If upload fails and auto-download is enabled, download locally
                        if (autoDownload) {
                            this.downloadVideo(arrayBuffer, filename);
                        }
                    });
                };
                reader.readAsDataURL(blob);
            } else if (autoDownload) {
                // Local download
                this.downloadVideo(arrayBuffer, filename);
            }

            // Clean up resources
            this.encoder.close();
            this.encoder = null;
            this.muxer = null;
            this.isRecording = false;
            this.videoFrames = [];
            
            console.log('Video recording completed');
            return { arrayBuffer, filename }; // Return data for external use
            
        } catch (error) {
            console.error('Failed to complete video recording:', error);
            this.isRecording = false;
            return false;
        }
    }

    // New: Separate download method
    downloadVideo(arrayBuffer, filename) {
        const blob = new Blob([arrayBuffer], { type: 'video/mp4' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.download = filename + '.mp4';
        a.href = url;
        a.click();
        window.URL.revokeObjectURL(url);
        console.log(`Video downloaded: ${filename}.mp4`);
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

