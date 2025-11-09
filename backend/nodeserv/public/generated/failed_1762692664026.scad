// Table parameters in millimeters
table_length = 1200;
table_width = 600;
table_height = 740;
top_thickness = 20;
leg_thickness = 40;
leg_inset = 50;
apron_height = 40;
apron_thickness = 10;
leg_engagement = 5;

// Tabletop module
module tabletop() {
    translate([0, 0, table_height - top_thickness])
        cube([table_length, table_width, top_thickness], center=true);
}

// Leg module
module leg() {
    cube([leg_thickness, leg_thickness, table_height - top_thickness + leg_engagement]);
}

// Apron module (single board)
module apron_board(length) {
    cube([length, apron_thickness, apron_height]);
}

// Complete table assembly
module table_assembly() {
    union() {
        // Tabletop
        tabletop();
        
        // Calculate leg positions
        // Legs positioned so their outer faces are inset by leg_inset from tabletop edges
        leg_x_offset = table_length/2 - leg_inset - leg_thickness;
        leg_y_offset = table_width/2 - leg_inset - leg_thickness;
        
        // Four legs
        translate([leg_x_offset, leg_y_offset, 0])
            leg();
        
        translate([-leg_x_offset - leg_thickness, leg_y_offset, 0])
            leg();
        
        translate([leg_x_offset, -leg_y_offset - leg_thickness, 0])
            leg();
        
        translate([-leg_x_offset - leg_thickness, -leg_y_offset - leg_thickness, 0])
            leg();
        
        // Apron boards
        apron_z = table_height - top_thickness - apron_height;
        
        // Front apron (along length, positive Y side)
        translate([-table_length/2, table_width/2 - leg_inset - apron_thickness, apron_z])
            apron_board(table_length);
        
        // Back apron (along length, negative Y side)
        translate([-table_length/2, -table_width/2 + leg_inset, apron_z])
            apron_board(table_length);
        
        // Right apron (along width, positive X side)
        translate([table_length/2 - leg_inset - apron_thickness, -table_width/2, apron_z])
            rotate([0, 0, 90])
                apron_board(table_width);
        
        // Left apron (along width, negative X side)
        translate([-table_length/2 + leg_inset, -table_width/2, apron_z])
            rotate([0, 0, 90])
                apron_board(table_width);
    }
}

// Generate the complete table
table_assembly();