```openscad
use <MCAD/gears.scad>;

// ===== TOP-LEVEL PARAMETERS =====
teeth = [12, 20, 30, 40, 60];
gear_module = 1.5;
face_width = 6;
backlash = 0.1 * gear_module;
bore_clearance = 0.2;
shaft_dia = 3;
base_thickness = 6;
chamfer = 0.5;
pressure_angle = 20;
$fn = 64;

// ===== DERIVED FUNCTIONS =====
function pitch_diameter(t) = gear_module * t;
function center_distance(t1, t2) = (pitch_diameter(t1) + pitch_diameter(t2)) / 2;

function gear_position(index) =
    index == 0 ? [0, 0] :
    index == 1 ? [center_distance(teeth[0], teeth[1]), 0] :
    index == 2 ? [0, center_distance(teeth[0], teeth[2])] :
    index == 3 ? [-center_distance(teeth[0], teeth[3]), 0] :
    index == 4 ? [0, -center_distance(teeth[0], teeth[4])] :
    [0, 0];

// ===== MODULES =====

// Gear with bore hole
module mcad_gear(teeth_count, module_val, width, bore_dia, pressure_ang, clearance_val) {
    difference() {
        // MCAD gear function
        gear(
            number_of_teeth = teeth_count,
            circular_pitch = module_val * PI,
            gear_thickness = width,
            rim_thickness = width,
            hub_thickness = width,
            bore_diameter = 0,
            pressure_angle = pressure_ang,
            clearance = clearance_val
        );
        
        // Bore hole
        if (bore_dia > 0) {
            translate([0, 0, -1])
                cylinder(h = width + 2, d = bore_dia, $fn = $fn);
        }
    }
}

// Shaft with integrated base hub
module shaft(dia, height, base_h) {
    union() {
        // Base hub reinforcement
        cylinder(h = base_h, d = dia * 2, $fn = $fn);
        
        // Shaft extending through base and into gear
        cylinder(h = height, d = dia, $fn = $fn);
    }
}

// Calculate base dimensions
function calculate_base_size(positions) = 
    let(
        max_x = max([for (p = positions) abs(p[0])]),
        max_y = max([for (p = positions) abs(p[1])]),
        max_gear_rad = pitch_diameter(max(teeth)) / 2 + gear_module * 3,
        size_x = 2 * (max_x + max_gear_rad) + 5,
        size_y = 2 * (max_y + max_gear_rad) + 5
    )
    [size_x, size_y];

// Base plate without shaft holes
module base_plate(thickness, positions, shaft_d) {
    base_size = calculate_base_size(positions);
    
    // Base plate
    translate([-base_size[0]/2, -base_size[1]/2, 0])
        cube([base_size[0], base_size[1], thickness]);
}

// Complete assembly
module assembly() {
    positions = [for (i = [0:len(teeth)-1]) gear_position(i)];
    shaft_height = base_thickness + face_width + 1;
    
    union() {
        // Base plate with integrated shaft hubs
        color("lightgray")
            union() {
                base_plate(base_thickness, positions, shaft_dia);
                
                // Shafts union with base
                for (i = [0:len(teeth)-1]) {
                    translate([positions[i][0], positions[i][1], 0])
                        shaft(shaft_dia, shaft_height, base_thickness);
                }
            }
        
        // Gears
        color("steelblue")
            for (i = [0:len(teeth)-1]) {
                translate([positions[i][0], positions[i][1], base_thickness])
                    mcad_gear(
                        teeth[i], 
                        gear_module, 
                        face_width, 
                        shaft_dia + bore_clearance, 
                        pressure_angle,
                        backlash
                    );
            }
    }
}

// ===== RENDER =====
assembly();
```