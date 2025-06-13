import * as pc from 'playcanvas';

const vertexShader = /* glsl */ `
attribute vec4 vertex_position;
attribute vec4 vertex_color;
vec4 discardVec = vec4(0.0, 0.0, 2.0, 0.0);

uniform mat4 matrix_model;
uniform mat4 matrix_view;
uniform mat4 matrix_projection;
uniform mat4 matrix_viewProjection;

// uniform float splatSize;
// uniform float expansionFactor;

uniform float maxRadius;
uniform float alpha;
uniform float heightRatio;
uniform vec3 localCenter;

varying vec4 color;

vec4 colors[3] = vec4[3](
    vec4(1.0, 0, 0, 0.25),
    vec4(0, 0, 1.0, 0.5),
    vec4(1.0, 1.0, 0.0, 0.5)
);

void main(void) {
    int state = int(vertex_position.w);
    if (state == -1) {
        gl_Position = discardVec;
    } else {
        vec4 worldPos = matrix_model * vec4(vertex_position.xyz, 1.0);
        gl_Position = matrix_viewProjection * worldPos;
        color = vertex_color;
        gl_PointSize = 1.0;
        color.a = 0.8;

        if (heightRatio > 0.05) {
            gl_Position.y *= heightRatio;
        }

        if (alpha > 0.05) {
                // Calculate distance to center point
            // float distanceToCenter = length(worldPos.xyz);
            float distanceToCenter = length(vertex_position.xyz - localCenter.xyz);

            // Calculate ring width (5% of max radius)
            float ringWidth = maxRadius * 0.03;

            // Calculate ring radius
            float ringRadius = alpha * maxRadius;

            // Determine if point is inside the ring
            float distanceToRing = abs(distanceToCenter - ringRadius);
            if (distanceToCenter < ringRadius) {
                gl_Position = discardVec;
                gl_PointSize = 0.0;
                return;
            }


            // color = vec4(1.0, 1.0, 1.0, 1.0);
            // color.a = 1.0;

            // Set point size based on distance
            if ((distanceToCenter > ringRadius) && (distanceToCenter < ringRadius + ringWidth)){
                // gl_PointSize = 1.5;
                // color.a = 1.0;
                color = vec4(1.0, 1.0, 1.0, 1.0);

                // Calculate relative position of point within ring width (between 0 and 1)
                float t = (distanceToCenter - ringRadius) / ringWidth;

                // Use sine function to create smooth transition effect
                float sinFactor = sin(t * 3.14159);

                // Map sinFactor to range 0.3 to 1.0
                color.a = 0.8 + sinFactor * 0.2;
                // // gl_PointSize = 1.0 + sinFactor * 1.0; // Optional: adjust point size based on sinFactor
                // gl_Position.y *= sinFactor * 0.1 + 1.0;
                // // gl_Position.x *= sinFactor * 0.1 + 1.0;
                // // gl_Position.z *= sinFactor * 0.1 + 1.0;

            } else {
                color.a = 0.8;
                gl_PointSize = 1.0;
            }
        }
    }
}
`;

const fragmentShader = /* glsl */ `
// attribute vec4 vertex_color;
varying vec4 color;

void main(void)
{
    // color.a *= expansionFactor;
    gl_FragColor = color;
}
`;

function pointCloudMesh(device, splatData, sample = 1) {
    // Use new ShaderMaterial API
    const material = new pc.ShaderMaterial({
        uniqueName: 'pointCloudShader',
        attributes: {
        vertex_position: pc.SEMANTIC_POSITION,
        vertex_color: pc.SEMANTIC_COLOR,
        },
        vertexGLSL: vertexShader,
        fragmentGLSL: fragmentShader
    });

    material.name = 'gsplatPointCloudMaterial';
    material.blendType = pc.BLEND_NORMAL;
    // material.cull = pc.CULLFACE_NONE;
    // material.depthTest = true; // Enable depth testing
    // material.depthWrite = false; // Disable depth writing
    material.update();

    const x = splatData.getProp('x');
    const y = splatData.getProp('y');
    const z = splatData.getProp('z');

    const r = splatData.getProp('f_dc_0');
    const g = splatData.getProp('f_dc_1');
    const b = splatData.getProp('f_dc_2');
    const a = splatData.getProp('opacity');

    // Initialize new arrays to store sampled data
    const vertexData = new Float32Array(Math.ceil(splatData.numSplats / sample) * 4);
    const colorData = new Float32Array(Math.ceil(splatData.numSplats / sample) * 4);

    let sampledIndex = 0;
    for (let i = 0; i < splatData.numSplats; i += sample) {
        // Copy vertex data
        vertexData[sampledIndex * 4 + 0] = x[i];
        vertexData[sampledIndex * 4 + 1] = y[i];
        vertexData[sampledIndex * 4 + 2] = z[i];
        vertexData[sampledIndex * 4 + 3] = 1;

        // Copy color data
        colorData[sampledIndex * 4 + 0] = r[i];
        colorData[sampledIndex * 4 + 1] = g[i];
        colorData[sampledIndex * 4 + 2] = b[i];
        colorData[sampledIndex * 4 + 3] = a[i];

        // Update sampled index
        sampledIndex++;
    }

    const mesh = new pc.Mesh(device);
    mesh.setPositions(vertexData, 4);
    mesh.setColors(colorData, 4);
    mesh.update(pc.PRIMITIVE_POINTS, true);

    const meshInstance = new pc.MeshInstance(mesh, material);
    meshInstance.cull = false;
    // meshInstance.material.setParameter('splatSize', splatSize);

    return meshInstance;
}

export { pointCloudMesh };