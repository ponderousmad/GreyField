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
        var type = data.type == "white";
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
                space.addBomb(pos, type, range, size);
            }
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

        this.exits = [];
        this.fuel = [];
        this.bombs = [];
        if (data.parts) {
            for (var p = 0; p < data.parts.length; ++p) {
                var partData = data.parts[p],
                    pos = new R2.V(parseFloat(partData.x), parseFloat(partData.y)),
                    size = parseFloat(partData.size);
                if (isNaN(size)) {
                    size = null;
                }
                switch (partData.type) {
                    case "exit": {
                        this.exits.push[makeExit(partData, pos, size)];
                        break;
                    }
                    case "fuel": {
                        this.fuel.push[makeFuel(partData, pos, size)];
                        break;
                    }
                    case "bomb": {
                        this.bombs.push[makeBomb(partData, pos, size)];
                    }
                }
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

        for (var e = 0; e < this.exits.length; ++e) {
            parts.push(this.exits[e].save());
        }
        for (var f = 0; f < this.fuel.length; ++f) {
            parts.push(this.fuel[f].save());
        }
        for (var b = 0; b < this.bombs.length; ++b) {
            parts.push(this.bombs[b].save());
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
        this.potentialCanvas = document.createElement('canvas');
        this.potentialContext = this.potentialCanvas.getContext('2d');

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

                    drawGradient(self.space, self.xGrad, null, xGradToPixel);
                    drawGradient(self.space, self.yGrad, null, yGradToPixel);
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

    function drawGradient(space, canvas, context, gradFunc) {
        if (!context) {
            context = canvas.getContext('2d');
        }
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

    function potToPixel(space, x, y) {
        var c = space.potential(x,y) * IMPROC.BYTE_MAX;
        return [c, c, c, IMPROC.BYTE_MAX];
    }

    SpaceView.prototype.loadLevel = function (index) {
        this.level = this.levels[index];
        var image = this.level.image,
            space = new FIELD.Space(image.width, image.height, this.level.gravity);
        IMPROC.processImage(image, 0, 0, image.width, image.height, function (x, y, r, g, b, a) {
            space.setPotential(x, y, r / IMPROC.BYTE_MAX);
        });
        this.level.setupShip(space);
        this.potentialCanvas.width = image.width;
        this.potentialCanvas.height = image.height;
        this.potentialContext.drawImage(image, 0, 0);
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

            if(this.space.hasPotentialUpdated){ // might need to go before the other stuff
                this.space.hasPotentialUpdated = false;
                drawGradient(this.space, this.potentialCanvas, this.potentialContext, potToPixel);
                console.log("Updated Gradient");
            }

            if (this.level) {
                BLIT.draw(context, this.potentialCanvas, xOffset, yOffset, BLIT.ALIGN.TopLeft);
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

            context.fillStyle = "red";
            for (var p = 0; p < this.space.bombs.length; ++p) {
                var explosive = this.space.bombs[p];
                var new_image = new Image();
                if(explosive.explodesWhite) {
                    new_image.src = 'images/white_bomb.png';
                } else {
                    new_image.src = 'images/black_bomb.png';
                }
                new_image.onload = function(){
                    //context.drawImage(new_image, explosive.pos.x + xOffset, explosive.pos.y + yOffset);
                }
                context.beginPath();
                context.arc(explosive.pos.x + xOffset, explosive.pos.y + yOffset, 5, 0, 2*Math.PI);
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