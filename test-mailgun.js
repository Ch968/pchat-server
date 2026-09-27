import FormData from "form-data"; // form-data v4.0.1
import Mailgun from "mailgun.js"; // mailgun.js v11.1.0

async function sendSimpleMessage() {
  const mailgun = new Mailgun(FormData);
  const mg = mailgun.client({
    username: "api",
    key: process.env.MAILGUN_API_KEY || "mg.fafcc20414a5d5017375fb3f332a071a",
    // When you have an EU-domain, you must specify the endpoint:
    // url: "https://api.eu.mailgun.net"
  });
  try {
    const data = await mg.messages.create("sandbox86ab54bae0c74259839870d21a6f5c9e.mailgun.org", {
      from: "Mailgun Sandbox <postmaster@sandbox86ab54bae0c74259839870d21a6f5c9e.mailgun.org>",
      to: ["Nnaya Christian <cnnaya500@gmail.com>"],
      subject: "Hello Nnaya Christian",
      text: "Congratulations Nnaya Christian, you just sent an email with Mailgun! You are truly awesome!",
    });

    console.log(data); // logs response data
  } catch (error) {
    console.log(error); //logs any error
  }
}
sendSimpleMessage();