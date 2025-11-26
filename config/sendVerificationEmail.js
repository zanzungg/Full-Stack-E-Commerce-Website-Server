import sendEmail from "./emailService.js";

const sendVerificationEmail = async ({ sendTo, subject, text, html }) => {
    try {
        await sendEmail({ sendTo, subject, text, html });
        return {
            message: 'Verification email sent successfully',
            error: false,
            success: true
        };
    } catch (error) {
        return {
            message: 'Failed to send verification email',
            error: true,
            success: false
        };
    }
}

export default sendVerificationEmail;