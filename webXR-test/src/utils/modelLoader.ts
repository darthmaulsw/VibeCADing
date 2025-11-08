import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

/**
 * Interface for loaded model data
 */
export interface LoadedModel {
  model: THREE.Group | THREE.Mesh;
  boundingBox: THREE.Box3;
  center: THREE.Vector3;
  size: THREE.Vector3;
}

/**
 * Load a GLB/GLTF model file
 * @param path - Path to the .glb or .gltf file
 * @returns Promise resolving to the loaded model data
 */
export async function loadGLBModel(path: string): Promise<LoadedModel> {
  const loader = new GLTFLoader();
  
  return new Promise((resolve, reject) => {
    loader.load(
      path,
      (gltf) => {
        const model = gltf.scene;
        
        // Calculate bounding box
        const boundingBox = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        boundingBox.getCenter(center);
        boundingBox.getSize(size);
        
        console.log(`✅ GLB model loaded: ${path}`);
        console.log(`   Size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
        console.log(`   Center: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`);
        
        resolve({
          model,
          boundingBox,
          center,
          size,
        });
      },
      (progress) => {
        if (progress.lengthComputable) {
          const percentComplete = (progress.loaded / progress.total) * 100;
          console.log(`Loading GLB: ${percentComplete.toFixed(0)}%`);
        }
      },
      (error) => {
        console.error(`❌ Error loading GLB model from ${path}:`, error);
        reject(error);
      }
    );
  });
}

/**
 * Load an STL model file
 * @param path - Path to the .stl file
 * @param material - Optional material to apply to the STL mesh (defaults to MeshStandardMaterial)
 * @returns Promise resolving to the loaded model data
 */
export async function loadSTLModel(
  path: string,
  material?: THREE.Material
): Promise<LoadedModel> {
  const loader = new STLLoader();
  
  // Default material if none provided
  const defaultMaterial = material || new THREE.MeshStandardMaterial({
    color: 0x888888,
    metalness: 0.3,
    roughness: 0.7,
  });
  
  return new Promise((resolve, reject) => {
    loader.load(
      path,
      (geometry) => {
        const mesh = new THREE.Mesh(geometry, defaultMaterial);
        
        // Calculate bounding box
        geometry.computeBoundingBox();
        const boundingBox = geometry.boundingBox!;
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        boundingBox.getCenter(center);
        boundingBox.getSize(size);
        
        console.log(`✅ STL model loaded: ${path}`);
        console.log(`   Size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
        console.log(`   Center: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`);
        
        resolve({
          model: mesh,
          boundingBox,
          center,
          size,
        });
      },
      (progress) => {
        if (progress.lengthComputable) {
          const percentComplete = (progress.loaded / progress.total) * 100;
          console.log(`Loading STL: ${percentComplete.toFixed(0)}%`);
        }
      },
      (error) => {
        console.error(`❌ Error loading STL model from ${path}:`, error);
        reject(error);
      }
    );
  });
}

/**
 * Universal model loader - automatically detects file type and loads accordingly
 * Tries to detect actual file type if extension doesn't match content
 * @param path - Path to the model file (.glb, .gltf, or .stl)
 * @param material - Optional material for STL files
 * @returns Promise resolving to the loaded model data
 */
export async function loadModel(
  path: string,
  material?: THREE.Material
): Promise<LoadedModel> {
  const extension = path.toLowerCase().split('.').pop();
  
  // Try loading based on extension first
  try {
    switch (extension) {
      case 'glb':
      case 'gltf':
        return await loadGLBModel(path);
      case 'stl':
        return await loadSTLModel(path, material);
      default:
        throw new Error(`Unsupported file format: .${extension}. Supported formats: .glb, .gltf, .stl`);
    }
  } catch (error) {
    // If GLB/GLTF loading failed, try STL as fallback (file might be misnamed)
    if ((extension === 'glb' || extension === 'gltf') && error instanceof Error) {
      const errorMsg = error.message.toLowerCase();
      // Check if error suggests it's actually an STL file
      if (errorMsg.includes('json') || errorMsg.includes('unexpected token') || errorMsg.includes('solid')) {
        console.warn(`⚠️ GLB/GLTF loading failed, trying as STL file instead...`);
        try {
          return await loadSTLModel(path, material);
        } catch (stlError) {
          throw new Error(`Failed to load as both GLB and STL. GLB error: ${error.message}. STL error: ${stlError instanceof Error ? stlError.message : 'Unknown'}`);
        }
      }
    }
    // Re-throw original error if it's not a format mismatch issue
    throw error;
  }
}

/**
 * Scale a model to fit within a specified size
 * @param model - The Three.js model (Group or Mesh)
 * @param maxSize - Maximum size in any dimension (default: 1.0)
 */
export function scaleModelToFit(
  model: THREE.Group | THREE.Mesh,
  maxSize: number = 1.0
): void {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  
  const maxDimension = Math.max(size.x, size.y, size.z);
  if (maxDimension > 0) {
    const scale = maxSize / maxDimension;
    model.scale.multiplyScalar(scale);
    console.log(`📏 Model scaled by ${scale.toFixed(3)} to fit max size ${maxSize}`);
  }
}

/**
 * Center a model at the origin (0, 0, 0)
 * @param model - The Three.js model (Group or Mesh)
 */
export function centerModel(model: THREE.Group | THREE.Mesh): void {
  const box = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  box.getCenter(center);
  
  model.position.sub(center);
  console.log(`📍 Model centered at origin`);
}

