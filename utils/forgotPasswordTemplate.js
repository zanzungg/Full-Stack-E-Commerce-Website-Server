const ForgotPasswordTemplate = (username, otp) => {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>Password Reset Request</title>
        <!--[if mso]>
        <style type="text/css">
            body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
        </style>
        <![endif]-->
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
            <tr>
                <td style="padding: 40px 20px;">
                    <!-- Main Container -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
                                <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">
                                    🔐 Password Reset Request
                                </h1>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px 30px;">
                                <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
                                    Hello <strong style="color: #f5576c;">${username}</strong>,
                                </p>
                                
                                <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #666666;">
                                    We received a request to reset the password for your <strong>E-Commerce App</strong> account. Use the verification code below to proceed with resetting your password:
                                </p>
                                
                                <!-- OTP Box -->
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                    <tr>
                                        <td style="padding: 30px; background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%); border-radius: 8px; text-align: center; border: 3px dashed #f5576c;">
                                            <p style="margin: 0 0 10px; font-size: 14px; color: #666666; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                                                Your Reset Code
                                            </p>
                                            <p style="margin: 0; font-size: 40px; font-weight: 700; color: #f5576c; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                                                ${otp}
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                                
                                <!-- Timer Info -->
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 30px;">
                                    <tr>
                                        <td style="padding: 20px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                                            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #856404;">
                                                <strong>⏰ Time Sensitive:</strong> This code will expire in <strong>10 minutes</strong>. Complete your password reset promptly.
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                                
                                <!-- Security Warning -->
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 20px;">
                                    <tr>
                                        <td style="padding: 20px; background-color: #f8d7da; border-left: 4px solid #dc3545; border-radius: 4px;">
                                            <p style="margin: 0 0 10px; font-size: 14px; line-height: 1.6; color: #721c24;">
                                                <strong>⚠️ Security Alert:</strong>
                                            </p>
                                            <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6; color: #721c24;">
                                                <li>Never share this code with anyone</li>
                                                <li>Our team will never ask for your reset code</li>
                                                <li>If you didn't request this, <strong>secure your account immediately</strong></li>
                                            </ul>
                                        </td>
                                    </tr>
                                </table>
                                
                                <!-- Action Box -->
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 30px;">
                                    <tr>
                                        <td style="padding: 20px; background-color: #d1ecf1; border-left: 4px solid #0c5460; border-radius: 4px;">
                                            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #0c5460;">
                                                <strong>📱 Didn't request this?</strong><br/>
                                                If you didn't initiate this password reset, please:
                                            </p>
                                            <ol style="margin: 10px 0 0; padding-left: 20px; font-size: 14px; line-height: 1.6; color: #0c5460;">
                                                <li>Ignore this email</li>
                                                <li>Change your password immediately</li>
                                                <li>Contact support at <a href="mailto:support@ecommerce.com" style="color: #0c5460; font-weight: 600;">support@ecommerce.com</a></li>
                                            </ol>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="padding: 30px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
                                <p style="margin: 0 0 10px; font-size: 14px; color: #666666;">
                                    Stay secure,<br/>
                                    <strong style="color: #f5576c;">E-Commerce App Security Team</strong>
                                </p>
                                
                                <div style="margin: 20px 0; padding-top: 20px; border-top: 1px solid #dee2e6;">
                                    <p style="margin: 0 0 10px; font-size: 12px; color: #999999;">
                                        Questions? Contact us at 
                                        <a href="mailto:support@ecommerce.com" style="color: #f5576c; text-decoration: none;">support@ecommerce.com</a>
                                    </p>
                                    <p style="margin: 0; font-size: 11px; color: #adb5bd;">
                                        &copy; ${new Date().getFullYear()} E-Commerce App. All rights reserved.
                                    </p>
                                </div>
                            </td>
                        </tr>
                        
                    </table>
                    
                    <!-- Extra Info -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 20px auto 0;">
                        <tr>
                            <td style="text-align: center; padding: 0 20px;">
                                <p style="margin: 0; font-size: 11px; line-height: 1.6; color: #999999;">
                                    This is an automated message. Please do not reply to this email.<br/>
                                    For assistance, visit our <a href="#" style="color: #f5576c; text-decoration: none;">Help Center</a>
                                </p>
                            </td>
                        </tr>
                    </table>
                    
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
}

export default ForgotPasswordTemplate;