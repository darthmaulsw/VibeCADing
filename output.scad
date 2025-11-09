```openscad
// Snowman OpenSCAD Model
// A complete snowman with three stacked spheres, hat, arms, face features, and buttons
// All parts are unioned into a single connected object
// Sized to fit within 25x25x25 units, centered on origin, base at Z=0

// ===== PARAMETERS =====
// Overall scale factor
overall_scale = 1.0;

// Sphere radii (scaled)
bottom_radius = 5.5 * overall_scale;
middle_radius = 4.0 * overall_scale;
head_radius = 3.0 * overall_scale;

// Facet count for smoothness
$fn = 60;

// Feature sizes
eye_radius = 0.15 * overall_scale;
nose_length = 1.2 * overall_scale;
nose_base_radius = 0.3 * overall_scale;
button_radius = 0.2 * overall_scale;
arm_length = 4.5 * overall_scale;
arm_radius = 0.15 * overall_scale;

// Hat dimensions
hat_brim_radius = 3.8 * overall_scale;
hat_brim_height = 0.4 * overall_scale;
hat_top_radius = 2.2 * overall_scale;
hat_top_height = 3.0 * overall_scale;

// Mouth sphere parameters
mouth_sphere_radius = 0.12 * overall_scale;

// ===== MAIN ASSEMBLY =====
union() {
    // Bottom sphere (slightly flattened at base)
    translate([0, 0, bottom_radius * 0.95])
        sphere(r = bottom_radius);
    
    // Middle sphere (positioned on top of bottom)
    translate([0, 0, bottom_radius * 1.9 + middle_radius * 0.85])
        sphere(r = middle_radius);
    
    // Head sphere (positioned on top of middle)
    translate([0, 0, bottom_radius * 1.9 + middle_radius * 1.7 + head_radius * 0.9])
        sphere(r = head_radius);
    
    // === FACE FEATURES ===
    // Left eye (coal - black sphere embedded in head)
    translate([-0.8 * overall_scale, head_radius * 0.85, bottom_radius * 1.9 + middle_radius * 1.7 + head_radius * 1.3])
        sphere(r = eye_radius);
    
    // Right eye
    translate([0.8 * overall_scale, head_radius * 0.85, bottom_radius * 1.9 + middle_radius * 1.7 + head_radius * 1.3])
        sphere(r = eye_radius);
    
    // Carrot nose (cone pointing forward)
    translate([0, head_radius * 0.9, bottom_radius * 1.9 + middle_radius * 1.7 + head_radius * 0.95])
        rotate([90, 0, 0])
            cylinder(h = nose_length, r1 = nose_base_radius, r2 = 0.05 * overall_scale);
    
    // Mouth (5 small spheres in an arc)
    for (i = [-2:2]) {
        translate([i * 0.35 * overall_scale, 
                   head_radius * 0.85, 
                   bottom_radius * 1.9 + middle_radius * 1.7 + head_radius * 0.5 - abs(i) * 0.1 * overall_scale])
            sphere(r = mouth_sphere_radius);
    }
    
    // === BUTTONS (on middle sphere) ===
    // Top button
    translate([0, middle_radius * 0.95, bottom_radius * 1.9 + middle_radius * 1.3])
        sphere(r = button_radius);
    
    // Middle button
    translate([0, middle_radius * 0.95, bottom_radius * 1.9 + middle_radius * 0.85])
        sphere(r = button_radius);
    
    // Bottom button
    translate([0, middle_radius * 0.95, bottom_radius * 1.9 + middle_radius * 0.4])
        sphere(r = button_radius);
    
    // === ARMS (stick arms) ===
    // Left arm
    translate([-middle_radius * 0.7, 0, bottom_radius * 1.9 + middle_radius * 1.0])
        rotate([0, -25, -15])
            cylinder(h = arm_length, r = arm_radius);
    
    // Right arm
    translate([middle_radius * 0.7, 0, bottom_radius * 1.9 + middle_radius * 1.0])
        rotate([0, 25, 15])
            cylinder(h = arm_length, r = arm_radius);
    
    // === HAT (top hat style) ===
    // Hat brim (wide flat cylinder)
    translate([0, 0, bottom_radius * 1.9 + middle_radius * 1.7 + head_radius * 1.8])
        cylinder(h = hat_brim_height, r = hat_brim_radius);
    
    // Hat top (tall cylinder)
    translate([0, 0, bottom_radius * 1.9 + middle_radius * 1.7 + head_radius * 1.8 + hat_brim_height])
        cylinder(h = hat_top_height, r = hat_top_radius);
    
    // Hat connector (ensures connection between brim and top)
    translate([0, 0, bottom_radius * 1.9 + middle_radius * 1.7 + head_radius * 1.8])
        cylinder(h = hat_brim_height + 0.2, r = hat_top_radius);
}
```