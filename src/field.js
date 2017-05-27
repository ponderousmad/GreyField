var FIELD = (function () {
    "use strict";

    function Space(width, height) {
        this.width = width;
        this.height = height;
        var size = width * height;
        this.potentials = new Float32Array(size);
        this.grads = new Float32Array(size * 2);
    }

    Space.prototype.scalarIndex = function (x, y) {
        return y * this.width * x;
    }

    Space.prototype.gradIndex = function (x, y) {
        return this.scalarIndex(x, y) * 2;
    }

    Space.prototype.potential = function (x, y) {
        return this.potentials[this.scalarIndex(x, y)];
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

	function compute_gradients(scalar_field,x,y) {
		var grad = new Float32Array(x * y * 2),
			offset = x * y,
			size = x * y * 2;
		
		for (var i = 0; i < offset; i++) {
			if( ( (i-1) % y < (i+1) % y) {
				grad[i] = scalar_field[i+1]-scalar_field[i-1];
			} else {
				grad[i] = 0;
			}
			
			if( (i - y >= 0) && (i + y < offset)) {
				grad[i+offset] = scalar_field[i+y] - scalar_field[i-y];
			} else {
				grad[i+offset] = 0;
			}
		}
		return grad;
	}
	
	function Ship (total_mass,empty_mass,particle_number,ejection_velocity,starting_position) {
		//constants:
		this.total_mass = total_mass;
		this.empty_mass = empty_mass;
		this.m_particle = (total_mass - empty_mass)/particle_number;
		this.v_particle = ejection_velocity;
		
		//variables:
		this.pos = starting_position;
		this.vel = [0,0];
		this.mass = total_mass;
		
	Ship.prototype.shoot = function(theta) {
		vel[0] += cos(theta) * v_particle * m_particle / mass;
		vel[1] += sin(theta) * v_particle * m_particle / mass;
		mass -= m_particle;
		//create new particles as well, going in opposite direction (-cos, -sin)
		
	}
	
	
    return {

    }
}());
















