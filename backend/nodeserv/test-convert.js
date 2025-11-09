// Quick test script for SCAD → STL conversion endpoint
// Usage: node test-convert.js

const testScad = `
// Simple cube for testing
cube([10, 10, 10], center=true);
`;

async function testConversion() {
  try {
    console.log('Testing /convert-scad endpoint...');
    console.log('SCAD code:', testScad.trim());
    
    const response = await fetch('http://localhost:3001/convert-scad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        scad: testScad,
        model_id: 'test-123',
        userid: 'test-user'
      })
    });

    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Error:', error);
      return;
    }

    const result = await response.json();
    console.log('✓ Success!');
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('\nSTL file available at: http://localhost:3001' + result.url);
    
  } catch (err) {
    console.error('✗ Test failed:', err.message);
    console.error('Make sure the Node server is running on port 3001');
  }
}

testConversion();
