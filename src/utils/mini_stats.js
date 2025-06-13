function init_mini_stats(app){
    // set up options for mini-stats, start with the default options
    const options = pc.MiniStats.getDefaultOptions();

    // configure sizes
    options.sizes = [
        { width: 128, height: 16, spacing: 0, graphs: false },
        { width: 256, height: 32, spacing: 2, graphs: true },
        { width: 500, height: 64, spacing: 2, graphs: true }
    ];

    // when the application starts, use the largest size
    options.startSizeIndex = 1;

    // display additional counters
    // Note: for most of these to report values, either debug or profiling engine build needs to be used.
    options.stats = [
        // frame update time in ms
        {
            name: 'Update',
            stats: ['frame.updateTime'],
            decimalPlaces: 1,
            unitsName: 'ms',
            watermark: 33
        },

        // total number of draw calls
        {
            name: 'DrawCalls',
            stats: ['drawCalls.total'],
            watermark: 2000
        },

        // total number of triangles, in 1000s
        {
            name: 'triCount',
            stats: ['frame.triangles'],
            decimalPlaces: 1,
            multiplier: 1 / 1000,
            unitsName: 'k',
            watermark: 500
        },

        // number of materials used in a frame
        {
            name: 'materials',
            stats: ['frame.materials'],
            watermark: 2000
        },

        // frame time it took to do frustum culling
        {
            name: 'cull',
            stats: ['frame.cullTime'],
            decimalPlaces: 1,
            watermark: 1,
            unitsName: 'ms'
        },

        // used VRAM, displayed using 2 colors - red for textures, green for geometry
        {
            name: 'VRAM',
            stats: ['vram.tex', 'vram.geom'],
            decimalPlaces: 1,
            multiplier: 1 / (1024 * 1024),
            unitsName: 'MB',
            watermark: 100
        },

        // frames per second
        {
            name: 'FPS',
            stats: ['frame.fps'],
            watermark: 60
        },

        // delta time
        {
            name: 'Frame',
            stats: ['frame.ms'],
            decimalPlaces: 1,
            unitsName: 'ms',
            watermark: 33
        }
    ];

    // create mini-stats system
    const miniStats = new pc.MiniStats(app, options); 
    return miniStats;
}

export { init_mini_stats };