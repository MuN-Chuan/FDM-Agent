import os
import sys
import json
import shutil
import tkinter as tk
from tkinter import filedialog, messagebox

def find_bambu_studio_user_dirs():
    """Finds all user profile directories in Bambu Studio AppData."""
    appdata = os.environ.get('APPDATA')
    if not appdata:
        return []
    
    bambu_user_dir = os.path.join(appdata, 'BambuStudio', 'user')
    if not os.path.exists(bambu_user_dir):
        return []
    
    user_dirs = []
    # Find all numbered subdirectories and 'default'
    for item in os.listdir(bambu_user_dir):
        full_path = os.path.join(bambu_user_dir, item)
        if os.path.isdir(full_path) and (item.isdigit() or item == 'default'):
            user_dirs.append(full_path)
            
    return user_dirs

def identify_preset_type(file_path):
    """Identifies the preset type from the JSON content."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get('type')
    except Exception as e:
        print(f"Error reading JSON: {e}")
        return None

def import_preset(file_path):
    preset_type = identify_preset_type(file_path)
    
    if not preset_type:
        messagebox.showerror("Error", "Invalid preset file or missing 'type' field in JSON.")
        return False
        
    valid_types = ['machine', 'process', 'filament']
    if preset_type not in valid_types:
        messagebox.showerror("Error", f"Unsupported preset type: {preset_type}.\nOnly machine, process, and filament are supported.")
        return False
        
    user_dirs = find_bambu_studio_user_dirs()
    if not user_dirs:
        messagebox.showerror("Error", "Bambu Studio user directory not found.\nPlease make sure Bambu Studio is installed and has been run at least once.")
        return False
        
    file_name = os.path.basename(file_path)
    success_paths = []
    
    for user_dir in user_dirs:
        target_dir = os.path.join(user_dir, preset_type)
        if not os.path.exists(target_dir):
            os.makedirs(target_dir)
            
        target_file = os.path.join(target_dir, file_name)
        try:
            shutil.copy2(file_path, target_file)
            success_paths.append(target_file)
        except Exception as e:
            print(f"Failed to copy to {target_file}: {e}")
            
    if success_paths:
        messagebox.showinfo("Success", f"Preset '{file_name}' ({preset_type}) successfully imported to {len(success_paths)} profile(s)!\n\nPlease restart Bambu Studio to see the changes.")
        return True
    else:
        messagebox.showerror("Error", "Failed to import preset.")
        return False

def select_file():
    file_path = filedialog.askopenfilename(
        title="Select Bambu Studio Preset",
        filetypes=(("JSON files", "*.json"), ("All files", "*.*"))
    )
    if file_path:
        import_preset(file_path)

def main():
    root = tk.Tk()
    root.title("Bambu Studio AI Preset Importer")
    root.geometry("400x200")
    root.resizable(False, False)
    
    # UI Elements
    lbl_title = tk.Label(root, text="Bambu Studio Preset Importer", font=("Helvetica", 14, "bold"))
    lbl_title.pack(pady=20)
    
    lbl_desc = tk.Label(root, text="Click below to upload and automatically import\na preset (.json) into Bambu Studio.", justify=tk.CENTER)
    lbl_desc.pack(pady=5)
    
    btn_import = tk.Button(root, text="Upload Preset", command=select_file, bg="#0078D7", fg="white", font=("Helvetica", 12), width=15)
    btn_import.pack(pady=20)
    
    root.mainloop()

if __name__ == "__main__":
    main()
