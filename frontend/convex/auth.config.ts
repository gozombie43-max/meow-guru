import type { AuthConfig } from "convex/server";

const issuer = process.env.CONVEX_JWT_ISSUER;
const jwks = process.env.CONVEX_JWT_JWKS_URL;
const applicationID = process.env.CONVEX_JWT_AUDIENCE;

if (!issuer || !jwks || !applicationID) {
  throw new Error(
    "Missing Convex JWT authentication configuration"
  );
}

const authConfig = {
  providers: [
    {
      type: "customJwt",
      algorithm: "ES256",
      issuer,
      jwks,
      applicationID,
    },
  ],
} satisfies AuthConfig;

export default authConfig;
