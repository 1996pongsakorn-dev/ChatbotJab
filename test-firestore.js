const { Firestore } = require("@google-cloud/firestore");

const db = new Firestore();

async function test() {
  await db.collection("test").doc("demo").set({
    message: "Hello Firestore",
    createdAt: new Date()
  });

  console.log("✅ Write success");
}

test();