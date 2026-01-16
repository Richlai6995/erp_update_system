export interface Group {
    id: number;
    name: string;
    description?: string;
}

export interface Folder {
    id: number;
    project_id: number;
    parent_id: number | null;
    name: string;
    drive_folder_id?: string;
    created_at?: string;
}

export interface User {
    id: number;
    username: string;
    name: string;
    email?: string;
    employee_id?: string;
    role?: 'user' | 'pm' | 'admin' | 'dba' | 'manager';
    department?: string;
    start_date?: string;
    end_date?: string;
    is_active: boolean;
}

export interface AuthResponse {
    token: string;
    user: User;
}

export interface ERPModule {
    id: number;
    name: string;
    code: string;
    form_path: string;
    report_path: string;
    path_code?: string; // Optional for now, but should be populated
}

export interface LoginError {
    error: string;
}
