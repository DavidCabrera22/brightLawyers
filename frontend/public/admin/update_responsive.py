
import glob
import re
import os

files = glob.glob('frontend/public/admin/*.html')

print(f"Found {len(files)} files.")

for file in files:
    print(f"Processing {file}...")
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # 1. Update Sidebar
    # Find <aside class="w-64 ...">
    # Replace with <aside id="sidebar" class="w-64 ... fixed inset-y-0 left-0 transform -translate-x-full transition-transform duration-300 md:relative md:translate-x-0">
    
    # We look for the start of the aside tag up to the class attribute
    # The class attribute is long and might vary slightly in spacing, so we use regex
    # But usually it's consistent in this codebase.
    
    sidebar_pattern = r'<aside class="w-64 bg-brand-dark text-white flex flex-col z-20 shadow-xl flex-shrink-0">'
    sidebar_replacement = '<aside id="sidebar" class="w-64 bg-brand-dark text-white flex flex-col z-30 shadow-xl flex-shrink-0 fixed inset-y-0 left-0 transform -translate-x-full transition-transform duration-300 md:relative md:translate-x-0">'
    
    if sidebar_pattern in content:
        content = content.replace(sidebar_pattern, sidebar_replacement)
    else:
        # Try a more flexible regex if exact string match fails
        content = re.sub(
            r'<aside class="w-64 bg-brand-dark text-white flex flex-col z-20 shadow-xl flex-shrink-0">',
            sidebar_replacement,
            content
        )

    # 2. Update Header Padding and Add Button
    # Look for the header tag
    # <header class="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0 z-10">
    
    header_start_pattern = r'(<header class="[^"]*?)px-8([^"]*?">)'
    
    def header_replacer(match):
        return f'{match.group(1)}px-4 md:px-8{match.group(2)}'
    
    content = re.sub(header_start_pattern, header_replacer, content)

    # Insert Hamburger Button
    # We want to insert it before the <h2>Title</h2>.
    # Pattern: <h2 class="text-lg font-bold text-slate-800">...</h2>
    # We wrap it in a div with the button.
    
    if 'onclick="toggleSidebar()"' not in content:
        # Check if h2 exists
        h2_pattern = r'(<h2 class="text-lg font-bold text-slate-800">.*?</h2>)'
        
        def h2_replacer(match):
            return f'''<div class="flex items-center gap-4">
                <button onclick="toggleSidebar()" class="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                    <span class="material-symbols-outlined">menu</span>
                </button>
                {match.group(1)}
            </div>'''
            
        content = re.sub(h2_pattern, h2_replacer, content, count=1)

    # 3. Add Overlay
    if 'id="sidebar-overlay"' not in content:
        overlay_html = '<div id="sidebar-overlay" onclick="toggleSidebar()" class="fixed inset-0 bg-black/50 z-20 hidden md:hidden backdrop-blur-sm transition-opacity"></div>'
        content = content.replace('</body>', f'{overlay_html}\n</body>')

    # 4. Add JS
    if 'function toggleSidebar()' not in content:
        js_code = """
    <script>
        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            sidebar.classList.toggle('-translate-x-full');
            overlay.classList.toggle('hidden');
        }
    </script>
"""
        content = content.replace('</body>', f'{js_code}\n</body>')

    # 5. Update Content Padding
    # <div class="flex-1 overflow-y-auto p-8">
    content = content.replace('<div class="flex-1 overflow-y-auto p-8">', '<div class="flex-1 overflow-y-auto p-4 md:p-8">')

    # 6. Ensure Tables are Scrollable
    # This is a bit safer: if we find a table that is NOT inside an overflow-x-auto div, we warn or try to fix.
    # For now, let's just rely on existing structure + the sidebar fix which is the main responsiveness blocker.
    # However, if main content is p-4, table might overflow.
    # Let's globally replace `overflow-hidden` with `overflow-x-auto` on the card containers if they contain tables?
    # No, that affects y-scroll.
    # Let's leave tables for now unless specific issue found. Most seem to have overflow handling.

    if content != original_content:
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {file}")
    else:
        print(f"No changes for {file}")

print("Done.")
