
// Units: millimeters

// Parameters
outer_diameter = 40; // mm
inner_diameter = 20; // mm (hole diameter)
height = 20; // mm (thickness of the ring)
$fn = 200; // facet count for roundness
center_geometry = true; // center the cylinders on the origin

// Parameter validation
// If inner_diameter >= outer_diameter, adjust inner_diameter
corrected_inner_diameter = (inner_diameter >= outer_diameter) ? outer_diameter * 0.5 : inner_diameter;
// Adjustment applied if inner_diameter was >= outer_diameter

// Geometry construction
difference() {
    // Outer cylinder
    cylinder(h = height, d = outer_diameter, center = center_geometry);
    
    // Inner cylinder (through-hole) - slightly taller to ensure clean subtraction
    cylinder(h = height + 2, d = corrected_inner_diameter, center = center_geometry);
}
