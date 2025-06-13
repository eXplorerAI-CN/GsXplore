// import * as pc from '../../engine';
import * as pc from 'playcanvas';

class Text {
    constructor(app, entity) {
        this.app = app;
        this.entity = entity;
        this.text = 'Hello World!';
        this.fontsize = 70;

        // Create canvas for text rendering
        this.canvas = document.createElement('canvas');
        this.canvas.height = 128;
        this.canvas.width = 512;
        this.context = this.canvas.getContext("2d");

        this.texture = new pc.Texture(this.app.graphicsDevice, {
            format: pc.PIXELFORMAT_R8_G8_B8_A8,
            autoMipmap: true
        });
        this.texture.setSource(this.canvas);
        this.texture.minFilter = pc.FILTER_LINEAR_MIPMAP_LINEAR;
        this.texture.magFilter = pc.FILTER_LINEAR;
        this.texture.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        this.texture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;

        this.updateText();

        // Assume entity already has model component
        if (this.entity.model) {
            this.entity.model.material.emissiveMap = this.texture;
            this.entity.model.material.opacityMap = this.texture;
            this.entity.model.material.blendType = pc.BLEND_NORMAL;
            this.entity.model.material.update();
        }
    }

    updateText() {
        const ctx = this.context;
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;

        // Clear context to transparent
        ctx.fillStyle = "#00000000";
        ctx.fillRect(0, 0, w, h);

        // Write white text
        ctx.fillStyle = 'white';
        ctx.save();
        ctx.font = 'bold ' + String(this.fontsize) + 'px Verdana';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillText(this.text, w / 2, h / 2);
        ctx.restore();

        // Copy canvas content to texture
        this.texture.upload();
    }

    setText(newText) {
        this.text = newText;
        this.updateText();
    }

    setFontSize(newSize) {
        this.fontsize = newSize;
        this.updateText();
    }
}

export { Text };
