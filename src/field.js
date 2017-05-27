var FIELD = (function () {
    "use strict";

    function Space(width, height) {
        this.width = width;
        this.height = height;
        var size = width * height;
        this.potentials = new Float32Array(size);
        this.grads = new Float32Array(size * 2);
        this.particles = [];
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
        this.grads[index + 1] = valuie.y;
    }

    Space.prototype.computeGrads = function() {
        for (var x = 0; x < this.width; x++) {
            for (var y = 0; y < this.height; y++) {
                var dx = this.potential(x-1,y)-this.potential(x+1,y),
                    dy = this.potential(x,y-1)-this.potential(x,y+1);
                this.setGradient(x,y, R2.V(dx,dy));
            }
        }

    }
    
    function Ship (total_mass,empty_mass,particle_number,ejection_velocity,starting_position) {
        //constants:
        this.total_mass = total_mass;
        this.empty_mass = empty_mass;
        this.m_particle = (total_mass - empty_mass)/particle_number;
        this.v_particle = ejection_velocity;
        
        //variables:
        this.pos = starting_position;
        this.vel = new R2.V(0,0);
        this.mass = total_mass;
        this.energy = 0
    }
    
    Ship.prototype.shoot = function(theta,space) {
        this.vel.addScaled( R2.V(Math.cos(theta),Math.sin(theta)), this.v_particle * this.m_particle / this.mass);
        
        this.mass -= this.m_particle;
        
        var particle_velocity = new R2.V(Math.cos(theta),Math.sin(theta));
        particle_velocity.scale(this.vel.length() - ejection_velocity);
        space.particles.push(new Particle(this.mass,this.pos,particle_velocity));
    }

    Ship.prototype.timestep = function(space,time) {
        if(this.vel.length() * time < 1) {
            var accel = space.closestGradient(this.pos);
            this.pos.addScaled(this.vel,t);
            this.pos.addScaled(accel,0.5*t*t);

            this.vel.addScaled(accel,t);
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
















