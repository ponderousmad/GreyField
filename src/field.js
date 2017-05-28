var FIELD = (function () {
    "use strict";

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
        this.ship = null;

        this.isLevelCompleted = false;
        this.isLevelLost = false;

        this.hasPotentialUpdated = true;

        this.bombs.push(new Bomb(new R2.V(300,300),false,5,50));
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
        if(x >= 0 && x < this.width && y >= 0 && y < this.height) {
            return this.potentials[this.scalarIndex(x, y)];
        } else {
            //return 0.01*Math.max(-x,-y,y-this.height,x-this.width) + 1;
            var x_off = Math.max(0,-x,x-this.width+1),
                y_off = Math.max(0,-y,y-this.height+1);
            return 0.01*Math.sqrt(x_off*x_off + y_off*y_off) + 1;
        }
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
    }

    Space.prototype.addExit = function (position, size) {
        this.exits.push(new Exit(position, size));
    };

    Space.prototype.addFuel = function (position, particles, boost, size) {
        this.fuels.push(new Fuel(position, particles, boost, size));
    };

    Space.prototype.addBomb = function (position, type, size, range) {
        this.bombs.push(new Bomb(position, type, size, range));
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
        space.particles.push(new Particle(this.particleMass, this.pos.clone(), velocity, space));
    }

    Ship.prototype.timestep = function(space, time) {
        //var energy = 0.5 * this.vel.lengthSq() + space.closestPotential(new R2.V(this.pos.y,this.pos.x)) * space.gravity;
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
        for(var i = 0; i < space.fuels.length && this.usesFuel; i++){
            var fuel = space.fuels[i],
                distance = R2.pointDistance(this.pos, fuel.pos);
            if(distance < this.size + fuel.size) {
                space.fuels.splice(i,1);
                this.particleCount += fuel.particles;
                this.particleVelocity += fuel.boost;
                this.calculateMass();
                this.energy += fuel.particles  * this.particleMass * Math.max(space.closestPotential(this.pos), space.closestPotential(fuel.pos)) * space.gravity;
            }
        }

        for(var i = 0; i < space.exits.length && this.endsLevel; i++){
            var end = space.exits[i],
                distance = R2.pointDistance(this.pos, end.pos);
            if(distance < this.size + end.size) {
                space.exits.splice(i,1);
                space.isLevelCompleted = true;
                this.energy = -1;
            }
        }

        for(var i = 0; i < space.bombs.length; i++){
            var explosive = space.bombs[i],
                distance = R2.pointDistance(this.pos, explosive.pos);
            if(distance < this.size + explosive.size) {
                console.log("explosion occured");
                space.bombs.splice(i,1);
                if(this.losesGameOnExplosion) {
                    this.energy = -1;
                    this.pos = new R2.V(-100,-100);
                    space.isLevelLost = true;
                } else {
                    space.particles.splice(space.particles.indexOf(this),1);
                }
                for (var x = Math.floor(explosive.pos.x - explosive.range); x <= Math.ceil(explosive.pos.x + explosive.range); x++){
                    for (var y = Math.floor(explosive.pos.y - explosive.range); y <= Math.ceil(explosive.pos.y + explosive.range); y++){
                        var pos = new R2.V(x,y),
                            distance = R2.pointDistance(pos,explosive.pos);
                        if(distance < explosive.range) {
                            //console.log("changing values");
                            var weight = 1 - (explosive.range - distance) / explosive.range, // 1 far away, 0 close
                                pot = space.potential(pos.x,pos.y);
                            if(explosive.explodesWhite) {
                                space.setPotential(pos.x,pos.y, 1 - ((1-pot) * weight) )
                            } else {
                                space.setPotential(pos.x,pos.y,pot * weight);
                            }
                        }
                    }
                }
                space.hasPotentialUpdated = true;
            }
        }

        var finalPotential = this.mass * space.closestPotential(this.pos) * space.gravity;
        if(finalPotential > this.energy) {
            this.vel.scale(0);
        } else {
            if(this.vel.length() > 0){
                this.vel.normalize();
                this.vel.scale(Math.sqrt(2 * (this.energy - finalPotential) / this.mass));
            }
        }
        //console.log("energy = ",0.5 * this.vel.lengthSq() + space.closestPotential(new R2.V(this.pos.y,this.pos.x)) * space.gravity);
    }

    function Particle(mass,position,velocity, space) {
        this.mass = mass;
        this.pos = position;
        this.vel = velocity;
        this.size = 2;
        this.energy = 0.5 * this.vel.lengthSq() + space.closestPotential(this.pos) * space.gravity;
        
        this.usesFuel = false;
        this.endsLevel = false;
        this.losesGameOnExplosion = true;
    }

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

    Particle.prototype.timestep = Ship.prototype.timestep;

    return {
        Space : Space
    }
}());
















