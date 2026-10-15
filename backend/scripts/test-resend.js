import 'dotenv/config';

async function main() {
  try {
    const { sendEmail } = await import('../services/email/emailService.js');
    const result = await sendEmail({
      to: 'delivered@resend.dev',
      subject: 'Meow Resend Test',
      html: `
        <h2>Meow email service is working ✅</h2>
        <p>This email was sent through the Azure backend using Resend.</p>
      `,
      text: 'Meow email service is working.',
    });

    console.log('Email sent successfully:');
    console.log(result);
  } catch (error) {
    console.error('Email test failed:');
    console.error(error.message);
    process.exitCode = 1;
  }
}

await main();
