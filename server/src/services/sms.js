/**
 * SMS Service — sends via Twilio if credentials are set,
 * otherwise logs to console (development mode).
 */

let twilioClient;

const getClient = () => {
    if (twilioClient) return twilioClient;
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
        try {
            twilioClient = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
            console.log('✅ Twilio SMS enabled');
        } catch {
            console.warn('⚠️  Twilio package error — SMS will be logged only');
        }
    } else {
        console.warn('⚠️  Twilio credentials not set — SMS will be logged to console');
    }
    return twilioClient;
};

const send = async (to, body) => {
    const client = getClient();
    if (!client) {
        console.log(`📱 [SMS LOG] To: ${to} | Message: ${body}`);
        return;
    }
    await client.messages.create({
        body,
        from: process.env.TWILIO_PHONE_NUMBER,
        to,
    });
};

module.exports = {
    sendTokenConfirmation: (phone, tokenNumber, tokenId) =>
        send(phone, `✅ Your queue token is ${tokenNumber}. Track live at: ${process.env.CLIENT_URL}/token/${tokenId}`),

    sendTokenCalled: (phone, tokenNumber) =>
        send(phone, `🔔 Your turn is coming! Token ${tokenNumber} has been called. Please proceed to the counter.`),

    sendPenalty: (phone, tokenNumber, newPosition) =>
        send(phone, `⚠️ Token ${tokenNumber} missed the call and was moved back to position #${newPosition}. Please be ready.`),

    sendNoShow: (phone, tokenNumber) =>
        send(phone, `❌ Token ${tokenNumber} has been marked as no-show. Please contact the clinic desk if you are present.`),

    sendAppointmentReminder: (phone, tokenNumber, time) =>
        send(phone, `⏰ Reminder: Your appointment (${tokenNumber}) is at ${time}. Please check in 10 minutes before.`),
};
