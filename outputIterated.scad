// BIC-style Disposable Lighter Model with Attached Cap
// All dimensions in millimeters

// ========== PARAMETERS ==========
// Body dimensions
body_h = 83;              // overall height in mm
body_w = 26;              // width in mm (left-right)
body_d = 12;              // depth / thickness in mm (front-back)
wall_thickness = 1.5;     // plastic shell thickness
corner_radius = 3;        // rounded corner radius for body
interior_clearance = 0.5; // clearance between inner tank and shell

// Flint wheel parameters
wheel_diameter = 10;      // flint wheel diameter
wheel_thickness = 3;      // flint wheel thickness
wheel_teeth = 24;         // number of serrations on wheel
wheel_offset_from_top = 6; // distance from top face to wheel center

// Nozzle parameters
nozzle_diameter = 3;      // gas valve/nozzle diameter
nozzle_length = 3;        // short valve length protruding above top

// Metal shield parameters
shield_thickness = 0.8;   // thickness of metal shield / cage
shield_height = 10;       // height of metal shield area
shield_slot_count = 5;    // number of ventilation slots

// Button parameters
button_width = 8;
button_depth = 4;
button_height = 2;

// Cap parameters
cap_thickness = 0.8;      // metal cap wall thickness
cap_height = 14;          // cap height to cover shield and wheel
cap_clearance = 0.5;      // clearance around shield

// Hinge parameters
hinge_radius = 1.5;       // hinge pin radius
hinge_height = 6;         // hinge bracket height

// Quality control
fillet_segments = 16;

// ========== MODULES ==========

// Main body shell with rounded corners
module body() {
    difference() {
        // Outer shell with rounded corners
        minkowski() {
            cube([body_w - 2*corner_radius, 
                  body_d - 2*corner_radius, 
                  body_h - corner_radius], center=false);
            cylinder(r=corner_radius, h=corner_radius, $fn=fillet_segments);
        }
        
        // Hollow interior
        translate([wall_thickness, wall_thickness, wall_thickness])
            minkowski() {
                cube([body_w - 2*corner_radius - 2*wall_thickness + 2*interior_clearance, 
                      body_d - 2*corner_radius - 2*wall_thickness + 2*interior_clearance, 
                      body_h - corner_radius - wall_thickness], center=false);
                cylinder(r=corner_radius - wall_thickness, h=0.01, $fn=fillet_segments);
            }
    }
}

// Metal shield/cage on top - modified to attach to body
module metal_shield() {
    shield_w = body_w - 4;
    shield_d = body_d;
    slot_width = 2;
    slot_height = 6;
    
    translate([body_w/2, body_d/2, body_h - shield_height/2]) {
        difference() {
            union() {
                // Outer shield box
                cube([shield_w, shield_d, shield_height], center=true);
                
                // Connection tab to body extending down
                translate([0, 0, -shield_height/2 - 0.5])
                    cube([shield_w - 2, shield_d - 2, 1], center=true);
            }
            
            // Inner hollow
            cube([shield_w - 2*shield_thickness, 
                  shield_d - 2*shield_thickness, 
                  shield_height + 1], center=true);
            
            // Ventilation slots on front face
            for (i = [0:shield_slot_count-1]) {
                translate([-(shield_slot_count-1)*slot_width/2 + i*slot_width*1.5, 
                          -shield_d/2 - 0.5, 
                          -slot_height/2])
                    cube([slot_width*0.6, shield_thickness + 1, slot_height], center=false);
            }
            
            // Opening for nozzle
            translate([0, -shield_d/2, shield_height/2 - 4])
                rotate([-90, 0, 0])
                    cylinder(d=nozzle_diameter + 2, h=shield_thickness + 1, $fn=fillet_segments);
        }
    }
}

// Flint wheel with serrations - modified to attach axle to body
module flint_wheel() {
    wheel_y_pos = body_d * 0.65;
    wheel_z_pos = body_h - wheel_offset_from_top;
    
    translate([body_w/2, wheel_y_pos, wheel_z_pos]) {
        rotate([90, 0, 0]) {
            difference() {
                // Base wheel cylinder
                cylinder(d=wheel_diameter, h=wheel_thickness, center=true, $fn=fillet_segments*2);
                
                // Create serrations (teeth)
                for (i = [0:wheel_teeth-1]) {
                    rotate([0, 0, i * 360/wheel_teeth])
                        translate([wheel_diameter/2 - 0.5, 0, 0])
                            rotate([0, 45, 0])
                                cube([1.5, wheel_thickness + 1, 1.5], center=true);
                }
            }
            
            // Axle pin connecting through body - extended to attach
            cylinder(d=2, h=body_d * 0.7, center=true, $fn=fillet_segments);
        }
    }
}

