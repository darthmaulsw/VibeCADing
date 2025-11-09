import { supabase } from './supabase';
import type { Model } from './types';

/**
 * Download a GLB/STL file from URL and convert to File object
 */
async function downloadModelFile(url: string, filename: string): Promise<File> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type });
}


/**
 * Upload a 3D model file to Supabase Storage
 */
export async function uploadModelFile(
  file: File,
  userId: string
): Promise<{ url: string; size: number } | null> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('models')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Error uploading file:', error);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('models')
      .getPublicUrl(data.path);

    return {
      url: publicUrl,
      size: file.size
    };
  } catch (error) {
    console.error('Error in uploadModelFile:', error);
    return null;
  }
}

/**
 * Save a model from external URL (like Hunyuan) to database
 */
export async function saveModelFromUrl(
  url: string,
  name: string,
  userId: string
): Promise<Model | null> {
  try {
    // Download the model file
    const fileExt = url.includes('.glb') ? 'glb' : 'stl';
    const fileName = `${name}.${fileExt}`;
    const file = await downloadModelFile(url, fileName);

    // Upload to Supabase Storage
    const uploadResult = await uploadModelFile(file, userId);
    if (!uploadResult) {
      console.error('Failed to upload model file');
      return null;
    }

    // Save to database with appropriate file URL field
    const insertData: any = {
      name,
      user_id: userId,
    };
    
    // Set the appropriate URL field based on file type
    if (fileExt === 'glb') {
      insertData.glb_file_url = uploadResult.url;
    } else {
      insertData.stl_file_url = uploadResult.url;
    }

    const { data, error } = await supabase
      .from('models')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error saving model to database:', error);
      return null;
    }

    return data as Model;
  } catch (error) {
    console.error('Error in saveModelFromUrl:', error);
    return null;
  }
}

/**
 * Get all models for a user
 */
export async function getUserModels(userId: string): Promise<Model[]> {
  try {
    const { data, error } = await supabase
      .from('models')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching models:', error);
      return [];
    }

    return data as Model[];
  } catch (error) {
    console.error('Error in getUserModels:', error);
    return [];
  }
}

/**
 * Delete a model
 */
export async function deleteModel(modelId: string, userId: string): Promise<boolean> {
  try {
    // Get the model to find the file paths
    const { data: model, error: fetchError } = await supabase
      .from('models')
      .select('glb_file_url, stl_file_url')
      .eq('id', modelId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !model) {
      console.error('Error fetching model:', fetchError);
      return false;
    }

    // Delete files from storage
    const filesToDelete: string[] = [];
    
    if (model.glb_file_url) {
      const url = new URL(model.glb_file_url);
      const pathParts = url.pathname.split('/');
      const filePath = pathParts.slice(pathParts.indexOf('models') + 1).join('/');
      filesToDelete.push(filePath);
    }
    
    if (model.stl_file_url) {
      const url = new URL(model.stl_file_url);
      const pathParts = url.pathname.split('/');
      const filePath = pathParts.slice(pathParts.indexOf('models') + 1).join('/');
      filesToDelete.push(filePath);
    }

    if (filesToDelete.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('models')
        .remove(filesToDelete);

      if (storageError) {
        console.error('Error deleting files from storage:', storageError);
      }
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('models')
      .delete()
      .eq('id', modelId)
      .eq('user_id', userId);

    if (dbError) {
      console.error('Error deleting model from database:', dbError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteModel:', error);
    return false;
  }
}

