import { supabase } from './supabase';
import type { Model } from './types';

/**
 * Quick save - just stores the Hunyuan GLB URL directly
 * No file download/upload = super fast, no timeouts
 */
export async function quickSaveModel(
  glbUrl: string,
  name: string,
  userId: string
): Promise<Model | null> {
  try {
    console.log('📝 Quick saving model to database...');
    console.log('   URL:', glbUrl);
    console.log('   User:', userId);

    const { data, error } = await supabase
      .from('models')
      .insert({
        name,
        user_id: userId,
        glb_file_url: glbUrl,  // Store Hunyuan URL directly
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Database error:', error);
      return null;
    }

    console.log('✅ Model saved successfully:', data);
    return data as Model;
  } catch (error) {
    console.error('❌ Quick save failed:', error);
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

    return (data as Model[]) || [];
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
    const { error } = await supabase
      .from('models')
      .delete()
      .eq('id', modelId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting model:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteModel:', error);
    return false;
  }
}

