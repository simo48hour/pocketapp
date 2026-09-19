// PocketBase Hook to handle Google One Tap authentication
// Verifies the Google ID token with Google's tokeninfo API and signs in/creates the user record,
// returning the official PocketBase auth response.

routerAdd("POST", "/api/google-one-tap", (e) => {
  let credential = "";

  try {
    const data = { credential: "" };
    e.bindBody(data);
    credential = (data && data.credential) ? String(data.credential).trim() : "";
  } catch (bindErr) {
    console.warn("[Google One Tap] bindBody error:", bindErr);
  }

  if (!credential) {
    try {
      const reqInfo = e.requestInfo ? e.requestInfo() : null;
      if (reqInfo && reqInfo.body && reqInfo.body.credential) {
        credential = String(reqInfo.body.credential).trim();
      }
    } catch (_) {}
  }

  if (!credential) {
    return e.json(400, { error: "Missing Google credential token" });
  }

  // Verify Google ID token via Google OAuth2 tokeninfo endpoint
  let verifyRes;
  try {
    verifyRes = $http.send({
      url: "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential),
      method: "GET",
      timeout: 10,
    });
  } catch (httpErr) {
    console.error("[Google One Tap] Failed to contact Google tokeninfo:", httpErr);
    return e.json(502, { error: "Failed to verify token with Google" });
  }

  if (verifyRes.statusCode !== 200) {
    console.warn("[Google One Tap] Google tokeninfo rejected token with status: " + verifyRes.statusCode);
    return e.json(401, { error: "Invalid Google token" });
  }

  const payload = verifyRes.json;

  if (!payload || !payload.email) {
    return e.json(401, { error: "Invalid Google token payload" });
  }

  const isVerified = payload.email_verified === true || payload.email_verified === "true";

  if (!isVerified) {
    return e.json(401, { error: "Google email is not verified" });
  }

  // Validate audience against configured GOOGLE_CLIENT_ID if present
  const expectedClientId = $os.getenv("GOOGLE_CLIENT_ID");

  if (expectedClientId && expectedClientId.trim() !== "") {
    if (payload.aud !== expectedClientId.trim()) {
      console.warn("[Google One Tap] Client ID mismatch: " + payload.aud + " vs " + expectedClientId);
      return e.json(401, { error: "Google Client ID mismatch" });
    }
  }

  const email = payload.email.toLowerCase().trim();
  const name = payload.name || payload.given_name || email.split("@")[0];
  const avatarUrl = payload.picture || "";

  // Lookup existing user by email
  let record = null;

  try {
    record = $app.findAuthRecordByEmail("users", email);
  } catch (_) {}

  if (!record) {
    try {
      record = $app.findFirstRecordByData("users", "email", email);
    } catch (_) {}
  }

  if (!record) {
    // Create new user record
    const usersCol = $app.findCollectionByNameOrId("users");
    record = new Record(usersCol);
    record.set("email", email);
    record.set("verified", true);
    record.set("name", name);

    try {
      record.setEmail(email);
      record.setVerified(true);
    } catch (_) {}

    try {
      if (record.hasField && record.hasField("avatarUrl")) {
        record.set("avatarUrl", avatarUrl);
      }
    } catch (_) {}

    const randomPassword = $security.randomString(32);
    record.set("password", randomPassword);
    record.set("passwordConfirm", randomPassword);
    try {
      record.setPassword(randomPassword);
    } catch (_) {}

    try {
      $app.save(record);
    } catch (saveErr) {
      console.warn("[Google One Tap] Standard save failed, falling back to saveNoValidate:", saveErr);
      $app.saveNoValidate(record);
    }
    console.log("[Google One Tap] Created new user: " + email);
  } else {
    // Update name or avatar if not set
    let shouldSave = false;

    if (!record.get("name") && name) {
      record.set("name", name);
      shouldSave = true;
    }

    try {
      if (record.hasField && record.hasField("avatarUrl") && !record.get("avatarUrl") && avatarUrl) {
        record.set("avatarUrl", avatarUrl);
        shouldSave = true;
      }
    } catch (_) {}

    if (shouldSave) {
      try {
        $app.save(record);
      } catch (saveErr) {
        console.warn("[Google One Tap] Failed to update user metadata:", saveErr);
      }
    }
  }

  // Generate and return PocketBase standard auth response
  const meta = {
    avatarUrl: avatarUrl,
    name: name,
    email: email,
  };

  try {
    return $apis.recordAuthResponse(e, record, "oauth2", meta);
  } catch (_) {
    return $apis.recordAuthResponse(e, record, "oauth2");
  }
});
