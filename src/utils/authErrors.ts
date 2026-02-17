/**
 * Translates Firebase Auth error codes into user-friendly messages
 */
export function getAuthErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'An unexpected error occurred. Please try again.';
  }

  const errorMessage = error.message;

  // Extract Firebase error code from message like "Firebase: Error (auth/invalid-credential)."
  const match = errorMessage.match(/auth\/([a-z-]+)/);
  const errorCode = match ? match[1] : null;

  const errorMessages: Record<string, string> = {
    // Email/Password Signup Errors
    'email-already-in-use': 'This email is already registered. Please sign in or use a different email.',
    'invalid-email': 'Please enter a valid email address.',
    'weak-password': 'Password is too weak. Please use at least 6 characters.',
    'operation-not-allowed': 'This sign-in method is not enabled. Please contact support.',

    // Sign-in Errors
    'invalid-credential': 'Invalid email or password. Please check your credentials and try again.',
    'user-disabled': 'This account has been disabled. Please contact support.',
    'user-not-found': 'No account found with this email. Please sign up first.',
    'wrong-password': 'Incorrect password. Please try again.',
    'invalid-login-credentials': 'Invalid email or password. Please check your credentials and try again.',

    // Google Sign-in Errors
    'popup-closed-by-user': 'Sign-in was cancelled. Please try again.',
    'popup-blocked': 'Pop-up was blocked by your browser. Please allow pop-ups and try again.',
    'account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',

    // Anonymous/Guest Errors
    'anonymous-provider-disabled': 'Guest sign-in is not available. Please use email or Google sign-in.',

    // Network Errors
    'network-request-failed': 'Network error. Please check your internet connection and try again.',
    'too-many-requests': 'Too many failed attempts. Please wait a few minutes and try again.',

    // General Errors
    'internal-error': 'An internal error occurred. Please try again later.',
    'requires-recent-login': 'Please sign out and sign in again to perform this action.',
  };

  if (errorCode && errorMessages[errorCode]) {
    return errorMessages[errorCode];
  }

  // Fallback for unknown errors
  return 'Unable to complete sign-in. Please try again or contact support.';
}
