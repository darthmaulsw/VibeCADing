// Parameters (mm)
table_length = 1200;
table_width = 600;
table_height = 750;
top_thickness = 20;
leg_size = 40;
leg_inset = 30;

// Derived values
leg_height = table_height - top_thickness;

// Main assembly
union() {
    // Tabletop positioned so top surface is at Z = table_height
    translate([0, 0, table_height - top_thickness])
        cube([table_length, table_width, top_thickness]);
    
    // Four legs positioned inset from tabletop edges
    // Front-left leg
    translate([leg_inset, leg_inset, 0])
        cube([leg_size, leg_size, leg_height]);
    
    // Front-right leg
    translate([table_length - leg_inset - leg_size, leg_inset, 0])
        cube([leg_size, leg_size, leg_height]);
    
    // Back-left leg
    translate([leg_inset, table_width - leg_inset - leg_size, 0])
        cube([leg_size, leg_size, leg_height]);
    
    // Back-right leg
    translate([table_length - leg_inset - leg_size, table_width - leg_inset - leg_size, 0])
        cube([leg_size, leg_size, leg_height]);
}