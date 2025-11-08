
// Owala-style Water Bottle - Parametric OpenSCAD Model
// References adapted from public Owala bottle images and MCAD library usage
// Inspired by Owala FreeSip and similar flip-spout designs

// ========== PARAMETERS ==========

// Overall dimensions
overall_height = 240;           // mm
body_diameter = 78;             // mm
base_diameter = 72;             // mm
neck_diameter = 48;             // mm
neck_height = 25;               // mm

// Wall and material
wall_thickness = 2.8;           // mm
base_thickness = 4;             // mm

// Lid parameters
lid_height = 60;                // mm
lid_diameter = 52;              // mm
spout_diameter = 12;            // mm
spout_height = 35;              // mm
carry_loop_width = 30;          // mm
carry_loop_thickness = 8;       // mm

// Thread parameters
thread_pitch = 3.5;             // mm
thread_depth = 1.5;             // mm
thread_starts = 2;              // number of thread starts

// Hinge parameters
hinge_pin_diameter = 3.5;       // mm
hinge_width = 12;               // mm
hinge_gap = 0.3;                // mm clearance

// Tolerances
fit_tolerance = 0.25;           // mm

// Volume target (informational)
volume_oz_target = 24;          // oz (~710 mL)

// Rendering quality
$fn = 60;

// ========== MODULES ==========

module bottle_body() {
    body_height = overall_height - neck_height - lid_height;
    shoulder_height = 30;
    
    difference() {
        union() {
            // Main body - tapered
            hull() {
                translate([0, 0, 0])
                    cylinder(d=base_diameter, h=5);
                translate([0, 0, body_height - shoulder_height])
                    cylinder(d=body_diameter, h=1);
            }
            
            // Shoulder curve
            hull() {
                translate([0, 0, body_height - shoulder_height])
                    cylinder(d=body_diameter, h=1);
                translate([0, 0, body_height])
                    cylinder(d=neck_diameter + wall_thickness*2, h=1);
            }
            
            // Neck with threads
            translate([0, 0, body_height])
                neck_threads();
        }
        
        // Hollow interior
        translate([0, 0, base_thickness]) {
            hull() {
                cylinder(d=base_diameter - wall_thickness*2, h=5);
                translate([0, 0, body_height - shoulder_height - base_thickness])
                    cylinder(d=body_diameter - wall_thickness*2, h=1);
            }
            hull() {
                translate([0, 0, body_height - shoulder_height - base_thickness])
                    cylinder(d=body_diameter - wall_thickness*2, h=1);
                translate([0, 0, body_height - base_thickness])
                    cylinder(d=neck_diameter, h=1);
            }
            translate([0, 0, body_height - base_thickness])
                cylinder(d=neck_diameter, h=neck_height + 5);
        }
        
        // O-ring groove at neck top
        translate([0, 0, body_height + neck_height - 3])
            rotate_extrude()
                translate([neck_diameter/2 + wall_thickness - 0.5, 0])
                    circle(d=2);
    }
    
    // Base chamfer
    difference() {
        cylinder(d=base_diameter, h=base_thickness);
        translate([0, 0, -0.1])
            cylinder(d1=base_diameter - 3, d2=base_diameter + 1, h=2);
    }
}

module neck_threads() {
    thread_length = neck_height - 2;
    outer_d = neck_diameter + wall_thickness*2;
    
    union() {
        // Neck cylinder
        cylinder(d=outer_d, h=neck_height);
        
        // Thread helix
        for(start = [0:thread_starts-1]) {
            rotate([0, 0, start * 360/thread_starts])
                thread_helix(outer_d, thread_length, thread_pitch, thread_depth);
        }
    }
}

module thread_helix(diameter, length, pitch, depth) {
    steps = $fn * length / pitch;
    
    for(i = [0:steps-1]) {
        angle = i * 360 / ($fn * pitch / pitch);
        z = i * length / steps;
        
        if(z < length) {
            hull() {
                translate([0, 0, z])
                    rotate([0, 0, angle])
                        translate([diameter/2, 0, 0])
                            sphere(d=depth*2);
                
                translate([0, 0, z + length/steps])
                    rotate([0, 0, angle + 360*pitch/($fn*pitch)])
                        translate([diameter/2, 0, 0])
                            sphere(d=depth*2);
            }
        }
    }
}

module lid_assembly() {
    body_height = overall_height - neck_height - lid_height;
    
    translate([0, 0, body_height + neck_height]) {
        // Main lid body
        lid_body();
        
        // Carry loop
        translate([0, 0, lid_height - carry_loop_thickness/2])
            carry_loop();
        
        // Flip spout with hinge
        translate([0, lid_diameter/2 - 5, 15])
            rotate([0, 0, 0])
                spout_assembly();
    }
}

module lid_body() {
    difference() {
        union() {
            // Main lid cylinder
            cylinder(d=lid_diameter, h=lid_height);
            
            // Top dome
            translate([0, 0, lid_height])
                sphere(d=lid_diameter);
        }
        
        // Internal threads
        translate([0, 0, -1])
            internal_threads();
        
        // Hollow interior
        translate([0, 0, wall_thickness])
            cylinder(d=lid_diameter - wall_thickness*2, h=lid_height);
        
        // Cut top half of dome
        translate([0, 0, lid_height + lid_diameter/2])
            cube([lid_diameter*2, lid_diameter*2, lid_diameter], center=true);
        
        // Spout opening channel
        translate([0, lid_diameter/2 - 5, 15])
            rotate([90, 0, 0])
                cylinder(d=spout_diameter + 2, h=wall_thickness*2);
    }
}

