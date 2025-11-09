```openscad
// Ergonomic Gaming Mouse Model
// All dimensions in mm, scaled to fit within 25x25x25 units

// Parameters
overall_scale = 0.22;
mouse_length = 120;
mouse_width = 70;
mouse_height = 42;
button_gap = 1.5;
button_depth = 0.8;
side_button_count = 2;
wall_thickness = 2;
scroll_wheel_diameter = 8;
scroll_wheel_width = 6;

// Scaled dimensions
s_length = mouse_length * overall_scale;
s_width = mouse_width * overall_scale;
s_height = mouse_height * overall_scale;

$fn = 40;

module ergonomic_shell() {
    difference() {
        union() {
            hull() {
                translate([s_length*0.1, 0, 0])
                    scale([1, 1, 0.6])
                    resize([s_length*0.8, s_width*0.9, s_height*0.8])
                    sphere(d=s_width*0.5);
                
                translate([s_length*0.3, 0, 0])
                    scale([1.2, 1, 0.5])
                    resize([s_length*0.6, s_width*0.95, s_height*0.9])
                    sphere(d=s_width*0.6);
                
                translate([s_length*0.6, 0, 0])
                    scale([0.8, 0.95, 0.4])
                    resize([s_length*0.4, s_width*0.85, s_height*0.7])
                    sphere(d=s_width*0.5);
            }
            
            hull() {
                translate([0, -s_width*0.2, s_height*0.1])
                    scale([1.5, 1, 0.8])
                    sphere(d=s_width*0.25);
                translate([s_length*0.25, -s_width*0.25, s_height*0.15])
                    scale([1.2, 1, 0.7])
                    sphere(d=s_width*0.3);
            }
        }
        
        translate([0, 0, -s_height*0.1])
            cube([s_length*2, s_width*2, s_height*0.2], center=true);
    }
}

module left_button() {
    translate([s_length*0.25, -button_gap/2-s_width*0.15, s_height*0.75]) {
        difference() {
            hull() {
                translate([0, 0, 0])
                    scale([1.8, 1, 0.3])
                    sphere(d=s_width*0.25);
                translate([s_length*0.15, 0, -button_depth*0.3])
                    scale([1.5, 1, 0.25])
                    sphere(d=s_width*0.24);
            }
            translate([0, 0, -s_height])
                cube([s_length, s_width, s_height*2], center=true);
        }
    }
}

module right_button() {
    translate([s_length*0.25, button_gap/2+s_width*0.15, s_height*0.75]) {
        difference() {
            hull() {
                translate([0, 0, 0])
                    scale([1.8, 1, 0.3])
                    sphere(d=s_width*0.25);
                translate([s_length*0.15, 0, -button_depth*0.3])
                    scale([1.5, 1, 0.25])
                    sphere(d=s_width*0.24);
            }
            translate([0, 0, -s_height])
                cube([s_length, s_width, s_height*2], center=true);
        }
    }
}

module scroll_wheel() {
    translate([s_length*0.35, 0, s_height*0.82]) {
        difference() {
            rotate([90, 0, 0])
                cylinder(d=scroll_wheel_diameter*overall_scale, h=scroll_wheel_width*overall_scale, center=true);
            for(i = [-5:5]) {
                translate([0, i*scroll_wheel_width*overall_scale*0.15, 0])
                    rotate([90, 0, 0])
                    cylinder(d=scroll_wheel_diameter*overall_scale*1.1, h=scroll_wheel_width*overall_scale*0.05, center=true);
            }
        }
    }
}

module side_buttons() {
    for(i = [0:side_button_count-1]) {
        translate([s_length*0.45, -s_width*0.35, s_height*0.35 - i*s_height*0.15]) {
            hull() {
                sphere(d=s_width*0.08);
                translate([s_length*0.08, 0, 0])
                    sphere(d=s_width*0.07);
            }
        }
    }
}

module sensor_area() {
    translate([s_length*0.5, 0, 0.1]) {
        cylinder(d=s_width*0.15, h=1, center=true);
        translate([0, 0, -0.5])
            cylinder(d1=s_width*0.18, d2=s_width*0.15, h=0.5);
    }
}

module base_plate() {
    translate([s_length*0.35, 0, 0.3]) {
        difference() {
            hull() {
                translate([s_length*0.15, 0, 0])
                    scale([1.2, 1, 0.2])
                    sphere(d=s_width*0.5);
                translate([-s_length*0.15, 0, 0])
                    scale([1, 0.9, 0.2])
                    sphere(d=s_width*0.45);
            }
            sensor_area();
        }
    }
    
    for(x = [0.2, 0.5, 0.8]) {
        for(y = [-0.25, 0.25]) {
            translate([s_length*x, s_width*y, 0.4])
                cylinder(d=s_width*0.04, h=0.8);
        }
    }
}

module cable_channel() {
    translate([0, 0, s_height*0.15]) {
        rotate([0, 90, 0])
            hull() {
                cylinder(d=s_height*0.15, h=s_length*0.05);
                translate([0, 0, s_length*0.05])
                    sphere(d=s_height*0.15);
            }
    }
}

module grip_texture() {
    for(i = [0:8]) {
        translate([s_length*0.5 + i*s_length*0.04, -s_width*0.38, s_height*0.25]) {
            rotate([0, -15, 0])
                scale([0.8, 1, 2])
                sphere(d=s_width*0.03);
        }
    }
}

module complete_mouse() {
    union() {
        difference() {
            ergonomic_shell();
            translate([s_length*0.35 - button_gap/2, 0, s_height*0.75])
                cube([button_gap, s_width*0.5, s_height*0.3], center=true);
        }
        left_button();
        right_button();
        scroll_wheel();
        side_buttons();
        base_plate();
        grip_texture();
    }
}

complete_mouse();
```