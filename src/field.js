var FIELD = (function () {
    "use strict";

    function lerp (a, b, x){
        return (x % 1) * a + (1-(x % 1)) * b;
    }

    function Space(width, height) {
        this.width = width;
        this.height = height;
        var size = width * height;
        this.potentials = new Float32Array(size);
        this.grads = new Float32Array(size * 2);
        this.particles = [];

        this.ship = null;
        this.gravity = 0.005;
    }

    Space.prototype.setupShip = function (shipPosition) {
        this.ship = new Ship(2, shipPosition, 2, 5, 0.1, this)
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
            return Math.max(-x,-y,y-this.height,x-this.width) + 1;
        }
    }

    Space.prototype.closestPotential = function (pos) {
        var T = Math.floor(pos.y), // top
            B = T+1, // bottom
            L = Math.floor(pos.x), // left
            R = L+1, // right
            TL = this.potential(T,L),
            TR = this.potential(T,R),
            BL = this.potential(B,L),
            BR = this.potential(B,R),
            topPot = lerp(TL,TR,pos.x),
            botPot = lerp(BL,BR,pos.x);
        return lerp(topPot,botPot,pos.y);
    }

    Space.prototype.closestGradient = function(pos) {
        var T = Math.floor(pos.x), // top
            B = T+1, // bottom
            L = Math.floor(pos.y), // left
            R = L+1, // right
            TL = this.potential(T,L),
            TR = this.potential(T,R),
            BL = this.potential(B,L),
            BR = this.potential(B,R),
            y_grad = lerp(TL-TR,BL-BR,pos.x) * this.gravity,
            x_grad = lerp(TR-BR,TL-BL,pos.y) * this.gravity;
        return new R2.V(x_grad,y_grad);
    }

    Space.prototype.setPotential = function (x, y, value) {
        this.potentials[this.scalarIndex(x, y)] = value;
    }

    Space.prototype.gradient = function (x, y) {
        var index = this.gradIndex(x, y);
        return new R2.V(this.grads[index], this.grads[index+1]);
    }

    Space.prototype.setGradient = function (x, y, value) {
        var index = this.gradIndex(x, y);
        this.grads[index] = value.x;
        this.grads[index + 1] = value.y;
    }

    Space.prototype.computeGrads = function() {
        for (var x = 0; x < this.width; x++) {
            for (var y = 0; y < this.height; y++) {
                var dx = this.potential(x-1,y)-this.potential(x+1,y),
                    dy = this.potential(x,y-1)-this.potential(x,y+1);
                this.setGradient(x,y,this.closestPotential(new R2.V(x,y)));
            }
        }

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
    
    function Ship (shipMass, position, particleMass, particleCount, particleVelocity, space) {
        //constants:
        this.shipMass = shipMass;
        this.particleMass = particleMass;
        this.particleVelocity = particleVelocity;
        
        //variables:
        this.particleCount = particleCount;
        this.pos = position;
        this.vel = new R2.V(0, 0);
        this.energy = 0.5 * this.vel.lengthSq() + space.closestPotential(new R2.V(this.pos.y,this.pos.x)) * space.gravity;
    }

    Ship.prototype.mass = function () {
        return this.shipMass + this.particleCount * this.particleMass;
    };
    
    Ship.prototype.shoot = function (theta, space) {
        if (this.particleCount <= 0) {
            return;
        }
        this.vel.addScaled(
            new R2.V(Math.cos(theta), Math.sin(theta)),
            this.particleVelocity * this.particleMass / this.mass()
        );
        this.energy = 0.5 * this.vel.lengthSq() + space.closestPotential(new R2.V(this.pos.y,this.pos.x)) * space.gravity;

        this.particleCount -= 1;

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
        var finalPotential = space.closestPotential(new R2.V(this.pos.y,this.pos.x)) * space.gravity;
        if(finalPotential > this.energy) {
            this.vel.scale(0);
        } else {
            if(this.vel.length > 0){
                this.vel.normalize();
                this.vel.scale(Math.sqrt(2 * (this.energy - finalPotential)));
            }
        }
        //console.log("energy = ",energy);
    }

    function Particle(mass,position,velocity, space) {
        this.mass = function () {return mass; };
        this.pos = position;
        this.vel = velocity;
        this.energy = 0.5 * this.vel.lengthSq() + space.closestPotential(new R2.V(this.pos.y,this.pos.x)) * space.gravity;
    }

    Particle.prototype.timestep = Ship.prototype.timestep;

    return {
        Space : Space,
        Ship : Ship,
        Particle : Particle,
    }
}());
















