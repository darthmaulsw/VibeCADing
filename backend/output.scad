```openscad
// Units: millimeters (mm)
// Default dimensions model a realistic 12-oz (355 mL) aluminum soda can

// ========== PARAMETERS ==========

// Main dimensions
overall_height_mm = 115.0;
outer_diameter_mm = 66.0;
wall_thickness_mm = 0.8;

// Thickness constraints
min_wall_thickness_mm = 0.4;
max_wall_thickness_mm = 3.0;

// Bottom feature
bottom_recess_depth_mm = 2.5;

// Top lip feature
top_lip_height_mm = 1.8;

// Seam ridge
seam_offset_mm = 0.3;

// Embossed logo area
emboss_enabled = true;
emboss_depth_mm = 0.8;
emboss_width_mm = 40.0;

// Render quality
render_fn = 96;

// ========== DERIVED VALUES ==========

// Clamp wall thickness to safe range
wall_thickness = max(min_wall_thickness_mm, min(wall_thickness_mm, max_wall_thickness_mm));

outer_radius = outer_diameter_mm / 2;
inner_radius = outer_radius - wall_thickness;

body_height = overall_height_mm - top_lip_height_mm;

// ========== MODULES ==========

module can_bottom() {
    $fn = render_fn;
    
    // Bottom dome parameters
    recess_depth = bottom_recess_depth_mm;
    base_radius = inner_radius;
    fillet_rad = 3.0;
    
    rotate_extrude() {
        difference() {
            union() {
                // Outer bottom shell
                difference() {
                    // Outer profile with recess
                    union() {
                        // Flat ring at perimeter
                        polygon([
                            [base_radius, 0],
                            [outer_radius, 0],
                            [outer_radius, wall_thickness],
                            [base_radius, wall_thickness]
                        ]);
                        
                        // Concave dome profile
                        translate([0, wall_thickness])
                        polygon([
                            [0, 0],
                            [base_radius, 0],
                            [base_radius, -recess_depth],
                            [fillet_rad, -recess_depth],
                            [0, -recess_depth + fillet_rad]
                        ]);
                    }
                    
                    // Inner hollow for dome
                    translate([0, wall_thickness * 2])
                    polygon([
                        [0, 0],
                        [base_radius - wall_thickness, 0],
                        [base_radius - wall_thickness, -recess_depth + wall_thickness],
                        [fillet_rad + wall_thickness, -recess_depth + wall_thickness],
                        [0, -recess_depth + fillet_rad + wall_thickness]
                    ]);
                }
            }
        }
    }
}

module can_body() {
    $fn = render_fn;
    
    body_start_z = wall_thickness;
    body_end_z = body_height;
    
    rotate_extrude() {
        polygon([
            [inner_radius, body_start_z],
            [outer_radius, body_start_z],
            [outer_radius, body_end_z],
            [inner_radius, body_end_z]
        ]);
    }
}

module can_top_lip() {
    $fn = render_fn;
    
    lip_outer_radius = outer_radius;
    lip_inner_radius = inner_radius - 1.5;
    lip_start_z = body_height;
    lip_end_z = overall_height_mm;
    lip_mid_z = lip_start_z + top_lip_height_mm * 0.5;
    
    rotate_extrude() {
        // Rolled lip profile - tapered inward at top
        polygon([
            [inner_radius, lip_start_z],
            [lip_outer_radius, lip_start_z],
            [lip_outer_radius - 1.0, lip_mid_z],
            [lip_outer_radius - 2.0, lip_end_z],
            [lip_inner_radius, lip_end_z],
            [lip_inner_radius + 1.0, lip_mid_z],
            [inner_radius, lip_start_z + 0.5]
        ]);
    }
}

module seam_ridge() {
    if (seam_offset_mm > 0) {
        $fn = render_fn;
        
        seam_height = 2.0;
        seam_z = body_height * 0.15;
        
        rotate_extrude() {
            polygon([
                [outer_radius, seam_z],
                [outer_radius + seam_offset_mm, seam_z + seam_height / 2],
                [outer_radius, seam_z + seam_height]
            ]);
        }
    }
}

module emboss() {
    if (emboss_enabled) {
        $fn = render_fn;
        
        emboss_height = emboss_width_mm;
        emboss_z_center = body_height * 0.6;
        emboss_z_start = emboss_z_center - emboss_height / 2;
        emboss_z_end = emboss_z_center + emboss_height / 2;
        
        rotate_extrude() {
            polygon([
                [outer_radius, emboss_z_start],
                [outer_radius + emboss_depth_mm, emboss_z_start + 2],
                [outer_radius + emboss_depth_mm, emboss_z_end - 2],
                [outer_radius, emboss_z_end]
            ]);
        }
    }
}

module soda_can() {
    union() {
        can_bottom();
        can_body();
        can_top_lip();
        seam_ridge();
        emboss();
    }
}

// ========== RENDER ==========

soda_can();
```