var FIELD = (function () {
    "use strict";

    function Space(width, height) {
        this.width = width;
        this.height = height;
        var size = width * height;
        this.potentials = new Float32Array(size);
        this.grads = new Float32Array(size * 2);
        this.particles = [];

        this.ship = new Ship(10, new R2.V(50, 50), 0.5, 45, 0.04);
        this.gravity = 0.001;
    }

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
            return 1;
        }
    }

    Space.prototype.closestPotential = function (pos) {
        return this.potential(Math.floor(pos.x),Math.floor(pos.y));
    }

    Space.prototype.closestGradient = function(pos) {
        return this.gradient(Math.floor(pos.x),Math.floor(pos.y));
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
                this.setGradient(x,y, new R2.V(dx,dy));
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
    
    function Ship (shipMass, position, particleMass, particleCount, particleVelocity) {
        //constants:
        this.shipMass = shipMass;
        this.particleMass = particleMass;
        this.particleVelocity = particleVelocity;
        
        //variables:
        this.particleCount = particleCount;
        this.pos = position;
        this.vel = new R2.V(0, 0);
        this.energy = 0;
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

        this.particleCount -= 1;

        var velocity = new R2.V(Math.cos(theta), Math.sin(theta));
        velocity.scale(this.vel.length() - this.particleVelocity);
        space.particles.push(new Particle(this.particleMass, this.pos.clone(), velocity));
    }

    Ship.prototype.timestep = function(space, time) {
        if(this.vel.length() * time < 1) {
            var accel = space.closestGradient(this.pos);
            accel.scale(space.gravity);
            this.pos.addScaled(this.vel, time);
            this.pos.addScaled(accel, 0.5 * time * time);

            this.vel.addScaled(accel,time);
        }
        else {
            this.timestep(space,0.5*time);
            this.timestep(space,0.5*time);
        }
    }

    function Particle(mass,position,velocity) {
        this.mass = mass;
        this.pos = position;
        this.vel = velocity;
    }

    Particle.prototype.timestep = Ship.prototype.timestep;

    return {
        Space : Space,
        Ship : Ship,
        Particle : Particle,
    }
}());
















