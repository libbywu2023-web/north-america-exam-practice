
const AZURE_TRANSLATOR_ENDPOINT =
  "https://api.cognitive.microsofttranslator.com/translate";

const API_VERSION = "3.0";
// Website language codes → Azure Translator language codes
const AZURE_LANGUAGE_CODES = {
  "zh-CN": "zh-Hans",
  "zh-TW": "zh-Hant",
};

function getAzureLanguageCode(languageCode) {
  if (languageCode === "en") {
    throw new Error("English is the source language and does not need translation.");
  }

  return AZURE_LANGUAGE_CODES[languageCode] || languageCode;
}

/**
 * 将一组文本翻译成指定语言。
 *
 * @param {string[]} texts 待翻译文本
 * @param {string} targetLanguage 目标语言代码，例如 zh-Hans、zh-Hant、fr
 * @param {object} env Cloudflare Worker 环境变量
 * @returns {Promise<string[]>} 翻译结果，与输入顺序对应
 */
export async function translateTexts(texts, targetLanguage, env) {
  if (!Array.isArray(texts)) {
    throw new Error("texts must be an array.");
  }

  if (!texts.length) return [];

  if (!targetLanguage) {
    throw new Error("Target language is required.");
  }

  // 空文本不需要调用 API
  const results = texts.map((text) => text ?? "");
  const indexes = [];

  texts.forEach((text, index) => {
    if (typeof text === "string" && text.trim()) {
      indexes.push(index);
    }
  });

  if (!indexes.length) return results;

  if (!env?.AZURE_TRANSLATOR_KEY) {
    throw new Error("Azure Translator API key is not configured.");
  }

  if (!env?.AZURE_TRANSLATOR_REGION) {
    throw new Error("Azure Translator region is not configured.");
  }

  const requestTexts = indexes.map((index) => ({
    Text: texts[index],
  }));

  const url = new URL(AZURE_TRANSLATOR_ENDPOINT);
  url.searchParams.set("api-version", API_VERSION);
  url.searchParams.set("to", getAzureLanguageCode(targetLanguage));

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": env.AZURE_TRANSLATOR_KEY,
      "Ocp-Apim-Subscription-Region": env.AZURE_TRANSLATOR_REGION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestTexts),
  });

  if (!response.ok) {
    // 不输出密钥，也不把请求头写入日志
    throw new Error(
      `Azure Translator request failed with HTTP ${response.status}.`
    );
  }

  const data = await response.json();

  if (!Array.isArray(data) || data.length !== indexes.length) {
    throw new Error("Azure Translator returned an unexpected response.");
  }

  data.forEach((item, resultIndex) => {
    const translatedText = item?.translations?.[0]?.text;

    if (typeof translatedText !== "string") {
      throw new Error("Azure Translator returned an invalid translation.");
    }

    results[indexes[resultIndex]] = translatedText;
  });

  return results;
}

/**
 * 翻译单条文本。
 */
export async function translateText(text, targetLanguage, env) {
  if (typeof text !== "string" || !text.trim()) {
    return "";
  }

  const results = await translateTexts(
    [text],
    targetLanguage,
    env
  );

  return results[0];
}
