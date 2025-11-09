// Simple parametric sphere module
// Parameters:
//   radius - sphere radius in mm (default: 20)
//   fn - number of facets for smoothness (default: 96)

module simple_sphere(radius=20, fn=96) {
  $fn = fn;
  sphere(r=radius);
}

// Render sphere with default parameters
simple_sphere();