module internal_threads() {
    thread_length = 18;
    inner_d = neck_diameter + fit_tolerance*2;
    
    difference() {
        cylinder(d=inner_d + wall_thickness*2, h=thread_length);
        
        // Core hole
        translate([0, 0, -1])
            cylinder(d=inner_d, h=thread_length + 2);
        
        // Thread grooves
        for(start = [0:thread_starts-1]) {
            rotate([0, 0, start * 360/thread_starts + 180/thread_starts])
                thread_groove(inner_d, thread_length, thread_pitch, thread_depth*1.2);
        }
    }
}

module thread_groove(diameter, length, pitch, depth) {
    steps = $fn * length / pitch;
    
    for(i = [0:steps-1]) {
        angle = i * 360 / ($fn * pitch / pitch);
        z = i * length / steps;
        
        if(z < length) {
            hull() {
                translate([0, 0, z])
                    rotate([0, 0, angle])
                        translate([diameter/2, 0, 0])
                            sphere(d=depth*2);
                
                translate([0, 0, z + length/steps])
                    rotate([0, 0, angle + 360*pitch/($fn*pitch)])
                        translate([diameter/2, 0, 0])
                            sphere(d=depth*2);
            }
        }
    }
}

module carry_loop() {
    loop_height = 40;
    loop_depth = 15;
    
    difference() {
        union() {
            // Loop arc
            rotate([90, 0, 0])
                rotate_extrude(angle=180)
                    translate([loop_depth, 0, 0])
                        circle(d=carry_loop_thickness);
            
            // Side supports
            for(side = [-1, 1]) {
                translate([side * loop_depth, 0, 0])
                    rotate([90, 0, 0])
                        cylinder(d=carry_loop_thickness, h=carry_loop_width/2, center=true);
            }
        }
        
        // Trim bottom
        translate([0, 0, -carry_loop_thickness])
            cube([loop_depth*3, carry_loop_width*2, carry_loop_thickness*2], center=true);
    }
    
    // Connect to lid
    for(side = [-1, 1]) {
        hull() {
            translate([side * loop_depth, 0, 0])
                sphere(d=carry_loop_thickness);
            translate([side * (lid_diameter/2 - 5), 0, -carry_loop_thickness/2])
                sphere(d=carry_loop_thickness);
        }
    }
}

module spout_assembly() {
    // Hinge base on lid
    translate([0, -hinge_width/2 - hinge_gap/2, 0])
        hinge_female();
    
    // Spout with hinge
    rotate([0, 0, 0])
        spout_with_hinge();
}

module hinge_female() {
    difference() {
        union() {
            cube([8, hinge_width, 8], center=false);
            translate([4, hinge_width/2, 4])
                rotate([90, 0, 0])
                    cylinder(d=8, h=hinge_width, center=true);
        }
        
        // Pin hole
        translate([4, hinge_width/2, 4])
            rotate([90, 0, 0])
                cylinder(d=hinge_pin_diameter + fit_tolerance, h=hinge_width + 2, center=true);
    }
}

module spout_with_hinge() {
    // Hinge knuckle
    translate([0, hinge_width/2 + hinge_gap/2, 0]) {
        difference() {
            translate([4, 0, 4])
                rotate([90, 0, 0])
                    cylinder(d=8, h=hinge_width - hinge_gap, center=true);
            
            translate([4, 0, 4])
                rotate([90, 0, 0])
                    cylinder(d=hinge_pin_diameter + fit_tolerance, h=hinge_width + 2, center=true);
        }
        
        // Hinge pin (attached)
        translate([4, 0, 4])
            rotate([90, 0, 0])
                cylinder(d=hinge_pin_diameter - fit_tolerance, h=hinge_width - hinge_gap*2, center=true);
    }
    
    // Spout body
    translate([0, 0, 8]) {
        difference() {
            union() {
                // Main spout
                hull() {
                    cube([spout_diameter*1.5, hinge_width - hinge_gap, 5], center=true);
                    translate([spout_height/2, 0, spout_height/2])
                        rotate([90, 0, 0])
                            cylinder(d=spout_diameter*1.5, h=hinge_width - hinge_gap, center=true);
                }
                
                // Spout tip
                translate([spout_height/2, 0, spout_height/2])
                    rotate([90, 0, 0])
                        cylinder(d1=spout_diameter*1.5, d2=spout_diameter, h=hinge_width - hinge_gap, center=true);
            }
            
            // Drinking hole
            translate([spout_height/2, 0, spout_height/2])
                rotate([90, 0, 0])
                    cylinder(d=spout_diameter - wall_thickness, h=hinge_width + 2, center=true);
            
            // Internal channel
            hull() {
                cylinder(d=spout_diameter - wall_thickness, h=5, center=true);
                translate([spout_height/2, 0, spout_height/2])
                    rotate([90, 0, 0])
                        cylinder(d=spout_diameter - wall_thickness, h=hinge_width + 2, center=true);
            }
        }
    }
}

module assemble() {
    union() {
        bottle_body();
        lid_assembly();
    }
}

// ========== RENDER ==========

assemble();
