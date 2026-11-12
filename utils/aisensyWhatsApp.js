
const AISENSY_API_URL =
  "https://backend.aisensy.com/campaign/t1/api/v2";

export const sendEposterWhatsApp = async ({
  phone,
  name,
}) => {
  const apiKey = process.env.AISENSY_API_KEY;
  const campaignName = process.env.AISENSY_CAMPAIGN_NAME;

  // ========================================
  // Configuration Validation
  // ========================================

  if (!apiKey || !campaignName) {
    throw new Error("AiSensy configuration is missing");
  }

  if (!phone) {
    throw new Error("Presenter mobile number is missing");
  }

  if (!name?.trim()) {
    throw new Error("Presenter name is missing");
  }

  // ========================================
  // Normalize Indian Mobile Number
  // ========================================

  const digits = String(phone).replace(/\D/g, "");

  if (!/^\d{10}$/.test(digits)) {
    throw new Error("Invalid Indian mobile number");
  }

  const destination = `91${digits}`;

  // ========================================
  // AiSensy Payload
  // ========================================

  const payload = {
    apiKey,
    campaignName,
    destination,
    userName: name.trim(),

    templateParams: [
      name.trim(), // {{1}}
    ],
  };

  // ========================================
  // Send WhatsApp Message
  // ========================================

  const response = await fetch(AISENSY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `AiSensy request failed (${response.status}): ${responseText.slice(0, 1000)}`
    );
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return {
      response: responseText,
    };
  }
};
