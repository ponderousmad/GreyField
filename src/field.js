var FIELD = (function () {
    "use strict";
    function compute_gradients(scalar_field,x,y) {
        var grad = new Float32Array(x * y * 2),
            offset = x * y,
            size = x * y * 2;
        
        for (var i = 0; i < offset; i++) {
            if ( (i-1) % y < (i+1) % y) {
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
        this.vel = new R2.V(0,0);
        this.mass = total_mass;
    }
    
    Ship.prototype.shoot = function(theta) {
        this.vel.addScaled( R2.V(Math.cos(theta),Math.sin(theta)), this.v_particle * this.m_particle / this.mass);
        
        this.mass -= this.m_particle;
        //create new particles as well, going in opposite direction (-cos, -sin)
        
    }
    
    
    return {

    }
}());
