// Gas valve/nozzle - modified to extend into body for attachment
module nozzle() {
    nozzle_y_pos = body_d * 0.25;
    nozzle_z_pos = body_h - shield_height/2;
    
    translate([body_w/2, nozzle_y_pos, nozzle_z_pos]) {
        // Main nozzle body extending up
        cylinder(d=nozzle_diameter, h=nozzle_length + shield_height/2, $fn=fillet_segments);
        
        // Base connecting down through body
        translate([0, 0, -shield_height - 2])
            cylinder(d=nozzle_diameter + 1, h=shield_height + 2, $fn=fillet_segments);
    }
}

// Gas release button/lever - modified to attach to body
module release_button() {
    button_y_pos = body_d * 0.25;
    button_z_pos = body_h - shield_height;
    
    translate([body_w/2, button_y_pos, button_z_pos]) {
        hull() {
            translate([0, 0, button_height/2])
                cube([button_width, button_depth, button_height], center=true);
            
            // Connection extending into body
            translate([0, 0, -2])
                cube([button_width - 2, button_depth - 1, 2], center=true);
        }
    }
}

// Internal ledge/rim near top - modified to attach to body walls
module top_ledge() {
    ledge_height = 3;
    ledge_z = body_h - shield_height - ledge_height;
    
    translate([wall_thickness*2, wall_thickness*2, ledge_z]) {
        difference() {
            cube([body_w - wall_thickness*4, 
                  body_d - wall_thickness*4, 
                  ledge_height]);
            
            translate([wall_thickness, wall_thickness, -0.5])
                cube([body_w - wall_thickness*6, 
                      body_d - wall_thickness*6, 
                      ledge_height + 1]);
        }
    }
}

// Hinge assembly connecting cap to body back
module hinge() {
    hinge_x = body_w/2;
    hinge_y = body_d - 1;
    hinge_z = body_h - shield_height - 2;
    
    translate([hinge_x, hinge_y, hinge_z]) {
        rotate([0, 90, 0]) {
            // Hinge pin cylinder connecting both parts
            cylinder(r=hinge_radius, h=8, center=true, $fn=fillet_segments);
            
            // Body-side hinge bracket
            translate([0, 0, -3])
                cube([hinge_height, 3, 2], center=true);
        }
    }
}

// Cap covering the shield and wheel - attached via hinge
module cap() {
    shield_w = body_w - 4;
    shield_d = body_d;
    cap_w = shield_w + 2*cap_clearance + 2*cap_thickness;
    cap_d = shield_d + cap_clearance + cap_thickness;
    cap_front_opening = 8;
    
    hinge_x = body_w/2;
    hinge_y = body_d - 1;
    hinge_z = body_h - shield_height - 2;
    
    difference() {
        union() {
            // Main cap body positioned over shield
            translate([body_w/2, body_d/2, body_h - shield_height/2]) {
                difference() {
                    // Outer cap shell with slight rounding
                    minkowski() {
                        cube([cap_w - 1, cap_d - 1, cap_height - 1], center=true);
                        sphere(r=0.5, $fn=fillet_segments);
                    }
                    
                    // Inner hollow
                    translate([0, cap_thickness/2, -cap_thickness])
                        cube([cap_w - 2*cap_thickness + 0.2, 
                              cap_d - cap_thickness + 0.2, 
                              cap_height], center=true);
                    
                    // Front opening for access to wheel
                    translate([0, -cap_d/2 - 0.5, 0])
                        cube([cap_front_opening, cap_thickness + 2, cap_height + 2], center=true);
                    
                    // Ventilation slots on sides
                    for (side = [-1, 1]) {
                        translate([side * cap_w/2, 0, 2])
                            rotate([0, 0, 0])
                                cube([cap_thickness + 1, 3, 8], center=true);
                    }
                }
            }
            
            // Cap-side hinge bracket attached to cap back
            translate([hinge_x, hinge_y, hinge_z]) {
                rotate([0, 90, 0]) {
                    translate([0, 0, 3])
                        cube([hinge_height, 3, 2], center=true);
                }
            }
        }
        
        // Nothing to subtract - hinge pin space is shared
    }
}

// Main assembly - all parts unioned to form single connected model
module lighter_model() {
    union() {
        // Main body
        body();
        
        // Top ledge attached to body
        top_ledge();
        
        // Metal shield attached to body
        metal_shield();
        
        // Flint wheel with axle through body
        flint_wheel();
        
        // Nozzle extending through body
        nozzle();
        
        // Button attached to body
        release_button();
        
        // Hinge connecting body and cap
        hinge();
        
        // Cap attached via hinge
        cap();
    }
}

// Render the complete lighter
lighter_model();