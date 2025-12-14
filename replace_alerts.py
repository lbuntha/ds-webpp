#!/usr/bin/env python3
"""
Script to replace all alert() calls with toast notifications
"""

import os
import re
from pathlib import Path

# Files to process
files_to_update = [
    "/Users/buntha/Documents/AI/ds-advance/components/customer/CustomerDashboard.tsx",
    "/Users/buntha/Documents/AI/ds-advance/components/customer/TrackingTimeline.tsx",
    "/Users/buntha/Documents/AI/ds-advance/components/customer/CustomerProfile.tsx",
    "/Users/buntha/Documents/AI/ds-advance/components/fixed_assets/AssetCategoryForm.tsx",
    "/Users/buntha/Documents/AI/ds-advance/components/fixed_assets/AssetForm.tsx",
    "/Users/buntha/Documents/AI/ds-advance/components/fixed_assets/FixedAssetsDashboard.tsx",
    "/Users/buntha/Documents/AI/ds-advance/components/closing/ClosingDashboard.tsx",
    "/Users/buntha/Documents/AI/ds-advance/components/UserList.tsx",
    "/Users/buntha/Documents/AI/ds-advance/components/staff/StaffLoansDashboard.tsx",
    "/Users/buntha/Documents/AI/ds-advance/components/staff/EmployeeList.tsx",
    "/Users/buntha/Documents/AI/ds-advance/components/payables/VendorList.tsx",
    "/Users/buntha/Documents/AI/ds-advance/components/wallet/WalletDashboard.tsx",
    "/Users/buntha/Documents/AI/ds-advance/components/setup/OnboardingWizard.tsx",
    "/Users/buntha/Documents/AI/ds-advance/components/LandingPage.tsx",
    "/Users/buntha/Documents/AI/ds-advance/components/banking/WalletRequests.tsx",
    "/Users/buntha/Documents/AI/ds-advance/src/app/views/JournalView.tsx",
]

def add_toast_import(content):
    """Add toast import if not present"""
    if "import { toast }" in content or "import toast" in content:
        return content
    
    # Find the last import statement
    import_pattern = r'^import\s+.*?;$'
    imports = list(re.finditer(import_pattern, content, re.MULTILINE))
    
    if imports:
        last_import = imports[-1]
        insert_pos = last_import.end()
        toast_import = "\nimport { toast } from '../shared/utils/toast';"
        content = content[:insert_pos] + toast_import + content[insert_pos:]
    
    return content

def replace_alerts(content):
    """Replace alert() calls with appropriate toast calls"""
    
    # Pattern to match alert calls
    # Handles: alert('message'), alert("message"), alert(`message ${var}`)
    
    # Success messages (common success keywords)
    success_keywords = ['success', 'updated', 'saved', 'created', 'posted', 'submitted', 'copied', 'closed', 'depreciated']
    
    # Replace alerts with toast based on content
    lines = content.split('\n')
    new_lines = []
    
    for line in lines:
        if 'alert(' in line and not '// alert(' in line:
            # Extract the message
            match = re.search(r'alert\((.*?)\);?', line)
            if match:
                message = match.group(1)
                
                # Determine if it's success or error
                is_success = any(keyword in line.lower() for keyword in success_keywords)
                is_error = 'fail' in line.lower() or 'error' in line.lower() or 'warning' in line.lower()
                
                if is_success and not is_error:
                    new_line = line.replace(f'alert({message})', f'toast.success({message})')
                elif is_error:
                    new_line = line.replace(f'alert({message})', f'toast.error({message})')
                else:
                    # Default to info
                    new_line = line.replace(f'alert({message})', f'toast.info({message})')
                
                new_lines.append(new_line)
            else:
                new_lines.append(line)
        else:
            new_lines.append(line)
    
    return '\n'.join(new_lines)

def process_file(filepath):
    """Process a single file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Add import
        content = add_toast_import(content)
        
        # Replace alerts
        content = replace_alerts(content)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"✓ Processed: {filepath}")
        return True
    except Exception as e:
        print(f"✗ Error processing {filepath}: {e}")
        return False

def main():
    print("Starting alert to toast replacement...")
    success_count = 0
    
    for filepath in files_to_update:
        if os.path.exists(filepath):
            if process_file(filepath):
                success_count += 1
        else:
            print(f"✗ File not found: {filepath}")
    
    print(f"\nCompleted! Processed {success_count}/{len(files_to_update)} files")

if __name__ == "__main__":
    main()
