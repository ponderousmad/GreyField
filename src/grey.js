var GREY = (function () {
    "use strict";

    function savePart(data, type, pos, size) {
        data.type = type;
        data.x = pos.x;
        data.y = pos.y;
        data.size = size;
    }

    function makeExit(data, pos, size) {
        return {
            pos: pos,
            save: function () {
                return savePart({}, "exit", pos);
            },
            build: function (space) {
                space.addExit(pos, size);
            }
        }
    }

    function makeFuel(data, pos, size) {
        var boost = data.boost,
            particles = parseInt(data.particles);
        return {
            pos: pos,
            save: function () {
                var saveData = {
                    particles: particles
                }
                if (boost) {
                    saveData.boost = true;
                }
                return savePart(saveData, "fuel", pos, size);
            },
            build: function (space) {
                space.addFuel(pos, particles, boost, size);
            }
        }
    }

    function makeBomb(data, pos, size) {
        var type = data.type == "white",
            range = parseFloat(data.range);
        if (isNaN(range)) {
            range = null;
        }
        return {
            pos: pos,
            save: function () {
                var saveData = {
                    type: type ? "white" : "black"
                }
                if (range) {
                    saveData.range = range;
                }
                return savePart({}, "bomb", pos);
            },
            build: function (space) {
                space.addBomb(pos, type, size, range);
            }
        }
    }
    
    function loadPart(data) {
        var pos = new R2.V(parseFloat(data.x), parseFloat(data.y)),
            size = parseFloat(data.size);
        if (isNaN(size)) {
            size = null;
        }
        switch (data.type) {
            case "exit": return makeExit(data, pos, size);
            case "fuel": return makeFuel(data, pos, size);
            case "bomb": return makeBomb(data, pos, size);
        }
    }

    function Level(data) {
        this.resource = data.resource;
        this.image = null;
        this.gravity = data.gravity;
        this.shipPosition = new R2.V(data.shipX, data.shipY);
        this.shipMass = data.shipMass;
        this.particleCount = data.particleCount;
        this.particleMass = data.particleMass;
        this.particleVelocity = data.particleVelocity;

        this.parts = [];
        if (data.parts) {
            for (var p = 0; p < data.parts.length; ++p) {
                this.parts.push(loadPart(data.parts[p]))
            }
        }
    }

    Level.prototype.save = function () {
        var data = {
            resource: this.resource,
            shipX: this.shipPosition.x,
            shipY: this.shipPosition.y
        };
        if (this.gravity) {
            data.gravity = this.gravity;
        }
        if (this.shipMass) {
            data.shipMass = this.shipMass;
        }
        if (this.particleCount) {
            data.particleCount = this.particleCount;
        }
        if (this.particleMass) {
            data.particleMass = this.particleMass;
        }
        if (this.particleVelocity) {
            data.particleVelocity = this.particleVelocity;
        }

        var parts = [];

        for (var p = 0; e < this.parts.length; ++p) {
            parts.push(this.parts[p].save());
        }

        return data;
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

    Level.prototype.batch = function (batch) {
        this.image = batch.load(this.resource);
    };

    function SpaceView() {
        this.maximize = true;
        this.updateInDraw = true;

        this.levels = null;

        var self = this;

        this.space = null;
        this.level = null;
        this.levelIndex = -1;
        this.potentialCanvas = document.createElement('canvas');
        this.potentialContext = this.potentialCanvas.getContext('2d');

        this.xGrad = null;
        this.yGrad = null;

        var self = this;
        this.batch = new BLIT.Batch("images/", function () {
            self.loadLevel(0);
            self.setupControls();
        });

        this.whiteBombImage = this.batch.load("white_bomb.png");
        this.blackBombImage = this.batch.load("black_bomb.png");
        this.fuelImage = this.batch.load("fuel.png");
        this.exitImage = this.batch.load("exit.png");

        IO.downloadJSON("levels.json", function (data) {
            self.loadLevelData(data);
        });
    }

    SpaceView.prototype.loadLevelData = function (data) {
        this.levels = [];

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
                self.levelSelect.appendChild(new Option(l + ": " + this.levels[l].resource.slice(0, -4), l));
            }
        }

        var showGradients = document.getElementById("buttonShowGrads"),
            self = this;
        if (showGradients) {
            showGradients.addEventListener("click", function (e) {
                if (self.space) {
                    self.xGrad = canvasMatching(self.level.image);
                    self.yGrad = canvasMatching(self.level.image);

                    drawField(self.space, self.xGrad, null, xGradToPixel);
                    drawField(self.space, self.yGrad, null, yGradToPixel);
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

    function drawField(space, canvas, context, gradFunc) {
        if (!context) {
            context = canvas.getContext('2d');
        }
        var buffer = context.getImageData(0, 0, canvas.width, canvas.height);
        for (var y = 0; y < canvas.height; ++y) {
            for (var x = 0; x < canvas.width; ++x) {
                var i = (y * canvas.width + x) * IMPROC.CHANNELS,
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

    function potToPixel(space, x, y) {
        var c = Math.floor(space.potential(x - space.border, y - space.border) * 0.5 * IMPROC.BYTE_MAX);
        return [c, c, c, IMPROC.BYTE_MAX];
    }

    SpaceView.prototype.loadLevel = function (index) {
        this.level = this.levels[index];
        this.levelIndex = index;
        var image = this.level.image,
            space = new FIELD.Space(image.width, image.height, this.level.gravity);
        IMPROC.processImage(image, 0, 0, image.width, image.height, function (x, y, r, g, b, a) {
            space.setPotential(x, y, r / IMPROC.BYTE_MAX);
        });
        this.level.setupShip(space);
        this.potentialCanvas.width = image.width + 2 * space.border;
        this.potentialCanvas.height = image.height + 2 * space.border;
        this.potentialContext.drawImage(image, 0, 0);
        this.xGrad = null;
        this.yGrad = null;

        for (var p = 0; p < this.level.parts.length; ++p) {
            this.level.parts[p].build(space);
        }
        this.space = space;
    }

    function centerOffset(outer, inner) {
        return Math.floor((outer - inner) * 0.5);
    }

    SpaceView.prototype.update = function (now, elapsed, keyboard, pointer, width, height) {
        elapsed = Math.min(200, elapsed);
        if (this.space) {
            var fire = false,
                fireAngle = 0;

            if (pointer.primary && pointer.primary.isStart) {
                fire = true;
                var levelX = pointer.primary.x - centerOffset(width, this.space.width),
                    levelY = pointer.primary.y - centerOffset(height, this.space.height),
                    shipPos = this.space.ship.pos,
                    dx = levelX - shipPos.x,
                    dy = levelY - shipPos.y;
                fireAngle = Math.atan2(dy, dx) + Math.PI;
            }

            this.space.update(elapsed, 1, fire, fireAngle);

            if (this.space.hasPotentialUpdated) {
                this.space.hasPotentialUpdated = false;
                drawField(this.space, this.potentialCanvas, this.potentialContext, potToPixel, true);
                console.log("Updated Gradient");
            }

            if(this.space.isLevelCompleted) {
                this.levelIndex += 1;
                this.loadLevel(this.levelIndex);
            } else if (this.space.isLevelLost) {
                this.loadLevel(this.levelIndex);
            }
        }
    };

    SpaceView.prototype.draw = function (context, width, height) {
        context.clearRect(0, 0, width, height);
        context.save();
        if (this.space) {
            context.translate(
                centerOffset(width, this.space.width),
                centerOffset(height, this.space.height)
            );
            if (this.level) {
                BLIT.draw(context, this.potentialCanvas, -this.space.border, -this.space.border, BLIT.ALIGN.TopLeft);
            }

            if (this.xGrad) {
                BLIT.draw(context, this.xGrad, this.space.width, 0, BLIT.ALIGN.TopLeft);
            }
            if (this.yGrad) {
                BLIT.draw(context, this.yGrad, 0, this.space.height, BLIT.ALIGN.TopLeft);
            }

            var shipPos = this.space.ship.pos;
            context.fillStyle = "green";
            context.beginPath();
            context.arc(shipPos.x, shipPos.y, 5, 0, 2*Math.PI);
            context.fill();

            context.fillStyle = "blue";
            for (var p = 0; p < this.space.particles.length; ++p) {
                var particle = this.space.particles[p];
                context.beginPath();
                context.arc(particle.pos.x, particle.pos.y, 2, 0, 2*Math.PI);
                context.fill();
            }

            for (var b = 0; b < this.space.bombs.length; ++b) {
                var bomb = this.space.bombs[b],
                    bombImage = bomb.explodesWhite ? this.whiteBombImage : this.blackBombImage;
                BLIT.draw(context, bombImage, bomb.pos.x, bomb.pos.y, BLIT.ALIGN.Center);
            }

            for (var f = 0; f < this.space.fuels.length; ++f) {
                var fuel = this.space.fuels[f];
                BLIT.draw(context, this.fuelImage, fuel.pos.x, fuel.pos.y, BLIT.ALIGN.Center);
            }

            for (var e = 0; e < this.space.exits.length; ++e) {
                var exit = this.space.exits[e];
                BLIT.draw(context, this.exitImage, exit.pos.x, exit.pos.y, BLIT.ALIGN.Center);
            }
        }
        context.restore();
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