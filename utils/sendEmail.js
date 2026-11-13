
import { SendMailClient } from "zeptomail";
import dotenv from "dotenv";

dotenv.config();

const client = new SendMailClient({
  url: process.env.ZEPTO_URL,
  token: process.env.ZEPTO_TOKEN,
});

const CC_RECIPIENTS = [
  "adilsaascraft@gmail.com",
];

const sendEposterEmail = async ({
  to,
  name,
  posterTitle,
  uploadPosterUrl,
  templateKey,
}) => {
  try {
    if (!templateKey) {
      throw new Error("EPoster email template key is missing.");
    }

    if (!to) {
      throw new Error("Recipient email is required.");
    }

    if (!name?.trim()) {
      throw new Error("Presenter name is required.");
    }

    if (!posterTitle?.trim()) {
      throw new Error("Poster title is required.");
    }

    if (!uploadPosterUrl?.trim()) {
      throw new Error("Poster download URL is required.");
    }

    const response = await client.sendMailWithTemplate({
      mail_template_key: templateKey,

      from: {
        address: process.env.ZEPTO_FROM,
        name: "AROICON 2026",
      },

      to: [
        {
          email_address: {
            address: to.trim(),
            name: name.trim(),
          },
        },
      ],

      cc: CC_RECIPIENTS.map((email) => ({
        email_address: {
          address: email,
        },
      })),

      merge_info: {
        presenterName: name.trim(),
        posterTitle: posterTitle.trim(),
        uploadPosterUrl: uploadPosterUrl.trim(),
      },
    });

    return response;
  } catch (error) {
    console.error("sendEposterEmail error:", error);
    throw error;
  }
};

export default sendEposterEmail;
