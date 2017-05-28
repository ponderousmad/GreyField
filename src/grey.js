var GREY = (function () {
    "use strict";

    function Level(data) {
        this.resource = data.resource;
        this.image = null;
        this.gravity = data.gravity;
        this.shipPosition = new R2.V(data.shipX, data.shipY);
        this.shipMass = data.shipMass;
        this.particleCount = data.particleCount;
        this.particleMass = data.particleMass;
        this.particleVelocity = data.particleVelocity;
    }

    Level.prototype.setupShip = function (space) {
        space.setupShip(
            this.shipPosition.clone(),
            this.shipMass,
            this.particleMass,
            this.particleCount,
            this.particleVelocity
        );
    };

    Level.prototype.batch = function(batch) {
        this.image = batch.load(this.resource);
    };

    function SpaceView() {
        this.maximize = true;
        this.updateInDraw = true;

        this.levels = null;

        var self = this;

        this.space = null;
        this.level = null;

        this.xGrad = null;
        this.yGrad = null;

        IO.downloadJSON("levels.json", function (data) {
            self.loadLevelData(data);
        });
    }

    SpaceView.prototype.loadLevelData = function (data) {
        this.levels = [];

        var self = this;
        this.batch = new BLIT.Batch("images/", function () {
            self.loadLevel(0);
            self.setupControls();
        });
        for (var l = 0; l < data.levels.length; ++l) {
            var level = new Level(data.levels[l]);
            this.levels.push(level);
            level.batch(this.batch);
        }
        this.batch.commit();
    }

    SpaceView.prototype.setupControls = function () {
        this.levelSelect = document.getElementById("selectLevel");
        if (this.levelSelect) {
            this.levelSelect.addEventListener("change", function (e) {
                self.loadLevel(parseInt(self.levelSelect.value));
            }, true);
            for (var l = 0, self = this ; l < this.levels.length; ++l) {
                self.levelSelect.appendChild(new Option(this.levels[l].resource.slice(0, -4), l));
            }
        }

        var showGradients = document.getElementById("buttonShowGrads"),
            self = this;
        if (showGradients) {
            showGradients.addEventListener("click", function (e) {
                if (self.space) {
                    self.xGrad = canvasMatching(self.level.image);
                    self.yGrad = canvasMatching(self.level.image);

                    drawGradient(self.space, self.xGrad, xGradToPixel);
                    drawGradient(self.space, self.yGrad, yGradToPixel);
                }
            }, true);
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
        return gradToPixel(space.closestGradient(new R2.V(x + 0.5, y + 0.5)).x / space.gravity);
    }

    function yGradToPixel(space, x, y) {
        return gradToPixel(space.closestGradient(new R2.V(x + 0.5, y + 0.5)).y / space.gravity);
    }

    SpaceView.prototype.loadLevel = function (index) {
        this.level = this.levels[index];
        var image = this.level.image,
            space = new FIELD.Space(image.width, image.height, this.level.gravity);
        IMPROC.processImage(image, 0, 0, image.width, image.height, function (x, y, r, g, b, a) {
            space.setPotential(x, y, r / IMPROC.BYTE_MAX);
        });
        this.level.setupShip(space);
        this.xGrad = null;
        this.yGrad = null;
        this.space = space;
    }

    SpaceView.prototype.update = function (now, elapsed, keyboard, pointer, width, height) {
        elapsed = Math.min(200, elapsed);
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

            if (this.xGrad) {
                BLIT.draw(context, this.xGrad, xOffset + this.space.width, yOffset, BLIT.ALIGN.TopLeft);
            }
            if (this.yGrad) {
                BLIT.draw(context, this.yGrad, xOffset, yOffset + this.space.height, BLIT.ALIGN.TopLeft);
            }

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