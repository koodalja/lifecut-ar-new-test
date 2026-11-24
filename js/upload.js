"use strict";

/**
 * 사진 보관 Edge Function을 호출하고 JSON 응답을 안전하게 확인합니다.
 * @param {string} functionName 호출할 서버 함수 이름
 * @param {BodyInit} body 서버에 보낼 사진 또는 JSON
 * @param {string} contentType 요청 자료의 형식
 * @returns {Promise<object>} 서버가 돌려준 응답 자료
 */
async function callPhotoFunction(functionName, body, contentType) {
  if (
    typeof SUPABASE_URL !== "string"
    || typeof SUPABASE_KEY !== "string"
    || !SUPABASE_URL.trim()
    || !SUPABASE_KEY.trim()
    || SUPABASE_URL === "여기에-내-프로젝트주소"
    || SUPABASE_KEY === "여기에-내-키"
  ) {
    throw new Error("js/config.js 에 내 Supabase 주소와 공개 키를 먼저 넣어 주세요");
  }

  var functionUrl = SUPABASE_URL.replace(/\/+$/, "")
    + "/functions/v1/" + functionName;
  var response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": contentType
    },
    body: body
  });
  var result;

  try {
    result = await response.json();
  } catch (error) {
    throw new Error("사진 서버 응답을 읽지 못했어요. 잠시 후 다시 시도해 주세요.");
  }

  if (!response.ok) {
    throw new Error(result && result.error
      ? result.error
      : "사진 서버 요청에 실패했어요. 잠시 후 다시 시도해 주세요.");
  }

  return result;
}

/**
 * 현재 GitHub Pages 경로 아래에 24시간 접근 토큰을 넣은 QR 화면 주소를 만듭니다.
 * @param {string} token 서버가 발급한 접근 토큰
 * @returns {string} 테스트·정식 사이트 경로에서 열리는 사진 화면 주소
 */
function makePhotoPageUrl(token) {
  var pageUrl = new URL("photo.html", document.baseURI);
  pageUrl.searchParams.set("token", token);
  return pageUrl.toString();
}

/**
 * 완성 사진을 비공개 버킷에 올리고 24시간 QR 화면 주소를 돌려줍니다.
 * @param {HTMLCanvasElement} canvas 업로드할 완성 사진 캔버스
 * @returns {Promise<string>} 토큰을 포함한 사진 다운로드 화면 주소
 */
async function uploadPhoto(canvas) {
  var blob = await new Promise(function (resolve) {
    canvas.toBlob(resolve, "image/jpeg", 0.9);
  });

  if (!blob) {
    throw new Error("사진 파일을 만들지 못했어요. 다시 시도해 주세요.");
  }

  var result = await callPhotoFunction("upload-photo", blob, "image/jpeg");
  if (
    !result
    || typeof result !== "object"
    || typeof result.token !== "string"
    || !/^[A-Za-z0-9_-]{43}$/.test(result.token)
  ) {
    throw new Error("사진 접근 토큰을 받지 못했어요. 다시 시도해 주세요.");
  }

  return makePhotoPageUrl(result.token);
}

/**
 * 지정한 화면 요소를 비우고 사진 주소의 200×200 QR 코드를 그립니다.
 * @param {HTMLElement} element QR 코드를 표시할 요소
 * @param {string} url QR 코드에 담을 24시간 사진 화면 주소
 * @returns {void} QR 코드를 화면에 표시합니다.
 */
function drawQrCode(element, url) {
  element.replaceChildren();
  new QRCode(element, {
    text: url,
    width: 200,
    height: 200
  });
}
