"use strict";

/**
 * Supabase Edge Function에 접근 토큰을 보내 새 10분 다운로드 주소를 받습니다.
 * @param {string} token QR에 담긴 24시간 접근 토큰
 * @returns {Promise<string>} 서버가 발급한 서명 다운로드 주소
 */
async function getSignedDownloadUrl(token) {
  if (
    typeof SUPABASE_URL !== "string"
    || typeof SUPABASE_KEY !== "string"
    || !SUPABASE_URL.trim()
    || !SUPABASE_KEY.trim()
    || SUPABASE_URL === "여기에-내-프로젝트주소"
    || SUPABASE_KEY === "여기에-내-키"
  ) {
    throw new Error("Supabase 연결 설정을 확인할 수 없습니다.");
  }

  var response = await fetch(
    SUPABASE_URL.replace(/\/+$/, "") + "/functions/v1/download-photo",
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ token: token })
    }
  );
  var result;

  try {
    result = await response.json();
  } catch (error) {
    throw new Error("사진 서버 응답을 읽지 못했어요. 다시 시도해 주세요.");
  }

  if (!response.ok) {
    if (response.status === 410) {
      throw new Error("QR 링크가 만료됐거나 올바르지 않아요. 촬영 화면에서 새 QR을 만들어 주세요.");
    }
    if (response.status === 429) {
      throw new Error("요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.");
    }
    throw new Error(result && result.error
      ? result.error
      : "사진 주소를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  }

  if (
    !result
    || typeof result !== "object"
    || typeof result.signedUrl !== "string"
    || result.expiresInSeconds !== 600
  ) {
    throw new Error("안전한 다운로드 주소를 받지 못했어요. 다시 시도해 주세요.");
  }

  var signedUrl;
  try {
    signedUrl = new URL(result.signedUrl);
  } catch (error) {
    throw new Error("안전한 다운로드 주소를 받지 못했어요. 다시 시도해 주세요.");
  }

  if (
    signedUrl.origin !== new URL(SUPABASE_URL).origin
    || !signedUrl.pathname.includes("/storage/v1/object/sign/photos/")
  ) {
    throw new Error("예상하지 못한 사진 주소를 거부했어요.");
  }

  return signedUrl.toString();
}

/**
 * 다운로드 화면에서 QR 토큰을 확인하고, 버튼 동작을 연결합니다.
 * @returns {void} 화면과 다운로드 버튼을 준비합니다.
 */
function initPhotoPage() {
  var status = document.getElementById("photo-status");
  var downloadButton = document.getElementById("photo-download-button");
  var token = new URLSearchParams(window.location.search).get("token") || "";

  // 토큰을 화면 주소창에 계속 남기지 않습니다.
  window.history.replaceState(null, "", window.location.pathname);

  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    status.textContent = "QR 링크가 없거나 올바르지 않아요. 촬영 화면에서 새 QR을 만들어 주세요.";
    downloadButton.disabled = true;
    return;
  }

  downloadButton.disabled = false;

  // 누를 때마다 서버에서 새 10분 다운로드 주소를 요청합니다.
  downloadButton.addEventListener("click", async function () {
    if (downloadButton.disabled) {
      return;
    }

    downloadButton.disabled = true;
    status.textContent = "다운로드 주소를 확인하고 있어요.";

    try {
      var signedUrl = await getSignedDownloadUrl(token);
      status.textContent = "사진 다운로드를 시작합니다.";
      window.location.assign(signedUrl);
    } catch (error) {
      console.error("사진 다운로드 준비에 실패했습니다.", error);
      status.textContent = error && error.message
        ? error.message
        : "사진을 다운로드하지 못했어요. 다시 시도해 주세요.";
      downloadButton.disabled = false;
    }
  });
}

// HTML 요소와 설정 파일이 모두 준비된 뒤 다운로드 버튼을 연결합니다.
document.addEventListener("DOMContentLoaded", initPhotoPage);
