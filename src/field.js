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

        this.ship = new Ship(100,10,45,4,new R2.V(50,50));
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
        var T = Math.floor(pos.y), // top
            B = T+1, // bottom
            L = Math.floor(pos.x), // left
            R = L+1, // right
            TL = this.potential(T,L),
            TR = this.potential(T,R),
            BL = this.potential(B,L),
            BR = this.potential(B,R),
            topPot = lerp(TL,TR,pos.x);
            botPot = lerp(BL,BR,pos.x);
        return lerp(topPot,botPot,pos.y);
    }

    Space.prototype.closestGradient = function(pos) {
        var T = Math.floor(pos.y), // top
            B = T+1, // bottom
            L = Math.floor(pos.x), // left
            R = L+1, // right
            TL = this.potential(T,L),
            TR = this.potential(T,R),
            BL = this.potential(B,L),
            BR = this.potential(B,R),
            x_grad = lerp(TL-TR,BL-BR,pos.x) * gravity,
            y_grad = lerp(TR-BR,TL-BL,pos.y) * gravity;
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
                this.setGradient(x,y, new R2.V(dx,dy));
            }
        }

    }

    Space.prototype.update = function(updateTime,numPhysicsSteps,isShooting,shotAngle) {
        var physicsTime = updateTime / numPhysicsSteps;
        
        if(isShooting) {
            this.ship.shoot(shotAngle,this);
        }

        this.ship.timestep(this,physicsTime);
        for (var i = 0; i < this.particles.length; ++i) {
            particles[i].timestep(this,physicsTime);
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
        var energy = 0.5 * this.vel.lengthsq() * this.mass + space.closestPotential(this.pos);
        if(this.vel.length() * time < 1) {
            var k_1v = space.closestGradient(this.pos),
                k_1r = this.vel,
                k_2v = space.closestGradient(R2.addVectors(this.pos,k_1r.scaled(time/2))),
                k_2r = R2.addVectors(this.vel,k_1r.scaled(time/2)),
                k_3v = space.closestGradient(R2.addVectors(this.pos,k_2r.scaled(time/2))),
                k_3r = R2.addVectors(this.vel,k_2r.scaled(time/2)),
                k_4v = space.closestGradient(R2.addVectors(this.pos,k_3r.scaled(time))),
                k_4r = R2.addVectors(this.vel,k_3r.scaled(time));
            
            this.vel.addScaled(k_1v,time/6);
            this.vel.addScaled(k_2v,2 * time/6);
            this.vel.addScaled(k_3v,2 * time/6);
            this.vel.addScaled(k_4v,time/6);

            this.vel.addScaled(k_1r,time/6);
            this.vel.addScaled(k_2r,2 * time/6);
            this.vel.addScaled(k_3r,2 * time/6);
            this.vel.addScaled(k_4r,time/6);
        }
        else {
            this.timestep(space,0.5*time);
            this.timestep(space,0.5*time);
        }
        var finalEnergy = 0.5 * this.vel.lengthsq() * this.mass + space.closestPotential(this.pos);
        
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
















