var GREY = (function () {
    "use strict";

    function savePart(data, type, pos, size) {
        data.type = type;
        data.x = pos.x;
        data.y = pos.y;
        data.size = size;
        return data;
    }

    function makePart(data, pos, save, build) {
        return {
            type: data.type,
            pos: pos,
            save: save,
            build: build
        };
    }

    function makeExit(data, pos, size) {
        return makePart(data, pos,
            function () {
                return savePart({}, "exit", pos);
            },
            function (space) {
                space.addExit(pos, size);
            }
        );
    }

    function makeFuel(data, pos, size) {
        var boost = data.boost,
            particles = parseInt(data.particles);
        return makePart(data, pos,
            function () {
                var saveData = {
                    particles: particles
                };
                if (boost) {
                    saveData.boost = true;
                }
                return savePart(saveData, "fuel", pos, size);
            },
            function (space) {
                space.addFuel(pos, particles, boost, size);
            }
        );
    }

    function makeBomb(data, pos, size) {
        var isWhite = data.bombType == "white",
            range = parseFloat(data.range);
        if (isNaN(range)) {
            range = null;
        }
        return makePart(data, pos,
            function () {
                var saveData = {
                    bombType: isWhite ? "white" : "black"
                };
                if (range) {
                    saveData.range = range;
                }
                return savePart(saveData, "bomb", pos, size);
            },
            function (space) {
                space.addBomb(pos, isWhite, size, range);
            }
        );
    }

    function makePlanet(data, pos, size) {
        var exponent = parseFloat(data.exponent),
            scale = parseFloat(data.scale);
        if (isNaN(exponent)) {
            exponent = null;
        }
        return makePart(data, pos,
            function () {
                var saveData = {
                };
                if (exponent) {
                    saveData.exponent = exponent;
                }
                return savePart(saveData, "planet", pos, size);
            },
            function (space) {
                space.addPlanet(pos, exponent, size);
            }
        );
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
            case "planet": return makePlanet(data, pos, size);
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
                this.parts.push(loadPart(data.parts[p]));
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
        for (var p = 0; p < this.parts.length; ++p) {
            parts.push(this.parts[p].save());
        }
        if (parts.length > 0) {
            data.parts = parts;
        }
        return data;
    };

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
        this.selectedPart = null;

        this.xGrad = null;
        this.yGrad = null;

        this.batch = new BLIT.Batch("images/", function () {
            self.loadLevel(0);
            self.setupControls();
        });

        this.whiteBombImage = this.batch.load("white_bomb.png");
        this.blackBombImage = this.batch.load("black_bomb.png");
        this.fuelImage = this.batch.load("fuel_high_res.png");
        this.exitImage = this.batch.load("goal.png");
        this.shipImage = this.batch.load("ship_high_res.png");
        this.particleImage = this.batch.load("pellet_high_res.png");

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
    };

    SpaceView.prototype.setupControls = function () {
        var showGradients = document.getElementById("buttonShowGrads"),
            saveButton = document.getElementById("buttonClipboard"),
            editArea = document.getElementById("textData"),
            createPart = document.getElementById("buttonCreatePart"),
            updatePart = document.getElementById("buttonUpdatePart"),
            deletePart = document.getElementById("buttonDeletePart"),
            self = this;

        this.cursorDisplay = document.getElementById("cursor");
        this.levelSelect = document.getElementById("selectLevel");
        if (this.levelSelect) {
            this.levelSelect.addEventListener("change", function (e) {
                self.loadLevel(parseInt(self.levelSelect.value), true);
            }, true);
            for (var l = 0; l < this.levels.length; ++l) {
                self.levelSelect.appendChild(new Option(l + ": " + this.levels[l].resource.slice(0, -4), l));
            }
        }

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

        if (saveButton) {
            saveButton.addEventListener("click", function () {
                var data = {},
                    levels = [];
                for (var l = 0; l < self.levels.length; ++l) {
                    levels.push(self.levels[l].save());
                }
                data.levels = levels;
                editArea.value = JSON.stringify(data, null, 4) + "\n";
                editArea.select();
                editArea.focus();
                document.execCommand("copy");
            }, true);
        }

        function setupSlider(idBase, handleChange) {
            var slider = document.getElementById("slider" + idBase),
                value = document.getElementById("value" + idBase);
            if (slider) {
                slider.addEventListener("input", function (e) {
                    if (value) {
                        value.value = slider.value;
                    }
                    handleChange(parseFloat(slider.value));
                });
            }
            if (value) {
                value.addEventListener("change", function (e) {
                    if (!isNaN(value.value)) {
                        if (slider) {
                            slider.value = value.value;
                        }
                        handleChange(parseFloat(value.value));
                    }
                });
            }

            return function(initialValue) {
                if (value) { value.value = initialValue; }
                if (slider) { slider.value = initialValue; }
            };
        }

        function onLevelChanged(updateEditors) {
            self.loadLevel(self.levelIndex, updateEditors);
        }

        this.initGravity = setupSlider("Gravity", function (value) {
            self.level.gravity = value;
            onLevelChanged();
        });
        this.initShipMass = setupSlider("ShipMass", function (value) {
            self.level.shipMass = value;
            onLevelChanged();
        });
        this.initShipX = setupSlider("ShipX", function (value) {
            self.level.shipPosition.x = value;
            onLevelChanged();
        });
        this.initShipY = setupSlider("ShipY", function (value) {
            self.level.shipPosition.y = value;
            onLevelChanged();
        });
        this.initParticles = setupSlider("Particles", function (value) {
            self.level.particleCount = Math.round(value);
            onLevelChanged();
        });
        this.initParticleVel = setupSlider("ParticleVel", function (value) {
            self.level.particleVelocity = value;
            onLevelChanged();
        });
        this.initParticleMass = setupSlider("ParticleMass", function (value) {
            self.level.particleMass = value;
            onLevelChanged();
        });

        this.partEdit = document.getElementById("textPartData");
        this.selectPartType = document.getElementById("selectPartType");
        this.partSelect = document.getElementById("selectPart");
        if (this.partSelect) {
            this.partSelect.addEventListener("change", function (e) {
                self.selectPart(parseInt(self.partSelect.value));
            }, true);
        }

        function setupPart() {
            if (self.partEdit && self.selectPartType) {
                var partData = JSON.parse(self.partEdit.value);
                partData.type = self.selectPartType.value;
                return loadPart(partData);
            }
            return null;
        }

        if (createPart) {
            createPart.addEventListener("click", function(e) {
                var newPart = setupPart();
                if (newPart !== null) {
                    self.level.parts.push(newPart);
                    onLevelChanged(true);
                    var selected = self.level.parts.length - 1;
                    self.partSelect.value = selected;
                    self.selectPart(selected);
                }
            }, true);
        }

        if (updatePart) {
            updatePart.addEventListener("click", function(e) {
                var newPart = setupPart();
                if (newPart !== null) {
                    var selected = self.selectedPart;
                    self.level.parts[selected] = newPart;
                    onLevelChanged(true);
                    self.partSelect.value = selected;
                    self.selectPart(selected);
                }
            }, true);
        }

        if (deletePart) {
            deletePart.addEventListener("click", function(e) {
                if (self.selectedPart !== null) {
                    self.level.parts.splice(self.selectedPart, 1);
                    onLevelChanged(true);
                }
            }, true);
        }

        this.updateLevelEditors();
    };

    SpaceView.prototype.updateLevelEditors = function () {
        this.initGravity(this.space.gravity);
        this.initShipMass(this.space.ship.shipMass);
        this.initShipX(this.space.ship.pos.x);
        this.initShipY(this.space.ship.pos.y);
        this.initParticles(this.space.ship.particleCount);
        this.initParticleVel(this.space.ship.particleVelocity);
        this.initParticleMass(this.space.ship.particleMass);

        if (this.partSelect) {
            this.partSelect.innerHTML = "";
            for (var p = 0; p < this.level.parts.length; ++p) {
                var part = this.level.parts[p];
                this.partSelect.appendChild(new Option(p + ": " + part.type, p));
            }
        }
        if (this.level.parts.length > 0) {
            this.selectPart(0);
        } else {
            this.selectedPart = null;
        }
    };

    SpaceView.prototype.selectPart = function (partIndex) {
        this.selectedPart = partIndex;
        var part = this.level.parts[partIndex];
        if (!part) {
            return;
        }
        if (this.selectPartType) {
            this.selectPartType.value = part.type;
        }
        if (this.partEdit) {
            this.partEdit.value = JSON.stringify(part.save(), null, 4);
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
        c = Math.min(c, IMPROC.BYTE_MAX);
        return [c, c, c, IMPROC.BYTE_MAX];
    }

    SpaceView.prototype.loadLevel = function (index, updateEditors) {
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
        this.xGrad = null;
        this.yGrad = null;

        for (var p = 0; p < this.level.parts.length; ++p) {
            this.level.parts[p].build(space);
        }
        this.space = space;
        if (updateEditors) {
            this.updateLevelEditors();
        }
    };

    function centerOffset(outer, inner) {
        return Math.floor((outer - inner) * 0.5);
    }

    SpaceView.prototype.update = function (now, elapsed, keyboard, pointer, width, height) {
        elapsed = 20;
        if (this.space) {
            var fire = false,
                fireAngle = 0,
                xOffset = centerOffset(width, this.space.width),
                yOffset = centerOffset(height, this.space.height);

            if (pointer.primary && pointer.primary.isStart) {
                fire = true;
                var levelX = pointer.primary.x - xOffset,
                    levelY = pointer.primary.y - yOffset,
                    shipPos = this.space.ship.pos,
                    dx = levelX - shipPos.x,
                    dy = levelY - shipPos.y;
                fireAngle = Math.atan2(dy, dx) + Math.PI;
            }
            if (this.cursorDisplay) {
                var loc = pointer.mouse.location;
                this.cursorDisplay.innerHTML = (loc[0] - xOffset) + ", " + (loc[1] - yOffset);
            }

            if (this.space.update(elapsed, 1, fire, fireAngle) ) {
                drawField(this.space, this.potentialCanvas, this.potentialContext, potToPixel, true);
                console.log("Updated Gradient");
            }

            if(this.space.isLevelCompleted) {
                this.levelIndex += 1;
                this.loadLevel(this.levelIndex, true);
                if (this.levelSelect) {
                    this.levelSelect.value = this.levelIndex;
                }
            } else if (this.space.isLevelLost || keyboard.wasAsciiPressed("R")) {
                this.loadLevel(this.levelIndex);
            }
        }
    };

    SpaceView.prototype.draw = function (context, width, height) {
        if (!this.space) {
            return;
        }
        context.clearRect(0, 0, width, height);
        context.save();
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

        context.imageSmoothingQuality = "high";

        var shipPos = this.space.ship.pos,
            shipSize = this.space.ship.size * 2;
        BLIT.draw(context, this.shipImage, shipPos.x, shipPos.y, BLIT.ALIGN.Center, shipSize, shipSize);

        for (var p = 0; p < this.space.particles.length; ++p) {
            var particle = this.space.particles[p],
                particleSize = particle.size * 2;
            BLIT.draw(context, this.particleImage, particle.pos.x, particle.pos.y, BLIT.ALIGN.Center, particleSize, particleSize);
        }

        for (var b = 0; b < this.space.bombs.length; ++b) {
            var bomb = this.space.bombs[b],
                bombImage = bomb.explodesWhite ? this.whiteBombImage : this.blackBombImage,
                bombSize = bomb.size * 4;
            BLIT.draw(context, bombImage, bomb.pos.x, bomb.pos.y, BLIT.ALIGN.Center, bombSize, bombSize);
        }

        for (var f = 0; f < this.space.fuels.length; ++f) {
            var fuel = this.space.fuels[f],
                fuelSize = fuel.size * 2;
            BLIT.draw(context, this.fuelImage, fuel.pos.x, fuel.pos.y, BLIT.ALIGN.Center, fuelSize, fuelSize);
        }

        for (var e = 0; e < this.space.exits.length; ++e) {
            var exit = this.space.exits[e];
            BLIT.draw(context, this.exitImage, exit.pos.x, exit.pos.y, BLIT.ALIGN.Center, exit.size*2, exit.size*2);
        }
        context.restore();
        context.fillStyle = "black";
        context.font = '48px serif';
        context.fillText(". ".repeat(this.space.ship.particleCount), 10, 20);
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