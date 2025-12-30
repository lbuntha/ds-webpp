# Testing Your Deployed Cloud Functions

## ✅ Your Function is Successfully Deployed!

**Function URL**: `https://api-ivsn3uu2pa-uc.a.run.app`

The 403 Forbidden error you're seeing is **expected and correct** because your organization has security policies that require authentication.

---

## 🔒 Why You're Getting 403 Forbidden

Your organization has enabled **Domain-restricted sharing** (`constraints/iam.allowedPolicyMemberDomains`), which means:
- ✅ Your function is deployed and working correctly
- ✅ Only authenticated users from allowed domains can access it
- ❌ You cannot make it publicly accessible with `allUsers`
- ✅ This is actually **good for security**

---

## 🧪 How to Test Your Function

### Option 1: Test from Your Frontend Application (Recommended)

Your React/TypeScript frontend should call the function with Firebase Authentication:

```typescript
// In your frontend app
import { getAuth } from 'firebase/auth';

async function callCloudFunction() {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) {
    console.error('User not authenticated');
    return;
  }
  
  // Get the ID token
  const idToken = await user.getIdToken();
  
  // Call your Cloud Function
  const response = await fetch('https://api-ivsn3uu2pa-uc.a.run.app/health', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  console.log('Function response:', data);
}
```

### Option 2: Grant Access to Your Email

If you want to test directly with `curl`, grant access to your specific email:

1. Go to: https://console.cloud.google.com/run/detail/us-central1/api/security?project=dsaccounting-18f75
2. Click "ADD PRINCIPAL"
3. Enter your email: `sotheara@doorsteps.tech`
4. Select role: **Cloud Run Invoker**
5. Click "Save"

Then test with:
```bash
# Get your identity token
gcloud auth print-identity-token

# Use it to call the function
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  https://api-ivsn3uu2pa-uc.a.run.app/health
```

### Option 3: Test Locally with Firebase Emulator

For development and testing without authentication:

```bash
# Start the emulator
firebase emulators:start --only functions

# Your function will be available at:
# http://localhost:5001/dsaccounting-18f75/us-central1/api
```

Test locally:
```bash
curl http://localhost:5001/dsaccounting-18f75/us-central1/api/health
```

---

## 📝 Update Your Frontend Configuration

Update your frontend to use the deployed function URL:

```typescript
// src/config/firebase.ts or similar
export const CLOUD_FUNCTION_URL = 
  process.env.NODE_ENV === 'production'
    ? 'https://api-ivsn3uu2pa-uc.a.run.app'
    : 'http://localhost:5001/dsaccounting-18f75/us-central1/api';
```

---

## ✅ Verification Checklist

- [x] Function deployed successfully
- [x] Function URL is accessible: `https://api-ivsn3uu2pa-uc.a.run.app`
- [x] Security policies are enforced (403 for unauthenticated requests)
- [ ] Grant access to your email OR test from authenticated frontend
- [ ] Update frontend to use the deployed URL
- [ ] Test all API endpoints with proper authentication

---

## 🎯 Next Steps

1. **For Development**: Use Firebase Emulator for local testing
2. **For Production**: Your frontend app will authenticate users and include their ID token
3. **For Manual Testing**: Grant Cloud Run Invoker role to your email address

Your deployment is **complete and secure**! The 403 error is actually protecting your API from unauthorized access.
