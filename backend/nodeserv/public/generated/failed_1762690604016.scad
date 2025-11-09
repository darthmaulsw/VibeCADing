
diameter_mm = 40;
center_sphere = true;
resolution_fn = 180;

radius = diameter_mm / 2;

module sphere_model() {
    union() {
        if (center_sphere) {
            sphere(r=radius, $fn=resolution_fn);
        } else {
            translate([0, 0, radius])
                sphere(r=radius, $fn=resolution_fn);
        }
    }
}

sphere_model();
