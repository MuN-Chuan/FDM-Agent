import sys

filepath = r"c:\Users\27822\Documents\FDM_AI_WEB\frontend\src\pages\AIChatPage.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    # Patch 1: handleGenericFile intercept
    if "try {" in line and i > 0 and "for (const file of files) {" in lines[i-1]:
        indent = line[:len(line) - len(line.lstrip())]
        new_lines.append(indent + "if (file.name.toLowerCase().endsWith('.3mf')) {\n")
        new_lines.append(indent + "    alert('请使用聊天框下方的 \"3MF 预设优化\" 专属按钮上传 3MF 文件。');\n")
        new_lines.append(indent + "    continue;\n")
        new_lines.append(indent + "}\n")

    # Patch 2: insert onOpenSlicerModal
    if "onOpenDefectRecognition={() => setIsDefectModalOpen(true)}" in line:
        new_lines.append(line)
        indent = line[:len(line) - len(line.lstrip())]
        new_lines.append(indent + "onOpenSlicerModal={() => setIsSlicerModalOpen(true)}\n")
        continue

    new_lines.append(line)

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Patch applied successfully.")
