import * as pc from 'playcanvas';

export class GridHelper {
    constructor(app, options = {}) {
        this.app = app;

        // Default configuration
        this.options = {
            gridHalfSize: options.gridHalfSize || 5,
            gridColor: options.gridColor || new pc.Color(1, 1, 1, 0.3),
            xAxisColor: options.xAxisColor || new pc.Color(1, 0, 0, 0.5),
            yAxisColor: options.yAxisColor || new pc.Color(0, 0, 1, 0.5),
            arrowSize: options.arrowSize || 0.3
        };

        this.initGridLines();
    }

    initGridLines() {
        const { gridHalfSize, arrowSize } = this.options;

        // Initialize line array
        this.gridLines = [];
        this.xAxisLine = [];
        this.yAxisLine = [];
        this.xAxisArrow = [];
        this.yAxisArrow = [];

        // Create grid lines
        for (let i = 0; i < gridHalfSize * 2 + 1; i++) {
            if (i !== gridHalfSize) {
                this.gridLines.push(
                    new pc.Vec3(-gridHalfSize, 0, i - gridHalfSize),
                    new pc.Vec3(gridHalfSize, 0, i - gridHalfSize)
                );
                this.gridLines.push(
                    new pc.Vec3(i - gridHalfSize, 0, -gridHalfSize),
                    new pc.Vec3(i - gridHalfSize, 0, gridHalfSize)
                );
            }
        }

        // Create axis lines
        this.xAxisLine.push(
            new pc.Vec3(-gridHalfSize, 0, 0),
            new pc.Vec3(gridHalfSize, 0, 0)
        );
        this.yAxisLine.push(
            new pc.Vec3(0, 0, -gridHalfSize),
            new pc.Vec3(0, 0, gridHalfSize)
        );

        // Create arrows
        this.xAxisArrow.push(
            new pc.Vec3(gridHalfSize, 0, 0),
            new pc.Vec3(gridHalfSize - arrowSize, 0, arrowSize),
            new pc.Vec3(gridHalfSize, 0, 0),
            new pc.Vec3(gridHalfSize - arrowSize, 0, -arrowSize)
        );
        this.yAxisArrow.push(
            new pc.Vec3(0, 0, gridHalfSize),
            new pc.Vec3(arrowSize, 0, gridHalfSize - arrowSize),
            new pc.Vec3(0, 0, gridHalfSize),
            new pc.Vec3(-arrowSize, 0, gridHalfSize - arrowSize)
        );
    }

    draw() {
        const { gridColor, xAxisColor, yAxisColor } = this.options;

        this.app.drawLines(this.gridLines, gridColor);
        this.app.drawLines(this.xAxisLine, xAxisColor);
        this.app.drawLines(this.yAxisLine, yAxisColor);
        this.app.drawLines(this.xAxisArrow, xAxisColor);
        this.app.drawLines(this.yAxisArrow, yAxisColor);
    }
}