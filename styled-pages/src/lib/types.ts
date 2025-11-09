export interface Model {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
  scad_code?: string;
  glb_file_url?: string;
  stl_file_url?: string;
  obj_file_url?: string;
}

export interface User {
  id: string;
  username: string;
  password: string;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      models: {
        Row: Model;
        Insert: Omit<Model, 'id' | 'created_at'>;
        Update: Partial<Omit<Model, 'id' | 'created_at'>>;
      };
      users: {
        Row: User;
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>;
      };
    };
  };
}

