var GREY = (function () {
    "use strict";

    function Level(data) {
        this.resource = data.resource;
        this.image = null;
        this.shipPosition = new R2.V(data.shipX, data.shipY);
    }

    Level.prototype.batch = function(batch) {
        this.image = batch.load(this.resource);
    };

    function SpaceView() {
        this.maximize = true;
        this.updateInDraw = true;

        this.levels = [
            new Level({resource: "normalspace.png", shipX: 50, shipY: 50 }),
            new Level({resource: "grey_square.png", shipX: 50, shipY: 50 }),
            new Level({resource: "wells.png", shipX: 50, shipY: 50 })
        ];

        var self = this;

        this.batch = new BLIT.Batch("images/", function () {
            self.loadLevel(0);
        });
        for (var l = 0; l < this.levels.length; ++l) {
            this.levels[l].batch(this.batch);
        }
        this.batch.commit();

        this.space = null;
        this.level = null;

        this.setupControls();
    }

    SpaceView.prototype.setupControls = function () {
        this.levelSelect = document.getElementById("selectLevel");
        if (this.levelSelect) {
            this.levelSelect.addEventListener("change", function (e) {
                self.loadLevel(parseInt(self.levelSelect.value));
            }, true);
            for (var l = 0, self = this ; l < this.levels.length; ++l) {
                self.levelSelect.appendChild(new Option("Level " + l, l));
            }
        }
    };

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

    SpaceView.prototype.loadLevel = function (index) {
        this.level = this.levels[index];
        var image = this.level.image,
            space = new FIELD.Space(image.width, image.height);
        IMPROC.processImage(image, 0, 0, image.width, image.height, function (x, y, r, g, b, a) {
            space.setPotential(x, y, r / IMPROC.BYTE_MAX);
        });
        space.computeGrads();

        this.xGrad = canvasMatching(image);
        this.yGrad = canvasMatching(image);

        drawGradient(space, this.xGrad, xGradToPixel);
        drawGradient(space, this.yGrad, yGradToPixel);

        this.space = space;
    }

    SpaceView.prototype.update = function (now, elapsed, keyboard, pointer, width, height) {
        if (this.space) {
            var xOffset = Math.floor((width - this.space.width) * 0.5),
                yOffset = Math.floor((height - this.space.height) * 0.5),
                fire = false,
                fireAngle = 0;

            if (pointer.primary && pointer.primary.isStart) {
                fire = true;
                var levelX = pointer.primary.x - xOffset,
                    levelY = pointer.primary.y - yOffset,
                    shipPos = this.space.ship.pos,
                    dx = levelX - shipPos.x,
                    dy = levelY - shipPos.y;
                fireAngle = Math.atan2(dy, dx) + Math.PI;
            }

            this.space.update(elapsed, 1, fire, fireAngle);
        }
    };

    SpaceView.prototype.draw = function (context, width, height) {
        context.clearRect(0, 0, width, height);
        if (this.space) {
            var xOffset = Math.floor((width - this.space.width) * 0.5),
                yOffset = Math.floor((height - this.space.height) * 0.5);
            if (this.level) {
                BLIT.draw(context, this.level.image, xOffset, yOffset, BLIT.ALIGN.TopLeft);
            }

            BLIT.draw(context, this.xGrad, xOffset + this.space.width, yOffset, BLIT.ALIGN.TopLeft);
            BLIT.draw(context, this.yGrad, xOffset, yOffset + this.space.height, BLIT.ALIGN.TopLeft);

            var shipPos = this.space.ship.pos;
            context.fillStyle = "green";
            context.beginPath();
            context.arc(shipPos.x + xOffset, shipPos.y + yOffset, 5, 0, 2*Math.PI);
            context.fill();

            context.fillStyle = "blue";
            for (var p = 0; p < this.space.particles.length; ++p) {
                var particle = this.space.particles[p];
                context.beginPath();
                context.arc(particle.pos.x + xOffset, particle.pos.y + yOffset, 2, 0, 2*Math.PI);
                context.fill();
            }
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