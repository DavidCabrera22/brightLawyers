const nodemailer = require('nodemailer');

// Configure transporter
// In production, use environment variables for SMTP settings
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const sendEmail = async (to, subject, html) => {
    // If no credentials, log only (Development mode)
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('---------------------------------------------------');
        console.log('📧 [MOCK EMAIL SERVICE]');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log('Content (preview):', html.substring(0, 100) + '...');
        console.log('---------------------------------------------------');
        return true;
    }

    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"BrightLawyers" <no-reply@brightlawyers.com>',
            to,
            subject,
            html
        });
        console.log(`📧 Email sent: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('❌ Error sending email:', error);
        
        // Helpful tip for Gmail authentication errors
        if (error.responseCode === 535) {
            console.error('\n⚠️  GMAIL AUTHENTICATION TIP:');
            console.error('   If you are using Gmail, you cannot use your regular password.');
            console.error('   1. Enable 2-Step Verification in your Google Account.');
            console.error('   2. Generate an "App Password" (Contraseña de aplicación).');
            console.error('   3. Use that App Password in your .env file as SMTP_PASS.');
            console.error('   Alternatively, remove SMTP_USER/SMTP_PASS from .env to use MOCK mode.\n');
        }
        
        return false;
    }
};

module.exports = {
    sendEmail
};
