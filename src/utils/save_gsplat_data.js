// Add functionality to save PLY file
const savePlyFile = (t_gsplat_data) => {
    // Generate PLY header
    let plyContent = 'ply\n';
    plyContent += 'format binary_little_endian 1.0\n';
    plyContent += `element vertex ${t_gsplat_data.numSplats}\n`;
    // Position
    plyContent += 'property float x\n';
    plyContent += 'property float y\n';
    plyContent += 'property float z\n';
    // Color
    plyContent += 'property float f_dc_0\n';
    plyContent += 'property float f_dc_1\n';
    plyContent += 'property float f_dc_2\n';
    // Opacity
    plyContent += 'property float opacity\n';
    // Rotation quaternion
    plyContent += 'property float rot_0\n';
    plyContent += 'property float rot_1\n';
    plyContent += 'property float rot_2\n';
    plyContent += 'property float rot_3\n';
    // Scale
    plyContent += 'property float scale_0\n';
    plyContent += 'property float scale_1\n';
    plyContent += 'property float scale_2\n';
    plyContent += 'end_header\n';

    try {
        // Calculate bytes per vertex
        const bytesPerVertex = (3 * 4) +  // position (x,y,z)
                        (3 * 4) +  // color (f_dc_0,f_dc_1,f_dc_2)
                        4 +        // opacity
                        (4 * 4) +  // rotation quaternion
                        (3 * 4);   // scale

        // Create binary data buffer
        const buffer = new ArrayBuffer(t_gsplat_data.numSplats * bytesPerVertex);
        const dataView = new DataView(buffer);
        let offset = 0;

        // Write data for each vertex
        for (let i = 0; i < t_gsplat_data.numSplats; i++) {
            // Write position
            dataView.setFloat32(offset, t_gsplat_data.getProp('x')[i], true); offset += 4;
            dataView.setFloat32(offset, t_gsplat_data.getProp('y')[i], true); offset += 4;
            dataView.setFloat32(offset, t_gsplat_data.getProp('z')[i], true); offset += 4;

            // Write color (keep original SH coefficients)
            dataView.setFloat32(offset, t_gsplat_data.getProp('f_dc_0')[i], true); offset += 4;
            dataView.setFloat32(offset, t_gsplat_data.getProp('f_dc_1')[i], true); offset += 4;
            dataView.setFloat32(offset, t_gsplat_data.getProp('f_dc_2')[i], true); offset += 4;

            // Write opacity
            dataView.setFloat32(offset, t_gsplat_data.getProp('opacity')[i], true); offset += 4;

            // Write rotation quaternion
            dataView.setFloat32(offset, t_gsplat_data.getProp('rot_0')[i], true); offset += 4;
            dataView.setFloat32(offset, t_gsplat_data.getProp('rot_1')[i], true); offset += 4;
            dataView.setFloat32(offset, t_gsplat_data.getProp('rot_2')[i], true); offset += 4;
            dataView.setFloat32(offset, t_gsplat_data.getProp('rot_3')[i], true); offset += 4;

            // Write scale
            dataView.setFloat32(offset, t_gsplat_data.getProp('scale_0')[i], true); offset += 4;
            dataView.setFloat32(offset, t_gsplat_data.getProp('scale_1')[i], true); offset += 4;
            dataView.setFloat32(offset, t_gsplat_data.getProp('scale_2')[i], true); offset += 4;
        }

        // Create and download file
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