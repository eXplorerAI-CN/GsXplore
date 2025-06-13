async function splatParser(arrayBuffer) {
    try {
        const data = new Uint8Array(arrayBuffer);

        // 定义常量
        const numBytesPerVertex = 32;
        const numVertices = data.length / numBytesPerVertex;
        const SH_C0 = 0.28209479177387814;

        // 创建数组来存储顶点属性
        const posX = new Float32Array(numVertices);
        const posY = new Float32Array(numVertices);
        const posZ = new Float32Array(numVertices);

        const scaleX = new Float32Array(numVertices);
        const scaleY = new Float32Array(numVertices);
        const scaleZ = new Float32Array(numVertices);

        const rotX = new Float32Array(numVertices);
        const rotY = new Float32Array(numVertices);
        const rotZ = new Float32Array(numVertices);
        const rotW = new Float32Array(numVertices);

        const f_dc_0 = new Float32Array(numVertices);
        const f_dc_1 = new Float32Array(numVertices);
        const f_dc_2 = new Float32Array(numVertices);
        const opacity = new Float32Array(numVertices);

        const dataView = new DataView(arrayBuffer);
        let offset = 0;

        for (let i = 0; i < numVertices; i++) {
            // 读取位置
            const x = dataView.getFloat32(offset, true);
            offset += 4;
            const y = dataView.getFloat32(offset, true);
            offset += 4;
            const z = dataView.getFloat32(offset, true);
            offset += 4;
            posX[i] = -x;
            posY[i] = -y;
            posZ[i] = z;

            // 读取尺度并计算 scale_0, scale_1, scale_2
            const sX = dataView.getFloat32(offset, true);
            offset += 4;
            const sY = dataView.getFloat32(offset, true);
            offset += 4;
            const sZ = dataView.getFloat32(offset, true);
            offset += 4;

            scaleX[i] = Math.log(sX);
            scaleY[i] = Math.log(sY);
            scaleZ[i] = Math.log(sZ);

            // 读取颜色并计算 f_dc_0, f_dc_1, f_dc_2
            const r = data[offset] / 255;
            offset += 1;
            const g = data[offset] / 255;
            offset += 1;
            const b = data[offset] / 255;
            offset += 1;
            const a = data[offset] / 255;
            offset += 1;

            f_dc_0[i] = (r - 0.5) / SH_C0;
            f_dc_1[i] = (g - 0.5) / SH_C0;
            f_dc_2[i] = (b - 0.5) / SH_C0;

            // 计算 opacity
            if (a === 1) {
                opacity[i] = 20;
            } else if (a === 0) {
                opacity[i] = -20;
            } else {
                opacity[i] = -Math.log((1 / a) - 1);
            }

            // 读取旋转并归一化
            let rot0 = (data[offset] - 128) / 128;
            offset += 1;
            let rot1 = (data[offset] - 128) / 128;
            offset += 1;
            let rot2 = (data[offset] - 128) / 128;
            offset += 1;
            let rot3 = (data[offset] - 128) / 128;
            offset += 1;

            const norm = Math.sqrt(rot0 * rot0 + rot1 * rot1 + rot2 * rot2 + rot3 * rot3);
            if (norm !== 0) {
                rot0 /= -norm;
                rot1 /= norm;
                rot2 /= norm;
                rot3 /= -norm;
            }

            rotX[i] = rot0;
            rotY[i] = rot1;
            rotZ[i] = rot2;
            rotW[i] = rot3;
        }

        const elements = [{
            name: 'vertex',
            count: numVertices,
            properties: [
                { name: 'x', type: 'float', storage: posX },
                { name: 'y', type: 'float', storage: posY },
                { name: 'z', type: 'float', storage: posZ },

                { name: 'scale_0', type: 'float', storage: scaleX },
                { name: 'scale_1', type: 'float', storage: scaleY },
                { name: 'scale_2', type: 'float', storage: scaleZ },

                { name: 'rot_0', type: 'float', storage: rotX },
                { name: 'rot_1', type: 'float', storage: rotY },
                { name: 'rot_2', type: 'float', storage: rotZ },
                { name: 'rot_3', type: 'float', storage: rotW },

                { name: 'f_dc_0', type: 'float', storage: f_dc_0 },
                { name: 'f_dc_1', type: 'float', storage: f_dc_1 },
                { name: 'f_dc_2', type: 'float', storage: f_dc_2 },
                { name: 'opacity', type: 'float', storage: opacity }
            ]
        }];

        return elements;
    } catch (error) {
        console.error("Error loading or parsing splat file:", error);
        throw error;
    }
}

export { splatParser };