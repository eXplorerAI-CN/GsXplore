/**
 * 创建Catmull-Rom曲线
 * @param {Array} input_points - 输入点数组
 * @param {Array} segmentCounts - 每段的分段数
 * @param {boolean} loop - 是否创建闭合曲线
 * @returns {Array} - 曲线上的点
 */
const catmull_rom_curve = (input_points, segmentCounts, loop = false) => {
    let points;
    let expectedSegments;

    // 根据是否闭合来构建控制点数组
    if (loop) {
        // 闭合曲线：为了计算最后一段（从最后一个点回到第一个点），需要额外的控制点
        const len = input_points.length;
        points = [
            input_points[len - 1], // 添加最后一个点作为第一个控制点
            ...input_points,
            input_points[0],       // 添加第一个点
            input_points[1]        // 添加第二个点作为最后一个控制点
        ];
        expectedSegments = len; // 闭合曲线有 n 段：(n-1)段原始 + 1段闭环
    } else {
        // 开放曲线：前后各添加一个点
        points = [input_points[0], ...input_points, input_points[input_points.length - 1]];
        expectedSegments = input_points.length - 1; // 开放曲线段数为点数减1
    }

    const curvePoints = [];
    const n = points.length;

    // 确保至少有4个点
    if (n < 4) {
        console.error("需要至少4个控制点");
        return curvePoints;
    }

    // 如果没有提供 segmentCounts，为每段使用默认值 100
    if (!segmentCounts) {
        segmentCounts = new Array(expectedSegments).fill(100);
    }

    // 确保 segmentCounts 的长度正确
    /* if (segmentCounts.length !== expectedSegments) {
        console.error(`segmentCounts 的长度应该等于 ${expectedSegments}`);
        return curvePoints;
    } */

    // 临时变量，避免重复创建
    let t, t2, t3;
    let p0, p1, p2, p3;
    let v0x, v0y, v0z, v1x, v1y, v1z;
    let point = { x: 0, y: 0, z: 0 };

    // 计算实际需要处理的段数
    const segmentsToProcess = loop ? expectedSegments : n - 3;

    for (let i = 0; i < segmentsToProcess; i++) {
        // 对于闭环情况，索引需要特殊处理
        let idx0, idx1, idx2, idx3;
        
        if (loop) {
            // 闭环情况下的索引计算
            idx0 = i;
            idx1 = i + 1;
            idx2 = i + 2;
            idx3 = i + 3;
        } else {
            // 开放曲线的索引计算
            idx0 = i;
            idx1 = i + 1;
            idx2 = i + 2;
            idx3 = i + 3;
        }

        p0 = points[idx0];
        p1 = points[idx1];
        p2 = points[idx2];
        p3 = points[idx3];

        // 预计算切线
        v0x = (p2.x - p0.x) * 0.5;
        v0y = (p2.y - p0.y) * 0.5;
        v0z = (p2.z - p0.z) * 0.5;
        v1x = (p3.x - p1.x) * 0.5;
        v1y = (p3.y - p1.y) * 0.5;
        v1z = (p3.z - p1.z) * 0.5;

        const numSegments = segmentCounts[i];

        for (let j = 0; j < numSegments; j++) {
            t = j / numSegments;
            t2 = t * t;
            t3 = t * t2;

            // X 坐标
            point.x = (2 * p1.x - 2 * p2.x + v0x + v1x) * t3 +
                (-3 * p1.x + 3 * p2.x - 2 * v0x - v1x) * t2 +
                v0x * t + p1.x;

            // Y 坐标
            point.y = (2 * p1.y - 2 * p2.y + v0y + v1y) * t3 +
                (-3 * p1.y + 3 * p2.y - 2 * v0y - v1y) * t2 +
                v0y * t + p1.y;

            // Z 坐标
            point.z = (2 * p1.z - 2 * p2.z + v0z + v1z) * t3 +
                (-3 * p1.z + 3 * p2.z - 2 * v0z - v1z) * t2 +
                v0z * t + p1.z;

            curvePoints.push({ x: point.x, y: point.y, z: point.z });
        }
    }

    return curvePoints;
};

export { catmull_rom_curve }; 