import http from 'http';
import nodemailer from 'nodemailer';

// Cấu hình transporter sử dụng Gmail SMTP
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // sử dụng Gmail SMTP
    port: 465, // cổng SMTP cho SSL
    secure: true, // sử dụng SSL kết nối an toàn
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Function to send email
async function sendEmail({ sendTo, subject, text, html }) {
    try {
        const info = await transporter.sendMail({
            from: `"E-Commerce App" <${process.env.EMAIL_USER}>`,
            to: sendTo,
            subject,
            text,
            html
        });
        console.log(`Email sent: ${info.messageId}`);
    } catch (error) {
        console.error(`Error sending email: ${error}`);
        throw error;
    }
}

export default sendEmail;