import { registerPlugin } from "@capacitor/core";

export interface AppleSignInPlugin {
  authorize(options: { nonce: string }): Promise<{
    response: {
      identityToken: string;
      user: string;
      email?: string;
      givenName?: string;
      familyName?: string;
    };
  }>;
}

export const AppleSignIn = registerPlugin<AppleSignInPlugin>("AppleSignIn");
