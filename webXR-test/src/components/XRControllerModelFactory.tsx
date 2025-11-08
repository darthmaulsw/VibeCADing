import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';

interface XRControllerModelFactoryProps {
  controller: THREE.XRTargetRaySpace | THREE.XRGripSpace | THREE.XRHandSpace;
  onModelLoaded?: (model: THREE.Group) => void;
}

/**
 * XRControllerModelFactory Component
 * 
 * Loads and displays 3D models for WebXR controllers.
 * This component handles the creation and attachment of controller models
 * to XR controller spaces (target ray, grip, or hand).
 */
export const XRControllerModelFactoryComponent: React.FC<XRControllerModelFactoryProps> = ({
  controller,
  onModelLoaded,
}) => {
  const modelRef = useRef<THREE.Group | null>(null);
  const factoryRef = useRef<XRControllerModelFactory | null>(null);

  useEffect(() => {
    if (!controller) return;

    // Create the factory instance
    if (!factoryRef.current) {
      factoryRef.current = new XRControllerModelFactory();
    }

    const factory = factoryRef.current;

    // Load the controller model
    factory.loadControllerModel(controller).then((model) => {
      if (model) {
        // Remove existing model if present
        if (modelRef.current) {
          controller.remove(modelRef.current);
        }

        // Add the new model to the controller
        controller.add(model);
        modelRef.current = model;

        // Notify parent component
        if (onModelLoaded) {
          onModelLoaded(model);
        }
      }
    }).catch((error) => {
      console.error('Error loading controller model:', error);
    });

    // Cleanup function
    return () => {
      if (modelRef.current) {
        controller.remove(modelRef.current);
        modelRef.current = null;
      }
    };
  }, [controller, onModelLoaded]);

  // This component doesn't render anything directly
  // It manages the 3D model attachment to the controller
  return null;
};

export default XRControllerModelFactoryComponent;

