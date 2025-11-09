// Parametric Smartphone Case Generator
// All dimensions in millimeters

// Phone and case core parameters
phone_length = 150;
phone_width = 72;
phone_thickness = 8;
corner_radius = 6;
camera_cutout_diameter = 12;
camera_cutout_offset_x = 16;
camera_cutout_offset_y = 12;
wall_thickness = 1.8;
clearance = 0.6;
lip_height = 1.5;
bottom_port_width = 12;
bottom_port_height = 6;
button_cutout_depth = 1.5;
use_closed_bottom = false;
include_screw_holes = false;
screw_hole_diameter = 2.5;
screw_hole_count = 0;
use_speaker_pattern = true;
speaker_hole_diameter = 1.2;
speaker_rows = 2;
speaker_cols = 10;
speaker_spacing = 2.4;
fillet_radius = 0.8;
chamfer_amount = 0.8;
snap_lip_thickness = 1.6;
snap_lip_height = 0.9;
shell_depth_extra = 0.5;
min_feature_size = 0.6;

// Derived parameters
outer_length = phone_length + 2 * wall_thickness + 2 * clearance;
outer_width = phone_width + 2 * wall_thickness + 2 * clearance;
outer_height = phone_thickness + lip_height + shell_depth_extra;
inner_length = phone_length + 2 * clearance;
inner_width = phone_width + 2 * clearance;
inner_height = phone_thickness + shell_depth_extra;
outer_corner = corner_radius + wall_thickness + clearance;
inner_corner = corner_radius + clearance;

$fn = 64;

// Module: rounded rectangle (2D profile)
module rounded_rect_2d(length, width, radius) {
    hull() {
        translate([radius, radius]) circle(r=radius);
        translate([length-radius, radius]) circle(r=radius);
        translate([length-radius, width-radius]) circle(r=radius);
        translate([radius, width-radius]) circle(r=radius);
    }
}

// Module: rounded box (3D)
module rounded_box(length, width, height, radius) {
    linear_extrude(height=height)
        rounded_rect_2d(length, width, radius);
}

// Module: outer shell with rounded corners
module outer_shell() {
    rounded_box(outer_length, outer_width, outer_height, outer_corner);
}

// Module: inner pocket for phone
module inner_pocket() {
    translate([wall_thickness + clearance, wall_thickness + clearance, wall_thickness])
        rounded_box(inner_length, inner_width, inner_height + 1, inner_corner);
}

// Module: snap lip (inner protrusion to hold phone)
module snap_lip() {
    lip_z = wall_thickness + phone_thickness - snap_lip_height;
    translate([wall_thickness + clearance - snap_lip_thickness/2, 
               wall_thickness + clearance - snap_lip_thickness/2, 
               lip_z])
        difference() {
            rounded_box(inner_length + snap_lip_thickness, 
                       inner_width + snap_lip_thickness, 
                       snap_lip_height, 
                       inner_corner);
            translate([snap_lip_thickness, snap_lip_thickness, -0.5])
                rounded_box(inner_length - snap_lip_thickness, 
                           inner_width - snap_lip_thickness, 
                           snap_lip_height + 1, 
                           inner_corner);
        }
}

// Module: camera cutout on back
module camera_cutout() {
    cutout_x = wall_thickness + clearance + camera_cutout_offset_x;
    cutout_y = outer_width - (wall_thickness + clearance + camera_cutout_offset_y);
    cutout_z = wall_thickness / 2;
    
    translate([cutout_x, cutout_y, cutout_z])
        cylinder(d=camera_cutout_diameter, h=wall_thickness + 2, center=true);
    
    // Chamfer for camera cutout
    translate([cutout_x, cutout_y, wall_thickness])
        cylinder(d1=camera_cutout_diameter, d2=camera_cutout_diameter + 2*chamfer_amount, h=chamfer_amount + 0.1);
}

// Module: bottom charging port cutout
module port_cutout() {
    port_x = (outer_length - bottom_port_width) / 2;
    port_y = -1;
    port_z = wall_thickness;
    
    if (!use_closed_bottom) {
        // Full cutout
        translate([port_x, port_y, port_z])
            cube([bottom_port_width, wall_thickness + clearance + 2, bottom_port_height]);
        
        // Chamfer edges
        translate([port_x, wall_thickness + clearance, port_z])
            rotate([-45, 0, 0])
            cube([bottom_port_width, chamfer_amount*1.5, chamfer_amount*1.5]);
    }
}

// Module: side button cutouts
module button_cutouts() {
    // Right side volume button (upper)
    button1_x = outer_length - wall_thickness - 1;
    button1_y = outer_width * 0.35;
    button1_z = wall_thickness + phone_thickness * 0.6;
    button1_length = 12;
    
    translate([button1_x, button1_y, button1_z])
        cube([wall_thickness + 2, button1_length, 3]);
    
    // Right side power button (lower)
    button2_x = outer_length - wall_thickness - 1;
    button2_y = outer_width * 0.55;
    button2_z = wall_thickness + phone_thickness * 0.5;
    button2_length = 8;
    
    translate([button2_x, button2_y, button2_z])
        cube([wall_thickness + 2, button2_length, 3]);
}

// Module: speaker holes pattern
module speaker_holes() {
    if (use_speaker_pattern) {
        pattern_width = (speaker_cols - 1) * speaker_spacing;
        pattern_height = (speaker_rows - 1) * speaker_spacing;
        start_x = (outer_length - pattern_width) / 2;
        start_y = wall_thickness + clearance + 5;
        
        for (row = [0:speaker_rows-1]) {
            for (col = [0:speaker_cols-1]) {
                hole_x = start_x + col * speaker_spacing;
                hole_y = start_y + row * speaker_spacing;
                
                translate([hole_x, hole_y, -0.5])
                    cylinder(d=speaker_hole_diameter, h=wall_thickness + 2);
            }
        }
    }
}

// Module: optional screw holes
module screw_holes() {
    if (include_screw_holes && screw_hole_count > 0) {
        hole_inset = outer_corner + 3;
        positions = [
            [hole_inset, hole_inset],
            [outer_length - hole_inset, hole_inset],
            [outer_length - hole_inset, outer_width - hole_inset],
            [hole_inset, outer_width - hole_inset]
        ];
        
        for (i = [0:min(screw_hole_count-1, 3)]) {
            translate([positions[i][0], positions[i][1], -0.5])
                cylinder(d=screw_hole_diameter, h=wall_thickness + 2);
        }
    }
}

// Module: open bottom (if enabled)
module bottom_opening() {
    if (!use_closed_bottom) {
        opening_inset = wall_thickness + clearance + outer_corner;
        opening_length = outer_length - 2 * opening_inset;
        opening_width = outer_width * 0.4;
        
        translate([opening_inset, -1, -1])
            rounded_box(opening_length, opening_width, wall_thickness + 3, corner_radius);
    }
}

// Main assembly
module phone_case() {
    difference() {
        union() {
            // Base outer shell
            outer_shell();
            
            // Add snap lip
            snap_lip();
        }
        
        // Subtract inner pocket
        inner_pocket();
        
        // Subtract camera cutout
        camera_cutout();
        
        // Subtract port cutout
        port_cutout();
        
        // Subtract button cutouts
        button_cutouts();
        
        // Subtract speaker holes
        speaker_holes();
        
        // Subtract screw holes
        screw_holes();
        
        // Subtract bottom opening
        bottom_opening();
    }
}

// Final assembly - single union
union() {
    phone_case();
}