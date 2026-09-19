# ECI Central sign-in handoff

Office and admin staff sign in at **central.ecinc.us** and arrive in ReviewMe
already authenticated. Foremen and managers keep the ReviewMe email and
password login on their phones. This page is the contract central must follow.

## Flow

1. ReviewMe's login page shows **Sign in with ECI Central**, which opens
   `CENTRAL_LOGIN_URL?app=reviewme&return_to=https://reviewme.ecinc.us/auth/central`.
2. Central authenticates the person however it likes.
3. Central redirects the browser to `return_to` with one query parameter:
   `?token=<JWT>`.
4. ReviewMe verifies the token, finds the ReviewMe user with that email, and
   opens its own session cookie. Central's token is never stored.

Central must only redirect to `return_to` values on hosts it trusts. ReviewMe
never sends anything else in the URL.

## The token

A compact JWT, valid for at most **10 minutes**, signed with one of:

- `HS256` using the shared secret in ReviewMe's `CENTRAL_LOGIN_SECRET`, or
- `RS256` using central's private key, with the public key in ReviewMe's
  `CENTRAL_LOGIN_PUBLIC_KEY`. Preferred once central has a key pair.

Claims, all required unless marked:

| Claim | Value |
|---|---|
| `iss` | `central.ecinc.us` (matches `CENTRAL_LOGIN_ISSUER`) |
| `aud` | `reviewme` (string, or an array that includes it) |
| `sub` | Central's stable user id |
| `email` | The person's ECI email, lower case. This is the match key. |
| `name` | Display name, optional |
| `iat` | Issued at, unix seconds |
| `exp` | Expiry, unix seconds, at most `iat + 600` |
| `jti` | Random id, unique per token. ReviewMe rejects a reused `jti`. |

Roles are **not** taken from the token. The ReviewMe admin creates each office
user and sets their roles inside ReviewMe. A valid token for an email with no
ReviewMe office account is rejected with a clear message.

## Minting a token, Node example

```js
import crypto from "node:crypto";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const header = b64({ alg: "HS256", typ: "JWT" });
const payload = b64({ iss: "central.ecinc.us", aud: "reviewme", sub: user.id, email: user.email.toLowerCase(),
  name: user.displayName, iat: now, exp: now + 300, jti: crypto.randomUUID() });
const sig = crypto.createHmac("sha256", process.env.REVIEWME_SSO_SECRET).update(`${header}.${payload}`).digest("base64url");
const token = `${header}.${payload}.${sig}`;
res.redirect(`${returnTo}?token=${encodeURIComponent(token)}`);
```

## ReviewMe environment

```
CENTRAL_LOGIN_URL="https://central.ecinc.us/sso"
CENTRAL_LOGIN_ISSUER="central.ecinc.us"
CENTRAL_LOGIN_SECRET="<same value as central's REVIEWME_SSO_SECRET>"   # or CENTRAL_LOGIN_PUBLIC_KEY
CENTRAL_LOGIN_REQUIRED="false"
```

Set `CENTRAL_LOGIN_REQUIRED="true"` once every office user has a central
account. From then on office-only accounts cannot sign in with a password;
reviewer accounts are unaffected.

## What ReviewMe rejects

Malformed token, unknown algorithm, bad signature, expired, lifetime over 10
minutes, wrong issuer or audience, missing `jti`/`sub`/`email`, a `jti` seen
before, or an email with no active ReviewMe office account. Every rejection is
written to the audit log with its reason.
