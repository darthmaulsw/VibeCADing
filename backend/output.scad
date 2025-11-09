// Parametric 12oz Soda Can Model for OpenSCAD
// Origin: Can base sits on XY plane (Z=0)
// Units: millimeters

// --- Adjustable Parameters ---
outer_diameter = 66.0; // mm
height = 116.0; // mm
wall_thickness = 0.25; // mm
top_lip_height = 2.5; // mm
bottom_dome_depth = 4.5; // mm
top_dome_depth = 1.8; // mm
fn = 128; // $fn for smooth circular features
seam_enabled = false; // optional vertical seam/ridge
seam_width = 0.6; // mm
seam_height = 0.2; // mm

// --- Internal calculations ---
wall_t = max(wall_thickness, 0.1);
outer_r = outer_diameter / 2;
inner_r = max(outer_r - wall_t, 0.1);

module can_bottom() {
    difference() {
        union() {
            translate([0, 0, bottom_dome_depth])
                cylinder(h=0.01, r=outer_r, $fn=fn);
            rotate_extrude($fn=fn) {
                polygon([
                    [0, 0],
                    [outer_r, 0],
                    [outer_r, bottom_dome_depth],
                    [inner_r, bottom_dome_depth],
                    [inner_r, wall_t],
                    [0, wall_t]
                ]);
            }
        }
        translate([0, 0, bottom_dome_depth - 0.01])
            scale([1, 1, 1])
                sphere(r=outer_r - wall_t/2, $fn=fn);
    }
    difference() {
        translate([0, 0, bottom_dome_depth])
            sphere(r=outer_r, $fn=fn);
        translate([0, 0, bottom_dome_depth])
            sphere(r=inner_r, $fn=fn);
        translate([0, 0, -outer_r + bottom_dome_depth])
            cube([outer_r*2+1, outer_r*2+1, outer_r*2], center=true);
    }
}

module can_body() {
    translate([0, 0, bottom_dome_depth])
        difference() {
            cylinder(h=height - bottom_dome_depth - top_lip_height, r=outer_r, $fn=fn);
            translate([0, 0, -0.01])
                cylinder(h=height - bottom_dome_depth - top_lip_height + 0.02, r=inner_r, $fn=fn);
        }
}

module can_top() {
    base_z = height - top_lip_height;
    lip_outer_r = outer_r + 0.5;
    lip_inner_r = outer_r - 1.0;
    
    translate([0, 0, base_z]) {
        difference() {
            union() {
                difference() {
                    cylinder(h=top_lip_height, r1=outer_r, r2=lip_outer_r, $fn=fn);
                    translate([0, 0, -0.01])
                        cylinder(h=top_lip_height - wall_t + 0.01, r1=inner_r, r2=lip_inner_r, $fn=fn);
                }
                translate([0, 0, top_lip_height - wall_t])
                    difference() {
                        cylinder(h=wall_t, r=lip_outer_r, $fn=fn);
                        translate([0, 0, -0.01])
                            cylinder(h=wall_t + 0.02, r=lip_inner_r - wall_t, $fn=fn);
                    }
            }
        }
        
        translate([0, 0, top_lip_height - top_dome_depth]) {
            difference() {
                intersection() {
                    sphere(r=outer_r - 2, $fn=fn);
                    translate([0, 0, top_dome_depth/2])
                        cylinder(h=top_dome_depth, r=outer_r, center=true, $fn=fn);
                }
                translate([0, 0, -0.01])
                    intersection() {
                        sphere(r=outer_r - 2 - wall_t, $fn=fn);
                        translate([0, 0, top_dome_depth/2])
                            cylinder(h=top_dome_depth + 0.02, r=outer_r, center=true, $fn=fn);
                    }
            }
        }
    }
}

module vertical_seam() {
    if (seam_enabled) {
        translate([outer_r, -seam_width/2, bottom_dome_depth])
            cube([seam_height, seam_width, height - bottom_dome_depth - top_lip_height]);
    }
}

module assemble_can() {
    union() {
        can_bottom();
        can_body();
        can_top();
        vertical_seam();
    }
}

assemble_can();