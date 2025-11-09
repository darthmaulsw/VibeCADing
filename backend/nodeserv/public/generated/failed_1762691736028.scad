
base_size = 20;
height = 12;
center_at_origin = true;
hollow = false;
wall_thickness = 1.0;
resolution = 16;

outer_points = [
    [0, 0, height],
    [base_size/2, base_size/2, 0],
    [base_size/2, -base_size/2, 0],
    [-base_size/2, -base_size/2, 0],
    [-base_size/2, base_size/2, 0],
    [0, 0, -height]
];

outer_faces = [
    [0,1,2],
    [0,2,3],
    [0,3,4],
    [0,4,1],
    [5,2,1],
    [5,3,2],
    [5,4,3],
    [5,1,4]
];

outer_max_radius = max(abs(height), sqrt(pow(base_size/2, 2) + pow(base_size/2, 2)));
inner_scale = max(0, 1 - wall_thickness / outer_max_radius);

inner_points = [
    [outer_points[0][0] * inner_scale, outer_points[0][1] * inner_scale, outer_points[0][2] * inner_scale],
    [outer_points[1][0] * inner_scale, outer_points[1][1] * inner_scale, outer_points[1][2] * inner_scale],
    [outer_points[2][0] * inner_scale, outer_points[2][1] * inner_scale, outer_points[2][2] * inner_scale],
    [outer_points[3][0] * inner_scale, outer_points[3][1] * inner_scale, outer_points[3][2] * inner_scale],
    [outer_points[4][0] * inner_scale, outer_points[4][1] * inner_scale, outer_points[4][2] * inner_scale],
    [outer_points[5][0] * inner_scale, outer_points[5][1] * inner_scale, outer_points[5][2] * inner_scale]
];

inner_faces = [
    [0,2,1],
    [0,3,2],
    [0,4,3],
    [0,1,4],
    [5,1,2],
    [5,2,3],
    [5,3,4],
    [5,4,1]
];

if (center_at_origin) {
    if (hollow) {
        difference() {
            union() {
                polyhedron(points=outer_points, faces=outer_faces, convexity=2);
            }
            polyhedron(points=inner_points, faces=inner_faces, convexity=2);
        }
    } else {
        union() {
            polyhedron(points=outer_points, faces=outer_faces, convexity=2);
        }
    }
} else {
    translate([0, 0, height]) {
        if (hollow) {
            difference() {
                union() {
                    polyhedron(points=outer_points, faces=outer_faces, convexity=2);
                }
                polyhedron(points=inner_points, faces=inner_faces, convexity=2);
            }
        } else {
            union() {
                polyhedron(points=outer_points, faces=outer_faces, convexity=2);
            }
        }
    }
}
