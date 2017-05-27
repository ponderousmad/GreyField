var GREY = (function () {
    "use strict";

    function SpaceView() {
        this.maximize = true;
        this.updateInDraw = true;

        var self = this;

        this.batch = new BLIT.Batch("images/", function () {
            self.processLevels();
        });
        this.image = this.batch.load("normalspace.png");
        this.batch.commit();

        this.space = null;
    }

    function canvasMatching(image) {
        var canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        return canvas;
    }

    function drawGradient(space, canvas, gradFunc) {
        var context = canvas.getContext('2d');
        var buffer = context.getImageData(0, 0, canvas.width, canvas.height);
        for (var y = 0; y < space.height; ++y) {
            for (var x = 0; x < space.width; ++x) {
                var i = (y * space.width + x) * IMPROC.CHANNELS,
                    result = gradFunc(space, x, y);
                for (var c = 0; c < result.length; ++c) {
                    buffer.data[i + c] = result[c];
                }
            }
        }
        context.putImageData(buffer, 0, 0);
    }

    function gradToPixel(grad) {
        var c = Math.floor(((grad + 2)/ 4) * IMPROC.BYTE_MAX);
        return [c, c, c, IMPROC.BYTE_MAX];
    }

    function xGradToPixel(space, x, y) {
        return gradToPixel(space.gradient(x, y).x);
    }

    function yGradToPixel(space, x, y) {
        return gradToPixel(space.gradient(x, y).y);
    }

    SpaceView.prototype.processLevels = function () {
        var space =  new FIELD.Space(this.image.width, this.image.height);
        IMPROC.processImage(this.image, 0, 0, this.image.width, this.image.height, function (x, y, r, g, b, a) {
            space.setPotential(x, y, r / IMPROC.BYTE_MAX);
        });
        space.computeGrads();

        this.xGrad = canvasMatching(this.image);
        this.yGrad = canvasMatching(this.image);

        drawGradient(space, this.xGrad, xGradToPixel);
        drawGradient(space, this.yGrad, yGradToPixel);

        this.space = space;
    }

    SpaceView.prototype.update = function (now, elapsed, keyboard, pointer) {
        if (this.space) {
            this.space.update(elapsed, 1);
        }
    };

    SpaceView.prototype.draw = function (context, width, height) {
        context.clearRect(0, 0, width, height);
        if (this.batch.loaded) {
            BLIT.draw(context, this.image, 0, 0, BLIT.ALIGN.TopLeft);
        }
        if (this.space) {
            BLIT.draw(context, this.xGrad, this.space.width, 0, BLIT.ALIGN.TopLeft);
            BLIT.draw(context, this.yGrad, 0, this.space.height, BLIT.ALIGN.TopLeft);

            context.fillStyle = "red";
            context.beginPath();
            var shipPos = this.space.ship.pos;
            context.arc(shipPos.x, shipPos.y, 5, 0, 2*Math.PI);
            context.fill();
        }
    };

    function start() {
        MAIN.start(document.getElementById("canvas2D"), new SpaceView());

        MAIN.setupToggleControls();
        if (MAIN.runTestSuites() === 0) {
            console.log("All Tests Passed!");
        }
    }

    return {
        start: start
    };
}());