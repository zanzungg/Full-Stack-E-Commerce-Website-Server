const VerificationEmailTemplate = (username, otp) => {
    return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="color: #333;">Hello, ${username}!</h2>
        <p>Thank you for registering on our E-Commerce platform. To complete your registration, please use the following One-Time Password (OTP) to verify your email address:</p>
        <h3 style="color: #007BFF;">${otp}</h3>
        <p>This OTP is valid for the next 10 minutes. Please do not share this code with anyone.</p>
        <p>If you did not initiate this request, please ignore this email.</p>
        <br/>
        <p>Best regards,<br/>E-Commerce App Team</p>
    </div>
    `;
}

export default VerificationEmailTemplate;