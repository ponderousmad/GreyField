var FIELD = (function () {
    "use strict";

    var explodeSound = new BLORT.Noise("audio/Boom.wav");

    function lerp (a, b, x){
        return (x % 1) * a + (1-(x % 1)) * b;
    }

    function Space(width, height, gravity) {
        this.width = width;
        this.height = height;
        var size = width * height;
        this.potentials = new Float32Array(size);
        this.particles = [];
        this.gravity = gravity || 0.05;
        this.fuels = [];
        this.exits = [];
        this.bombs = [];
        this.planets = [];
        this.effects = [];
        this.ship = null;
        this.border = 100;

        this.isLevelCompleted = false;
        this.isLevelLost = false;

        this.hasPotentialUpdated = true;
    }

    Space.prototype.setupShip = function (shipPosition, shipMass, particleMass, particleCount, particleVelocity) {
        this.ship = new Ship(
            shipMass || 2,
            shipPosition,
            particleMass || 1,
            particleCount || 5,
            particleVelocity || 0.1,
            this
        );
    };

    Space.prototype.scalarIndex = function (x, y) {
        return y * this.width + x;
    }

    Space.prototype.gradIndex = function (x, y) {
        return this.scalarIndex(x, y) * 2;
    }

    Space.prototype.potential = function (x, y) {
        var pot = 0;
        if(x >= 0 && x < this.width && y >= 0 && y < this.height) {
            pot += this.potentials[this.scalarIndex(x, y)];
        } else {
            var x_off = Math.max(0,-x,x-this.width+1),
                y_off = Math.max(0,-y,y-this.height+1);
            pot += (1 / this.border) * Math.sqrt(x_off*x_off + y_off*y_off) + 1;
        }
        for(var i = 0; i < this.planets.length; i++) {
            var planet = this.planets[i];
            pot += planet.potential(new R2.V(x,y));
        }

        for(var e = 0; e < this.effects.length; e++){
            pot += this.effects[e].potential(new R2.V(x,y));
        }
        return pot;
    }

    Space.prototype.closestPotential = function (pos) {
        var T = Math.floor(pos.y), // top
            B = T+1, // bottom
            L = Math.floor(pos.x), // left
            R = L+1, // right
            TL = this.potential(L,T),
            TR = this.potential(R,T),
            BL = this.potential(L,B),
            BR = this.potential(R,B),
            topPot = lerp(TL,TR,pos.x),
            botPot = lerp(BL,BR,pos.x);
        return lerp(topPot,botPot,pos.y);
    }

    Space.prototype.closestGradient = function(pos) {
        var T = Math.floor(pos.y), // top
            B = T+1, // bottom
            L = Math.floor(pos.x), // left
            R = L+1, // right
            TL = this.potential(L,T),
            TR = this.potential(R,T),
            BL = this.potential(L,B),
            BR = this.potential(R,B),
            x_grad = lerp(TL-TR,BL-BR,pos.x) * this.gravity,
            y_grad = lerp(TR-BR,TL-BL,pos.y) * this.gravity;
        return new R2.V(x_grad,y_grad);
    }

    Space.prototype.setPotential = function (x, y, value) {
        this.potentials[this.scalarIndex(x, y)] = value;
    }

    Space.prototype.update = function(updateTime, stepCount, isShooting, shotAngle) {
        var physicsTime = updateTime / stepCount;
        
        if (isShooting) {
            this.ship.shoot(shotAngle, this);
        }

        this.ship.timestep(this,physicsTime);
        for (var i = 0; i < this.particles.length; ++i) {
            this.particles[i].timestep(this, physicsTime);
        }

        for (var e = 0; e < this.effects.length; e++){
            var effect = this.effects[e];
            effect.update(updateTime,this);
                this.hasPotentialUpdated = true;
            if(effect.isFinished) {
                this.effects.splice(e,1);
                e--;
            }
        }
    }


    Space.prototype.addExit = function (position, size) {
        this.exits.push(new Exit(position, size));
    };

    Space.prototype.addFuel = function (position, particles, boost, size) {
        this.fuels.push(new Fuel(position, particles, boost, size));
    };

    Space.prototype.addBomb = function (position, type, size, range) {
        this.bombs.push(new Bomb(position, type, size, range));
    };

    
    Space.prototype.addPlanet = function (position, gravityExponent, size) {
        this.planets.push(new Planet(position, gravityExponent, size));

        this.hasPotentialUpdated = true;
    };

    Space.prototype.addEffect = function(position, type, scale) {
        this.effects.push(new Effect(position, type, scale));
        this.hasPotentialUpdated = true;
    }

    Space.prototype.checkFuelCollisions = function (ship) {
        for(var i = 0; i < this.fuels.length; i++){
            var fuel = this.fuels[i];
            if (hasCollided(ship,fuel)) {
                this.fuels.splice(i,1);
                i--;
                ship.particleCount += fuel.particles;
                ship.particleVelocity += fuel.boost;
                ship.calculateMass();
                ship.energy += fuel.particles  * ship.particleMass * Math.max(this.closestPotential(ship.pos), this.closestPotential(fuel.pos)) * this.gravity;
            }
        }
    }

    Space.prototype.checkExitCollisions = function (ship) {
        for(var i = 0; i < this.exits.length; i++){
            var exit = this.exits[i];
            if(hasCollided(ship,exit)) {
                this.exits.splice(i,1);
                i--;
                this.isLevelCompleted = true;
                ship.energy = -1;
                ship.particleCount = 0;
            }
        }
    }

    Space.prototype.checkBombCollisions = function (particle) {
        for(var i = 0; i < this.bombs.length; i++){
            var bomb = this.bombs[i];
            if(hasCollided(particle,bomb)) {
                this.bombs.splice(i,1);
                i--;
                if(particle.losesGameOnExplosion) {
                    particle.energy = -1;
                    particle.pos = new R2.V(-100,-100);
                    this.isLevelLost = true;
                } else {
                    this.particles.splice(this.particles.indexOf(particle),1);
                }

                bomb.explode(this);
            }
        }
    }

    function Ship (shipMass, position, particleMass, particleCount, particleVelocity, space) {
        //constants:
        this.shipMass = shipMass;
        this.particleMass = particleMass;
        this.particleVelocity = particleVelocity;

        //variables:
        this.particleCount = particleCount;
        this.pos = position;
        this.vel = new R2.V(0, 0);
        this.size = 5;
        this.usesFuel = true;
        this.endsLevel = true;
        this.losesGameOnExplosion = true;

        this.calculateMass();
        this.calcEnergy(space);
    }

    Ship.prototype.calculateMass = function () {
        this.mass = this.shipMass + this.particleCount * this.particleMass;
    };

    Ship.prototype.calcEnergy = function(space){
        this.energy = 0.5 * this.vel.lengthSq() + space.closestPotential(this.pos) * space.gravity;
        this.energy *= this.mass;
    }
    
    Ship.prototype.shoot = function (theta, space) {
        if (this.particleCount <= 0) {
            return;
        }
        this.vel.addScaled(
            new R2.V(Math.cos(theta), Math.sin(theta)),
            this.particleVelocity * this.particleMass / this.mass
        );
        
        this.particleCount -= 1;
        this.calculateMass();
        this.calcEnergy(space);

        var velocity = new R2.V(Math.cos(theta), Math.sin(theta));
        velocity.scale(this.vel.length() - this.particleVelocity);
        var newParticle = new Particle(this.particleMass, this.pos.clone(), velocity, space);
        newParticle.calcEnergy(space);
        space.particles.push(newParticle);

    }

    Ship.prototype.timestep = function(space, time) {
        if(space.hasPotentialUpdated) {
            this.calcEnergy(space);
        }

        var speed = this.vel.length()
        if (speed * time < 1) {
            var k_1v = space.closestGradient(this.pos),
                k_1r = this.vel,
                k_2v = space.closestGradient(R2.addVectors(this.pos,k_1r.scaled(time/2))),
                k_2r = R2.addVectors(this.vel,k_1v.scaled(time/2)),
                k_3v = space.closestGradient(R2.addVectors(this.pos,k_2r.scaled(time/2))),
                k_3r = R2.addVectors(this.vel,k_2v.scaled(time/2)),
                k_4v = space.closestGradient(R2.addVectors(this.pos,k_3r.scaled(time))),
                k_4r = R2.addVectors(this.vel,k_3v.scaled(time));
            
            this.vel.addScaled(k_1v,time/6);
            this.vel.addScaled(k_2v,2 * time/6);
            this.vel.addScaled(k_3v,2 * time/6);
            this.vel.addScaled(k_4v,time/6);

            this.pos.addScaled(k_1r,time/6);
            this.pos.addScaled(k_2r,2 * time/6);
            this.pos.addScaled(k_3r,2 * time/6);
            this.pos.addScaled(k_4r,time/6);
        } else if (speed) {
            //console.log("Exceeded vMax", speed);
            this.timestep(space,0.5*time);
            this.timestep(space,0.5*time);
        }

        // COLLISION CODE BLOCK: 
        if(this.usesFuel) {
            space.checkFuelCollisions(this);
        }

        if(this.endsLevel) {
            space.checkExitCollisions(this);
        }

        space.checkBombCollisions(this);

        
        

        var finalPotential = this.mass * space.closestPotential(this.pos) * space.gravity;
        if(finalPotential > this.energy) {
            this.vel.scale(0);
        } else {
            if(this.vel.length() > 0){
                this.vel.normalize();
                this.vel.scale(Math.sqrt(2 * (this.energy - finalPotential) / this.mass));
            }
        }

        var result = this.hasPotentialUpdated;
        this.hasPotentialUpdated = false;
        return result;
        //console.log("energy = ",0.5 * this.vel.lengthSq() + space.closestPotential(new R2.V(this.pos.y,this.pos.x)) * space.gravity);
    }

    function hasCollided(objectA,objectB) {
        var distance = R2.pointDistance(objectA.pos, objectB.pos);
        return (distance < objectA.size + objectB.size);
    }

    function Particle(mass,position,velocity, space) {
        this.mass = mass;
        this.pos = position;
        this.vel = velocity;
        this.size = 2;
        this.energy;

        this.usesFuel = false;
        this.endsLevel = false;
        this.losesGameOnExplosion = false;
    }

    Particle.prototype.calcEnergy = Ship.prototype.calcEnergy;

    Particle.prototype.timestep = Ship.prototype.timestep;

    function Fuel(position, particles, boost, size) {
        this.pos = position;
        this.particles = particles;
        this.boost = boost || 0;
        this.size = size || 5;
    }

    function Exit(position, size) {
        this.pos = position;
        this.size = size || 10;
    }

    function Bomb(position, type, size, range) {
        this.pos = position;
        this.explodesWhite = type; // false for black, true for white
        this.size = size;
        this.range = range || 50;
    }

    Bomb.prototype.explode = function(space) {
        for (var x = Math.floor(this.pos.x - this.range); x <= Math.ceil(this.pos.x + this.range); x++){
            for (var y = Math.floor(this.pos.y - this.range); y <= Math.ceil(this.pos.y + this.range); y++){
                var pos = new R2.V(x,y),
                    distance = R2.pointDistance(pos,this.pos);
                if(distance < this.range) {
                    var weight = (this.range - distance) / this.range, // 0 far away, 1 close
                        pot = space.potential(pos.x,pos.y);
                    space.setPotential(pos.x,pos.y, pot + weight * (this.explodesWhite ? 1 : -1) );
                }
            }
        }
        //space.addEffect(this.pos,"bomb", this.explodesWhite ? 1 : -1);
        //space.addEffect(this.pos,"wave", this.explodesWhite ? 1 : -1);

        space.hasPotentialUpdated = true;
        explodeSound.play();
    }

    function Effect(position,type, scale) {
        this.pos = position,
        this.effectTypes = {
                //type : [duration,typeEnumerated]
                bomb : [1000,0],
                wave : [2000,1]
            }
        this.type = type;
        this.remaining = this.effectTypes[type][0] || 0;
        this.elapsed = 0;
        this.isFinished = false;
        this.scale = scale || 1;
    }

    Effect.prototype.update = function(deltaTime,space) {
        this.remaining -= deltaTime;
        this.elapsed += deltaTime;
        if(this.remaining < 0) {
            this.isFinished = true;
            this.potential = function(pos) {
                return 0;
            }
        } else {
            space.hasPotentialUpdated = true;
        }
    }

    Effect.prototype.potential = function(pos) {
        if(this.effectTypes[this.type][1] == 0) {
            return this.scale * this.bombPotential(pos)
        }
        else if (this.effectTypes[this.type][1] == 1) {
            return this.scale * this.wavePotential(pos);
        }
    }

    Effect.prototype.bombPotential = function(pos) {
        return 0;
    }

    Effect.prototype.wavePotential = function(pos) {
        var waveSpeed = 0.1,
            dist = R2.pointDistance(pos,this.pos),
            wavePeak = waveSpeed * this.elapsed,
            waveWidth = (waveSpeed * 0.1) * this.elapsed;
        return Math.abs(dist - wavePeak) > waveWidth ? 0 : Math.cos( (Math.PI/2) * (dist - wavePeak) / waveWidth) * (this.remaining / this.effectTypes[this.type][0]);
    }

    function Planet(position, gravityExponent, size){
        this.pos = position;
        this.size = size || 50;
        this.exponent = gravityExponent || 1; // 1 is a normal planet, because this exponent affects the potential
    }

    Planet.prototype.potential = function(pos) {
        var dPlan = R2.pointDistance(this.pos, pos);
        return R2.clamp(0.0 - (1.0 / Math.pow(dPlan / this.size, this.exponent)),-3,3);
    }


    return {
        Space : Space
    }
}());
















