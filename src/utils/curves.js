/**
 * Create Catmull-Rom curve
 * @param {Array} input_points - Input points array
 * @param {Array} segmentCounts - Number of segments per section
 * @param {boolean} loop - Whether to create a closed curve
 * @returns {Array} - Points on the curve
 */
const catmull_rom_curve = (input_points, segmentCounts, loop = false) => {
    let points;
    let expectedSegments;

    // Build control points array based on whether it's closed or not
    if (loop) {
        // Closed curve: need additional control points to calculate the last segment (from last point back to first point)
        const len = input_points.length;
        points = [
            input_points[len - 1], // Add last point as first control point
            ...input_points,
            input_points[0],       // Add first point
            input_points[1]        // Add second point as last control point
        ];
        expectedSegments = len; // Closed curve has n segments: (n-1) original + 1 closing segment
    } else {
        // Open curve: add one point at each end
        points = [input_points[0], ...input_points, input_points[input_points.length - 1]];
        expectedSegments = input_points.length - 1; // Open curve has n-1 segments
    }

    const curvePoints = [];
    const n = points.length;

    // Ensure at least 4 points
    if (n < 4) {
        console.error("Need at least 4 control points");
        return curvePoints;
    }

    // If segmentCounts not provided, use default value 100 for each segment
    if (!segmentCounts) {
        segmentCounts = new Array(expectedSegments).fill(100);
    }

    // Ensure segmentCounts length is correct
    /* if (segmentCounts.length !== expectedSegments) {
        console.error(`segmentCounts length should equal ${expectedSegments}`);
        return curvePoints;
    } */

    // Temporary variables to avoid repeated creation
    let t, t2, t3;
    let p0, p1, p2, p3;
    let v0x, v0y, v0z, v1x, v1y, v1z;
    let point = { x: 0, y: 0, z: 0 };

    // Calculate actual number of segments to process
    const segmentsToProcess = loop ? expectedSegments : n - 3;

    for (let i = 0; i < segmentsToProcess; i++) {
        // For closed loop case, indices need special handling
        let idx0, idx1, idx2, idx3;
        
        if (loop) {
            // Index calculation for closed loop
            idx0 = i;
            idx1 = i + 1;
            idx2 = i + 2;
            idx3 = i + 3;
        } else {
            // Index calculation for open curve
            idx0 = i;
            idx1 = i + 1;
            idx2 = i + 2;
            idx3 = i + 3;
        }

        p0 = points[idx0];
        p1 = points[idx1];
        p2 = points[idx2];
        p3 = points[idx3];

        // Pre-calculate tangents
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

            // X coordinate
            point.x = (2 * p1.x - 2 * p2.x + v0x + v1x) * t3 +
                (-3 * p1.x + 3 * p2.x - 2 * v0x - v1x) * t2 +
                v0x * t + p1.x;

            // Y coordinate
            point.y = (2 * p1.y - 2 * p2.y + v0y + v1y) * t3 +
                (-3 * p1.y + 3 * p2.y - 2 * v0y - v1y) * t2 +
                v0y * t + p1.y;

            // Z coordinate
            point.z = (2 * p1.z - 2 * p2.z + v0z + v1z) * t3 +
                (-3 * p1.z + 3 * p2.z - 2 * v0z - v1z) * t2 +
                v0z * t + p1.z;

            curvePoints.push({ x: point.x, y: point.y, z: point.z });
        }
    }

    return curvePoints;
};

export { catmull_rom_curve }; 