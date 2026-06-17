const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, text, html }) => {
  try {
    // 1. Create a transporter configuration using your email service providers
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // Your email address
        pass: process.env.EMAIL_PASS  // Your App Password
      }
    });

    // 2. Setup email options
    const mailOptions = {
      from: `"Ahaar Platform" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html
    };

    // 3. Send the email
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email successfully sent to ${to}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`Email sending failed: ${error.message}`);
    throw new Error('Email delivery failed');
  }
};

module.exports = sendEmail;