#!/bin/bash
# Script to replace all alert() calls with toast notifications

# Add toast import to files that need it
add_toast_import() {
    local file="$1"
    # Check if toast import already exists
    if ! grep -q "import.*toast.*from.*shared/utils/toast" "$file" && ! grep -q "import { toast }" "$file"; then
        # Find the last import line and add toast import after it
        sed -i '' '/^import/h; ${x; s/$/\nimport { toast } from '"'"'..\/..\/src\/shared\/utils\/toast'"'"';/; p; x}' "$file" 2>/dev/null || \
        sed -i '' '1i\
import { toast } from '"'"'..\/..\/src\/shared\/utils\/toast'"'"';\
' "$file"
    fi
}

# Replace alert calls with toast
replace_alerts() {
    local file="$1"
    
    # Success messages
    sed -i '' 's/alert(\(.*success.*\|.*updated.*\|.*saved.*\|.*created.*\|.*posted.*\|.*submitted.*\|.*copied.*\))/toast.success(\1)/g' "$file"
    
    # Error/failure messages  
    sed -i '' 's/alert(\(.*[Ff]ail.*\|.*[Ee]rror.*\|.*[Ww]arning.*\))/toast.error(\1)/g' "$file"
    
    # Remaining alerts as info
    sed -i '' 's/alert(/toast.info(/g' "$file"
}

# Process files
files=(
    "components/customer/CustomerDashboard.tsx"
    "components/customer/CustomerProfile.tsx"
    "components/fixed_assets/AssetCategoryForm.tsx"
    "components/fixed_assets/AssetForm.tsx"
    "components/fixed_assets/FixedAssetsDashboard.tsx"
    "components/closing/ClosingDashboard.tsx"
    "components/UserList.tsx"
    "components/staff/StaffLoansDashboard.tsx"
    "components/staff/EmployeeList.tsx"
    "components/payables/VendorList.tsx"
    "components/wallet/WalletDashboard.tsx"
    "components/setup/OnboardingWizard.tsx"
    "components/LandingPage.tsx"
    "components/banking/WalletRequests.tsx"
    "src/app/views/JournalView.tsx"
)

cd /Users/buntha/Documents/AI/ds-advance

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "Processing $file..."
        add_toast_import "$file"
        replace_alerts "$file"
        echo "✓ Done: $file"
    else
        echo "✗ Not found: $file"
    fi
done

echo "Alert replacement complete!"
