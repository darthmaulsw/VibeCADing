// ============================================
// Rectangular Table with Mid-Side Legs
// Units: millimeters
// ============================================

// === Parameters ===
table_length = 1200;
table_width = 600;
tabletop_thickness = 25;
leg_width = 40;
leg_depth = 40;
leg_height = 720;
apron_thickness = 18;
apron_height = 60;
leg_inset = 20;
mid_side_leg_offset_from_edge = 20;
corner_radius = 3;
tolerance_clearance = 0.2;

// === Modules ===

// Single leg (square vertical post with optional rounded edges)
module leg() {
    translate([0, 0, leg_height/2])
        cube([leg_width, leg_depth, leg_height], center=true);
}

// Tabletop with rounded corners
module tabletop() {
    hull() {
        translate([corner_radius, corner_radius, 0])
            cylinder(r=corner_radius, h=tabletop_thickness, $fn=16);
        translate([table_length - corner_radius, corner_radius, 0])
            cylinder(r=corner_radius, h=tabletop_thickness, $fn=16);
        translate([corner_radius, table_width - corner_radius, 0])
            cylinder(r=corner_radius, h=tabletop_thickness, $fn=16);
        translate([table_length - corner_radius, table_width - corner_radius, 0])
            cylinder(r=corner_radius, h=tabletop_thickness, $fn=16);
    }
}

// Apron beam (rectangular horizontal rail)
module apron_beam(length) {
    cube([length, apron_thickness, apron_height]);
}

// Apron system connecting all legs
module aprons() {
    z_offset = leg_height - apron_height;
    
    // Front apron (along length, Y=0 side)
    translate([0, leg_inset - apron_thickness/2, z_offset])
        apron_beam(table_length);
    
    // Back apron (along length, Y=table_width side)
    translate([0, table_width - leg_inset - apron_thickness/2, z_offset])
        apron_beam(table_length);
    
    // Left apron (along width, X=0 side)
    translate([leg_inset - apron_thickness/2, 0, z_offset])
        rotate([0, 0, 90])
            apron_beam(table_width);
    
    // Right apron (along width, X=table_length side)
    translate([table_length - leg_inset - apron_thickness/2, 0, z_offset])
        rotate([0, 0, 90])
            apron_beam(table_width);
}

// All legs positioned around table
module legs() {
    // Corner legs
    // Front-left corner
    translate([leg_inset + leg_width/2, leg_inset + leg_depth/2, 0])
        leg();
    
    // Front-right corner
    translate([table_length - leg_inset - leg_width/2, leg_inset + leg_depth/2, 0])
        leg();
    
    // Back-left corner
    translate([leg_inset + leg_width/2, table_width - leg_inset - leg_depth/2, 0])
        leg();
    
    // Back-right corner
    translate([table_length - leg_inset - leg_width/2, table_width - leg_inset - leg_depth/2, 0])
        leg();
    
    // Mid-side legs (centered on long edges)
    // Front mid-side leg (centered along length, at Y=0 long edge)
    translate([table_length/2, mid_side_leg_offset_from_edge + leg_depth/2, 0])
        leg();
    
    // Back mid-side leg (centered along length, at Y=table_width long edge)
    translate([table_length/2, table_width - mid_side_leg_offset_from_edge - leg_depth/2, 0])
        leg();
}

// Complete assembled table
module assembled_table() {
    union() {
        // Tabletop positioned on top of legs
        translate([0, 0, leg_height])
            tabletop();
        
        // Apron rails
        aprons();
        
        // All legs
        legs();
    }
}

// === Render assembled table ===
assembled_table();