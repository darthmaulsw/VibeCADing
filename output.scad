// Parametric Coffee Mug - Generated Automated CAD Model
// Date: 2024
// Description: Fully parametric printable coffee mug with handle, fillets, and rim rounding

// ========================================
// PARAMETERS (User-adjustable)
// ========================================

// Mug body dimensions
outer_diameter = 85;        // mm, overall outside diameter
inner_diameter = 78;        // mm, nominal inside diameter at top (before inner lip rounding)
mug_height = 95;            // mm, rim to base
wall_thickness = 3.5;       // mm, wall thickness (default computed from diameters)
base_thickness = 4;         // mm, solid base thickness

// Handle parameters
handle_thickness = 8;       // mm, cross-section thickness of handle
handle_clearance = 12;      // mm, minimum gap between inner handle surface and mug body
handle_center_distance = (outer_diameter/2) + 12; // mm, radial distance of handle center-path from mug center
handle_attach_height = [mug_height*0.30, mug_height*0.70]; // mm, [lower, upper] attachment heights

// Aesthetic parameters
fillet_radius = 2;          // mm, default fillet radius for edges
rim_chamfer = 1;            // mm, chamfer or lip height on top edge
top_inner_radius = 2;       // mm, inner lip rounding for comfortable drinking
lid_compatible = false;     // boolean, add lid seating feature (not implemented in basic version)

// Debug and rendering
debug = false;              // boolean, visualize internal cavity in contrasting color
$fn_param = 100;            // polygon resolution for circles/rounds

// Computed parameters
computed_wall_thickness = (outer_diameter - inner_diameter) / 2;
effective_wall_thickness = wall_thickness; // Use explicit wall_thickness parameter

// Sanity checks
min_wall = 2.0; // mm, minimum recommended wall thickness
// Warning: If wall_thickness < 2.0 mm, printability may be reduced

// ========================================
// GLOBAL SETTINGS
// ========================================
$fn = $fn_param;

// ========================================
// MODULES
// ========================================

// Module: mug_body()
// Creates the outer shell with inner cavity subtracted
module mug_body() {
    difference() {
        // Outer shell
        outer_shell();
        
        // Inner cavity (subtract to make hollow)
        if (debug) {
            color("red", 0.5) inner_cavity();
        } else {
            inner_cavity();
        }
    }
}

// Module: outer_shell()
// Creates the solid outer body with fillets
module outer_shell() {
    outer_radius = outer_diameter / 2;
    
    // Main body with bottom fillet
    hull() {
        // Bottom ring for fillet
        translate([0, 0, fillet_radius])
            cylinder(r = outer_radius - fillet_radius, h = 0.01);
        
        // Top of mug body (before rim processing)
        translate([0, 0, mug_height - fillet_radius])
            cylinder(r = outer_radius, h = 0.01);
    }
    
    // Top rim rounding (outer edge)
    rotate_extrude()
        translate([outer_radius - fillet_radius, mug_height - fillet_radius, 0])
            circle(r = fillet_radius);
}

// Module: inner_cavity()
// Creates the inner cavity to be subtracted from outer shell
module inner_cavity() {
    inner_radius = inner_diameter / 2;
    cavity_depth = mug_height - base_thickness - top_inner_radius;
    
    // Main cylindrical cavity
    translate([0, 0, base_thickness])
        cylinder(r = inner_radius, h = cavity_depth + 0.01);
    
    // Top inner lip rounding (for comfortable drinking)
    translate([0, 0, mug_height - top_inner_radius])
        rotate_extrude()
            translate([inner_radius, 0, 0])
                circle(r = top_inner_radius);
}

// Module: mug_handle()
// Creates the handle with C-shaped profile and attachments
module mug_handle() {
    outer_radius = outer_diameter / 2;
    
    // Handle path parameters
    handle_width = handle_thickness;
    handle_depth = handle_thickness;
    
    // C-shape path parameters
    path_radius = handle_center_distance - outer_radius;
    handle_angle_start = -45;   // degrees
    handle_angle_end = 45;      // degrees
    handle_sweep = handle_angle_end - handle_angle_start;
    
    // Attachment positions
    attach_lower = handle_attach_height[0];
    attach_upper = handle_attach_height[1];
    attach_mid = (attach_lower + attach_upper) / 2;
    
    union() {
        // Main handle arc
        difference() {
            union() {
                // Outer handle path with vertical arc
                for (angle = [handle_angle_start : 5 : handle_angle_end]) {
                    hull() {
                        // Current position
                        translate([
                            cos(angle) * handle_center_distance,
                            sin(angle) * handle_center_distance,
                            attach_lower + (attach_upper - attach_lower) * 
                                (angle - handle_angle_start) / handle_sweep
                        ])
                            sphere(d = handle_depth);
                        
                        // Next position
                        translate([
                            cos(angle + 5) * handle_center_distance,
                            sin(angle + 5) * handle_center_distance,
                            attach_lower + (attach_upper - attach_lower) * 
                                (angle + 5 - handle_angle_start) / handle_sweep
                        ])
                            sphere(d = handle_depth);
                    }
                }
                
                // Lower attachment blend
                hull() {
                    translate([outer_radius, 0, attach_lower])
                        sphere(d = handle_depth);
                    translate([
                        cos(handle_angle_start) * handle_center_distance,
                        sin(handle_angle_start) * handle_center_distance,
                        attach_lower
                    ])
                        sphere(d = handle_depth);
                }
                
                // Upper attachment blend
                hull() {
                    translate([outer_radius, 0, attach_upper])
                        sphere(d = handle_depth);
                    translate([
                        cos(handle_angle_end) * handle_center_distance,
                        sin(handle_angle_end) * handle_center_distance,
                        attach_upper
                    ])
                        sphere(d = handle_depth);
                }
            }
        }
    }
}

// Module: assemble_mug()
// Assembles the complete mug with body and handle
module assemble_mug() {
    union() {
        // Mug body
        if (debug) {
            color("lightblue", 0.7) 
                difference() {
                    outer_shell();
                }
            color("red", 0.3)
                inner_cavity();
        } else {
            mug_body();
        }
        
        // Handle
        if (debug) {
            color("green", 0.7) mug_handle();
        } else {
            mug_handle();
        }
    }
}

// ========================================
// MAIN EXECUTION
// ========================================
assemble_mug();
