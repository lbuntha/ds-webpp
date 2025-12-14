
export const getFriendlyErrorMessage = (error: any): string => {
  if (typeof error === 'string') return error;
  if (!error) return "An unknown error occurred.";

  const code = error.code || '';
  const message = error.message || '';

  // Firebase Auth Errors
  if (code === 'auth/invalid-credential' || message.includes('auth/invalid-credential')) {
      return 'Invalid Email or Password.';
  }
  if (code === 'auth/user-not-found') return 'No account found with this email.';
  if (code === 'auth/wrong-password') return 'Incorrect password.';
  if (code === 'auth/email-already-in-use') return 'This email is already registered.';
  if (code === 'auth/weak-password') return 'Password should be at least 6 characters.';
  if (code === 'auth/too-many-requests') return 'Too many failed attempts. Please try again later.';
  if (code === 'auth/network-request-failed') return 'Network connection failed. Please check your internet.';
  if (code === 'auth/invalid-email') return 'Please enter a valid email address.';

  // Firestore / Permissions / Network
  if (code === 'permission-denied' || message.includes('Missing or insufficient permissions')) {
      return 'Access Denied: You do not have permission to perform this action.';
  }
  if (code === 'unavailable') {
      return 'Service temporarily unavailable. Please check your internet connection.';
  }
  if (code === 'deadline-exceeded') {
      return 'The request took too long. Please check your connection and try again.';
  }

  // Storage Errors
  if (code === 'storage/object-not-found') return 'File not found.';
  if (code === 'storage/unauthorized') return 'Permission denied for file upload.';
  if (code === 'storage/canceled') return 'Upload canceled.';
  if (message.includes('storage/')) return 'Storage Error: ' + message;

  // Logic / Custom Errors
  if (message) return message;

  return "An unexpected error occurred. Please try again.";
};
