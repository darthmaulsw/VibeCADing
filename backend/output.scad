// Traffic Cone - Adjustable Parameters
total_height = 450;
cone_bottom_od = 290;
cone_top_od = 45;
wall_thickness = 3.0;
base_skirt_outer_od = 300;
base_skirt_thickness = 10;
base_plate_thickness = 3;
stripe_count = 2;
stripe_height = 50;
stripe_positions = [120, 260];
stripe_gap = 2;
fillet_radius = 0;
$fn = 96;

// Derived radii
cone_bottom_r = cone_bottom_od / 2;
cone_top_r = cone_top_od / 2;
base_skirt_outer_r = base_skirt_outer_od / 2;

// Clamp inner radii to avoid negatives
cone_bottom_inner_r = max(0, cone_bottom_r - wall_thickness);
cone_top_inner_r = max(0, cone_top_r - wall_thickness);

// Function to interpolate cone radius at given height
function cone_radius_at_height(h) = 
    cone_bottom_r + (cone_top_r - cone_bottom_r) * (h / total_height);

// Main assembly
union() {
    // Hollow cone shell with base plate
    color([1, 0.5, 0]) {
        difference() {
            // Outer cone
            cylinder(h = total_height, r1 = cone_bottom_r, r2 = cone_top_r, center = false);
            
            // Inner cone for hollowing (leaves base plate solid)
            translate([0, 0, base_plate_thickness])
                cylinder(h = total_height - base_plate_thickness + 0.1, 
                         r1 = cone_bottom_inner_r, 
                         r2 = cone_top_inner_r, 
                         center = false);
        }
    }
    
    // Base plate (solid disc at bottom)
    color([1, 0.5, 0]) {
        cylinder(h = base_plate_thickness, r = cone_bottom_r - wall_thickness / 2, center = false);
    }
    
    // Rubber skirt (outer ring at base)
    color([0.2, 0.2, 0.2]) {
        translate([0, 0, -base_skirt_thickness])
            difference() {
                cylinder(h = base_skirt_thickness + 1, r = base_skirt_outer_r, center = false);
                cylinder(h = base_skirt_thickness + 1, r = cone_bottom_r - 1, center = false);
            }
    }
    
    // Reflective stripes
    actual_stripe_count = min(stripe_count, len(stripe_positions));
    for (i = [0 : actual_stripe_count - 1]) {
        stripe_z = stripe_positions[i];
        stripe_center_r = cone_radius_at_height(stripe_z + stripe_height / 2);
        stripe_outer_r = stripe_center_r + stripe_gap;
        stripe_inner_r = max(0, stripe_outer_r - wall_thickness - stripe_gap);
        
        color([0.9, 0.9, 0.9]) {
            translate([0, 0, stripe_z])
                difference() {
                    cylinder(h = stripe_height, 
                             r1 = cone_radius_at_height(stripe_z) + stripe_gap, 
                             r2 = cone_radius_at_height(stripe_z + stripe_height) + stripe_gap, 
                             center = false);
                    translate([0, 0, -0.1])
                        cylinder(h = stripe_height + 0.2, 
                                 r1 = cone_radius_at_height(stripe_z) - wall_thickness, 
                                 r2 = cone_radius_at_height(stripe_z + stripe_height) - wall_thickness, 
                                 center = false);
                }
        }
    }
}