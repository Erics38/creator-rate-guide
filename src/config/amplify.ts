/**
 * AWS Amplify Configuration
 *
 * Configures Amplify to work with our Cognito User Pool
 * Environment variables are loaded from .env.local
 */

import { Amplify } from 'aws-amplify';

const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
      region: import.meta.env.VITE_AWS_REGION,

      // Optional: Configure sign-in options
      signUpVerificationMethod: 'code' as const, // Email verification with code

      // Optional: Password policy (should match CDK configuration)
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: false,
      },
    }
  }
};

// Configure Amplify
Amplify.configure(amplifyConfig);

export default amplifyConfig;
