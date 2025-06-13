
// 添加保存PLY文件的功能
const savePlyFile = (t_gsplat_data) => {
    // 生成PLY header
    let plyContent = 'ply\n';
    plyContent += 'format binary_little_endian 1.0\n';
    plyContent += `element vertex ${t_gsplat_data.numSplats}\n`;
    // 位置
    plyContent += 'property float x\n';
    plyContent += 'property float y\n';
    plyContent += 'property float z\n';
    // 颜色
    plyContent += 'property float f_dc_0\n';
    plyContent += 'property float f_dc_1\n';
    plyContent += 'property float f_dc_2\n';
    // 不透明度
    plyContent += 'property float opacity\n';
    // 旋转四元数
    plyContent += 'property float rot_0\n';
    plyContent += 'property float rot_1\n';
    plyContent += 'property float rot_2\n';
    plyContent += 'property float rot_3\n';
    // 缩放
    plyContent += 'property float scale_0\n';
    plyContent += 'property float scale_1\n';
    plyContent += 'property float scale_2\n';
    plyContent += 'end_header\n';

    try {
        // 计算每个顶点的字节大小
        const bytesPerVertex = (3 * 4) +  // position (x,y,z)
                        (3 * 4) +  // color (f_dc_0,f_dc_1,f_dc_2)
                        4 +        // opacity
                        (4 * 4) +  // rotation quaternion
                        (3 * 4);   // scale

        // 创建二进制数据缓冲区
        const buffer = new ArrayBuffer(t_gsplat_data.numSplats * bytesPerVertex);
        const dataView = new DataView(buffer);
        let offset = 0;

        // 写入每个顶点的数据
        for (let i = 0; i < t_gsplat_data.numSplats; i++) {
            // 写入位置
            dataView.setFloat32(offset, t_gsplat_data.getProp('x')[i], true); offset += 4;
            dataView.setFloat32(offset, t_gsplat_data.getProp('y')[i], true); offset += 4;
            dataView.setFloat32(offset, t_gsplat_data.getProp('z')[i], true); offset += 4;

            // 写入颜色 (保持原始SH系数)
            dataView.setFloat32(offset, t_gsplat_data.getProp('f_dc_0')[i], true); offset += 4;
            dataView.setFloat32(offset, t_gsplat_data.getProp('f_dc_1')[i], true); offset += 4;
            dataView.setFloat32(offset, t_gsplat_data.getProp('f_dc_2')[i], true); offset += 4;

            // 写入不透明度
            dataView.setFloat32(offset, t_gsplat_data.getProp('opacity')[i], true); offset += 4;

            // 写入旋转四元数
            dataView.setFloat32(offset, t_gsplat_data.getProp('rot_0')[i], true); offset += 4;
            dataView.setFloat32(offset, t_gsplat_data.getProp('rot_1')[i], true); offset += 4;
            dataView.setFloat32(offset, t_gsplat_data.getProp('rot_2')[i], true); offset += 4;
            dataView.setFloat32(offset, t_gsplat_data.getProp('rot_3')[i], true); offset += 4;

            // 写入缩放
            dataView.setFloat32(offset, t_gsplat_data.getProp('scale_0')[i], true); offset += 4;
            dataView.setFloat32(offset, t_gsplat_data.getProp('scale_1')[i], true); offset += 4;
            dataView.setFloat32(offset, t_gsplat_data.getProp('scale_2')[i], true); offset += 4;
        }

        // 创建并下载文件
        const finalBlob = new Blob([plyContent, buffer], { type: 'application/octet-stream' });
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(finalBlob);
        downloadLink.download = `lod_level_${t_gsplat_data.lodLevel || 0}.ply`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(downloadLink.href);

    } catch (error) {
        console.error('Error saving PLY file:', error);
    }
};

export { savePlyFile };