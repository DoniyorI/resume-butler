import "server-only";
import { HttpError } from "@/server/http";

const CERTIFICATE_ERRORS = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "SELF_SIGNED_CERT_IN_CHAIN", "DEPTH_ZERO_SELF_SIGNED_CERT",
  "CERT_HAS_EXPIRED", "ERR_TLS_CERT_ALTNAME_INVALID",
]);

export function emailConnectionError(error) {
  if (CERTIFICATE_ERRORS.has(error?.code)) return new HttpError(502,
    "The email server's TLS certificate could not be verified. This is a server trust-configuration issue; check the app server's trusted certificates and retry.");
  if (error?.code === "ETIMEDOUT") return new HttpError(503, "The email connection timed out. Please retry, or use a shorter date range.");
  if (["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "ENETUNREACH"].includes(error?.code)) return new HttpError(503,
    "The email server could not be reached. Check the connection and try again shortly.");
  if (error?.source === "authentication" || error?.textCode === "AUTHENTICATIONFAILED") return new HttpError(400,
    "The email server rejected the sign-in. Check the email address and the app password required by your provider.");
  return new HttpError(502, "The email connection failed. Please retry and review your connection settings in Inbox.");
}
