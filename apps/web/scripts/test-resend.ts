import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

async function main() {
  const { data, error } = await resend.emails.send({
    from: process.env.MAIL_FROM!,
    to: ["iranpour.armin.ca@gmail.com"], // replace with your email
    subject: "CNaghsh Resend Test",
    html: `
      <h2>✅ Resend is working</h2>
      <p>Your CNaghsh deployment can send emails successfully.</p>
    `,
  });

  if (error) {
    console.error(error);
    process.exit(1);
  }

  console.log("Success!");
  console.log(data);
}

main();